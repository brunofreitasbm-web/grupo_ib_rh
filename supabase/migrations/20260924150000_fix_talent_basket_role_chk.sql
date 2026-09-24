-- =========================================================================
-- BANCO DE TALENTOS — REMOVER RESTRIÇÃO RÍGIDA DE ROLES NA SIMULAÇÃO
-- Data: 2026-09-24
-- =========================================================================
-- Remove o CHECK constraint talent_basket_role_chk para permitir que novas
-- funções configuradas no frontend (como 'administrativo' e futuras) sejam
-- salvas na simulação por unidade sem erros de constraint no PostgreSQL.
-- =========================================================================

-- 1. Remover a restrição rígida em talent_basket_assignments
ALTER TABLE public.talent_basket_assignments
  DROP CONSTRAINT IF EXISTS talent_basket_role_chk;

-- 2. Atualizar CHECK em interns (se a constraint existir)
ALTER TABLE public.interns
  DROP CONSTRAINT IF EXISTS interns_role_id_check;

-- 3. Atualizar CHECK em professionals (se a constraint existir)
ALTER TABLE public.professionals
  DROP CONSTRAINT IF EXISTS professionals_role_id_check;

-- 4. Atualizar CHECK em employees (se a constraint existir)
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_role_id_check;
