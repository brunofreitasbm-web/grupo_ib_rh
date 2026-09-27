-- =========================================================================
-- RPCs para Autocadastro de Freelancer e Controle de OS Presencial no Quiosque
-- Data: 2026-09-27
-- =========================================================================

-- 1. RPC: Autocadastro Obrigatório de Freelancer (sem login / quiosque)
CREATE OR REPLACE FUNCTION public.create_freelancer_self_registration(
  p_unit_id text,
  p_name text,
  p_cpf text,
  p_birthdate date DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_endereco_cep text DEFAULT NULL,
  p_endereco_logradouro text DEFAULT NULL,
  p_endereco_numero text DEFAULT NULL,
  p_endereco_complemento text DEFAULT NULL,
  p_endereco_bairro text DEFAULT NULL,
  p_endereco_cidade text DEFAULT NULL,
  p_endereco_uf text DEFAULT NULL,
  p_service_area text DEFAULT NULL,
  p_bank_name text DEFAULT NULL,
  p_bank_agency text DEFAULT NULL,
  p_bank_account text DEFAULT NULL,
  p_bank_account_type text DEFAULT 'Conta Corrente',
  p_pix_key text DEFAULT NULL,
  p_autonomy_declaration_accepted boolean DEFAULT true,
  p_autonomy_declaration_version text DEFAULT '1.0',
  p_lgpd_consent_accepted boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_cpf text;
  v_freelancer_id uuid;
  v_existing_id uuid;
BEGIN
  IF p_unit_id IS NULL OR trim(p_unit_id) = '' THEN
    RAISE EXCEPTION 'Unidade é obrigatória.';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório.';
  END IF;

  v_clean_cpf := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  IF v_clean_cpf = '' OR length(v_clean_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido.';
  END IF;

  IF NOT COALESCE(p_autonomy_declaration_accepted, false) THEN
    RAISE EXCEPTION 'É obrigatório o aceite da Declaração de Autonomia.';
  END IF;

  -- Verifica se já existe freelancer cadastrado com este CPF
  SELECT id INTO v_existing_id
  FROM public.freelancers
  WHERE regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_clean_cpf
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.freelancers
    SET
      unit_id = p_unit_id,
      name = trim(p_name),
      birthdate = COALESCE(p_birthdate, birthdate),
      email = COALESCE(NULLIF(trim(p_email), ''), email),
      phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
      endereco_cep = COALESCE(NULLIF(trim(p_endereco_cep), ''), endereco_cep),
      endereco_logradouro = COALESCE(NULLIF(trim(p_endereco_logradouro), ''), endereco_logradouro),
      endereco_numero = COALESCE(NULLIF(trim(p_endereco_numero), ''), endereco_numero),
      endereco_complemento = COALESCE(NULLIF(trim(p_endereco_complemento), ''), endereco_complemento),
      endereco_bairro = COALESCE(NULLIF(trim(p_endereco_bairro), ''), endereco_bairro),
      endereco_cidade = COALESCE(NULLIF(trim(p_endereco_cidade), ''), endereco_cidade),
      endereco_uf = COALESCE(NULLIF(trim(p_endereco_uf), ''), endereco_uf),
      service_area = COALESCE(NULLIF(trim(p_service_area), ''), service_area),
      bank_name = COALESCE(NULLIF(trim(p_bank_name), ''), bank_name),
      bank_agency = COALESCE(NULLIF(trim(p_bank_agency), ''), bank_agency),
      bank_account = COALESCE(NULLIF(trim(p_bank_account), ''), bank_account),
      bank_account_type = COALESCE(NULLIF(trim(p_bank_account_type), ''), bank_account_type),
      pix_key = COALESCE(NULLIF(trim(p_pix_key), ''), pix_key),
      autonomy_declaration_accepted_at = now(),
      autonomy_declaration_version = COALESCE(p_autonomy_declaration_version, '1.0'),
      lgpd_consent_accepted_at = CASE WHEN p_lgpd_consent_accepted THEN now() ELSE lgpd_consent_accepted_at END,
      active = true
    WHERE id = v_existing_id;

    v_freelancer_id := v_existing_id;
  ELSE
    INSERT INTO public.freelancers (
      unit_id, name, cpf, birthdate, email, phone,
      endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento,
      endereco_bairro, endereco_cidade, endereco_uf,
      service_area, bank_name, bank_agency, bank_account, bank_account_type, pix_key,
      autonomy_declaration_accepted_at, autonomy_declaration_version, lgpd_consent_accepted_at, active
    ) VALUES (
      p_unit_id, trim(p_name), v_clean_cpf, p_birthdate, NULLIF(trim(p_email), ''), NULLIF(trim(p_phone), ''),
      NULLIF(trim(p_endereco_cep), ''), NULLIF(trim(p_endereco_logradouro), ''), NULLIF(trim(p_endereco_numero), ''), NULLIF(trim(p_endereco_complemento), ''),
      NULLIF(trim(p_endereco_bairro), ''), NULLIF(trim(p_endereco_cidade), ''), NULLIF(trim(p_endereco_uf), ''),
      NULLIF(trim(p_service_area), ''), NULLIF(trim(p_bank_name), ''), NULLIF(trim(p_bank_agency), ''), NULLIF(trim(p_bank_account), ''), COALESCE(NULLIF(trim(p_bank_account_type), ''), 'Conta Corrente'), NULLIF(trim(p_pix_key), ''),
      now(), COALESCE(p_autonomy_declaration_version, '1.0'), CASE WHEN p_lgpd_consent_accepted THEN now() ELSE NULL END, true
    )
    RETURNING id INTO v_freelancer_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'freelancer_id', v_freelancer_id,
    'message', 'Cadastro obrigatório de Freelancer realizado com sucesso!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_freelancer_self_registration TO anon, authenticated;

-- 2. RPC: Consulta de Ordens de Serviço (OS) do Freelancer por CPF no Quiosque
CREATE OR REPLACE FUNCTION public.get_freelancer_os_for_kiosk(
  p_cpf text,
  p_unit_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_cpf text;
  v_freelancer_id uuid;
  v_freelancer_record record;
  v_jobs jsonb;
BEGIN
  v_clean_cpf := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  IF v_clean_cpf = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Informe o CPF para consulta.');
  END IF;

  SELECT * INTO v_freelancer_record
  FROM public.freelancers
  WHERE regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_clean_cpf
  LIMIT 1;

  IF v_freelancer_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Freelancer não encontrado. Faça o cadastro primeiro.');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', j.id,
      'title', j.title,
      'service_type', j.service_type,
      'scope', j.scope,
      'deliverable', j.deliverable,
      'gross_amount', j.gross_amount,
      'status', j.status,
      'scheduled_date', j.scheduled_date,
      'executed_date', j.executed_date,
      'proposed_at', j.proposed_at,
      'accepted_at', j.accepted_at,
      'delivered_at', j.delivered_at,
      'payment_accepted_at', j.payment_accepted_at,
      'paid_at', j.paid_at,
      'rpa_number', j.rpa_number,
      'notes', j.notes,
      'unit_id', j.unit_id
    ) ORDER BY j.created_at DESC
  ) INTO v_jobs
  FROM public.freelance_jobs j
  WHERE j.freelancer_id = v_freelancer_record.id
    AND (p_unit_id IS NULL OR j.unit_id = p_unit_id);

  RETURN jsonb_build_object(
    'success', true,
    'freelancer', jsonb_build_object(
      'id', v_freelancer_record.id,
      'name', v_freelancer_record.name,
      'cpf', v_freelancer_record.cpf,
      'email', v_freelancer_record.email,
      'phone', v_freelancer_record.phone,
      'service_area', v_freelancer_record.service_area,
      'pix_key', v_freelancer_record.pix_key,
      'autonomy_accepted_at', v_freelancer_record.autonomy_declaration_accepted_at
    ),
    'jobs', COALESCE(v_jobs, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_freelancer_os_for_kiosk TO anon, authenticated;

-- 3. RPC: Atualização de Status da OS no Quiosque (Aceite de Escopo / Declaração de Entrega)
CREATE OR REPLACE FUNCTION public.update_freelance_job_status_kiosk(
  p_job_id uuid,
  p_action text, -- 'accept_scope' | 'deliver_scope'
  p_notes text DEFAULT NULL,
  p_gps_lat numeric DEFAULT NULL,
  p_gps_lng numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job record;
BEGIN
  SELECT * INTO v_job FROM public.freelance_jobs WHERE id = p_job_id;
  IF v_job.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ordem de Serviço não encontrada.');
  END IF;

  IF p_action = 'accept_scope' THEN
    IF v_job.status NOT IN ('proposta', 'rascunho') THEN
      RETURN jsonb_build_object('success', false, 'message', 'Esta OS já foi aceita ou processada.');
    END IF;

    UPDATE public.freelance_jobs
    SET
      status = 'aceita',
      accepted_at = now(),
      executed_date = COALESCE(executed_date, CURRENT_DATE),
      notes = CASE
        WHEN p_notes IS NOT NULL AND p_notes <> '' THEN COALESCE(notes || E'\n', '') || '[Aceite no Local]: ' || p_notes
        ELSE notes
      END
    WHERE id = p_job_id;

    RETURN jsonb_build_object('success', true, 'status', 'aceita', 'message', 'Escopo da OS aceito com sucesso! Execução iniciada.');

  ELSIF p_action = 'deliver_scope' THEN
    IF v_job.status NOT IN ('aceita') THEN
      RETURN jsonb_build_object('success', false, 'message', 'A OS precisa estar em execução (aceita) para declarar a entrega.');
    END IF;

    UPDATE public.freelance_jobs
    SET
      status = 'entregue',
      delivered_at = now(),
      notes = CASE
        WHEN p_notes IS NOT NULL AND p_notes <> '' THEN COALESCE(notes || E'\n', '') || '[Declaração de Entrega]: ' || p_notes
        ELSE notes
      END
    WHERE id = p_job_id;

    RETURN jsonb_build_object('success', true, 'status', 'entregue', 'message', 'Entrega da OS declarada com sucesso! Aguardando conferência do supervisor.');

  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Ação inválida.');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_freelance_job_status_kiosk TO anon, authenticated;
