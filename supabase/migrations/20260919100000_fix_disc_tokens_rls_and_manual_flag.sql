-- Migração: Correção das políticas de RLS das tabelas de tokens do DISC
-- e suporte a marcação manual de envio para gestores (autenticados).

-- 1. talent_disc_tokens
DROP POLICY IF EXISTS talent_disc_tokens_select ON public.talent_disc_tokens;
CREATE POLICY talent_disc_tokens_select ON public.talent_disc_tokens
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS talent_disc_tokens_insert ON public.talent_disc_tokens;
CREATE POLICY talent_disc_tokens_insert ON public.talent_disc_tokens
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS talent_disc_tokens_update ON public.talent_disc_tokens;
CREATE POLICY talent_disc_tokens_update ON public.talent_disc_tokens
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 2. staff_disc_tokens
DROP POLICY IF EXISTS staff_disc_tokens_select ON public.staff_disc_tokens;
CREATE POLICY staff_disc_tokens_select ON public.staff_disc_tokens
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS staff_disc_tokens_insert ON public.staff_disc_tokens;
CREATE POLICY staff_disc_tokens_insert ON public.staff_disc_tokens
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS staff_disc_tokens_update ON public.staff_disc_tokens;
CREATE POLICY staff_disc_tokens_update ON public.staff_disc_tokens
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
