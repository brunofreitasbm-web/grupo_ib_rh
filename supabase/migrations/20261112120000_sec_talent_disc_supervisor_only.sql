-- Segurança (auditoria 2026-11-10): as tabelas de talentos e DISC estavam com
-- policies `to authenticated using (true)`. Como a senha das contas de quiosque
-- (*_unit) está no bundle do frontend e o banco é compartilhado com a Clínica,
-- "qualquer autenticado" equivalia a público: dava para ler nome, e-mail,
-- telefone e respostas de DISC de candidatos e de funcionários, e alterar as
-- anotações do banco de talentos.
--
-- Passam a valer só para supervisor (claim protegido app_metadata.role), o mesmo
-- critério já usado em talent_disc_tokens/staff_disc_tokens. As telas que usam
-- estas tabelas (Banco de Talentos, Profissionais, Estagiários, Funcionários)
-- são todas de supervisor; o DISC público grava por RPC SECURITY DEFINER.
--
-- ROLLBACK: recriar cada policy abaixo trocando a expressão por `true`.

do $$
declare
  v_sup constant text := $q$((((select auth.jwt()) -> 'app_metadata') ->> 'role') = 'supervisor')$q$;
  r record;
begin
  for r in
    select tablename, policyname, cmd
      from pg_policies
     where schemaname = 'public'
       and tablename in (
         'talent_candidates_meta', 'talent_disc_assessments', 'staff_disc_assessments',
         'talent_basket_assignments', 'talent_candidate_aliases', 'talent_purged_candidates'
       )
       and (qual = 'true' or with_check = 'true')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    if r.cmd = 'SELECT' or r.cmd = 'DELETE' then
      execute format('create policy %I on public.%I for %s to authenticated using (%s)',
                     r.policyname, r.tablename, r.cmd, v_sup);
    elsif r.cmd = 'INSERT' then
      execute format('create policy %I on public.%I for insert to authenticated with check (%s)',
                     r.policyname, r.tablename, v_sup);
    else -- UPDATE / ALL
      execute format('create policy %I on public.%I for %s to authenticated using (%s) with check (%s)',
                     r.policyname, r.tablename, r.cmd, v_sup, v_sup);
    end if;
  end loop;
end $$;

revoke all on public.talent_candidates_meta, public.talent_disc_assessments,
              public.staff_disc_assessments, public.talent_basket_assignments,
              public.talent_candidate_aliases, public.talent_purged_candidates
  from anon;
