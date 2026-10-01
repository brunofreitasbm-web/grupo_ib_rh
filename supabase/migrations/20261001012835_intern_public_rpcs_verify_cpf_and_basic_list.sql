-- Substitui a entrega de CPF e assinatura facial ao anônimo por verificação no servidor, com limite de tentativas.
-- Aditivo: get_public_interns continua existindo até o app migrar.

-- 1) Controle de tentativas de CPF por estagiário (só funções SECURITY DEFINER acessam).
create table if not exists public.intern_cpf_attempts (
  intern_id uuid primary key references public.interns(id) on delete cascade,
  failed_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);
alter table public.intern_cpf_attempts enable row level security;
revoke all on table public.intern_cpf_attempts from anon, authenticated;

-- 2) Verificação de CPF no servidor: true/false, bloqueia 15 min após 5 erros em 15 min.
create or replace function public.verify_intern_cpf(p_intern_id uuid, p_cpf text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_in text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_db text;
  v_lock timestamptz;
  v_new_count integer;
begin
  select regexp_replace(coalesce(cpf, ''), '\D', '', 'g') into v_db
  from public.interns where id = p_intern_id and active = true;
  if v_db is null then
    return false;
  end if;

  select locked_until into v_lock from public.intern_cpf_attempts where intern_id = p_intern_id;
  if v_lock is not null and v_lock > now() then
    raise exception 'Muitas tentativas de CPF. Aguarde alguns minutos para tentar novamente.' using errcode = 'P0001';
  end if;

  if length(v_in) = 11 and v_db = v_in then
    delete from public.intern_cpf_attempts where intern_id = p_intern_id;
    return true;
  end if;

  insert into public.intern_cpf_attempts as a (intern_id, failed_count, window_started_at)
  values (p_intern_id, 1, now())
  on conflict (intern_id) do update
    set failed_count = case when a.window_started_at < now() - interval '15 minutes' then 1 else a.failed_count + 1 end,
        window_started_at = case when a.window_started_at < now() - interval '15 minutes' then now() else a.window_started_at end
  returning failed_count into v_new_count;

  if v_new_count >= 5 then
    update public.intern_cpf_attempts set locked_until = now() + interval '15 minutes' where intern_id = p_intern_id;
  end if;
  return false;
end;
$$;
revoke all on function public.verify_intern_cpf(uuid, text) from public;
grant execute on function public.verify_intern_cpf(uuid, text) to anon, authenticated, service_role;

-- 3) Lista pública sem CPF e sem assinatura facial: só um indicador de "já tem biometria".
create or replace function public.get_public_interns_basic(p_workspace_unit_ids text[] default null)
returns table (id uuid, name text, unit_id text, active boolean, has_biometria boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select i.id, i.name, i.unit_id, i.active,
         (i.face_descriptor is not null and i.face_descriptor <> '' and i.face_descriptor <> '[]') as has_biometria
  from public.interns i
  where i.active = true
    and (p_workspace_unit_ids is null or i.unit_id = any(p_workspace_unit_ids))
  order by i.name asc;
end;
$$;
revoke all on function public.get_public_interns_basic(text[]) from public;
grant execute on function public.get_public_interns_basic(text[]) to anon, authenticated, service_role;

-- 4) Gravação da biometria passa a usar a verificação com limite de tentativas.
--    Em CPF errado devolve false (e não exceção) para que a contagem de erros seja gravada.
create or replace function public.save_intern_autogestao_biometria(p_intern_id uuid, p_face_descriptor text, p_cpf text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.interns where id = p_intern_id and active = true) then
    raise exception 'Estagiário não encontrado ou inativo';
  end if;

  if not public.verify_intern_cpf(p_intern_id, p_cpf) then
    return false;
  end if;

  update public.interns set face_descriptor = p_face_descriptor where id = p_intern_id;
  return true;
end;
$$;
revoke all on function public.save_intern_autogestao_biometria(uuid, text, text) from public;
grant execute on function public.save_intern_autogestao_biometria(uuid, text, text) to anon, authenticated, service_role;
