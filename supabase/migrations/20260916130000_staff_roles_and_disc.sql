-- =========================================================================
-- SIMULAÇÃO POR UNIDADE — FUNÇÃO INTERNA + DISC DA EQUIPE JÁ CONTRATADA
-- Data: 2026-09-16
-- =========================================================================
-- Até aqui, o Levantamento de Perfil DISC só existia para candidatos do
-- Banco de Talentos (talent_disc_tokens/talent_disc_assessments, candidatos
-- remotos do projeto Faça Amigos). Esta migração estende o mesmo
-- questionário para quem JÁ FOI CONTRATADO (estagiários, profissionais PJ e
-- funcionários CLT), para que os quadrantes da Simulação por Unidade
-- mostrem a equipe atual junto dos candidatos simulados.
--
-- 1) role_id: função esperada (ROLE_PROFILES em src/config/roleProfiles.js)
--    marcada manualmente pelo gestor em cada estagiário/PJ/CLT — não há
--    inferência automática a partir de cargo/profissão em texto livre.
-- 2) staff_disc_tokens / staff_disc_assessments: mesmo padrão de
--    talent_disc_tokens/talent_disc_assessments, mas o sujeito é
--    (subject_type, subject_id) em vez de um candidate_id remoto.
-- 3) get_disc_session / submit_disc_assessment (já existentes) passam a
--    tentar primeiro o caminho de candidato (talent_disc_tokens) e, se o
--    hash do token não bater lá, o caminho de equipe (staff_disc_tokens) —
--    assim a página pública /disc/:token e o front (DiscAssessmentPage.jsx)
--    não precisam saber qual dos dois casos é.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. FUNÇÃO INTERNA (role_id) EM ESTAGIÁRIOS, PJ E CLT
-- -------------------------------------------------------------------------

ALTER TABLE public.interns
  ADD COLUMN IF NOT EXISTS role_id text
    CHECK (role_id IS NULL OR role_id IN ('operador_recepcao', 'profissional_pj', 'estagiario'));
COMMENT ON COLUMN public.interns.role_id IS
  'Função esperada na Simulação por Unidade do Banco de Talentos (ROLE_PROFILES em src/config/roleProfiles.js). Marcação manual do gestor.';

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS role_id text
    CHECK (role_id IS NULL OR role_id IN ('operador_recepcao', 'profissional_pj', 'estagiario'));
COMMENT ON COLUMN public.professionals.role_id IS
  'Função esperada na Simulação por Unidade do Banco de Talentos (ROLE_PROFILES em src/config/roleProfiles.js). Marcação manual do gestor.';

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS role_id text
    CHECK (role_id IS NULL OR role_id IN ('operador_recepcao', 'profissional_pj', 'estagiario'));
COMMENT ON COLUMN public.employees.role_id IS
  'Função esperada na Simulação por Unidade do Banco de Talentos (ROLE_PROFILES em src/config/roleProfiles.js). Marcação manual do gestor.';

CREATE INDEX IF NOT EXISTS idx_interns_role ON public.interns (unit_id, role_id) WHERE role_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_professionals_role ON public.professionals (unit_id, role_id) WHERE role_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees (unit_id, role_id) WHERE role_id IS NOT NULL;

-- -------------------------------------------------------------------------
-- 2. TABELAS DE DISC PARA QUEM JÁ FOI CONTRATADO
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.staff_disc_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('intern', 'professional', 'employee')),
  subject_id uuid NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_to text,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  first_opened_at timestamptz,
  UNIQUE (subject_type, subject_id)
);

COMMENT ON TABLE public.staff_disc_tokens IS
  'Link temporário do Levantamento de Perfil DISC para quem já foi contratado (estagiário/PJ/CLT). Guarda apenas o hash SHA-256 (hex) do token. Mesmo padrão de talent_disc_tokens.';

ALTER TABLE public.staff_disc_tokens ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy: inacessível pela API além das RPCs SECURITY DEFINER abaixo.
-- Gestores (authenticated) só enxergam metadados de envio via a Edge Function
-- send-staff-disc-assessment (service role) — não há SELECT direto aqui.

CREATE TABLE IF NOT EXISTS public.staff_disc_assessments (
  subject_type text NOT NULL CHECK (subject_type IN ('intern', 'professional', 'employee')),
  subject_id uuid NOT NULL,
  workspace_id text NOT NULL DEFAULT 'grupoib',
  answers jsonb NOT NULL,
  scores jsonb NOT NULL,
  primary_profile text NOT NULL CHECK (primary_profile IN ('D', 'I', 'S', 'C')),
  secondary_profile text CHECK (secondary_profile IS NULL OR secondary_profile IN ('D', 'I', 'S', 'C')),
  duration_seconds integer,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_type, subject_id)
);

COMMENT ON TABLE public.staff_disc_assessments IS
  'Resultado do Levantamento de Perfil DISC de quem já foi contratado. Usado para desenhar os quadradinhos fixos da equipe na Simulação por Unidade.';

CREATE INDEX IF NOT EXISTS idx_staff_disc_workspace ON public.staff_disc_assessments (workspace_id);

ALTER TABLE public.staff_disc_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_disc_select ON public.staff_disc_assessments;
CREATE POLICY staff_disc_select ON public.staff_disc_assessments
  FOR SELECT TO authenticated USING (true);
-- Escrita só pela RPC SECURITY DEFINER submit_disc_assessment.

-- -------------------------------------------------------------------------
-- 3. get_disc_session / submit_disc_assessment PASSAM A ATENDER OS DOIS
--    NAMESPACES DE TOKEN (candidato remoto OU equipe já contratada).
--    O front (DiscAssessmentPage.jsx) e a rota pública /disc/:token não
--    mudam — o token em si (só o hash é comparado) decide o caminho.
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_disc_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_row public.talent_disc_tokens%ROWTYPE;
  v_meta public.talent_candidates_meta%ROWTYPE;
  v_staff public.staff_disc_tokens%ROWTYPE;
  v_staff_name text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  -- Caminho 1: candidato do Banco de Talentos (comportamento original).
  SELECT * INTO v_row FROM public.talent_disc_tokens WHERE token_hash = v_hash FOR UPDATE;
  IF FOUND THEN
    IF v_row.attempts >= 20 THEN
      RAISE EXCEPTION 'invalid_token';
    END IF;

    UPDATE public.talent_disc_tokens
    SET attempts = attempts + 1,
        first_opened_at = COALESCE(first_opened_at, now())
    WHERE candidate_id = v_row.candidate_id;

    IF v_row.consumed_at IS NOT NULL THEN
      RAISE EXCEPTION 'already_submitted';
    END IF;
    IF v_row.expires_at < now() THEN
      RAISE EXCEPTION 'token_expired';
    END IF;

    SELECT * INTO v_meta FROM public.talent_candidates_meta WHERE candidate_id = v_row.candidate_id;

    RETURN jsonb_build_object(
      'ok', true,
      'candidate_name', COALESCE(v_meta.snapshot ->> 'full_name', 'Candidato'),
      'expires_at', v_row.expires_at
    );
  END IF;

  -- Caminho 2: quem já foi contratado (estagiário/PJ/CLT).
  SELECT * INTO v_staff FROM public.staff_disc_tokens WHERE token_hash = v_hash FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  IF v_staff.attempts >= 20 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  UPDATE public.staff_disc_tokens
  SET attempts = attempts + 1,
      first_opened_at = COALESCE(first_opened_at, now())
  WHERE id = v_staff.id;

  IF v_staff.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_submitted';
  END IF;
  IF v_staff.expires_at < now() THEN
    RAISE EXCEPTION 'token_expired';
  END IF;

  v_staff_name := CASE v_staff.subject_type
    WHEN 'intern' THEN (SELECT name FROM public.interns WHERE id = v_staff.subject_id)
    WHEN 'professional' THEN (SELECT name FROM public.professionals WHERE id = v_staff.subject_id)
    WHEN 'employee' THEN (SELECT name FROM public.employees WHERE id = v_staff.subject_id)
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'candidate_name', COALESCE(v_staff_name, 'Colaborador'),
    'expires_at', v_staff.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_disc_assessment(
  p_token text,
  p_answers jsonb,
  p_scores jsonb,
  p_primary text,
  p_secondary text DEFAULT NULL,
  p_duration integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_row public.talent_disc_tokens%ROWTYPE;
  v_staff public.staff_disc_tokens%ROWTYPE;
  v_workspace text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  IF jsonb_typeof(p_answers) <> 'array' OR jsonb_array_length(p_answers) <> 24 THEN
    RAISE EXCEPTION 'invalid_answers';
  END IF;
  IF p_primary IS NULL OR p_primary NOT IN ('D', 'I', 'S', 'C') THEN
    RAISE EXCEPTION 'invalid_answers';
  END IF;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  -- Caminho 1: candidato do Banco de Talentos (comportamento original).
  SELECT * INTO v_row FROM public.talent_disc_tokens WHERE token_hash = v_hash FOR UPDATE;
  IF FOUND THEN
    IF v_row.consumed_at IS NOT NULL THEN
      RAISE EXCEPTION 'already_submitted';
    END IF;
    IF v_row.expires_at < now() THEN
      RAISE EXCEPTION 'token_expired';
    END IF;

    SELECT workspace_id INTO v_workspace FROM public.talent_candidates_meta WHERE candidate_id = v_row.candidate_id;

    INSERT INTO public.talent_disc_assessments AS a (
      candidate_id, workspace_id, answers, scores,
      primary_profile, secondary_profile, duration_seconds, completed_at
    ) VALUES (
      v_row.candidate_id, COALESCE(v_workspace, 'grupoib'), p_answers, p_scores,
      p_primary, NULLIF(p_secondary, ''), p_duration, now()
    )
    ON CONFLICT (candidate_id) DO UPDATE SET
      answers = EXCLUDED.answers,
      scores = EXCLUDED.scores,
      primary_profile = EXCLUDED.primary_profile,
      secondary_profile = EXCLUDED.secondary_profile,
      duration_seconds = EXCLUDED.duration_seconds,
      completed_at = EXCLUDED.completed_at;

    UPDATE public.talent_disc_tokens SET consumed_at = now() WHERE candidate_id = v_row.candidate_id;

    RETURN jsonb_build_object('ok', true);
  END IF;

  -- Caminho 2: quem já foi contratado (estagiário/PJ/CLT).
  SELECT * INTO v_staff FROM public.staff_disc_tokens WHERE token_hash = v_hash FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  IF v_staff.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_submitted';
  END IF;
  IF v_staff.expires_at < now() THEN
    RAISE EXCEPTION 'token_expired';
  END IF;

  INSERT INTO public.staff_disc_assessments AS a (
    subject_type, subject_id, workspace_id, answers, scores,
    primary_profile, secondary_profile, duration_seconds, completed_at
  ) VALUES (
    v_staff.subject_type, v_staff.subject_id, 'grupoib', p_answers, p_scores,
    p_primary, NULLIF(p_secondary, ''), p_duration, now()
  )
  ON CONFLICT (subject_type, subject_id) DO UPDATE SET
    answers = EXCLUDED.answers,
    scores = EXCLUDED.scores,
    primary_profile = EXCLUDED.primary_profile,
    secondary_profile = EXCLUDED.secondary_profile,
    duration_seconds = EXCLUDED.duration_seconds,
    completed_at = EXCLUDED.completed_at;

  UPDATE public.staff_disc_tokens SET consumed_at = now() WHERE id = v_staff.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_disc_session(text) FROM public;
REVOKE ALL ON FUNCTION public.submit_disc_assessment(text, jsonb, jsonb, text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_disc_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_disc_assessment(text, jsonb, jsonb, text, text, integer) TO anon, authenticated;
