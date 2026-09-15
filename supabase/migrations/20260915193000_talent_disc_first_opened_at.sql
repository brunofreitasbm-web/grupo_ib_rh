-- =========================================================================
-- BANCO DE TALENTOS — MARCO DE ABERTURA DO LINK DO DISC (SLA DE 48H)
-- Data: 2026-09-15
-- =========================================================================
-- Requisito: assim que o candidato abre o link do levantamento de perfil,
-- gravar a data/hora dessa primeira abertura e contar 48h a partir dela.
-- Passado o prazo sem o candidato concluir o preenchimento, o gestor precisa
-- ver um sinal de atraso junto ao nome do candidato (calculado no cliente a
-- partir de first_opened_at + consumed_at, sem necessidade de job agendado).
-- =========================================================================

ALTER TABLE public.talent_disc_tokens
  ADD COLUMN IF NOT EXISTS first_opened_at timestamptz;

COMMENT ON COLUMN public.talent_disc_tokens.first_opened_at IS
  'Data/hora do primeiro acesso do candidato ao link (gravada pela RPC get_disc_session). Base para o SLA de 48h de atraso no preenchimento do perfil.';

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
  SET attempts = attempts + 1,
      first_opened_at = COALESCE(first_opened_at, now())
  WHERE candidate_id = v_row.candidate_id
  RETURNING first_opened_at INTO v_row.first_opened_at;

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

GRANT EXECUTE ON FUNCTION public.get_disc_session(text) TO anon, authenticated;
