-- Função de consulta mínima para o cadastro público: devolve só true/false.
-- Substitui a consulta anônima direta a public.interns (que devolvia o nome do dono do CPF).
create or replace function public.intern_cpf_exists(p_cpf text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.interns i
    where length(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')) = 11
      and regexp_replace(coalesce(i.cpf, ''), '\D', '', 'g')
        = regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')
  );
$$;

revoke all on function public.intern_cpf_exists(text) from public;
grant execute on function public.intern_cpf_exists(text) to anon, authenticated, service_role;

comment on function public.intern_cpf_exists(text) is
  'Devolve apenas true/false para checar CPF duplicado no cadastro público. Não expõe nome nem outros campos.';
