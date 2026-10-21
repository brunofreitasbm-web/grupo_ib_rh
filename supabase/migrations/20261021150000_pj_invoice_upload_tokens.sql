-- =========================================================================
-- MÓDULO GRUPO IB (FaçaAmigos): Tokens e RPCs para Upload Público de NFSe PJ
-- Permite que o prestador PJ acerte valor, competência e envie a NFSe via link seguro
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.professional_invoice_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL,
  competencia text NOT NULL,
  calculated_amount numeric(12, 2) NOT NULL DEFAULT 0.00,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_professional_invoice_tokens_prof_comp
  ON public.professional_invoice_tokens(professional_id, competencia);

CREATE INDEX IF NOT EXISTS idx_professional_invoice_tokens_hash
  ON public.professional_invoice_tokens(token_hash);

-- RLS: tokens só são manipulados via RPCs e Service Role (Edge Functions)
ALTER TABLE public.professional_invoice_tokens ENABLE ROW LEVEL SECURITY;

-- 1. RPC para validar e obter dados da sessão de upload da NFSe (pública)
CREATE OR REPLACE FUNCTION public.get_pj_invoice_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash bytea;
  v_row public.professional_invoice_tokens%ROWTYPE;
  v_prof public.professionals%ROWTYPE;
  v_unit public.units%ROWTYPE;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_obrigatorio');
  END IF;

  v_hash := digest(p_token, 'sha256');

  SELECT * INTO v_row
  FROM public.professional_invoice_tokens
  WHERE token_hash = v_hash
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_invalido');
  END IF;

  IF v_row.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_expirado');
  END IF;

  SELECT * INTO v_prof
  FROM public.professionals
  WHERE id = v_row.professional_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'prestador_nao_encontrado');
  END IF;

  SELECT * INTO v_unit
  FROM public.units
  WHERE id = v_prof.unit_id;

  RETURN jsonb_build_object(
    'ok', true,
    'professional_id', v_prof.id,
    'professional_name', v_prof.name,
    'razao_social', COALESCE(v_prof.razao_social, v_prof.name),
    'cnpj', COALESCE(v_prof.cnpj, v_prof.cpf),
    'unit_id', v_prof.unit_id,
    'unit_name', COALESCE(v_unit.name, 'Unidade'),
    'competencia', v_row.competencia,
    'calculated_amount', v_row.calculated_amount,
    'already_used', v_row.used_at IS NOT NULL
  );
END;
$$;

-- 2. RPC para o prestador enviar a NFSe com valor e competência editáveis (pública)
CREATE OR REPLACE FUNCTION public.submit_pj_invoice(
  p_token text,
  p_competencia text,
  p_numero_nf text,
  p_valor numeric,
  p_pdf_content text,
  p_file_name text,
  p_file_size text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash bytea;
  v_row public.professional_invoice_tokens%ROWTYPE;
  v_prof public.professionals%ROWTYPE;
  v_doc_key text;
  v_meta jsonb;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_obrigatorio');
  END IF;

  v_hash := digest(p_token, 'sha256');

  SELECT * INTO v_row
  FROM public.professional_invoice_tokens
  WHERE token_hash = v_hash
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_invalido');
  END IF;

  IF v_row.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_expirado');
  END IF;

  IF p_pdf_content IS NULL OR length(p_pdf_content) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'arquivo_obrigatorio');
  END IF;

  IF p_valor IS NULL OR p_valor <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'valor_invalido');
  END IF;

  SELECT * INTO v_prof
  FROM public.professionals
  WHERE id = v_row.professional_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'prestador_nao_encontrado');
  END IF;

  v_doc_key := 'nf-' || COALESCE(p_competencia, v_row.competencia) || '-' || round(extract(epoch from now()))::text;

  v_meta := jsonb_build_object(
    'name', COALESCE(p_file_name, 'nfse.pdf'),
    'size', COALESCE(p_file_size, '—'),
    'type', 'nf',
    'competencia', COALESCE(p_competencia, v_row.competencia),
    'numeroNf', trim(COALESCE(p_numero_nf, '')),
    'valor', p_valor,
    'valorApurado', v_row.calculated_amount,
    'unitId', v_prof.unit_id,
    'uploadedAt', now(),
    'status', 'pendente',
    'origem', 'portal_link'
  );

  INSERT INTO public.professional_documents (professional_id, doc_key, content, meta)
  VALUES (v_row.professional_id, v_doc_key, p_pdf_content, v_meta)
  ON CONFLICT (professional_id, doc_key) DO UPDATE
    SET content = EXCLUDED.content,
        meta = EXCLUDED.meta,
        created_at = now();

  UPDATE public.professional_invoice_tokens
  SET used_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object('ok', true, 'doc_key', v_doc_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pj_invoice_session(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_pj_invoice(text, text, text, numeric, text, text, text) TO anon, authenticated;
