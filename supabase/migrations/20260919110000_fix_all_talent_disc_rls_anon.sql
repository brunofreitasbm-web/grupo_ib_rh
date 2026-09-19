-- Migração: Garantir que o acesso RLS às tabelas de overlay do Banco de Talentos
-- e tokens do DISC permita tanto o papel 'authenticated' quanto 'anon' (gestores sem JWT ativo no frontend).

-- 1. talent_disc_tokens
DROP POLICY IF EXISTS talent_disc_tokens_select ON public.talent_disc_tokens;
CREATE POLICY talent_disc_tokens_select ON public.talent_disc_tokens
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS talent_disc_tokens_insert ON public.talent_disc_tokens;
CREATE POLICY talent_disc_tokens_insert ON public.talent_disc_tokens
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS talent_disc_tokens_update ON public.talent_disc_tokens;
CREATE POLICY talent_disc_tokens_update ON public.talent_disc_tokens
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS talent_disc_tokens_delete ON public.talent_disc_tokens;
CREATE POLICY talent_disc_tokens_delete ON public.talent_disc_tokens
  FOR DELETE TO anon, authenticated USING (true);

-- 2. staff_disc_tokens
DROP POLICY IF EXISTS staff_disc_tokens_select ON public.staff_disc_tokens;
CREATE POLICY staff_disc_tokens_select ON public.staff_disc_tokens
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS staff_disc_tokens_insert ON public.staff_disc_tokens;
CREATE POLICY staff_disc_tokens_insert ON public.staff_disc_tokens
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS staff_disc_tokens_update ON public.staff_disc_tokens;
CREATE POLICY staff_disc_tokens_update ON public.staff_disc_tokens
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS staff_disc_tokens_delete ON public.staff_disc_tokens;
CREATE POLICY staff_disc_tokens_delete ON public.staff_disc_tokens
  FOR DELETE TO anon, authenticated USING (true);

-- 3. talent_candidates_meta
DROP POLICY IF EXISTS talent_meta_select ON public.talent_candidates_meta;
CREATE POLICY talent_meta_select ON public.talent_candidates_meta
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS talent_meta_insert ON public.talent_candidates_meta;
CREATE POLICY talent_meta_insert ON public.talent_candidates_meta
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS talent_meta_update ON public.talent_candidates_meta;
CREATE POLICY talent_meta_update ON public.talent_candidates_meta
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS talent_meta_delete ON public.talent_candidates_meta;
CREATE POLICY talent_meta_delete ON public.talent_candidates_meta
  FOR DELETE TO anon, authenticated USING (true);

-- 4. talent_disc_assessments
DROP POLICY IF EXISTS talent_disc_select ON public.talent_disc_assessments;
CREATE POLICY talent_disc_select ON public.talent_disc_assessments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS talent_disc_insert ON public.talent_disc_assessments;
CREATE POLICY talent_disc_insert ON public.talent_disc_assessments
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS talent_disc_update ON public.talent_disc_assessments;
CREATE POLICY talent_disc_update ON public.talent_disc_assessments
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. staff_disc_assessments
DROP POLICY IF EXISTS staff_disc_select ON public.staff_disc_assessments;
CREATE POLICY staff_disc_select ON public.staff_disc_assessments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS staff_disc_insert ON public.staff_disc_assessments;
CREATE POLICY staff_disc_insert ON public.staff_disc_assessments
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS staff_disc_update ON public.staff_disc_assessments;
CREATE POLICY staff_disc_update ON public.staff_disc_assessments
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. talent_basket_assignments
DROP POLICY IF EXISTS talent_basket_select ON public.talent_basket_assignments;
CREATE POLICY talent_basket_select ON public.talent_basket_assignments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS talent_basket_insert ON public.talent_basket_assignments;
CREATE POLICY talent_basket_insert ON public.talent_basket_assignments
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS talent_basket_update ON public.talent_basket_assignments;
CREATE POLICY talent_basket_update ON public.talent_basket_assignments
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS talent_basket_delete ON public.talent_basket_assignments;
CREATE POLICY talent_basket_delete ON public.talent_basket_assignments
  FOR DELETE TO anon, authenticated USING (true);
