-- Fecha o acesso anônimo direto à tabela interns (LGPD).
-- A tela pública usa get_public_interns (SECURITY DEFINER) e o cadastro público usa
-- intern_cpf_exists, então nenhum dos dois depende desta política nem dos privilégios do anon.
drop policy if exists "Permitir leitura pública de estagiários ativos" on public.interns;
revoke all on table public.interns from anon;

-- Reversão, se necessário:
-- create policy "Permitir leitura pública de estagiários ativos" on public.interns
--   for select to anon, authenticated using (active = true);
-- grant select on table public.interns to anon;
