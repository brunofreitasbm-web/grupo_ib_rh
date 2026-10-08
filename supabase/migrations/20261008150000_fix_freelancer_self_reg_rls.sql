-- =========================================================================
-- Correção de Permissões RLS e RPC para Autocadastro de Freelancers
-- Data: 2026-10-08
-- =========================================================================
-- Permite que usuários anon e authenticated realizem autocadastro no módulo
-- Freelance (quiosque/link público) sem violar políticas RLS de tabela.

-- 1. Garantir que a RPC create_freelancer_self_registration existe e é SECURITY DEFINER
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

-- 2. Garantir Políticas RLS para Autocadastro de Freelancers na tabela public.freelancers
-- Permite inserção direta por anon/authenticated caso a RPC esteja em fallback
DROP POLICY IF EXISTS "freelance: autocadastro insercao" ON public.freelancers;
CREATE POLICY "freelance: autocadastro insercao" ON public.freelancers
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "freelance: autocadastro selecao" ON public.freelancers;
CREATE POLICY "freelance: autocadastro selecao" ON public.freelancers
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "freelance: autocadastro atualizacao" ON public.freelancers;
CREATE POLICY "freelance: autocadastro atualizacao" ON public.freelancers
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);
