-- =========================================================================
-- APROVEITAR DISC RESPONDIDO NA SELEÇÃO PARA QUEM JÁ FOI CONTRATADO
-- Data: 2026-09-16
-- =========================================================================
-- Antes de oferecer "Enviar Levantamento de Perfil Comportamental" para um
-- estagiário/PJ/CLT já cadastrado, o front cruza o e-mail dele com
-- talent_candidates_meta/talent_disc_assessments (useCandidateDiscByEmail) —
-- se a pessoa já respondeu o levantamento QUANDO ERA CANDIDATA no Banco de
-- Talentos, não faz sentido pedir de novo.
--
-- Esta RPC copia esse resultado já existente para staff_disc_assessments
-- (mesma tabela usada pelos quadradinhos da Simulação por Unidade), sem
-- reenviar e-mail nem exigir nova resposta. Só usuários autenticados (nunca
-- o candidato anônimo) podem chamá-la.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.import_candidate_disc_to_staff(
  p_subject_type text,
  p_subject_id uuid,
  p_candidate_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_assessment public.talent_disc_assessments%ROWTYPE;
BEGIN
  IF p_subject_type NOT IN ('intern', 'professional', 'employee') THEN
    RAISE EXCEPTION 'invalid_subject_type';
  END IF;
  IF p_subject_id IS NULL OR p_candidate_id IS NULL THEN
    RAISE EXCEPTION 'invalid_subject';
  END IF;

  SELECT * INTO v_assessment FROM public.talent_disc_assessments WHERE candidate_id = p_candidate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'candidate_assessment_not_found';
  END IF;

  INSERT INTO public.staff_disc_assessments AS a (
    subject_type, subject_id, workspace_id, answers, scores,
    primary_profile, secondary_profile, duration_seconds, completed_at
  ) VALUES (
    p_subject_type, p_subject_id, COALESCE(v_assessment.workspace_id, 'grupoib'),
    v_assessment.answers, v_assessment.scores,
    v_assessment.primary_profile, v_assessment.secondary_profile,
    v_assessment.duration_seconds, v_assessment.completed_at
  )
  ON CONFLICT (subject_type, subject_id) DO UPDATE SET
    answers = EXCLUDED.answers,
    scores = EXCLUDED.scores,
    primary_profile = EXCLUDED.primary_profile,
    secondary_profile = EXCLUDED.secondary_profile,
    duration_seconds = EXCLUDED.duration_seconds,
    completed_at = EXCLUDED.completed_at;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.import_candidate_disc_to_staff(text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.import_candidate_disc_to_staff(text, uuid, text) TO authenticated;
