-- talent_disc_tokens / staff_disc_tokens tinham RLS ligado e NENHUMA política:
-- o SELECT do front voltava vazio (o status "Enviado" nunca aparecia) e o
-- upsert de "marcar como enviado manualmente" levava 403.
--
-- As migrações 20260919100000 e 20260919110000 "resolviam" liberando tudo
-- (USING true) também para o papel anon — qualquer um com a anon key, que é
-- pública no bundle, poderia ler, forjar e apagar tokens. Essa liberação era
-- um contorno para o JWT expirado (a sessão vencida caía em anon); o cliente
-- agora renova a sessão sozinho (src/utils/authFetch.js), então não é mais
-- necessária. Esta migração fica DEPOIS daquelas e remove o acesso anon,
-- deixando só supervisores. A escrita real dos tokens continua na Edge
-- Function (service role), que ignora RLS.

DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOREACH t IN ARRAY ARRAY['talent_disc_tokens', 'staff_disc_tokens'] LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol, t);
    END LOOP;

    EXECUTE format(
      $p$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor')
         WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor')$p$,
      t || '_supervisor_all', t
    );
  END LOOP;
END $$;
