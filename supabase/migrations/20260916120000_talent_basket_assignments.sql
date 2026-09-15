-- =========================================================================
-- BANCO DE TALENTOS — SIMULAÇÃO DE ENCAIXE POR UNIDADE ("baskets")
-- Data: 2026-09-16
-- =========================================================================
-- O gestor arrasta candidatos que já concluíram o Levantamento de Perfil DISC
-- para um quadrante (unidade × função) e vê a compatibilidade com o perfil
-- esperado da função (src/config/roleProfiles.js + src/utils/roleFit.js).
--
-- Esta tabela persiste a simulação para que ela sobreviva ao reload e seja
-- compartilhada entre supervisores. Segue o mesmo padrão overlay de
-- 20260915_talent_bank_overlay_disc.sql: chave = id remoto do candidato,
-- FK para talent_candidates_meta (que já existe para todo candidato com DISC
-- enviado, pois send-disc-assessment faz upsert lá).
--
-- PK em candidate_id: cada candidato ocupa UM único quadrante — mover é upsert.
-- fit_score é denormalizado só para listagens/relatórios; a fonte da verdade
-- é o cálculo no cliente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.talent_basket_assignments (
  candidate_id text PRIMARY KEY
    REFERENCES public.talent_candidates_meta(candidate_id) ON DELETE CASCADE,
  workspace_id text NOT NULL DEFAULT 'grupoib',
  unit_id text NOT NULL,
  role_id text NOT NULL,
  fit_score integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT talent_basket_role_chk CHECK (
    role_id IN ('operador_recepcao', 'profissional_pj', 'estagiario')
  ),
  CONSTRAINT talent_basket_fit_chk CHECK (
    fit_score IS NULL OR (fit_score >= 0 AND fit_score <= 100)
  )
);

COMMENT ON TABLE public.talent_basket_assignments IS
  'Simulação de encaixe do Banco de Talentos: em qual unidade × função o gestor posicionou cada candidato.';
COMMENT ON COLUMN public.talent_basket_assignments.unit_id IS
  'Id da unidade em BRANDING.kioskUnits (ex.: faca-amigos-grao-para, faca-amigos-parque-shopping, clinica-a).';
COMMENT ON COLUMN public.talent_basket_assignments.role_id IS
  'Função esperada (ROLE_PROFILES em src/config/roleProfiles.js).';
COMMENT ON COLUMN public.talent_basket_assignments.fit_score IS
  'Compatibilidade 0–100 calculada no cliente no momento da alocação (denormalizado).';

CREATE INDEX IF NOT EXISTS idx_talent_basket_workspace_unit
  ON public.talent_basket_assignments (workspace_id, unit_id);

-- -------------------------------------------------------------------------
-- RLS — mesmo modelo de talent_candidates_meta: só usuários autenticados
-- (gestores) leem e escrevem; anon nunca toca nesta tabela.
-- -------------------------------------------------------------------------

ALTER TABLE public.talent_basket_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS talent_basket_select ON public.talent_basket_assignments;
CREATE POLICY talent_basket_select ON public.talent_basket_assignments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS talent_basket_insert ON public.talent_basket_assignments;
CREATE POLICY talent_basket_insert ON public.talent_basket_assignments
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS talent_basket_update ON public.talent_basket_assignments;
CREATE POLICY talent_basket_update ON public.talent_basket_assignments
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS talent_basket_delete ON public.talent_basket_assignments;
CREATE POLICY talent_basket_delete ON public.talent_basket_assignments
  FOR DELETE TO authenticated USING (true);
