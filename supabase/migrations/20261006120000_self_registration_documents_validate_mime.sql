-- Migration: 20261006120000_self_registration_documents_validate_mime.sql
-- Os uploads passam a ser comprimidos no navegador (imagens em WebP, com
-- fallback JPEG). As RPCs de anexo do autocadastro, que eram chamadas sem
-- sessao e so limitavam o tamanho, passam a exigir que o conteudo seja um
-- data URL base64 de tipo permitido: image/webp, image/jpeg, image/png ou
-- application/pdf. O restante do comportamento e identico a definicao anterior
-- (20260910185600_fix_token_hash_bytea_text_comparison.sql).
-- NAO aplicada automaticamente: revisar e aplicar manualmente.

CREATE OR REPLACE FUNCTION public.attach_employee_self_registration_document(
  p_employee_id uuid, p_token text, p_doc_key text, p_content text, p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  v_row public.employee_self_registration_tokens%ROWTYPE;
BEGIN
  IF p_doc_key NOT IN (
    'rg_cnh', 'cpf', 'ctps_digital', 'pis', 'comprovante_residencia', 'titulo_eleitor',
    'certificado_reservista', 'certidao_nascimento_casamento', 'certidao_cpf_dependentes',
    'cartao_vacinacao_filhos', 'comprovante_escolaridade', 'foto_3x4'
  ) THEN
    RAISE EXCEPTION 'invalid_doc_key';
  END IF;
  IF length(COALESCE(p_content, '')) = 0 OR length(p_content) > 2800000 THEN
    RAISE EXCEPTION 'invalid_file_size';
  END IF;
  IF p_content !~ '^data:(image/(webp|jpeg|png)|application/pdf);base64,' THEN
    RAISE EXCEPTION 'invalid_file_type';
  END IF;

  SELECT * INTO v_row FROM public.employee_self_registration_tokens WHERE employee_id = p_employee_id FOR UPDATE;
  IF NOT FOUND OR v_row.token_hash::bytea <> digest(COALESCE(p_token, ''), 'sha256') THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  IF v_row.expires_at < now() THEN
    RAISE EXCEPTION 'token_expired';
  END IF;
  IF v_row.uploads_used >= 12 THEN
    RAISE EXCEPTION 'upload_limit_reached';
  END IF;

  INSERT INTO public.employee_documents (employee_id, doc_key, content, meta)
  VALUES (p_employee_id, p_doc_key, p_content, COALESCE(p_meta, '{}'::jsonb))
  ON CONFLICT (employee_id, doc_key) DO UPDATE
    SET content = EXCLUDED.content, meta = EXCLUDED.meta, created_at = now();

  UPDATE public.employee_self_registration_tokens
     SET uploads_used = uploads_used + 1
   WHERE employee_id = p_employee_id;

  RETURN jsonb_build_object('ok', true, 'doc_key', p_doc_key);
END;
$function$;

CREATE OR REPLACE FUNCTION public.attach_professional_self_registration_document(
  p_professional_id uuid, p_token text, p_doc_key text, p_content text, p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  v_row public.professional_self_registration_tokens%ROWTYPE;
BEGIN
  IF p_doc_key NOT IN ('cartao_cnpj', 'contrato_social', 'carteira_conselho', 'comprovante_endereco', 'doc_identidade_representante') THEN
    RAISE EXCEPTION 'invalid_doc_key';
  END IF;
  IF length(COALESCE(p_content, '')) = 0 OR length(p_content) > 2800000 THEN
    RAISE EXCEPTION 'invalid_file_size';
  END IF;
  IF p_content !~ '^data:(image/(webp|jpeg|png)|application/pdf);base64,' THEN
    RAISE EXCEPTION 'invalid_file_type';
  END IF;

  SELECT * INTO v_row FROM public.professional_self_registration_tokens WHERE professional_id = p_professional_id FOR UPDATE;
  IF NOT FOUND OR v_row.token_hash::bytea <> digest(COALESCE(p_token, ''), 'sha256') THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  IF v_row.expires_at < now() THEN
    RAISE EXCEPTION 'token_expired';
  END IF;
  IF v_row.uploads_used >= 8 THEN
    RAISE EXCEPTION 'upload_limit_reached';
  END IF;

  INSERT INTO public.professional_documents (professional_id, doc_key, content, meta)
  VALUES (p_professional_id, p_doc_key, p_content, COALESCE(p_meta, '{}'::jsonb))
  ON CONFLICT (professional_id, doc_key) DO UPDATE
    SET content = EXCLUDED.content, meta = EXCLUDED.meta, created_at = now();

  UPDATE public.professional_self_registration_tokens
     SET uploads_used = uploads_used + 1
   WHERE professional_id = p_professional_id;

  RETURN jsonb_build_object('ok', true, 'doc_key', p_doc_key);
END;
$function$;
