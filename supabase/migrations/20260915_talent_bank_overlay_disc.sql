-- =========================================================================
-- BANCO DE TALENTOS — CAMADA LOCAL (OVERLAY) + LEVANTAMENTO DE PERFIL DISC
-- Data: 2026-09-15
-- =========================================================================
-- Os candidatos vivem em OUTRO projeto Supabase (Faça Amigos,
-- ivjvpdzsfjdpyabbzzuj, tabela fa_kiosk_job_applications) e são lidos apenas
-- via proxy (edge function fetch-talent-bank). Não há caminho de escrita lá.
--
-- Estas tabelas formam uma camada local indexada pelo id remoto do candidato:
-- status próprio (override), anotações internas do gestor e o resultado do
-- levantamento de perfil DISC. O front faz o merge com os dados remotos.
--
-- O token do questionário segue o mesmo padrão de
-- professional_self_registration_tokens: só o hash SHA-256 é gravado, a tabela
-- tem RLS ligado e NENHUMA policy, e o acesso anônimo acontece exclusivamente
-- pelas RPCs SECURITY DEFINER no fim deste arquivo.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. TABELAS
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.talent_candidates_meta (
  candidate_id text PRIMARY KEY,
  workspace_id text NOT NULL DEFAULT 'grupoib',
  status text,
  notes text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT talent_meta_status_chk CHECK (
    status IS NULL OR status IN
      ('NOVO', 'LIDO', 'ESPERA', 'ENTREVISTA', 'EM_ANALISE', 'CONTATADO', 'ARQUIVADO')
  )
);

COMMENT ON TABLE public.talent_candidates_meta IS
  'Overlay local dos candidatos do Banco de Talentos (fonte remota: fa_kiosk_job_applications).';
COMMENT ON COLUMN public.talent_candidates_meta.status IS
  'Override do status remoto. NULL = usa o status vindo do projeto Faça Amigos.';
COMMENT ON COLUMN public.talent_candidates_meta.snapshot IS
  'Cópia de {full_name, email, phone} no momento da ação — a edge function e as RPCs não alcançam o projeto remoto.';

CREATE TABLE IF NOT EXISTS public.talent_disc_tokens (
  candidate_id text PRIMARY KEY
    REFERENCES public.talent_candidates_meta(candidate_id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_to text,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz
);

COMMENT ON TABLE public.talent_disc_tokens IS
  'Link temporário do questionário DISC. Guarda apenas o hash SHA-256 (hex) do token.';

ALTER TABLE public.talent_disc_tokens ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy: inacessível pela API além das RPCs SECURITY DEFINER abaixo.

CREATE TABLE IF NOT EXISTS public.talent_disc_assessments (
  candidate_id text PRIMARY KEY
    REFERENCES public.talent_candidates_meta(candidate_id) ON DELETE CASCADE,
  workspace_id text NOT NULL DEFAULT 'grupoib',
  answers jsonb NOT NULL,
  scores jsonb NOT NULL,
  primary_profile text NOT NULL,
  secondary_profile text,
  duration_seconds integer,
  completed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT talent_disc_primary_chk CHECK (primary_profile IN ('D', 'I', 'S', 'C')),
  CONSTRAINT talent_disc_secondary_chk CHECK (secondary_profile IS NULL OR secondary_profile IN ('D', 'I', 'S', 'C'))
);

COMMENT ON TABLE public.talent_disc_assessments IS
  'Resultado do levantamento de perfil DISC do candidato. answers guarda as respostas cruas (permite recálculo).';

CREATE INDEX IF NOT EXISTS idx_talent_meta_workspace
  ON public.talent_candidates_meta (workspace_id);
CREATE INDEX IF NOT EXISTS idx_talent_meta_workspace_status
  ON public.talent_candidates_meta (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_talent_disc_workspace
  ON public.talent_disc_assessments (workspace_id);

-- -------------------------------------------------------------------------
-- 2. RLS DAS TABELAS VISÍVEIS AO GESTOR
-- -------------------------------------------------------------------------
-- O candidato anônimo nunca toca nestas tabelas diretamente — só passa pelas
-- RPCs. Usuários autenticados (gestores) leem e escrevem.

ALTER TABLE public.talent_candidates_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_disc_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS talent_meta_select ON public.talent_candidates_meta;
CREATE POLICY talent_meta_select ON public.talent_candidates_meta
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS talent_meta_insert ON public.talent_candidates_meta;
CREATE POLICY talent_meta_insert ON public.talent_candidates_meta
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS talent_meta_update ON public.talent_candidates_meta;
CREATE POLICY talent_meta_update ON public.talent_candidates_meta
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS talent_disc_select ON public.talent_disc_assessments;
CREATE POLICY talent_disc_select ON public.talent_disc_assessments
  FOR SELECT TO authenticated USING (true);

-- Escrita no resultado do DISC acontece só pela RPC SECURITY DEFINER.

-- -------------------------------------------------------------------------
-- 3. RPCs DO LINK TEMPORÁRIO (acessíveis ao candidato anônimo)
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_disc_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public.talent_disc_tokens%ROWTYPE;
  v_meta public.talent_candidates_meta%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  SELECT * INTO v_row
  FROM public.talent_disc_tokens
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  -- Rate limit simples: o link é de uso único, não faz sentido abrir 20 vezes.
  IF v_row.attempts >= 20 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  UPDATE public.talent_disc_tokens
  SET attempts = attempts + 1
  WHERE candidate_id = v_row.candidate_id;

  IF v_row.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_submitted';
  END IF;

  IF v_row.expires_at < now() THEN
    RAISE EXCEPTION 'token_expired';
  END IF;

  SELECT * INTO v_meta
  FROM public.talent_candidates_meta
  WHERE candidate_id = v_row.candidate_id;

  RETURN jsonb_build_object(
    'ok', true,
    'candidate_name', COALESCE(v_meta.snapshot ->> 'full_name', 'Candidato'),
    'expires_at', v_row.expires_at
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
  v_row public.talent_disc_tokens%ROWTYPE;
  v_workspace text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  SELECT * INTO v_row
  FROM public.talent_disc_tokens
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  IF v_row.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_submitted';
  END IF;
  IF v_row.expires_at < now() THEN
    RAISE EXCEPTION 'token_expired';
  END IF;

  IF jsonb_typeof(p_answers) <> 'array' OR jsonb_array_length(p_answers) <> 24 THEN
    RAISE EXCEPTION 'invalid_answers';
  END IF;
  IF p_primary IS NULL OR p_primary NOT IN ('D', 'I', 'S', 'C') THEN
    RAISE EXCEPTION 'invalid_answers';
  END IF;

  SELECT workspace_id INTO v_workspace
  FROM public.talent_candidates_meta
  WHERE candidate_id = v_row.candidate_id;

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

  UPDATE public.talent_disc_tokens
  SET consumed_at = now()
  WHERE candidate_id = v_row.candidate_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_disc_session(text) FROM public;
REVOKE ALL ON FUNCTION public.submit_disc_assessment(text, jsonb, jsonb, text, text, integer) FROM public;

GRANT EXECUTE ON FUNCTION public.get_disc_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_disc_assessment(text, jsonb, jsonb, text, text, integer) TO anon, authenticated;
