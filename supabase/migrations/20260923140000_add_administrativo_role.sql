-- =========================================================================
-- BANCO DE TALENTOS & EQUIPE — NOVAL FUNÇÃO: ADMINISTRATIVO
-- Data: 2026-09-23
-- =========================================================================
-- Adiciona 'administrativo' como role_id válido na simulação por unidade
-- (talent_basket_assignments) e no cadastro de colaboradores (interns,
-- professionals, employees).
-- =========================================================================

-- 1. Atualizar CHECK em talent_basket_assignments
ALTER TABLE public.talent_basket_assignments
  DROP CONSTRAINT IF EXISTS talent_basket_role_chk;

ALTER TABLE public.talent_basket_assignments
  ADD CONSTRAINT talent_basket_role_chk CHECK (
    role_id IN ('operador_recepcao', 'profissional_pj', 'estagiario', 'administrativo')
  );

-- 2. Atualizar CHECK em interns
ALTER TABLE public.interns
  DROP CONSTRAINT IF EXISTS interns_role_id_check;

ALTER TABLE public.interns
  ADD CONSTRAINT interns_role_id_check CHECK (
    role_id IS NULL OR role_id IN ('operador_recepcao', 'profissional_pj', 'estagiario', 'administrativo')
  );

-- 3. Atualizar CHECK em professionals
ALTER TABLE public.professionals
  DROP CONSTRAINT IF EXISTS professionals_role_id_check;

ALTER TABLE public.professionals
  ADD CONSTRAINT professionals_role_id_check CHECK (
    role_id IS NULL OR role_id IN ('operador_recepcao', 'profissional_pj', 'estagiario', 'administrativo')
  );

-- 4. Atualizar CHECK em employees
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_role_id_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_role_id_check CHECK (
    role_id IS NULL OR role_id IN ('operador_recepcao', 'profissional_pj', 'estagiario', 'administrativo')
  );
