-- ============================================================================
-- Blindagem de autorização (C-1 do SECURITY_HARDENING_PROMPT.md)
-- ============================================================================
-- Problema: todo o RLS e as funções SECURITY DEFINER deste app confiam em
-- auth.jwt() -> 'user_metadata', e a coluna auth.users.raw_user_meta_data que
-- a alimenta pode ser editada pelo PRÓPRIO usuário autenticado via
-- supabase.auth.updateUser({ data: { role: 'supervisor', ... } }). Combinado
-- com a senha fixa das contas de quiosque no bundle do front-end, isso
-- permitia que qualquer pessoa se autopromovesse a supervisor com escopo
-- total.
--
-- Correção: mover role/unit_id/workspace_scope para app_metadata (só
-- service_role/SQL privilegiado grava), reescrever as ~19 funções e 12
-- policies deste app que liam essas chaves, e travar por trigger qualquer
-- tentativa de gravar essas 3 chaves específicas em raw_user_meta_data por
-- fora de uma sessão privilegiada.
--
-- Verificado antes de escrever esta migração (contra o banco de produção
-- vththexblpxwocbowhsv, que também hospeda o sistema CLINICA/Grupo IB na
-- mesma base): nenhuma função do sistema CLINICA lê ou grava
-- raw_user_meta_data/raw_app_meta_data com as chaves role/unit_id/
-- workspace_scope (ele resolve papel via public.profiles, não via claim de
-- JWT) — a lista de 19 funções abaixo é exaustiva e pertence só a este app.
--
-- Achado adicional (só visível no banco ao vivo, não no dump versionado):
-- public.change_intern_password estava GRANT TO PUBLIC (logo, a `anon`) e
-- não verificava se quem chama é o dono da conta — qualquer pessoa na
-- internet podia trocar a senha de qualquer estagiário. Corrigido nesta
-- mesma migração (seção 8).
--
-- Efeito colateral esperado e temporário: sessões JÁ ABERTAS antes desta
-- migração carregam um token cujo app_metadata ainda não tem o papel
-- (só tinha em user_metadata). Elas deixam de ser autorizadas até o token
-- renovar (supabase-js faz isso sozinho, TTL padrão de 1h) ou até a pessoa
-- logar de novo. Não é possível evitar essa janela sem esvaziar o propósito
-- da correção (ver relatório).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Backfill: copia o que já existe em raw_user_meta_data para
--    raw_app_meta_data, preservando o original (permite rollback só revertendo
--    as seções 2 em diante, sem precisar restaurar dado).
-- ----------------------------------------------------------------------------
UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object(
       'role', raw_user_meta_data ->> 'role',
       'unit_id', raw_user_meta_data ->> 'unit_id',
       'workspace_scope', COALESCE(raw_user_meta_data -> 'workspace_scope', '[]'::jsonb)
     ))
WHERE raw_user_meta_data ? 'role';

-- ----------------------------------------------------------------------------
-- 2) Funções auxiliares de JWT (usadas pelas policies de RLS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jwt_has_workspace_access(target_workspace text)
 RETURNS boolean
 LANGUAGE sql STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(auth.jwt() -> 'app_metadata' -> 'workspace_scope', '[]'::jsonb) ? 'all'
    OR (target_workspace IS NOT NULL
        AND COALESCE(auth.jwt() -> 'app_metadata' -> 'workspace_scope', '[]'::jsonb) ? target_workspace);
$function$;

CREATE OR REPLACE FUNCTION public.jwt_is_supervisor_for_unit(target_unit text)
 RETURNS boolean
 LANGUAGE sql STABLE
 SET search_path TO 'public'
AS $function$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'role') = 'supervisor'
     AND EXISTS (SELECT 1 FROM public.units u WHERE u.id = target_unit AND public.jwt_has_workspace_access(u.workspace_id));
$function$;

CREATE OR REPLACE FUNCTION public.jwt_is_employee_kiosk_for_unit(target_unit text)
 RETURNS boolean
 LANGUAGE sql STABLE
 SET search_path TO 'public'
AS $function$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'role') = 'employee_unit'
     AND target_unit IS NOT NULL
     AND (auth.jwt() -> 'app_metadata' ->> 'unit_id') = target_unit;
$function$;

CREATE OR REPLACE FUNCTION public.jwt_is_professional_kiosk_for_unit(target_unit text)
 RETURNS boolean
 LANGUAGE sql STABLE
 SET search_path TO 'public'
AS $function$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'role') = 'professional_unit'
     AND target_unit IS NOT NULL
     AND (auth.jwt() -> 'app_metadata' ->> 'unit_id') = target_unit;
$function$;

CREATE OR REPLACE FUNCTION public.jwt_own_unit_workspace()
 RETURNS text
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT workspace_id FROM public.units WHERE id = (auth.jwt() -> 'app_metadata' ->> 'unit_id');
$function$;

-- jwt_intern_self_workspace() não referencia user_metadata (resolve por
-- auth.uid() direto na tabela interns) — sem mudança, mantida como está.

-- ----------------------------------------------------------------------------
-- 3) assert_system_user_admin — checagem de admin usada por todas as
--    funções de gestão de contas do sistema.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_system_user_admin(p_workspace_scope jsonb)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ws text;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'supervisor' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF public.jwt_has_workspace_access('all') THEN
    RETURN;
  END IF;

  IF p_workspace_scope IS NULL OR jsonb_array_length(COALESCE(p_workspace_scope, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'workspace scope required';
  END IF;

  FOR ws IN SELECT jsonb_array_elements_text(p_workspace_scope) LOOP
    IF ws = 'all' OR NOT public.jwt_has_workspace_access(ws) THEN
      RAISE EXCEPTION 'not authorized for workspace %', ws;
    END IF;
  END LOOP;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 4) Gestão de contas do sistema (Usuários do Sistema): agora lê e grava
--    role/unit_id/workspace_scope em app_metadata. 'name' continua em
--    user_metadata (não é usado para autorização, sem risco).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_system_user(p_email text, p_password text, p_name text, p_role text, p_unit_id text DEFAULT NULL::text, p_workspace_scope jsonb DEFAULT '[]'::jsonb, p_permissions jsonb DEFAULT '{}'::jsonb, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid;
  v_email text := lower(trim(p_email));
BEGIN
  PERFORM public.assert_system_user_admin(p_workspace_scope);

  IF NOT (p_role = ANY (public.system_user_manageable_roles())) THEN
    RAISE EXCEPTION 'papel inválido: %', p_role;
  END IF;

  IF v_email IS NULL OR position('@' in v_email) < 2 OR position('.' in split_part(v_email, '@', 2)) < 2 THEN
    RAISE EXCEPTION 'e-mail inválido';
  END IF;

  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'a senha deve ter ao menos 8 caracteres';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'já existe uma conta com este e-mail';
  END IF;

  IF p_role <> 'supervisor' THEN
    IF p_unit_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.units WHERE id = p_unit_id) THEN
      RAISE EXCEPTION 'unidade obrigatória e existente para contas de quiosque';
    END IF;
    IF NOT public.jwt_has_workspace_access('all')
       AND NOT EXISTS (SELECT 1 FROM public.units u WHERE u.id = p_unit_id AND public.jwt_has_workspace_access(u.workspace_id)) THEN
      RAISE EXCEPTION 'not authorized for this unit/workspace';
    END IF;
  END IF;

  new_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_sso_user, is_anonymous
  ) VALUES (
    new_id, '00000000-0000-0000-0000-000000000000', v_email,
    crypt(p_password, gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'))
      || jsonb_strip_nulls(jsonb_build_object(
           'role', p_role,
           'unit_id', p_unit_id,
           'workspace_scope', COALESCE(p_workspace_scope, '[]'::jsonb)
         )),
    jsonb_build_object('name', p_name),
    'authenticated', 'authenticated', now(), now(),
    '', '', '', '', false, false
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), new_id,
    jsonb_build_object('sub', new_id::text, 'email', v_email),
    'email', new_id::text, now(), now(), now()
  );

  INSERT INTO public.system_user_permissions (user_id, permissions, notes, updated_by)
  VALUES (new_id, COALESCE(p_permissions, '{}'::jsonb), p_notes, auth.uid());

  PERFORM public.log_system_user_action(
    new_id, v_email, 'create',
    jsonb_build_object('role', p_role, 'unit_id', p_unit_id, 'workspace_scope', p_workspace_scope)
  );

  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_system_user(p_user_id uuid, p_name text DEFAULT NULL::text, p_role text DEFAULT NULL::text, p_unit_id text DEFAULT NULL::text, p_workspace_scope jsonb DEFAULT NULL::jsonb, p_permissions jsonb DEFAULT NULL::jsonb, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_user_meta jsonb;
  v_app_meta jsonb;
  v_new_role text;
  v_new_scope jsonb;
  v_new_unit text;
BEGIN
  SELECT u.email, COALESCE(u.raw_user_meta_data, '{}'::jsonb), COALESCE(u.raw_app_meta_data, '{}'::jsonb)
    INTO v_email, v_user_meta, v_app_meta
    FROM auth.users u WHERE u.id = p_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'conta não encontrada';
  END IF;

  IF NOT ((v_app_meta ->> 'role') = ANY (public.system_user_manageable_roles())) THEN
    RAISE EXCEPTION 'esta conta não é gerenciada por esta tela';
  END IF;

  v_new_role  := COALESCE(p_role, v_app_meta ->> 'role');
  v_new_scope := COALESCE(p_workspace_scope, v_app_meta -> 'workspace_scope', '[]'::jsonb);
  v_new_unit  := COALESCE(p_unit_id, v_app_meta ->> 'unit_id');

  -- Precisa poder administrar tanto o escopo atual quanto o escopo resultante.
  PERFORM public.assert_system_user_admin(COALESCE(v_app_meta -> 'workspace_scope', '[]'::jsonb));
  PERFORM public.assert_system_user_admin(v_new_scope);

  IF NOT (v_new_role = ANY (public.system_user_manageable_roles())) THEN
    RAISE EXCEPTION 'papel inválido: %', v_new_role;
  END IF;

  IF v_new_role <> 'supervisor' THEN
    IF v_new_unit IS NULL OR NOT EXISTS (SELECT 1 FROM public.units WHERE id = v_new_unit) THEN
      RAISE EXCEPTION 'unidade obrigatória e existente para contas de quiosque';
    END IF;
  ELSE
    v_new_unit := NULL;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = jsonb_strip_nulls(
        v_app_meta || jsonb_build_object(
          'role', v_new_role,
          'unit_id', v_new_unit,
          'workspace_scope', v_new_scope
        )
      ),
      raw_user_meta_data = jsonb_strip_nulls(
        v_user_meta || jsonb_build_object('name', COALESCE(p_name, v_user_meta ->> 'name'))
      ),
      updated_at = now()
  WHERE id = p_user_id;

  IF p_permissions IS NOT NULL OR p_notes IS NOT NULL THEN
    INSERT INTO public.system_user_permissions (user_id, permissions, notes, updated_at, updated_by)
    VALUES (p_user_id, COALESCE(p_permissions, '{}'::jsonb), p_notes, now(), auth.uid())
    ON CONFLICT (user_id) DO UPDATE
      SET permissions = COALESCE(p_permissions, public.system_user_permissions.permissions),
          notes       = COALESCE(p_notes, public.system_user_permissions.notes),
          updated_at  = now(),
          updated_by  = auth.uid();
  END IF;

  PERFORM public.log_system_user_action(
    p_user_id, v_email, 'update',
    jsonb_build_object('role', v_new_role, 'unit_id', v_new_unit, 'workspace_scope', v_new_scope)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_system_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_app_meta jsonb;
BEGIN
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'você não pode excluir a própria conta';
  END IF;

  SELECT u.email, COALESCE(u.raw_app_meta_data, '{}'::jsonb)
    INTO v_email, v_app_meta
    FROM auth.users u WHERE u.id = p_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'conta não encontrada';
  END IF;

  IF NOT ((v_app_meta ->> 'role') = ANY (public.system_user_manageable_roles())) THEN
    RAISE EXCEPTION 'esta conta não é gerenciada por esta tela';
  END IF;

  PERFORM public.assert_system_user_admin(COALESCE(v_app_meta -> 'workspace_scope', '[]'::jsonb));

  PERFORM public.log_system_user_action(
    p_user_id, v_email, 'delete', jsonb_build_object('role', v_app_meta ->> 'role')
  );

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_system_users()
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'supervisor' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.role, t.name), '[]'::jsonb) INTO result
  FROM (
    SELECT
      u.id,
      u.email,
      COALESCE(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)) AS name,
      u.raw_app_meta_data ->> 'role' AS role,
      u.raw_app_meta_data ->> 'unit_id' AS unit_id,
      COALESCE(u.raw_app_meta_data -> 'workspace_scope', '[]'::jsonb) AS workspace_scope,
      COALESCE(p.permissions, '{}'::jsonb) AS permissions,
      p.notes,
      u.created_at,
      u.last_sign_in_at,
      (u.banned_until IS NOT NULL AND u.banned_until > now()) AS disabled,
      u.banned_until
    FROM auth.users u
    LEFT JOIN public.system_user_permissions p ON p.user_id = u.id
    WHERE (u.raw_app_meta_data ->> 'role') = ANY (public.system_user_manageable_roles())
      AND (
        public.jwt_has_workspace_access('all')
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(
            COALESCE(u.raw_app_meta_data -> 'workspace_scope', '[]'::jsonb)
          ) ws WHERE public.jwt_has_workspace_access(ws)
        )
        OR EXISTS (
          SELECT 1 FROM public.units un
          WHERE un.id = (u.raw_app_meta_data ->> 'unit_id')
            AND public.jwt_has_workspace_access(un.workspace_id)
        )
      )
  ) t;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_system_user_password(p_user_id uuid, p_new_password text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_app_meta jsonb;
BEGIN
  SELECT u.email, COALESCE(u.raw_app_meta_data, '{}'::jsonb)
    INTO v_email, v_app_meta
    FROM auth.users u WHERE u.id = p_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'conta não encontrada';
  END IF;

  IF NOT ((v_app_meta ->> 'role') = ANY (public.system_user_manageable_roles())) THEN
    RAISE EXCEPTION 'esta conta não é gerenciada por esta tela';
  END IF;

  PERFORM public.assert_system_user_admin(COALESCE(v_app_meta -> 'workspace_scope', '[]'::jsonb));

  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'a senha deve ter ao menos 8 caracteres';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;

  PERFORM public.log_system_user_action(p_user_id, v_email, 'reset_password', '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_system_user_active(p_user_id uuid, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_app_meta jsonb;
BEGIN
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'você não pode desativar a própria conta';
  END IF;

  SELECT u.email, COALESCE(u.raw_app_meta_data, '{}'::jsonb)
    INTO v_email, v_app_meta
    FROM auth.users u WHERE u.id = p_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'conta não encontrada';
  END IF;

  IF NOT ((v_app_meta ->> 'role') = ANY (public.system_user_manageable_roles())) THEN
    RAISE EXCEPTION 'esta conta não é gerenciada por esta tela';
  END IF;

  PERFORM public.assert_system_user_admin(COALESCE(v_app_meta -> 'workspace_scope', '[]'::jsonb));

  UPDATE auth.users
  SET banned_until = CASE WHEN p_active THEN NULL ELSE 'infinity'::timestamptz END,
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT p_active THEN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
    DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
  END IF;

  PERFORM public.log_system_user_action(
    p_user_id, v_email, CASE WHEN p_active THEN 'enable' ELSE 'disable' END, '{}'::jsonb
  );
END;
$function$;

-- ----------------------------------------------------------------------------
-- 5) list_system_user_audit — só checagem de papel, sem leitura/gravação de
--    metadata de terceiros.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_system_user_audit(p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'supervisor' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO result
  FROM (
    SELECT a.id, a.target_user_id, a.target_email, a.action, a.detail,
           a.actor_id, a.actor_email, a.created_at
    FROM public.system_user_audit a
    ORDER BY a.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  ) t;

  RETURN result;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 6) Estagiários: create/delete/reset de senha e cadastro de RH/PJ.
--    Anon continua podendo chamar create_intern_user/create_*_self_registration
--    (autocadastro por link/kiosk) — comportamento inalterado: caller_role
--    NULL (sem sessão) cai no mesmo ramo "pending_validation" de antes.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_intern_user(p_email text, p_password text, p_name text, p_course text, p_institution text, p_shift text, p_daily_hours integer, p_unit_id text, p_start_date date, p_end_date date, p_photo text DEFAULT NULL::text, p_cpf text DEFAULT NULL::text, p_rg text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_bank_name text DEFAULT NULL::text, p_bank_agency text DEFAULT NULL::text, p_bank_account text DEFAULT NULL::text, p_pix_key text DEFAULT NULL::text, p_emergency_name text DEFAULT NULL::text, p_emergency_relationship text DEFAULT NULL::text, p_emergency_phone text DEFAULT NULL::text, p_allowance numeric DEFAULT 0, p_supervisor_name text DEFAULT NULL::text, p_registration_status text DEFAULT 'validated'::text, p_documents jsonb DEFAULT '{}'::jsonb, p_birthdate date DEFAULT NULL::date, p_face_descriptor text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_intern_id uuid;
  caller_role text := (auth.jwt() -> 'app_metadata' ->> 'role');
  caller_unit text := (auth.jwt() -> 'app_metadata' ->> 'unit_id');
  final_registration_status text := p_registration_status;
  final_unit_id text := p_unit_id;
BEGIN
  IF caller_role IS DISTINCT FROM 'supervisor' AND caller_role IS DISTINCT FROM 'intern_unit' AND caller_role IS NOT NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF caller_role = 'intern_unit' OR caller_role IS NULL THEN
    final_registration_status := 'pending_validation';
    IF caller_role = 'intern_unit' AND caller_unit IS NOT NULL THEN
      final_unit_id := caller_unit;
    END IF;
  END IF;

  IF caller_role = 'supervisor' AND NOT public.jwt_has_workspace_access('all') THEN
    IF NOT EXISTS (SELECT 1 FROM public.units u WHERE u.id = final_unit_id AND public.jwt_has_workspace_access(u.workspace_id)) THEN
      RAISE EXCEPTION 'not authorized for this unit/workspace';
    END IF;
  END IF;

  new_intern_id := gen_random_uuid();

  INSERT INTO public.interns (
    id, name, course, institution, shift, daily_hours, unit_id, active, start_date, end_date,
    username, is_first_login, documents, photo, cpf, email, rg, phone, address, bank_name,
    bank_agency, bank_account, pix_key, emergency_name, emergency_relationship, emergency_phone,
    allowance, supervisor_name, registration_status, semestral_reports, contract_termination,
    birthdate, face_descriptor
  ) VALUES (
    new_intern_id, p_name, p_course, p_institution, p_shift, p_daily_hours, final_unit_id, true, p_start_date, p_end_date,
    COALESCE(split_part(p_email, '@', 1), 'estagiario_' || substring(md5(random()::text) from 1 for 6)),
    false, p_documents, p_photo, p_cpf, p_email, p_rg, p_phone, p_address, p_bank_name,
    p_bank_agency, p_bank_account, p_pix_key, p_emergency_name, p_emergency_relationship, p_emergency_phone,
    p_allowance, p_supervisor_name, final_registration_status, '{}'::jsonb, '{}'::jsonb,
    p_birthdate, p_face_descriptor
  );

  RETURN new_intern_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_intern_user(p_intern_id uuid)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'supervisor' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT public.jwt_has_workspace_access('all') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.interns i JOIN public.units u ON u.id = i.unit_id
      WHERE i.id = p_intern_id AND public.jwt_has_workspace_access(u.workspace_id)
    ) THEN
      RAISE EXCEPTION 'not authorized for this unit/workspace';
    END IF;
  END IF;

  UPDATE public.records SET photo = NULL WHERE intern_id = p_intern_id;

  DELETE FROM public.interns WHERE id = p_intern_id;
  DELETE FROM auth.users WHERE id = p_intern_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_intern_password(p_intern_id uuid, p_new_password text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'supervisor' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT public.jwt_has_workspace_access('all') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.interns i JOIN public.units u ON u.id = i.unit_id
      WHERE i.id = p_intern_id AND public.jwt_has_workspace_access(u.workspace_id)
    ) THEN
      RAISE EXCEPTION 'not authorized for this unit/workspace';
    END IF;
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_intern_id;

  UPDATE public.interns
  SET is_first_login = true
  WHERE id = p_intern_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_employee_self_registration(p_unit_id text, p_name text, p_cpf text, p_rg text, p_rg_issuer text, p_birthdate date, p_sex text, p_marital_status text, p_education text, p_nationality text, p_birthplace text, p_mother_name text, p_father_name text, p_phone text, p_email text, p_address jsonb, p_ctps_number text, p_ctps_series text, p_ctps_uf text, p_pis text, p_voter_title text, p_reservist_cert text, p_cnh text, p_cnh_category text, p_bank_name text, p_bank_agency text, p_bank_account text, p_bank_account_type text, p_pix_key text, p_dependents jsonb, p_face_descriptor text, p_biometric_consent_accepted boolean, p_biometric_consent_version text, p_lgpd_consent_accepted boolean)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  caller_role text := auth.jwt() -> 'app_metadata' ->> 'role';
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
  IF NOT COALESCE(p_biometric_consent_accepted, false) OR COALESCE(trim(p_face_descriptor), '') = '' THEN
    RAISE EXCEPTION 'biometric_required';
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
    NULL, 'ativo', p_face_descriptor, now(), NULLIF(trim(p_biometric_consent_version), ''),
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
$function$;

CREATE OR REPLACE FUNCTION public.create_professional_self_registration(p_unit_id text, p_name text, p_cnpj text, p_razao_social text, p_nome_fantasia text, p_natureza_juridica text, p_cnae_principal text, p_inscricao_municipal text, p_endereco_cep text, p_endereco_logradouro text, p_endereco_numero text, p_endereco_complemento text, p_endereco_bairro text, p_endereco_cidade text, p_endereco_uf text, p_profession text, p_council_type text, p_council_number text, p_council_uf text, p_council_validity date, p_specialties text, p_rep_name text, p_rep_cpf text, p_rep_rg text, p_rep_birthdate date, p_rep_email text, p_rep_phone text, p_rep_role text, p_email text, p_phone text, p_bank_name text, p_bank_agency text, p_bank_account text, p_bank_account_type text, p_pix_key text, p_service_description text, p_remuneration_model text, p_remuneration_value numeric, p_payment_day integer, p_notice_days integer, p_contract_start date, p_autonomy_declaration_accepted boolean, p_autonomy_declaration_version text, p_lgpd_consent_accepted boolean)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  caller_role text := auth.jwt() -> 'app_metadata' ->> 'role';
  caller_unit text := auth.jwt() -> 'app_metadata' ->> 'unit_id';
  v_unit public.units%ROWTYPE;
  v_cnpj_clean text := regexp_replace(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');
  v_cpf_clean text := regexp_replace(COALESCE(p_rep_cpf, ''), '[^0-9]', '', 'g');
  v_final_status text := 'pending_validation';
  v_new_id uuid;
  v_token text;
BEGIN
  IF caller_role IS NOT NULL
     AND caller_role NOT IN ('professional_unit', 'supervisor') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF caller_role = 'professional_unit' AND caller_unit IS DISTINCT FROM p_unit_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF trim(COALESCE(p_name, '')) = '' OR trim(COALESCE(p_cnpj, '')) = ''
     OR trim(COALESCE(p_razao_social, '')) = '' OR trim(COALESCE(p_profession, '')) = ''
     OR trim(COALESCE(p_council_type, '')) = '' OR trim(COALESCE(p_council_number, '')) = ''
     OR trim(COALESCE(p_rep_name, '')) = '' OR trim(COALESCE(p_rep_cpf, '')) = '' THEN
    RAISE EXCEPTION 'missing_required_fields';
  END IF;
  IF NOT COALESCE(p_autonomy_declaration_accepted, false) THEN
    RAISE EXCEPTION 'autonomy_declaration_required';
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
    IF NOT FOUND OR NOT COALESCE(v_unit.pj_enabled, false) OR NOT COALESCE(v_unit.pj_self_registration_enabled, false) THEN
      RAISE EXCEPTION 'self_registration_disabled';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.professionals p
     WHERE p.unit_id = p_unit_id
       AND regexp_replace(COALESCE(p.cnpj, ''), '[^0-9]', '', 'g') = v_cnpj_clean
       AND v_cnpj_clean <> ''
  ) THEN
    RAISE EXCEPTION 'duplicate_cnpj';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.professionals p
     WHERE p.unit_id = p_unit_id
       AND regexp_replace(COALESCE(p.rep_cpf, ''), '[^0-9]', '', 'g') = v_cpf_clean
       AND v_cpf_clean <> ''
  ) THEN
    RAISE EXCEPTION 'duplicate_cpf';
  END IF;

  INSERT INTO public.professionals (
    unit_id, name, profession, council_type, council_number, council_uf, council_validity, specialties,
    cpf, cnpj, razao_social, nome_fantasia, natureza_juridica, cnae_principal, inscricao_municipal,
    endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf,
    email, phone, bank_name, bank_agency, bank_account, bank_account_type, pix_key,
    rep_name, rep_cpf, rep_rg, rep_birthdate, rep_email, rep_phone, rep_role,
    service_description, remuneration_model, remuneration_value, payment_day, notice_days,
    contract_start, active, registration_status, self_registered_at,
    autonomy_declaration_accepted_at, autonomy_declaration_version, lgpd_consent_accepted_at
  ) VALUES (
    p_unit_id, trim(p_name), NULLIF(trim(p_profession), ''), NULLIF(trim(p_council_type), ''), NULLIF(trim(p_council_number), ''),
    NULLIF(trim(p_council_uf), ''), p_council_validity, NULLIF(trim(p_specialties), ''),
    NULLIF(v_cpf_clean, ''), NULLIF(v_cnpj_clean, ''), NULLIF(trim(p_razao_social), ''), NULLIF(trim(p_nome_fantasia), ''),
    NULLIF(trim(p_natureza_juridica), ''), NULLIF(trim(p_cnae_principal), ''), NULLIF(trim(p_inscricao_municipal), ''),
    NULLIF(trim(p_endereco_cep), ''), NULLIF(trim(p_endereco_logradouro), ''), NULLIF(trim(p_endereco_numero), ''),
    NULLIF(trim(p_endereco_complemento), ''), NULLIF(trim(p_endereco_bairro), ''), NULLIF(trim(p_endereco_cidade), ''), NULLIF(trim(p_endereco_uf), ''),
    NULLIF(trim(p_email), ''), NULLIF(trim(p_phone), ''), NULLIF(trim(p_bank_name), ''), NULLIF(trim(p_bank_agency), ''),
    NULLIF(trim(p_bank_account), ''), NULLIF(trim(p_bank_account_type), ''), NULLIF(trim(p_pix_key), ''),
    NULLIF(trim(p_rep_name), ''), NULLIF(v_cpf_clean, ''), NULLIF(trim(p_rep_rg), ''), p_rep_birthdate,
    NULLIF(trim(p_rep_email), ''), NULLIF(trim(p_rep_phone), ''), NULLIF(trim(p_rep_role), ''),
    NULLIF(trim(p_service_description), ''), NULLIF(trim(p_remuneration_model), ''), p_remuneration_value, p_payment_day, p_notice_days,
    p_contract_start, true, v_final_status, CASE WHEN v_final_status = 'pending_validation' THEN now() ELSE NULL END,
    now(), NULLIF(trim(p_autonomy_declaration_version), ''), now()
  ) RETURNING id INTO v_new_id;

  IF v_final_status = 'pending_validation' THEN
    v_token := encode(gen_random_bytes(24), 'hex');
    INSERT INTO public.professional_self_registration_tokens (professional_id, token_hash, expires_at, uploads_used)
    VALUES (v_new_id, digest(v_token, 'sha256'), now() + interval '60 minutes', 0)
    ON CONFLICT (professional_id) DO UPDATE
      SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, uploads_used = 0, created_at = now();
    RETURN jsonb_build_object('ok', true, 'professional_id', v_new_id, 'upload_token', v_token, 'registration_status', v_final_status);
  END IF;

  RETURN jsonb_build_object('ok', true, 'professional_id', v_new_id, 'registration_status', v_final_status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_employee_kiosk_roster(p_unit text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, photo text, face_descriptor text, biometric_consent_at timestamp with time zone, last_type text, last_ts timestamp with time zone)
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unit text;
BEGIN
  v_unit := COALESCE(auth.jwt() -> 'app_metadata' ->> 'unit_id', p_unit);
  IF v_unit IS NULL OR NOT (public.jwt_is_employee_kiosk_for_unit(v_unit) OR public.jwt_is_supervisor_for_unit(v_unit)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT e.id, e.name, e.photo, e.face_descriptor, e.biometric_consent_at,
         lr.type AS last_type, lr.timestamp AS last_ts
    FROM public.employees e
    LEFT JOIN LATERAL (
      SELECT t.type, t.timestamp
        FROM public.employee_time_records t
       WHERE t.employee_id = e.id
         AND t.timestamp > now() - interval '20 hours'
       ORDER BY t.timestamp DESC
       LIMIT 1
    ) lr ON true
   WHERE e.unit_id = v_unit
     AND e.status IN ('ativo', 'aviso_previo')
     AND e.registration_status = 'validated'
   ORDER BY e.name;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 7) RLS: recria as 12 policies flagradas pelo Security Advisor
--    (rls_references_user_metadata) trocando user_metadata por app_metadata.
--    Mesma lógica, mesmos nomes de policy, só a fonte da claim muda.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Permitir escrita de unidades apenas para supervisor" ON public.units;
CREATE POLICY "Permitir escrita de unidades apenas para supervisor" ON public.units
  FOR ALL
  USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'supervisor'::text) AND jwt_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS "Permitir leitura de unidades para qualquer autenticado" ON public.units;
CREATE POLICY "Permitir leitura de unidades para qualquer autenticado" ON public.units
  FOR SELECT
  USING (
    ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'supervisor'::text) AND jwt_has_workspace_access(workspace_id))
    OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'intern_unit'::text) AND (workspace_id = jwt_own_unit_workspace()))
    OR (workspace_id = jwt_intern_self_workspace())
  );

DROP POLICY IF EXISTS "Permitir leitura de estagiários (supervisor, próprio estagiá" ON public.interns;
CREATE POLICY "Permitir leitura de estagiários (supervisor, próprio estagiá" ON public.interns
  FOR SELECT
  USING (
    (((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'supervisor'::text) AND (EXISTS (
      SELECT 1 FROM units u WHERE ((u.id = interns.unit_id) AND jwt_has_workspace_access(u.workspace_id))
    ))) OR (auth.uid() = id) OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'intern_unit'::text) AND (((auth.jwt() -> 'app_metadata'::text) ->> 'unit_id'::text) = unit_id)))
  );

DROP POLICY IF EXISTS "Permitir escrita de estagiários apenas para supervisor" ON public.interns;
CREATE POLICY "Permitir escrita de estagiários apenas para supervisor" ON public.interns
  FOR ALL
  USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'supervisor'::text) AND (EXISTS (
    SELECT 1 FROM units u WHERE ((u.id = interns.unit_id) AND jwt_has_workspace_access(u.workspace_id))
  )));

DROP POLICY IF EXISTS "Permitir leitura de pontos (supervisor, próprio estagiário ou" ON public.records;
CREATE POLICY "Permitir leitura de pontos (supervisor, próprio estagiário ou" ON public.records
  FOR SELECT
  USING (
    (((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'supervisor'::text) AND (EXISTS (
      SELECT 1 FROM units u WHERE ((u.id = records.unit_id) AND jwt_has_workspace_access(u.workspace_id))
    ))) OR (auth.uid() = intern_id) OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'intern_unit'::text) AND (EXISTS (
      SELECT 1 FROM interns i WHERE ((i.id = records.intern_id) AND (i.unit_id = ((auth.jwt() -> 'app_metadata'::text) ->> 'unit_id'::text)))
    ))))
  );

DROP POLICY IF EXISTS "Permitir inserção de pontos para supervisor, próprio estagi" ON public.records;
CREATE POLICY "Permitir inserção de pontos para supervisor, próprio estagi" ON public.records
  FOR INSERT
  WITH CHECK (
    (((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'supervisor'::text) AND (EXISTS (
      SELECT 1 FROM units u WHERE ((u.id = records.unit_id) AND jwt_has_workspace_access(u.workspace_id))
    ))) OR (auth.uid() = intern_id) OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'intern_unit'::text) AND (EXISTS (
      SELECT 1 FROM interns i WHERE ((i.id = records.intern_id) AND (i.unit_id = ((auth.jwt() -> 'app_metadata'::text) ->> 'unit_id'::text)))
    ))))
  );

DROP POLICY IF EXISTS "Permitir modificação/exclusão de pontos apenas para supervis" ON public.records;
CREATE POLICY "Permitir modificação/exclusão de pontos apenas para supervis" ON public.records
  FOR ALL
  USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'supervisor'::text) AND (EXISTS (
    SELECT 1 FROM units u WHERE ((u.id = records.unit_id) AND jwt_has_workspace_access(u.workspace_id))
  )));

DROP POLICY IF EXISTS "Permitir leitura de conteúdo de documento para supervisor, pr" ON public.document_contents;
CREATE POLICY "Permitir leitura de conteúdo de documento para supervisor, pr" ON public.document_contents
  FOR SELECT
  USING (
    (((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'supervisor'::text) AND (EXISTS (
      SELECT 1 FROM (interns i JOIN units u ON ((u.id = i.unit_id))) WHERE ((i.id = document_contents.intern_id) AND jwt_has_workspace_access(u.workspace_id))
    ))) OR (auth.uid() = intern_id) OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'intern_unit'::text) AND (EXISTS (
      SELECT 1 FROM interns i WHERE ((i.id = document_contents.intern_id) AND (i.unit_id = ((auth.jwt() -> 'app_metadata'::text) ->> 'unit_id'::text)))
    ))))
  );

DROP POLICY IF EXISTS "Permitir inserção de conteúdo de documento para supervisor, " ON public.document_contents;
CREATE POLICY "Permitir inserção de conteúdo de documento para supervisor, " ON public.document_contents
  FOR INSERT
  WITH CHECK (
    (((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'supervisor'::text) AND (EXISTS (
      SELECT 1 FROM (interns i JOIN units u ON ((u.id = i.unit_id))) WHERE ((i.id = document_contents.intern_id) AND jwt_has_workspace_access(u.workspace_id))
    ))) OR (auth.uid() = intern_id) OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'intern_unit'::text) AND (EXISTS (
      SELECT 1 FROM interns i WHERE ((i.id = document_contents.intern_id) AND (i.unit_id = ((auth.jwt() -> 'app_metadata'::text) ->> 'unit_id'::text)))
    ))))
  );

DROP POLICY IF EXISTS "Permitir modificação/exclusão de conteúdo de documento apen" ON public.document_contents;
CREATE POLICY "Permitir modificação/exclusão de conteúdo de documento apen" ON public.document_contents
  FOR ALL
  USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'supervisor'::text) AND (EXISTS (
    SELECT 1 FROM (interns i JOIN units u ON ((u.id = i.unit_id))) WHERE ((i.id = document_contents.intern_id) AND jwt_has_workspace_access(u.workspace_id))
  )));

DROP POLICY IF EXISTS "clt: leitura de feriados" ON public.holidays;
CREATE POLICY "clt: leitura de feriados" ON public.holidays
  FOR SELECT
  USING (
    (unit_id IS NULL) OR jwt_is_supervisor_for_unit(unit_id) OR jwt_is_employee_kiosk_for_unit(unit_id)
    OR ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['intern_unit'::text, 'professional_unit'::text, 'intern'::text])))
  );

DROP POLICY IF EXISTS "clt: escrita de feriados (supervisor)" ON public.holidays;
CREATE POLICY "clt: escrita de feriados (supervisor)" ON public.holidays
  FOR ALL
  USING ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'supervisor'::text))
  WITH CHECK ((((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'supervisor'::text));

-- ----------------------------------------------------------------------------
-- 8) change_intern_password: achado crítico só visível no banco ao vivo.
--    Estava GRANT TO PUBLIC (cobre anon) e sem checar se o chamador é o
--    dono da conta — qualquer pessoa na internet podia trocar a senha de
--    qualquer estagiário. Comportamento legítimo (estagiário loga com a
--    senha temporária e define a própria senha nova) preservado: só passa
--    a exigir auth.uid() = p_intern_id.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.change_intern_password(p_intern_id uuid, p_new_password text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_intern_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'a senha deve ter ao menos 6 caracteres';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_intern_id;

  UPDATE public.interns
  SET is_first_login = false
  WHERE id = p_intern_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.change_intern_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_intern_password(uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 9) Defesa em profundidade: trava qualquer tentativa de gravar role/
--    unit_id/workspace_scope em raw_user_meta_data por fora de uma sessão
--    privilegiada (postgres/supabase_admin, usadas por migrações e pelo SQL
--    editor). Depois desta migração, nada legítimo deste app grava essas
--    3 chaves ali — role/unit_id/workspace_scope agora vivem em
--    raw_app_meta_data. Isso reforça o fechamento do C-1 mesmo se algum
--    código futuro tentar voltar a confiar em user_metadata por engano.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_client_role_metadata_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') AND (
       COALESCE(NEW.raw_user_meta_data ->> 'role', '') IS DISTINCT FROM COALESCE(OLD.raw_user_meta_data ->> 'role', '')
    OR COALESCE(NEW.raw_user_meta_data ->> 'unit_id', '') IS DISTINCT FROM COALESCE(OLD.raw_user_meta_data ->> 'unit_id', '')
    OR COALESCE(NEW.raw_user_meta_data -> 'workspace_scope', 'null'::jsonb) IS DISTINCT FROM COALESCE(OLD.raw_user_meta_data -> 'workspace_scope', 'null'::jsonb)
  ) THEN
    RAISE EXCEPTION 'role/unit_id/workspace_scope não podem ser alterados via user_metadata; use as telas de administração de usuários do sistema';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_block_client_role_metadata_write ON auth.users;
CREATE TRIGGER trg_block_client_role_metadata_write
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.block_client_role_metadata_write();
