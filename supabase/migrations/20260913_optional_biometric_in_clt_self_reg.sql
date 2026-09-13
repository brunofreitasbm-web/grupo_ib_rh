-- Migration: Torna a biometria facial opcional no envio inicial do autocadastro CLT
-- (permitindo que o funcionário cadastre/atualize sua biometria posteriormente
-- através da tela de Autogestão de Biometria no Quiosque).

CREATE OR REPLACE FUNCTION public.create_employee_self_registration(
  p_unit_id text,
  p_name text,
  p_cpf text,
  p_rg text,
  p_rg_issuer text,
  p_birthdate date,
  p_sex text,
  p_marital_status text,
  p_education text,
  p_nationality text,
  p_birthplace text,
  p_mother_name text,
  p_father_name text,
  p_phone text,
  p_email text,
  p_address jsonb,
  p_ctps_number text,
  p_ctps_series text,
  p_ctps_uf text,
  p_pis text,
  p_voter_title text,
  p_reservist_cert text,
  p_cnh text,
  p_cnh_category text,
  p_bank_name text,
  p_bank_agency text,
  p_bank_account text,
  p_bank_account_type text,
  p_pix_key text,
  p_dependents jsonb,
  p_face_descriptor text,
  p_biometric_consent_accepted boolean,
  p_biometric_consent_version text,
  p_lgpd_consent_accepted boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_catalog AS $$
DECLARE
  caller_role text := auth.jwt() -> 'user_metadata' ->> 'role';
  v_unit public.units%ROWTYPE;
  v_cpf_clean text := regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g');
  v_final_status text := 'pending_validation';
  v_new_id uuid;
  v_token text;
  v_dep jsonb;
BEGIN
  IF caller_role IS NOT NULL AND caller_role <> 'supervisor' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF trim(COALESCE(p_name, '')) = '' OR v_cpf_clean = '' THEN
    RAISE EXCEPTION 'missing_required_fields';
  END IF;
  IF NOT COALESCE(p_lgpd_consent_accepted, false) THEN
    RAISE EXCEPTION 'lgpd_consent_required';
  END IF;

  IF caller_role = 'supervisor' THEN
    SELECT * INTO v_unit FROM public.units WHERE id = p_unit_id;
    IF NOT FOUND OR NOT public.jwt_has_workspace_access(v_unit.workspace_id) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
    v_final_status := 'validated';
  ELSE
    SELECT * INTO v_unit FROM public.units WHERE id = p_unit_id;
    IF NOT FOUND OR NOT COALESCE(v_unit.clt_enabled, false) OR NOT COALESCE(v_unit.clt_self_registration_enabled, false) THEN
      RAISE EXCEPTION 'self_registration_disabled';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.employees e
     WHERE e.unit_id = p_unit_id
       AND regexp_replace(COALESCE(e.cpf, ''), '[^0-9]', '', 'g') = v_cpf_clean
  ) THEN
    RAISE EXCEPTION 'duplicate_cpf';
  END IF;

  INSERT INTO public.employees (
    unit_id, name, cpf, rg, rg_issuer, birthdate, sex, marital_status, education, nationality, birthplace,
    mother_name, father_name, phone, email, address,
    ctps_number, ctps_series, ctps_uf, pis, voter_title, reservist_cert, cnh, cnh_category,
    bank_name, bank_agency, bank_account, bank_account_type, pix_key,
    admission_date, status, face_descriptor, biometric_consent_at, biometric_consent_version,
    registration_status, self_registered_at, lgpd_consent_accepted_at, lgpd_consent_version
  ) VALUES (
    p_unit_id, trim(p_name), v_cpf_clean, NULLIF(trim(p_rg), ''), NULLIF(trim(p_rg_issuer), ''), p_birthdate,
    NULLIF(p_sex, ''), NULLIF(trim(p_marital_status), ''), NULLIF(trim(p_education), ''),
    NULLIF(trim(p_nationality), ''), NULLIF(trim(p_birthplace), ''), NULLIF(trim(p_mother_name), ''), NULLIF(trim(p_father_name), ''),
    NULLIF(trim(p_phone), ''), NULLIF(trim(p_email), ''), COALESCE(p_address, '{}'::jsonb),
    NULLIF(trim(p_ctps_number), ''), NULLIF(trim(p_ctps_series), ''), NULLIF(trim(p_ctps_uf), ''), NULLIF(trim(p_pis), ''),
    NULLIF(trim(p_voter_title), ''), NULLIF(trim(p_reservist_cert), ''), NULLIF(trim(p_cnh), ''), NULLIF(trim(p_cnh_category), ''),
    NULLIF(trim(p_bank_name), ''), NULLIF(trim(p_bank_agency), ''), NULLIF(trim(p_bank_account), ''), NULLIF(trim(p_bank_account_type), ''), NULLIF(trim(p_pix_key), ''),
    NULL, 'ativo', NULLIF(trim(p_face_descriptor), ''), CASE WHEN COALESCE(p_biometric_consent_accepted, false) THEN now() ELSE NULL END, NULLIF(trim(p_biometric_consent_version), ''),
    v_final_status, CASE WHEN v_final_status = 'pending_validation' THEN now() ELSE NULL END, now(), NULL
  ) RETURNING id INTO v_new_id;

  IF p_dependents IS NOT NULL THEN
    FOR v_dep IN SELECT * FROM jsonb_array_elements(p_dependents) LOOP
      IF trim(COALESCE(v_dep->>'name', '')) <> '' THEN
        INSERT INTO public.employee_dependents (employee_id, name, cpf, birthdate, relationship, for_ir, for_salario_familia)
        VALUES (
          v_new_id, trim(v_dep->>'name'), NULLIF(regexp_replace(COALESCE(v_dep->>'cpf', ''), '[^0-9]', '', 'g'), ''),
          NULLIF(v_dep->>'birthdate', '')::date, NULLIF(trim(v_dep->>'relationship'), ''),
          COALESCE((v_dep->>'forIr')::boolean, true), COALESCE((v_dep->>'forSalarioFamilia')::boolean, false)
        );
      END IF;
    END LOOP;
  END IF;

  IF v_final_status = 'pending_validation' THEN
    v_token := encode(gen_random_bytes(24), 'hex');
    INSERT INTO public.employee_self_registration_tokens (employee_id, token_hash, expires_at, uploads_used)
    VALUES (v_new_id, digest(v_token, 'sha256'), now() + interval '60 minutes', 0)
    ON CONFLICT (employee_id) DO UPDATE
      SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, uploads_used = 0, created_at = now();
    RETURN jsonb_build_object('ok', true, 'employee_id', v_new_id, 'upload_token', v_token, 'registration_status', v_final_status);
  END IF;

  RETURN jsonb_build_object('ok', true, 'employee_id', v_new_id, 'registration_status', v_final_status);
END;
$$;
