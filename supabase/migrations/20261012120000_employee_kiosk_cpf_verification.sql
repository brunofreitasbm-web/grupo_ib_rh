-- Autogestão de biometria no quiosque CLT: o CPF passa a ser verificado no servidor.
-- Antes o tablet comparava o CPF digitado com selectedEmployee.cpf, mas get_employee_kiosk_roster
-- não devolve CPF (e não deve), então a comparação nunca batia ("CPF não coincide").
-- A gravação direta em employees também era barrada pelo RLS (quiosque não tem policy de UPDATE).

create table if not exists public.employee_cpf_attempts (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  failed_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);
alter table public.employee_cpf_attempts enable row level security;
revoke all on table public.employee_cpf_attempts from anon, authenticated;

-- true/false; bloqueia 15 min após 5 erros em 15 min. Só quiosque da unidade ou supervisor.
create or replace function public.verify_employee_cpf(p_employee_id uuid, p_cpf text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_in text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_db text;
  v_unit text;
  v_lock timestamptz;
  v_new_count integer;
begin
  select regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), unit_id into v_db, v_unit
  from public.employees
  where id = p_employee_id
    and status in ('ativo', 'aviso_previo')
    and registration_status = 'validated';

  if v_unit is null
     or not (public.jwt_is_employee_kiosk_for_unit(v_unit) or public.jwt_is_supervisor_for_unit(v_unit)) then
    raise exception 'not authorized';
  end if;

  select locked_until into v_lock from public.employee_cpf_attempts where employee_id = p_employee_id;
  if v_lock is not null and v_lock > now() then
    raise exception 'Muitas tentativas de CPF. Aguarde alguns minutos para tentar novamente.' using errcode = 'P0001';
  end if;

  if length(v_in) = 11 and v_db = v_in then
    delete from public.employee_cpf_attempts where employee_id = p_employee_id;
    return true;
  end if;

  insert into public.employee_cpf_attempts as a (employee_id, failed_count, window_started_at)
  values (p_employee_id, 1, now())
  on conflict (employee_id) do update
    set failed_count = case when a.window_started_at < now() - interval '15 minutes' then 1 else a.failed_count + 1 end,
        window_started_at = case when a.window_started_at < now() - interval '15 minutes' then now() else a.window_started_at end
  returning failed_count into v_new_count;

  if v_new_count >= 5 then
    update public.employee_cpf_attempts set locked_until = now() + interval '15 minutes' where employee_id = p_employee_id;
  end if;
  return false;
end;
$$;
revoke all on function public.verify_employee_cpf(uuid, text) from public, anon;
grant execute on function public.verify_employee_cpf(uuid, text) to authenticated;

-- Grava a biometria (e o consentimento) só se o CPF conferir. Em CPF errado devolve false.
create or replace function public.save_employee_autogestao_biometria(
  p_employee_id uuid,
  p_face_descriptor text,
  p_cpf text,
  p_consent_version text default '1.0'
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_face_descriptor is null or p_face_descriptor in ('', '[]') then
    raise exception 'Biometria inválida';
  end if;

  if not public.verify_employee_cpf(p_employee_id, p_cpf) then
    return false;
  end if;

  update public.employees
     set face_descriptor = p_face_descriptor,
         biometric_consent_at = now(),
         biometric_consent_version = coalesce(p_consent_version, '1.0')
   where id = p_employee_id;
  return true;
end;
$$;
revoke all on function public.save_employee_autogestao_biometria(uuid, text, text, text) from public, anon;
grant execute on function public.save_employee_autogestao_biometria(uuid, text, text, text) to authenticated;
