-- =========================================================================
-- SCRIPT DE CRIAÇÃO DO BANCO DE DADOS - CONTROLE DE ESTAGIÁRIOS (SUPABASE)
-- Cole este script diretamente no SQL Editor do Supabase e clique em "Run".
-- =========================================================================

-- Habilitar a extensão pgcrypto para criptografia de senhas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. LIMPEZA DE TABELAS EXISTENTES (ATENÇÃO: MANTIDO COMENTADO PARA NÃO APAGAR DADOS)
-- DROP TABLE IF EXISTS public.records CASCADE;
-- DROP TABLE IF EXISTS public.document_contents CASCADE;
-- DROP TABLE IF EXISTS public.interns CASCADE;
-- DROP TABLE IF EXISTS public.units CASCADE;

-- 2. TABELA DE UNIDADES
CREATE TABLE IF NOT EXISTS public.units (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    address text,
    lat numeric NOT NULL,
    lng numeric NOT NULL,
    radius_km numeric NOT NULL DEFAULT 5,
    radius_m numeric NOT NULL DEFAULT 5000,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. TABELA DE ESTAGIÁRIOS (Sem vínculo obrigatório com auth.users)
CREATE TABLE IF NOT EXISTS public.interns (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    course text,
    institution text,
    shift text,
    daily_hours integer DEFAULT 6,
    unit_id text REFERENCES public.units(id) ON DELETE SET NULL,
    active boolean DEFAULT true,
    start_date date,
    end_date date,
    last_report_date date,
    recess_days_taken numeric DEFAULT 0,
    username text UNIQUE NOT NULL,
    is_first_login boolean DEFAULT true,
    birthdate date,
    face_descriptor text,
    documents jsonb DEFAULT '{}'::jsonb,
    photo text,
    cpf text,
    email text,
    rg text,
    phone text,
    address text,
    bank_name text,
    bank_agency text,
    bank_account text,
    pix_key text,
    emergency_name text,
    emergency_relationship text,
    emergency_phone text,
    allowance numeric DEFAULT 0,
    supervisor_name text,
    registration_status text DEFAULT 'validated',
    semestral_reports jsonb DEFAULT '{}'::jsonb,
    contract_termination jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. TABELA DE REGISTROS DE FREQUÊNCIA (PONTO)
CREATE TABLE IF NOT EXISTS public.records (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    intern_id uuid REFERENCES public.interns(id) ON DELETE SET NULL,
    intern_name text,
    action text NOT NULL, -- 'entrada' ou 'saida'
    justification text,
    timestamp timestamp with time zone NOT NULL DEFAULT now(),
    photo text, -- Armazena a foto em Base64
    is_manual boolean DEFAULT false,
    justification_doc jsonb DEFAULT '{}'::jsonb,
    geo jsonb DEFAULT '{}'::jsonb,
    days_away integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- 5. INSERÇÃO DAS UNIDADES PADRÃO da Porto Terapia
INSERT INTO public.units (id, name, address, lat, lng, radius_km, radius_m) VALUES
('antonio-barreto', 'Unidade Antônio Barreto', 'R. Antônio Barreto, 2050 - Fátima, Belém - PA, 66060-021', -1.442473861453128, -48.469996243820276, 5, 5000),
('generalissimo', 'Unidade Generalíssimo', 'Av. Generalíssimo Deodoro, 564 - Nazaré, Belém - PA', -1.4456511159378498, -48.48304674431182, 5, 5000)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius_km = EXCLUDED.radius_km,
  radius_m = EXCLUDED.radius_m;

-- 6. INSERÇÃO DO SUPERVISOR PADRÃO
-- IMPORTANTE: troque o valor abaixo por uma senha forte ANTES de rodar este
-- script em produção. Não deixe a senha real deste usuário em um arquivo
-- versionado no repositório.
-- Limpar supervisor antigo para garantir reconstrução sem conflitos de UUID ou identidades
DELETE FROM auth.users WHERE email = 'supervisor@portoterapia.com';

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  is_sso_user,
  is_anonymous
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '00000000-0000-0000-0000-000000000000',
  'supervisor@portoterapia.com',
  crypt('TROQUE_ESTA_SENHA_ANTES_DE_RODAR_EM_PRODUCAO', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Supervisor Geral", "role": "supervisor"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  '',
  '',
  '',
  false,
  false
);

-- Inserir identidade do supervisor para habilitar login no Supabase Auth (GoTrue)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '{"sub":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11","email":"supervisor@portoterapia.com"}'::jsonb,
  'email',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  now(),
  now(),
  now()
);

-- 6b. INSERÇÃO DE ADMINISTRADORES NOMEADOS (mesmo papel 'supervisor')
-- Guimelly: guimelly@portoterapia.com / Senha: admin321
-- Bruno: bruno@portoterapia.com / Senha: admin321
-- Isabella: isabella@portoterapia.com / Senha: admin321
-- Ian: ian@portoterapia.com / Senha: admin321
-- IMPORTANTE: troque estas senhas por senhas fortes assim que possível.

DELETE FROM auth.users WHERE email IN ('guimelly@portoterapia.com', 'bruno@portoterapia.com', 'isabella@portoterapia.com', 'ian@portoterapia.com');

-- Guimelly
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  is_sso_user,
  is_anonymous
) VALUES (
  'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  '00000000-0000-0000-0000-000000000000',
  'guimelly@portoterapia.com',
  crypt('admin321', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Guimelly", "role": "supervisor"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  '',
  '',
  '',
  false,
  false
);

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  '{"sub":"d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44","email":"guimelly@portoterapia.com"}'::jsonb,
  'email',
  'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  now(),
  now(),
  now()
);

-- Bruno
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  is_sso_user,
  is_anonymous
) VALUES (
  'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
  '00000000-0000-0000-0000-000000000000',
  'bruno@portoterapia.com',
  crypt('admin321', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Bruno", "role": "supervisor"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  '',
  '',
  '',
  false,
  false
);

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
  '{"sub":"e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55","email":"bruno@portoterapia.com"}'::jsonb,
  'email',
  'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
  now(),
  now(),
  now()
);

-- Isabella
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  is_sso_user,
  is_anonymous
) VALUES (
  'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
  '00000000-0000-0000-0000-000000000000',
  'isabella@portoterapia.com',
  crypt('admin321', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Isabella", "role": "supervisor"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  '',
  '',
  '',
  false,
  false
);

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
  '{"sub":"f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66","email":"isabella@portoterapia.com"}'::jsonb,
  'email',
  'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
  now(),
  now(),
  now()
);

-- Ian
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  is_sso_user,
  is_anonymous
) VALUES (
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a77',
  '00000000-0000-0000-0000-000000000000',
  'ian@portoterapia.com',
  crypt('admin321', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Ian", "role": "supervisor"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  '',
  '',
  '',
  false,
  false
);

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a77',
  '{"sub":"a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a77","email":"ian@portoterapia.com"}'::jsonb,
  'email',
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a77',
  now(),
  now(),
  now()
);

-- 7. INSERÇÃO DOS ESTAGIÁRIOS GENÉRICOS POR UNIDADE
-- Antônio Barreto: antoniobarreto@portoterapia.com / Senha: estagio123
-- Generalíssimo: generalissimo@portoterapia.com / Senha: estagio123

DELETE FROM auth.users WHERE email IN ('antoniobarreto@portoterapia.com', 'generalissimo@portoterapia.com');

-- Antônio Barreto
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  is_sso_user,
  is_anonymous
) VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  '00000000-0000-0000-0000-000000000000',
  'antoniobarreto@portoterapia.com',
  crypt('estagio123', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Estagiário Antônio Barreto", "role": "intern_unit", "unit_id": "antonio-barreto"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  '',
  '',
  '',
  false,
  false
);

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  '{"sub":"b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22","email":"antoniobarreto@portoterapia.com"}'::jsonb,
  'email',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  now(),
  now(),
  now()
);

-- Generalíssimo
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  is_sso_user,
  is_anonymous
) VALUES (
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  '00000000-0000-0000-0000-000000000000',
  'generalissimo@portoterapia.com',
  crypt('estagio123', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "Estagiário Generalíssimo", "role": "intern_unit", "unit_id": "generalissimo"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  '',
  '',
  '',
  false,
  false
);

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  '{"sub":"c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33","email":"generalissimo@portoterapia.com"}'::jsonb,
  'email',
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  now(),
  now(),
  now()
);


-- =========================================================================
-- FUNÇÕES PL/pgSQL (SECURITY DEFINER) PARA GERENCIAMENTO DE ESTAGIÁRIOS
-- Executam com privilégios elevados para gerenciar auth.users com segurança
-- =========================================================================

-- Função 1: Criar novo estagiário (cria conta em auth.users e na tabela interns)
-- Remover versões anteriores (sobrecarregadas) da função para evitar o erro "Could not choose the best candidate function" no PostgREST
DROP FUNCTION IF EXISTS public.create_intern_user(
  text, text, text, text, text, text, integer, text, date, date, text, text, text, text, text, text, text, text, text, text, text, text, numeric
);
DROP FUNCTION IF EXISTS public.create_intern_user(
  text, text, text, text, text, text, integer, text, date, date, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, text, jsonb
);

CREATE OR REPLACE FUNCTION public.create_intern_user(
  p_email text,
  p_password text,
  p_name text,
  p_course text,
  p_institution text,
  p_shift text,
  p_daily_hours integer,
  p_unit_id text,
  p_start_date date,
  p_end_date date,
  p_photo text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_rg text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_bank_name text DEFAULT NULL,
  p_bank_agency text DEFAULT NULL,
  p_bank_account text DEFAULT NULL,
  p_pix_key text DEFAULT NULL,
  p_emergency_name text DEFAULT NULL,
  p_emergency_relationship text DEFAULT NULL,
  p_emergency_phone text DEFAULT NULL,
  p_allowance numeric DEFAULT 0,
  p_supervisor_name text DEFAULT NULL,
  p_registration_status text DEFAULT 'validated',
  p_documents jsonb DEFAULT '{}'::jsonb,
  p_birthdate date DEFAULT NULL,
  p_face_descriptor text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  new_intern_id uuid;
  caller_role text := (auth.jwt() -> 'user_metadata' ->> 'role');
  caller_unit text := (auth.jwt() -> 'user_metadata' ->> 'unit_id');
  final_registration_status text := p_registration_status;
  final_unit_id text := p_unit_id;
BEGIN
  -- Supervisor (cadastro administrativo), login de unidade/quiosque ou cadastro anônimo obrigatório podem chamar esta função.
  IF caller_role IS DISTINCT FROM 'supervisor' AND caller_role IS DISTINCT FROM 'intern_unit' AND caller_role IS NOT NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Um login de unidade ou cadastro anônimo só pode se autocadastrar como pendente de validação
  IF caller_role = 'intern_unit' OR caller_role IS NULL THEN
    final_registration_status := 'pending_validation';
    IF caller_role = 'intern_unit' AND caller_unit IS NOT NULL THEN
      final_unit_id := caller_unit;
    END IF;
  END IF;

  -- Gerar novo UUID aleatório para o estagiário
  new_intern_id := gen_random_uuid();

  -- Inserir diretamente no public.interns sem criar registro no auth.users
  INSERT INTO public.interns (
    id,
    name,
    course,
    institution,
    shift,
    daily_hours,
    unit_id,
    active,
    start_date,
    end_date,
    username,
    is_first_login,
    documents,
    photo,
    cpf,
    email,
    rg,
    phone,
    address,
    bank_name,
    bank_agency,
    bank_account,
    pix_key,
    emergency_name,
    emergency_relationship,
    emergency_phone,
    allowance,
    supervisor_name,
    registration_status,
    semestral_reports,
    contract_termination,
    birthdate,
    face_descriptor
  ) VALUES (
    new_intern_id,
    p_name,
    p_course,
    p_institution,
    p_shift,
    p_daily_hours,
    final_unit_id,
    true,
    p_start_date,
    p_end_date,
    COALESCE(split_part(p_email, '@', 1), 'estagiario_' || substring(md5(random()::text) from 1 for 6)),
    false,
    p_documents,
    p_photo,
    p_cpf,
    p_email,
    p_rg,
    p_phone,
    p_address,
    p_bank_name,
    p_bank_agency,
    p_bank_account,
    p_pix_key,
    p_emergency_name,
    p_emergency_relationship,
    p_emergency_phone,
    p_allowance,
    p_supervisor_name,
    final_registration_status,
    '{}'::jsonb,
    '{}'::jsonb,
    p_birthdate,
    p_face_descriptor
  );

  RETURN new_intern_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_intern_user(
  text, text, text, text, text, text, integer, text, date, date, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, text, jsonb, date, text
) TO anon, authenticated;

-- Função 2: Excluir estagiário (deleta de auth.users e o cascade limpa public.interns)
-- Apenas o supervisor pode excluir estagiários.
CREATE OR REPLACE FUNCTION public.delete_intern_user(p_intern_id uuid) RETURNS void AS $$
BEGIN
  IF (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'supervisor' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- LGPD: anonimiza as fotos biométricas dos registros de ponto antes de excluir o
  -- estagiário, para que não fiquem órfãs indefinidamente no banco (records.intern_id
  -- é ON DELETE SET NULL, então a foto sobreviveria sem vínculo ao titular dos dados).
  UPDATE public.records SET photo = NULL WHERE intern_id = p_intern_id;

  DELETE FROM public.interns WHERE id = p_intern_id;
  DELETE FROM auth.users WHERE id = p_intern_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.delete_intern_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_intern_user(uuid) TO authenticated;

-- Função 3: Resetar senha do estagiário para '0000'
-- Ação administrativa: apenas o supervisor pode resetar a senha de qualquer estagiário.
CREATE OR REPLACE FUNCTION public.reset_intern_password(p_intern_id uuid, p_new_password text) RETURNS void AS $$
BEGIN
  IF (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'supervisor' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_intern_id;

  UPDATE public.interns
  SET is_first_login = true
  WHERE id = p_intern_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.reset_intern_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_intern_password(uuid, text) TO authenticated;

-- Função 4: Alterar senha inicial do estagiário no primeiro login
-- Permitido para o supervisor, ou para o login de unidade/quiosque desde que
-- o estagiário-alvo pertença à mesma unidade de quem está chamando.
CREATE OR REPLACE FUNCTION public.change_intern_password(p_intern_id uuid, p_new_password text) RETURNS void AS $$
DECLARE
  caller_role text := (auth.jwt() -> 'user_metadata' ->> 'role');
  caller_unit text := (auth.jwt() -> 'user_metadata' ->> 'unit_id');
  target_unit text;
BEGIN
  IF caller_role = 'supervisor' THEN
    NULL; -- autorizado
  ELSIF caller_role = 'intern_unit' THEN
    SELECT unit_id INTO target_unit FROM public.interns WHERE id = p_intern_id;
    IF target_unit IS NULL OR target_unit IS DISTINCT FROM caller_unit THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
  ELSE
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_intern_id;

  UPDATE public.interns
  SET is_first_login = false
  WHERE id = p_intern_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.change_intern_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_intern_password(uuid, text) TO authenticated;


-- =========================================================================
-- CONTROLE DE ACESSO - ROW LEVEL SECURITY (RLS) & POLÍTICAS
-- =========================================================================

-- Habilitar RLS nas tabelas
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

-- 1. Políticas de Segurança para 'units'
CREATE POLICY "Permitir leitura de unidades para qualquer autenticado" 
    ON public.units FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir escrita de unidades apenas para supervisor" 
    ON public.units FOR ALL 
    USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');

-- 2. Políticas de Segurança para 'interns'
CREATE POLICY "Permitir leitura de estagiários (supervisor, próprio estagiário ou login de unidade)" 
    ON public.interns FOR SELECT 
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor' 
        OR auth.uid() = id
        OR (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'intern_unit'
            AND (auth.jwt() -> 'user_metadata' ->> 'unit_id') = unit_id
        )
    );

CREATE POLICY "Permitir escrita de estagiários apenas para supervisor" 
    ON public.interns FOR ALL 
    USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');

CREATE POLICY "Permitir que estagiários atualizem seus próprios documentos ou perfil"
    ON public.interns FOR UPDATE
    USING (auth.uid() = id);

-- A policy acima permite que o próprio estagiário faça UPDATE na sua linha,
-- mas o Postgres RLS não restringe COLUNAS — sem o trigger abaixo, um
-- estagiário autenticado poderia alterar `allowance`, `active`,
-- `registration_status`, `unit_id`, `face_descriptor` etc. via uma chamada
-- direta à API, e não só os campos que a UI expõe.
-- O trigger força que, fora do papel "supervisor", uma auto-atualização só
-- possa alterar `documents` e `photo` — todas as demais colunas são
-- reescritas para o valor anterior.
CREATE OR REPLACE FUNCTION public.enforce_intern_self_update_columns() RETURNS trigger AS $$
BEGIN
  IF (auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.id THEN
    NEW.name := OLD.name;
    NEW.course := OLD.course;
    NEW.institution := OLD.institution;
    NEW.shift := OLD.shift;
    NEW.daily_hours := OLD.daily_hours;
    NEW.unit_id := OLD.unit_id;
    NEW.active := OLD.active;
    NEW.start_date := OLD.start_date;
    NEW.end_date := OLD.end_date;
    NEW.last_report_date := OLD.last_report_date;
    NEW.recess_days_taken := OLD.recess_days_taken;
    NEW.username := OLD.username;
    NEW.is_first_login := OLD.is_first_login;
    NEW.birthdate := OLD.birthdate;
    NEW.face_descriptor := OLD.face_descriptor;
    NEW.cpf := OLD.cpf;
    NEW.email := OLD.email;
    NEW.rg := OLD.rg;
    NEW.address := OLD.address;
    NEW.bank_name := OLD.bank_name;
    NEW.bank_agency := OLD.bank_agency;
    NEW.bank_account := OLD.bank_account;
    NEW.pix_key := OLD.pix_key;
    NEW.emergency_name := OLD.emergency_name;
    NEW.emergency_relationship := OLD.emergency_relationship;
    NEW.emergency_phone := OLD.emergency_phone;
    NEW.allowance := OLD.allowance;
    NEW.supervisor_name := OLD.supervisor_name;
    NEW.registration_status := OLD.registration_status;
    NEW.semestral_reports := OLD.semestral_reports;
    NEW.contract_termination := OLD.contract_termination;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_restrict_intern_self_update ON public.interns;
CREATE TRIGGER trg_restrict_intern_self_update
    BEFORE UPDATE ON public.interns
    FOR EACH ROW EXECUTE FUNCTION public.enforce_intern_self_update_columns();

-- 3. Políticas de Segurança para 'records'
CREATE POLICY "Permitir leitura de pontos (supervisor, próprio estagiário ou login de unidade)" 
    ON public.records FOR SELECT 
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor' 
        OR auth.uid() = intern_id
        OR (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'intern_unit'
            AND EXISTS (
                SELECT 1 FROM public.interns i
                WHERE i.id = intern_id 
                AND i.unit_id = (auth.jwt() -> 'user_metadata' ->> 'unit_id')
            )
        )
    );

CREATE POLICY "Permitir inserção de pontos para supervisor, próprio estagiário ou login de unidade" 
    ON public.records FOR INSERT 
    WITH CHECK (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor' 
        OR auth.uid() = intern_id
        OR (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'intern_unit'
            AND EXISTS (
                SELECT 1 FROM public.interns i
                WHERE i.id = intern_id 
                AND i.unit_id = (auth.jwt() -> 'user_metadata' ->> 'unit_id')
            )
        )
    );

CREATE POLICY "Permitir modificação/exclusão de pontos apenas para supervisor" 
    ON public.records FOR ALL 
    USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');

-- =========================================================================
-- TABELA ADICIONAL DE DOCUMENTOS PARA OTIMIZAÇÃO DE PERFORMANCE
-- =========================================================================

-- 4.b TABELA DE CONTEÚDO DOS DOCUMENTOS (Armazenamento separado do conteúdo em Base64 para otimização de performance)
CREATE TABLE IF NOT EXISTS public.document_contents (
    intern_id uuid REFERENCES public.interns(id) ON DELETE CASCADE,
    doc_key text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (intern_id, doc_key)
);

-- Habilitar RLS na tabela document_contents
ALTER TABLE public.document_contents ENABLE ROW LEVEL SECURITY;

-- Políticas para document_contents
CREATE POLICY "Permitir leitura de conteúdo de documento para supervisor, próprio estagiário ou login de unidade" 
    ON public.document_contents FOR SELECT 
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor' 
        OR auth.uid() = intern_id
        OR (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'intern_unit'
            AND EXISTS (
                SELECT 1 FROM public.interns i
                WHERE i.id = intern_id 
                AND i.unit_id = (auth.jwt() -> 'user_metadata' ->> 'unit_id')
            )
        )
    );

CREATE POLICY "Permitir inserção de conteúdo de documento para supervisor, próprio estagiário ou login de unidade" 
    ON public.document_contents FOR INSERT 
    WITH CHECK (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor' 
        OR auth.uid() = intern_id
        OR (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'intern_unit'
            AND EXISTS (
                SELECT 1 FROM public.interns i
                WHERE i.id = intern_id 
                AND i.unit_id = (auth.jwt() -> 'user_metadata' ->> 'unit_id')
            )
        )
    );

CREATE POLICY "Permitir modificação/exclusão de conteúdo de documento apenas para supervisor" 
    ON public.document_contents FOR ALL 
    USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');

-- Habilitar replicação em tempo real para as tabelas principais
alter publication supabase_realtime add table public.interns;
alter publication supabase_realtime add table public.records;
alter publication supabase_realtime add table public.units;

-- =========================================================================
-- ÍNDICES DE PERFORMANCE (ACELERAR QUERIES E REGRAS RLS)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_records_intern_id ON public.records(intern_id);
CREATE INDEX IF NOT EXISTS idx_records_timestamp ON public.records(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_records_action ON public.records(action);
CREATE INDEX IF NOT EXISTS idx_interns_unit_id ON public.interns(unit_id);
CREATE INDEX IF NOT EXISTS idx_interns_active ON public.interns(active);
CREATE INDEX IF NOT EXISTS idx_document_contents_intern ON public.document_contents(intern_id, doc_key);

-- =========================================================================
-- MULTI-WORKSPACE: GRUPO IB (Faça Amigos Parque Shopping, Faça Amigos Grão
-- Pará, Clínica A, Clínica B) atendido por um segundo deploy (Vercel) que
-- compartilha este mesmo banco com a Porto Terapia, sem misturar dados.
-- Idempotente: pode ser rodado de novo sem duplicar/quebrar nada.
-- =========================================================================

-- 8. Tabela de workspaces (agrupamento de unidades por "empresa/deploy")
CREATE TABLE IF NOT EXISTS public.workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

INSERT INTO public.workspaces (id, name) VALUES
  ('porto-terapia', 'Porto Terapia'),
  ('grupoib', 'Grupo IB')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 9. units: workspace_id + config por unidade (login de quiosque, exigência de biometria)
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'porto-terapia'
    REFERENCES public.workspaces(id),
  ADD COLUMN IF NOT EXISTS kiosk_email text,
  ADD COLUMN IF NOT EXISTS biometric_required boolean NOT NULL DEFAULT true;

UPDATE public.units SET kiosk_email = 'antoniobarreto@portoterapia.com' WHERE id = 'antonio-barreto' AND kiosk_email IS NULL;
UPDATE public.units SET kiosk_email = 'generalissimo@portoterapia.com' WHERE id = 'generalissimo' AND kiosk_email IS NULL;

-- Unidades do Grupo IB (endereço/coordenadas placeholder — calibrar na unidade física antes do go-live)
INSERT INTO public.units (id, name, address, lat, lng, radius_km, radius_m, workspace_id, kiosk_email, biometric_required) VALUES
  ('faca-amigos-parque-shopping', 'Faça Amigos Parque Shopping', 'ENDEREÇO PENDENTE', 0, 0, 5, 5000, 'grupoib', 'parqueshopping@grupoib.internal', true),
  ('faca-amigos-grao-para',       'Faça Amigos Grão Pará',       'ENDEREÇO PENDENTE', 0, 0, 5, 5000, 'grupoib', 'graopara@grupoib.internal',       true),
  ('clinica-a',                   'Clínica A',                    'ENDEREÇO PENDENTE', 0, 0, 5, 5000, 'grupoib', 'clinicaa@grupoib.internal',       true),
  ('clinica-b',                   'Clínica B',                    'ENDEREÇO PENDENTE', 0, 0, 5, 5000, 'grupoib', 'clinicab@grupoib.internal',       true)
ON CONFLICT (id) DO NOTHING;

-- 10. records.unit_id — coluna durável (interns.unit_id e records.intern_id são
-- ON DELETE SET NULL, então um join ao vivo via intern não é confiável para
-- histórico depois que o estagiário é removido). Preenchida automaticamente.
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS unit_id text REFERENCES public.units(id) ON DELETE SET NULL;

UPDATE public.records r
SET unit_id = COALESCE(r.geo->>'unitId', i.unit_id)
FROM public.interns i
WHERE r.unit_id IS NULL AND i.id = r.intern_id;

CREATE OR REPLACE FUNCTION public.set_record_unit_id() RETURNS trigger AS $$
BEGIN
  IF NEW.unit_id IS NULL THEN
    NEW.unit_id := NEW.geo->>'unitId';
  END IF;
  IF NEW.unit_id IS NULL AND NEW.intern_id IS NOT NULL THEN
    SELECT unit_id INTO NEW.unit_id FROM public.interns WHERE id = NEW.intern_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_record_unit_id ON public.records;
CREATE TRIGGER trg_set_record_unit_id
  BEFORE INSERT ON public.records
  FOR EACH ROW EXECUTE FUNCTION public.set_record_unit_id();

CREATE INDEX IF NOT EXISTS idx_records_unit_id ON public.records(unit_id);
CREATE INDEX IF NOT EXISTS idx_units_workspace_id ON public.units(workspace_id);

-- 11. Helper de RLS: o chamador tem acesso ao workspace informado?
-- user_metadata.workspace_scope é um array jsonb (ex.: ["porto-terapia"] ou
-- ["all"] para quem administra os dois grupos, como o Bruno).
CREATE OR REPLACE FUNCTION public.jwt_has_workspace_access(target_workspace text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(auth.jwt() -> 'user_metadata' -> 'workspace_scope', '[]'::jsonb) ? 'all'
    OR (target_workspace IS NOT NULL
        AND COALESCE(auth.jwt() -> 'user_metadata' -> 'workspace_scope', '[]'::jsonb) ? target_workspace);
$$;

-- 12. Metadados dos supervisores existentes (rodar ANTES de trocar as políticas
-- abaixo, para nenhuma sessão supervisor ficar sem workspace_scope e perder
-- acesso). Bruno, Guimelly e Isabella administram os dois grupos; o Supervisor
-- Geral genérico (fallback do quiosque) fica restrito à Porto Terapia.
UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"workspace_scope": ["all"]}'::jsonb
  WHERE email IN ('bruno@portoterapia.com', 'guimelly@portoterapia.com', 'isabella@portoterapia.com');

UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"workspace_scope": ["porto-terapia"]}'::jsonb
  WHERE email = 'supervisor@portoterapia.com';

-- 13. RLS: as políticas do papel 'supervisor' agora respeitam o workspace da
-- unidade da linha; as políticas de 'intern_unit' (quiosque) e auth.uid()
-- (autoatendimento do estagiário) continuam inalteradas, pois já são
-- restritas à própria unidade.

DROP POLICY IF EXISTS "Permitir leitura de unidades para qualquer autenticado" ON public.units;
CREATE POLICY "Permitir leitura de unidades para qualquer autenticado"
    ON public.units FOR SELECT
    USING (
        ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor' AND public.jwt_has_workspace_access(workspace_id))
        OR (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'intern_unit'
            AND workspace_id = (SELECT u2.workspace_id FROM public.units u2 WHERE u2.id = (auth.jwt() -> 'user_metadata' ->> 'unit_id'))
        )
        OR workspace_id = (
            SELECT u2.workspace_id FROM public.units u2
            JOIN public.interns i ON i.unit_id = u2.id
            WHERE i.id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Permitir escrita de unidades apenas para supervisor" ON public.units;
CREATE POLICY "Permitir escrita de unidades apenas para supervisor"
    ON public.units FOR ALL
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor'
        AND public.jwt_has_workspace_access(workspace_id)
    );

DROP POLICY IF EXISTS "Permitir leitura de estagiários (supervisor, próprio estagiário ou login de unidade)" ON public.interns;
CREATE POLICY "Permitir leitura de estagiários (supervisor, próprio estagiário ou login de unidade)"
    ON public.interns FOR SELECT
    USING (
        ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor'
         AND EXISTS (SELECT 1 FROM public.units u WHERE u.id = interns.unit_id AND public.jwt_has_workspace_access(u.workspace_id)))
        OR auth.uid() = id
        OR (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'intern_unit'
            AND (auth.jwt() -> 'user_metadata' ->> 'unit_id') = unit_id
        )
    );

DROP POLICY IF EXISTS "Permitir escrita de estagiários apenas para supervisor" ON public.interns;
CREATE POLICY "Permitir escrita de estagiários apenas para supervisor"
    ON public.interns FOR ALL
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor'
        AND EXISTS (SELECT 1 FROM public.units u WHERE u.id = interns.unit_id AND public.jwt_has_workspace_access(u.workspace_id))
    );

DROP POLICY IF EXISTS "Permitir leitura de pontos (supervisor, próprio estagiário ou login de unidade)" ON public.records;
CREATE POLICY "Permitir leitura de pontos (supervisor, próprio estagiário ou login de unidade)"
    ON public.records FOR SELECT
    USING (
        ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor'
         AND EXISTS (SELECT 1 FROM public.units u WHERE u.id = records.unit_id AND public.jwt_has_workspace_access(u.workspace_id)))
        OR auth.uid() = intern_id
        OR (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'intern_unit'
            AND EXISTS (SELECT 1 FROM public.interns i WHERE i.id = intern_id AND i.unit_id = (auth.jwt() -> 'user_metadata' ->> 'unit_id'))
        )
    );

DROP POLICY IF EXISTS "Permitir inserção de pontos para supervisor, próprio estagiário ou login de unidade" ON public.records;
CREATE POLICY "Permitir inserção de pontos para supervisor, próprio estagiário ou login de unidade"
    ON public.records FOR INSERT
    WITH CHECK (
        ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor'
         AND EXISTS (SELECT 1 FROM public.units u WHERE u.id = unit_id AND public.jwt_has_workspace_access(u.workspace_id)))
        OR auth.uid() = intern_id
        OR (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'intern_unit'
            AND EXISTS (SELECT 1 FROM public.interns i WHERE i.id = intern_id AND i.unit_id = (auth.jwt() -> 'user_metadata' ->> 'unit_id'))
        )
    );

DROP POLICY IF EXISTS "Permitir modificação/exclusão de pontos apenas para supervisor" ON public.records;
CREATE POLICY "Permitir modificação/exclusão de pontos apenas para supervisor"
    ON public.records FOR ALL
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor'
        AND EXISTS (SELECT 1 FROM public.units u WHERE u.id = records.unit_id AND public.jwt_has_workspace_access(u.workspace_id))
    );

DROP POLICY IF EXISTS "Permitir leitura de conteúdo de documento para supervisor, próprio estagiário ou login de unidade" ON public.document_contents;
CREATE POLICY "Permitir leitura de conteúdo de documento para supervisor, próprio estagiário ou login de unidade"
    ON public.document_contents FOR SELECT
    USING (
        ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor'
         AND EXISTS (SELECT 1 FROM public.interns i JOIN public.units u ON u.id = i.unit_id
               WHERE i.id = document_contents.intern_id AND public.jwt_has_workspace_access(u.workspace_id)))
        OR auth.uid() = intern_id
        OR (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'intern_unit'
            AND EXISTS (SELECT 1 FROM public.interns i WHERE i.id = intern_id AND i.unit_id = (auth.jwt() -> 'user_metadata' ->> 'unit_id'))
        )
    );

DROP POLICY IF EXISTS "Permitir inserção de conteúdo de documento para supervisor, próprio estagiário ou login de unidade" ON public.document_contents;
CREATE POLICY "Permitir inserção de conteúdo de documento para supervisor, próprio estagiário ou login de unidade"
    ON public.document_contents FOR INSERT
    WITH CHECK (
        ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor'
         AND EXISTS (SELECT 1 FROM public.interns i JOIN public.units u ON u.id = i.unit_id
               WHERE i.id = intern_id AND public.jwt_has_workspace_access(u.workspace_id)))
        OR auth.uid() = intern_id
        OR (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'intern_unit'
            AND EXISTS (SELECT 1 FROM public.interns i WHERE i.id = intern_id AND i.unit_id = (auth.jwt() -> 'user_metadata' ->> 'unit_id'))
        )
    );

DROP POLICY IF EXISTS "Permitir modificação/exclusão de conteúdo de documento apenas para supervisor" ON public.document_contents;
CREATE POLICY "Permitir modificação/exclusão de conteúdo de documento apenas para supervisor"
    ON public.document_contents FOR ALL
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor'
        AND EXISTS (SELECT 1 FROM public.interns i JOIN public.units u ON u.id = i.unit_id
              WHERE i.id = document_contents.intern_id AND public.jwt_has_workspace_access(u.workspace_id))
    );

-- 14. RPCs: create_intern_user/delete_intern_user/reset_intern_password agora
-- também checam workspace (além do papel), evitando que um supervisor
-- restrito a um workspace mexa em estagiário de outro workspace via RPC
-- (RPCs são SECURITY DEFINER e por isso ignoram as políticas de RLS acima).
-- Também restaura, no create_intern_user e no delete_intern_user, checagens
-- que já existiam no restante deste arquivo mas haviam divergido do banco
-- em produção (bug encontrado durante esta migração — corrigido aqui).

CREATE OR REPLACE FUNCTION public.create_intern_user(
  p_email text, p_password text, p_name text, p_course text, p_institution text, p_shift text,
  p_daily_hours integer, p_unit_id text, p_start_date date, p_end_date date,
  p_photo text DEFAULT NULL, p_cpf text DEFAULT NULL, p_rg text DEFAULT NULL, p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL, p_bank_name text DEFAULT NULL, p_bank_agency text DEFAULT NULL,
  p_bank_account text DEFAULT NULL, p_pix_key text DEFAULT NULL, p_emergency_name text DEFAULT NULL,
  p_emergency_relationship text DEFAULT NULL, p_emergency_phone text DEFAULT NULL,
  p_allowance numeric DEFAULT 0, p_supervisor_name text DEFAULT NULL,
  p_registration_status text DEFAULT 'validated', p_documents jsonb DEFAULT '{}'::jsonb,
  p_birthdate date DEFAULT NULL, p_face_descriptor text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  new_intern_id uuid;
  caller_role text := (auth.jwt() -> 'user_metadata' ->> 'role');
  caller_unit text := (auth.jwt() -> 'user_metadata' ->> 'unit_id');
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

GRANT EXECUTE ON FUNCTION public.create_intern_user(
  text, text, text, text, text, text, integer, text, date, date, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, text, jsonb, date, text
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_intern_user(p_intern_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'supervisor' THEN
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

  -- LGPD: anonimiza as fotos biométricas dos registros de ponto antes de excluir o
  -- estagiário, para que não fiquem órfãs indefinidamente no banco (records.intern_id
  -- é ON DELETE SET NULL, então a foto sobreviveria sem vínculo ao titular dos dados).
  UPDATE public.records SET photo = NULL WHERE intern_id = p_intern_id;

  DELETE FROM public.interns WHERE id = p_intern_id;
  DELETE FROM auth.users WHERE id = p_intern_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_intern_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_intern_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_intern_password(p_intern_id uuid, p_new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'supervisor' THEN
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

REVOKE ALL ON FUNCTION public.reset_intern_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_intern_password(uuid, text) TO authenticated;

-- 15. Logins de quiosque das 4 novas unidades (mesmo padrão dos existentes:
-- role 'intern_unit', senha compartilhada 'estagio123', sem necessidade de
-- caixa de e-mail real). Idempotente via DELETE + INSERT, como o restante
-- deste arquivo faz para os demais usuários seed.
DO $$
DECLARE
  units_data jsonb := '[
    {"email": "parqueshopping@grupoib.internal", "name": "Estagiário Faça Amigos Parque Shopping", "unit_id": "faca-amigos-parque-shopping"},
    {"email": "graopara@grupoib.internal", "name": "Estagiário Faça Amigos Grão Pará", "unit_id": "faca-amigos-grao-para"},
    {"email": "clinicaa@grupoib.internal", "name": "Estagiário Clínica A", "unit_id": "clinica-a"},
    {"email": "clinicab@grupoib.internal", "name": "Estagiário Clínica B", "unit_id": "clinica-b"}
  ]'::jsonb;
  u jsonb;
  new_id uuid;
BEGIN
  FOR u IN SELECT * FROM jsonb_array_elements(units_data) LOOP
    DELETE FROM auth.users WHERE email = (u->>'email');
    new_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      is_sso_user, is_anonymous
    ) VALUES (
      new_id, '00000000-0000-0000-0000-000000000000', u->>'email',
      crypt('estagio123', gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('name', u->>'name', 'role', 'intern_unit', 'unit_id', u->>'unit_id'),
      'authenticated', 'authenticated', now(), now(),
      '', '', '', '', false, false
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), new_id,
      jsonb_build_object('sub', new_id::text, 'email', u->>'email'),
      'email', new_id::text, now(), now(), now()
    );
  END LOOP;
END $$;

-- 11. Colunas adicionais em public.units para personnalização de dados cadastrais, timbres e documentos por unidade
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS tce_custom_text text,
  ADD COLUMN IF NOT EXISTS pae_custom_text text,
  ADD COLUMN IF NOT EXISTS declaracao_custom_text text,
  ADD COLUMN IF NOT EXISTS ficha_custom_text text;



-- =========================================================================
-- 16. MÓDULO PROFISSIONAIS PJ (prestadores de serviço) — Grupo IB
-- Tabelas próprias, separadas de interns/records, para que a presença de
-- prestadores nunca se misture com o ponto/bolsa de estagiários. Isolamento
-- feito no servidor via papel de quiosque próprio ('professional_unit'):
--   * intern_unit não aparece em nenhuma policy das tabelas professional_*
--   * professional_unit não aparece nas policies de interns/records
--   * supervisor (com jwt_has_workspace_access) administra ambos
-- Idempotente: pode ser rodado de novo sem duplicar/quebrar nada.
-- =========================================================================

-- 16.1 Colunas em units: habilita o módulo por unidade e define o login de quiosque PJ
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS pj_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pj_kiosk_email text;

UPDATE public.units SET pj_enabled = true, pj_kiosk_email = 'pj-parqueshopping@grupoib.internal' WHERE id = 'faca-amigos-parque-shopping' AND pj_kiosk_email IS NULL;
UPDATE public.units SET pj_enabled = true, pj_kiosk_email = 'pj-graopara@grupoib.internal'       WHERE id = 'faca-amigos-grao-para'       AND pj_kiosk_email IS NULL;
UPDATE public.units SET pj_enabled = true, pj_kiosk_email = 'pj-clinicaa@grupoib.internal'       WHERE id = 'clinica-a'                   AND pj_kiosk_email IS NULL;
UPDATE public.units SET pj_enabled = true, pj_kiosk_email = 'pj-clinicab@grupoib.internal'       WHERE id = 'clinica-b'                   AND pj_kiosk_email IS NULL;

-- 16.2 Tabelas
CREATE TABLE IF NOT EXISTS public.professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id text NOT NULL REFERENCES public.units(id),
  name text NOT NULL,
  profession text,
  council_type text,
  council_number text,
  cpf text,
  cnpj text,
  razao_social text,
  email text,
  phone text,
  contract_start date,
  contract_end date,
  contract_notes text,
  active boolean NOT NULL DEFAULT true,
  terms_accepted_at timestamp with time zone,
  terms_version text,
  photo text,
  created_at timestamp with time zone DEFAULT now()
);

-- PIN em tabela própria, SEM policies: só as funções SECURITY DEFINER abaixo a acessam.
CREATE TABLE IF NOT EXISTS public.professional_pins (
  professional_id uuid PRIMARY KEY REFERENCES public.professionals(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.professional_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  professional_name text,
  unit_id text REFERENCES public.units(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('entrada', 'saida')),
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  auth_method text NOT NULL DEFAULT 'pin',
  geo jsonb DEFAULT '{}'::jsonb,
  note text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.professional_documents (
  professional_id uuid REFERENCES public.professionals(id) ON DELETE CASCADE,
  doc_key text NOT NULL,
  content text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (professional_id, doc_key)
);

CREATE INDEX IF NOT EXISTS idx_professionals_unit_id ON public.professionals(unit_id);
CREATE INDEX IF NOT EXISTS idx_professional_presence_professional ON public.professional_presence(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_presence_unit ON public.professional_presence(unit_id);
CREATE INDEX IF NOT EXISTS idx_professional_presence_timestamp ON public.professional_presence(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_professional_documents_prof ON public.professional_documents(professional_id, doc_key);

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'professional_presence') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.professional_presence;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'professionals') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.professionals;
  END IF;
END $$;

-- 16.3 Helpers de RLS
CREATE OR REPLACE FUNCTION public.jwt_is_supervisor_for_unit(target_unit text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor'
     AND EXISTS (SELECT 1 FROM public.units u WHERE u.id = target_unit AND public.jwt_has_workspace_access(u.workspace_id));
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_professional_kiosk_for_unit(target_unit text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'role') = 'professional_unit'
     AND target_unit IS NOT NULL
     AND (auth.jwt() -> 'user_metadata' ->> 'unit_id') = target_unit;
$$;

-- 16.4 Policies
DROP POLICY IF EXISTS "pj: leitura de profissionais" ON public.professionals;
CREATE POLICY "pj: leitura de profissionais" ON public.professionals FOR SELECT
  USING (public.jwt_is_supervisor_for_unit(unit_id) OR public.jwt_is_professional_kiosk_for_unit(unit_id));

DROP POLICY IF EXISTS "pj: escrita de profissionais (supervisor)" ON public.professionals;
CREATE POLICY "pj: escrita de profissionais (supervisor)" ON public.professionals FOR ALL
  USING (public.jwt_is_supervisor_for_unit(unit_id))
  WITH CHECK (public.jwt_is_supervisor_for_unit(unit_id));

DROP POLICY IF EXISTS "pj: leitura de presenca" ON public.professional_presence;
CREATE POLICY "pj: leitura de presenca" ON public.professional_presence FOR SELECT
  USING (public.jwt_is_supervisor_for_unit(unit_id) OR public.jwt_is_professional_kiosk_for_unit(unit_id));

-- Quiosque só insere via RPC (register_professional_presence); inserção direta é do supervisor.
DROP POLICY IF EXISTS "pj: escrita de presenca (supervisor)" ON public.professional_presence;
CREATE POLICY "pj: escrita de presenca (supervisor)" ON public.professional_presence FOR ALL
  USING (public.jwt_is_supervisor_for_unit(unit_id))
  WITH CHECK (public.jwt_is_supervisor_for_unit(unit_id));

DROP POLICY IF EXISTS "pj: documentos (supervisor)" ON public.professional_documents;
CREATE POLICY "pj: documentos (supervisor)" ON public.professional_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND public.jwt_is_supervisor_for_unit(p.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = professional_id AND public.jwt_is_supervisor_for_unit(p.unit_id)));

-- professional_pins: RLS ligado e NENHUMA policy — inacessível pela API.

-- 16.5 Funções (SECURITY DEFINER)

-- Regra de PIN: exatamente 6 dígitos, sem sequências triviais.
CREATE OR REPLACE FUNCTION public.is_valid_professional_pin(p_pin text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_pin ~ '^[0-9]{6}$'
     AND p_pin !~ '^(\d)\1{5}$'
     AND p_pin NOT IN ('123456', '654321', '012345', '543210', '112233', '123123', '111222', '222333');
$$;

-- Supervisor define/reseta o PIN de um prestador.
CREATE OR REPLACE FUNCTION public.set_professional_pin(p_professional_id uuid, p_pin text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit text;
BEGIN
  SELECT unit_id INTO v_unit FROM public.professionals WHERE id = p_professional_id;
  IF v_unit IS NULL OR NOT public.jwt_is_supervisor_for_unit(v_unit) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF NOT public.is_valid_professional_pin(p_pin) THEN
    RAISE EXCEPTION 'pin_invalid_format';
  END IF;

  INSERT INTO public.professional_pins (professional_id, pin_hash, failed_attempts, locked_until, updated_at)
  VALUES (p_professional_id, crypt(p_pin, gen_salt('bf')), 0, NULL, now())
  ON CONFLICT (professional_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash, failed_attempts = 0, locked_until = NULL, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.set_professional_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_professional_pin(uuid, text) TO authenticated;

-- Verificação interna de PIN com bloqueio (5 erros → 15 min). Não exposta à API.
CREATE OR REPLACE FUNCTION public.verify_professional_pin_internal(p_professional_id uuid, p_pin text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.professional_pins%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.professional_pins WHERE professional_id = p_professional_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pin_not_set';
  END IF;
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RAISE EXCEPTION 'pin_locked';
  END IF;
  IF v_row.pin_hash <> crypt(COALESCE(p_pin, ''), v_row.pin_hash) THEN
    UPDATE public.professional_pins
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
           updated_at = now()
     WHERE professional_id = p_professional_id;
    RAISE EXCEPTION 'pin_invalid';
  END IF;
  UPDATE public.professional_pins
     SET failed_attempts = 0, locked_until = NULL
   WHERE professional_id = p_professional_id;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_professional_pin_internal(uuid, text) FROM PUBLIC, anon, authenticated;

-- Prestador altera o próprio PIN a partir do quiosque da sua unidade.
CREATE OR REPLACE FUNCTION public.change_professional_pin(p_professional_id uuid, p_current_pin text, p_new_pin text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit text;
BEGIN
  SELECT unit_id INTO v_unit FROM public.professionals WHERE id = p_professional_id AND active;
  IF v_unit IS NULL OR NOT (public.jwt_is_professional_kiosk_for_unit(v_unit) OR public.jwt_is_supervisor_for_unit(v_unit)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF NOT public.is_valid_professional_pin(p_new_pin) THEN
    RAISE EXCEPTION 'pin_invalid_format';
  END IF;
  PERFORM public.verify_professional_pin_internal(p_professional_id, p_current_pin);
  UPDATE public.professional_pins
     SET pin_hash = crypt(p_new_pin, gen_salt('bf')), failed_attempts = 0, locked_until = NULL, updated_at = now()
   WHERE professional_id = p_professional_id;
END;
$$;
REVOKE ALL ON FUNCTION public.change_professional_pin(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_professional_pin(uuid, text, text) TO authenticated;

-- Aceite do termo de ciência (1ª utilização), validado pelo PIN.
CREATE OR REPLACE FUNCTION public.accept_professional_terms(p_professional_id uuid, p_pin text, p_version text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit text;
BEGIN
  SELECT unit_id INTO v_unit FROM public.professionals WHERE id = p_professional_id AND active;
  IF v_unit IS NULL OR NOT (public.jwt_is_professional_kiosk_for_unit(v_unit) OR public.jwt_is_supervisor_for_unit(v_unit)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  PERFORM public.verify_professional_pin_internal(p_professional_id, p_pin);
  UPDATE public.professionals
     SET terms_accepted_at = now(), terms_version = p_version
   WHERE id = p_professional_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_professional_terms(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_professional_terms(uuid, text, text) TO authenticated;

-- Registro de presença pelo quiosque: valida papel/unidade, PIN, sequência
-- entrada→saída do dia e insere. GPS é meramente informativo (jsonb livre).
CREATE OR REPLACE FUNCTION public.register_professional_presence(
  p_professional_id uuid,
  p_pin text,
  p_action text,
  p_geo jsonb DEFAULT '{}'::jsonb,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prof public.professionals%ROWTYPE;
  v_pj_enabled boolean;
  v_last_action text;
  v_new_id uuid;
  v_ts timestamp with time zone := now();
BEGIN
  IF p_action NOT IN ('entrada', 'saida') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  SELECT * INTO v_prof FROM public.professionals WHERE id = p_professional_id;
  IF NOT FOUND OR NOT v_prof.active THEN
    RAISE EXCEPTION 'professional_inactive';
  END IF;
  IF NOT (public.jwt_is_professional_kiosk_for_unit(v_prof.unit_id) OR public.jwt_is_supervisor_for_unit(v_prof.unit_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT pj_enabled INTO v_pj_enabled FROM public.units WHERE id = v_prof.unit_id;
  IF NOT COALESCE(v_pj_enabled, false) THEN
    RAISE EXCEPTION 'unit_pj_disabled';
  END IF;

  PERFORM public.verify_professional_pin_internal(p_professional_id, p_pin);

  IF v_prof.terms_accepted_at IS NULL THEN
    RAISE EXCEPTION 'terms_not_accepted';
  END IF;

  SELECT action INTO v_last_action
    FROM public.professional_presence
   WHERE professional_id = p_professional_id
     AND (timestamp AT TIME ZONE 'America/Belem')::date = (v_ts AT TIME ZONE 'America/Belem')::date
   ORDER BY timestamp DESC
   LIMIT 1;

  IF p_action = 'entrada' AND v_last_action = 'entrada' THEN
    RAISE EXCEPTION 'sequence_open_entry';
  END IF;
  IF p_action = 'saida' AND (v_last_action IS NULL OR v_last_action <> 'entrada') THEN
    RAISE EXCEPTION 'sequence_no_entry';
  END IF;

  INSERT INTO public.professional_presence (professional_id, professional_name, unit_id, action, timestamp, auth_method, geo, note, created_by)
  VALUES (p_professional_id, v_prof.name, v_prof.unit_id, p_action, v_ts, 'pin', COALESCE(p_geo, '{}'::jsonb), NULLIF(trim(p_note), ''), auth.uid())
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'id', v_new_id, 'timestamp', v_ts, 'action', p_action, 'name', v_prof.name);
END;
$$;
REVOKE ALL ON FUNCTION public.register_professional_presence(uuid, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_professional_presence(uuid, text, text, jsonb, text) TO authenticated;

-- Indica ao painel se o prestador já tem PIN (sem expor o hash).
CREATE OR REPLACE FUNCTION public.professional_has_pin(p_professional_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit text;
BEGIN
  SELECT unit_id INTO v_unit FROM public.professionals WHERE id = p_professional_id;
  IF v_unit IS NULL OR NOT (public.jwt_is_supervisor_for_unit(v_unit) OR public.jwt_is_professional_kiosk_for_unit(v_unit)) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.professional_pins WHERE professional_id = p_professional_id);
END;
$$;
REVOKE ALL ON FUNCTION public.professional_has_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.professional_has_pin(uuid) TO authenticated;

-- 16.6 Logins de quiosque PJ (um por unidade do Grupo IB), papel 'professional_unit'.
DO $$
DECLARE
  units_data jsonb := '[
    {"email": "pj-parqueshopping@grupoib.internal", "name": "Prestadores Faça Amigos Parque Shopping", "unit_id": "faca-amigos-parque-shopping"},
    {"email": "pj-graopara@grupoib.internal",       "name": "Prestadores Faça Amigos Grão Pará",       "unit_id": "faca-amigos-grao-para"},
    {"email": "pj-clinicaa@grupoib.internal",       "name": "Prestadores Clínica A",                   "unit_id": "clinica-a"},
    {"email": "pj-clinicab@grupoib.internal",       "name": "Prestadores Clínica B",                   "unit_id": "clinica-b"}
  ]'::jsonb;
  u jsonb;
  new_id uuid;
BEGIN
  FOR u IN SELECT * FROM jsonb_array_elements(units_data) LOOP
    DELETE FROM auth.users WHERE email = (u->>'email');
    new_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      is_sso_user, is_anonymous
    ) VALUES (
      new_id, '00000000-0000-0000-0000-000000000000', u->>'email',
      crypt('estagio123', gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('name', u->>'name', 'role', 'professional_unit', 'unit_id', u->>'unit_id'),
      'authenticated', 'authenticated', now(), now(),
      '', '', '', '', false, false
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), new_id,
      jsonb_build_object('sub', new_id::text, 'email', u->>'email'),
      'email', new_id::text, now(), now(), now()
    );
  END LOOP;
END $$;

-- 16.7 O quiosque PJ precisa ler a própria unidade (nome/endereço). A policy de
-- leitura de units não contemplava o papel 'professional_unit'.
DROP POLICY IF EXISTS "Permitir leitura de unidades para quiosque PJ" ON public.units;
CREATE POLICY "Permitir leitura de unidades para quiosque PJ"
    ON public.units FOR SELECT
    USING (public.jwt_is_professional_kiosk_for_unit(id));

-- =========================================================================
-- 17. MÓDULO FUNCIONÁRIOS CLT (empregados regidos pela CLT)
-- Terceiro tipo de vínculo do hub de RH, ao lado de Estagiários (Lei 11.788,
-- seção 1-15) e Profissionais PJ (seção 16). Ao contrário do PJ, este módulo
-- deliberadamente SE APROXIMA de controle de jornada (Portaria MTP 671/2021):
-- ponto biométrico com GPS, registros imutáveis com NSR sequencial e hash
-- encadeado, espelho mensal e apuração de eventos (faltas, HE, noturno, DSR,
-- férias) para a contabilidade. NÃO calcula folha (INSS/IRRF/FGTS/rescisão).
-- =========================================================================

-- 17.1 Colunas novas em units
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS clt_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clt_kiosk_email text,
  ADD COLUMN IF NOT EXISTS clt_tolerance_minutes integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS clt_geofence_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS clt_custom_contract_text text;

-- 17.2 Tabelas

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id text NOT NULL REFERENCES public.units(id),
  -- Identificação
  name text NOT NULL,
  cpf text,
  rg text,
  rg_issuer text,
  birthdate date,
  sex text CHECK (sex IN ('M', 'F', 'outro')),
  marital_status text,
  education text,
  nationality text,
  birthplace text,
  mother_name text,
  father_name text,
  -- Contato / endereço
  phone text,
  email text,
  address jsonb DEFAULT '{}'::jsonb,
  -- Documentos trabalhistas
  ctps_number text,
  ctps_series text,
  ctps_uf text,
  pis text,
  voter_title text,
  reservist_cert text,
  cnh text,
  cnh_category text,
  -- Dados bancários
  bank_name text,
  bank_agency text,
  bank_account text,
  bank_account_type text,
  pix_key text,
  -- Contrato / jornada
  job_title text,
  cbo text,
  department text,
  admission_date date NOT NULL,
  contract_type text NOT NULL DEFAULT 'indeterminado'
    CHECK (contract_type IN ('indeterminado', 'experiencia', 'tempo_determinado', 'intermitente', 'aprendiz')),
  experience_first_end date,
  experience_second_end date,
  contract_end date,
  base_salary numeric(12, 2),
  weekly_hours numeric(5, 2) NOT NULL DEFAULT 44,
  schedule jsonb DEFAULT '{}'::jsonb,
  work_regime text CHECK (work_regime IN ('presencial', 'hibrido', 'remoto')),
  night_work boolean NOT NULL DEFAULT false,
  hours_bank boolean NOT NULL DEFAULT false,
  hours_bank_started_at date,
  vt_opted boolean NOT NULL DEFAULT false,
  vt_daily_cost numeric(10, 2),
  vr_opted boolean NOT NULL DEFAULT false,
  health_plan boolean NOT NULL DEFAULT false,
  union_name text,
  cba_reference text,
  -- Biometria / foto
  photo text,
  face_descriptor text,
  biometric_consent_at timestamp with time zone,
  biometric_consent_version text,
  -- Estado
  status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'afastado', 'ferias', 'aviso_previo', 'desligado')),
  termination_date date,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  name text NOT NULL,
  cpf text,
  birthdate date,
  relationship text,
  for_ir boolean NOT NULL DEFAULT false,
  for_salario_familia boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_documents (
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  doc_key text NOT NULL,
  content text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (employee_id, doc_key)
);

-- Registros de ponto — IMUTÁVEIS (Portaria MTP 671/2021). NSR sequencial por
-- unidade e hash encadeado; nunca UPDATE/DELETE (ver trigger abaixo). Erros
-- operacionais viram um novo lançamento em employee_time_adjustments.
CREATE TABLE IF NOT EXISTS public.employee_time_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id text NOT NULL REFERENCES public.units(id),
  nsr bigint NOT NULL,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  employee_name text NOT NULL,
  employee_cpf text,
  type text NOT NULL CHECK (type IN ('entrada', 'saida', 'intervalo_inicio', 'intervalo_fim')),
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  work_date date NOT NULL,
  photo text,
  geo jsonb DEFAULT '{}'::jsonb,
  auth_method text NOT NULL DEFAULT 'facial' CHECK (auth_method IN ('facial')),
  biometric jsonb DEFAULT '{}'::jsonb,
  prev_hash text,
  record_hash text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (unit_id, nsr)
);

-- Contador de NSR/hash por unidade, usado com SELECT ... FOR UPDATE dentro do
-- RPC de registro (garante sequência atômica mesmo com marcações concorrentes).
CREATE TABLE IF NOT EXISTS public.employee_time_nsr (
  unit_id text PRIMARY KEY REFERENCES public.units(id),
  last_nsr bigint NOT NULL DEFAULT 0,
  last_hash text
);

CREATE OR REPLACE FUNCTION public.forbid_time_record_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'time_record_immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_time_records_immutable ON public.employee_time_records;
CREATE TRIGGER trg_employee_time_records_immutable
  BEFORE UPDATE OR DELETE ON public.employee_time_records
  FOR EACH ROW EXECUTE FUNCTION public.forbid_time_record_mutation();

-- Ajustes de ponto lançados pelo RH: SEMPRE um registro novo, nunca edição do
-- original. 'desconsiderar' anula um registro/ajuste anterior via voids_*.
CREATE TABLE IF NOT EXISTS public.employee_time_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  unit_id text NOT NULL REFERENCES public.units(id),
  work_date date NOT NULL,
  type text NOT NULL CHECK (type IN ('entrada', 'saida', 'intervalo_inicio', 'intervalo_fim', 'desconsiderar')),
  timestamp timestamp with time zone,
  voids_record_id uuid REFERENCES public.employee_time_records(id),
  voids_adjustment_id uuid,
  reason text NOT NULL,
  evidence_doc jsonb DEFAULT '{}'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.employee_time_adjustments
  DROP CONSTRAINT IF EXISTS employee_time_adjustments_voids_adjustment_fk;
ALTER TABLE public.employee_time_adjustments
  ADD CONSTRAINT employee_time_adjustments_voids_adjustment_fk
  FOREIGN KEY (voids_adjustment_id) REFERENCES public.employee_time_adjustments(id) DEFERRABLE INITIALLY DEFERRED;

DROP TRIGGER IF EXISTS trg_employee_time_adjustments_immutable ON public.employee_time_adjustments;
CREATE TRIGGER trg_employee_time_adjustments_immutable
  BEFORE UPDATE OR DELETE ON public.employee_time_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.forbid_time_record_mutation();

CREATE TABLE IF NOT EXISTS public.employee_timesheet_closures (
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  competencia text NOT NULL, -- 'AAAA-MM'
  summary jsonb DEFAULT '{}'::jsonb,
  closed_by uuid,
  closed_at timestamp with time zone DEFAULT now(),
  reopened_at timestamp with time zone,
  PRIMARY KEY (employee_id, competencia)
);

CREATE TABLE IF NOT EXISTS public.employee_vacation_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  acquisition_start date NOT NULL,
  acquisition_end date NOT NULL,
  concession_end date NOT NULL,
  unjustified_absences integer NOT NULL DEFAULT 0,
  days_entitled integer NOT NULL DEFAULT 30,
  suspended_reason text,
  status text NOT NULL DEFAULT 'em_aquisicao'
    CHECK (status IN ('em_aquisicao', 'adquirido', 'parcialmente_gozado', 'gozado', 'vencido', 'zerado')),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (employee_id, acquisition_start)
);

CREATE TABLE IF NOT EXISTS public.employee_vacation_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.employee_vacation_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days integer NOT NULL,
  abono_days integer NOT NULL DEFAULT 0,
  notice_issued_at date,
  payment_due date,
  payment_done_at date,
  status text NOT NULL DEFAULT 'planejado'
    CHECK (status IN ('planejado', 'avisado', 'em_gozo', 'concluido', 'cancelado')),
  doc_notice_key text,
  doc_receipt_key text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_medical_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  exam_type text NOT NULL CHECK (exam_type IN ('admissional', 'periodico', 'retorno', 'mudanca_risco', 'demissional')),
  exam_date date NOT NULL,
  valid_until date,
  result text CHECK (result IN ('apto', 'inapto', 'apto_com_restricoes')),
  risk_grade smallint,
  doctor_name text,
  doctor_crm text,
  restrictions text,
  doc_key text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- Ocorrências funcionais. Deliberadamente SEM coluna de CID (dado de saúde
-- sensível, LGPD art. 11): o atestado fica só como documento anexado.
CREATE TABLE IF NOT EXISTS public.employee_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  unit_id text NOT NULL REFERENCES public.units(id),
  type text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  days integer NOT NULL DEFAULT 1,
  justified boolean NOT NULL DEFAULT false,
  legal_basis text,
  description text,
  affects_dsr boolean NOT NULL DEFAULT false,
  affects_vacation boolean NOT NULL DEFAULT false,
  inss_referral boolean NOT NULL DEFAULT false,
  cat_number text,
  doc_key text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_terminations (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sem_justa_causa', 'pedido_demissao', 'justa_causa', 'acordo_484a', 'termino_contrato', 'falecimento')),
  notice_type text CHECK (notice_type IN ('trabalhado', 'indenizado', 'dispensado', 'nao_aplicavel')),
  notice_reduction text CHECK (notice_reduction IN ('2h_dia', '7_dias', 'nenhuma')),
  notice_start date,
  notice_days integer,
  projected_end date,
  termination_date date,
  demissional_exam_id uuid REFERENCES public.employee_medical_exams(id),
  payment_deadline date,
  checklist jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Espelha o status/termination_date do funcionário ao gravar o encerramento.
CREATE OR REPLACE FUNCTION public.sync_employee_status_on_termination() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.employees
     SET status = CASE
                     WHEN NEW.termination_date IS NOT NULL AND NEW.termination_date <= now()::date THEN 'desligado'
                     WHEN NEW.notice_start IS NOT NULL THEN 'aviso_previo'
                     ELSE status
                   END,
         termination_date = NEW.termination_date,
         updated_at = now()
   WHERE id = NEW.employee_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_status_on_termination ON public.employee_terminations;
CREATE TRIGGER trg_sync_employee_status_on_termination
  AFTER INSERT OR UPDATE ON public.employee_terminations
  FOR EACH ROW EXECUTE FUNCTION public.sync_employee_status_on_termination();

CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'nacional' CHECK (scope IN ('nacional', 'estadual', 'municipal', 'unidade')),
  workspace_id text,
  unit_id text REFERENCES public.units(id),
  recurring boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Postgres não aceita expressões (COALESCE) em UNIQUE de tabela — precisa de
-- índice único de expressão; o ON CONFLICT abaixo casa com este índice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_unique_date_scope
  ON public.holidays (date, COALESCE(unit_id, ''), COALESCE(workspace_id, ''));

INSERT INTO public.holidays (date, name, scope, recurring) VALUES
  ('2026-01-01', 'Confraternização Universal', 'nacional', true),
  ('2026-04-21', 'Tiradentes', 'nacional', true),
  ('2026-05-01', 'Dia do Trabalho', 'nacional', true),
  ('2026-09-07', 'Independência do Brasil', 'nacional', true),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional', true),
  ('2026-11-02', 'Finados', 'nacional', true),
  ('2026-11-15', 'Proclamação da República', 'nacional', true),
  ('2026-11-20', 'Consciência Negra', 'nacional', true),
  ('2026-12-25', 'Natal', 'nacional', true)
ON CONFLICT (date, COALESCE(unit_id, ''), COALESCE(workspace_id, '')) DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_employees_unit_id ON public.employees(unit_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employee_dependents_employee ON public.employee_dependents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON public.employee_documents(employee_id, doc_key);
CREATE INDEX IF NOT EXISTS idx_employee_time_records_employee_date ON public.employee_time_records(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_employee_time_records_unit_ts ON public.employee_time_records(unit_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_employee_time_adjustments_employee_date ON public.employee_time_adjustments(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_employee_vacation_periods_employee ON public.employee_vacation_periods(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_vacation_schedules_employee ON public.employee_vacation_schedules(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_medical_exams_employee ON public.employee_medical_exams(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_occurrences_employee ON public.employee_occurrences(employee_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_time_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_time_nsr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_time_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_timesheet_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_vacation_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_vacation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_medical_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_terminations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'employee_time_records') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_time_records;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'employee_time_adjustments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_time_adjustments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'employees') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
  END IF;
END $$;

-- 17.3 Helper de RLS (papel do quiosque CLT)
CREATE OR REPLACE FUNCTION public.jwt_is_employee_kiosk_for_unit(target_unit text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'role') = 'employee_unit'
     AND target_unit IS NOT NULL
     AND (auth.jwt() -> 'user_metadata' ->> 'unit_id') = target_unit;
$$;

-- 17.4 Policies

DROP POLICY IF EXISTS "clt: leitura e escrita de funcionarios (supervisor)" ON public.employees;
CREATE POLICY "clt: leitura e escrita de funcionarios (supervisor)" ON public.employees FOR ALL
  USING (public.jwt_is_supervisor_for_unit(unit_id))
  WITH CHECK (public.jwt_is_supervisor_for_unit(unit_id));
-- O quiosque CLT NÃO lê employees diretamente: usa a RPC get_employee_kiosk_roster.

DROP POLICY IF EXISTS "clt: dependentes (supervisor)" ON public.employee_dependents;
CREATE POLICY "clt: dependentes (supervisor)" ON public.employee_dependents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)));

DROP POLICY IF EXISTS "clt: documentos (supervisor)" ON public.employee_documents;
CREATE POLICY "clt: documentos (supervisor)" ON public.employee_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)));

DROP POLICY IF EXISTS "clt: leitura de registros de ponto" ON public.employee_time_records;
CREATE POLICY "clt: leitura de registros de ponto" ON public.employee_time_records FOR SELECT
  USING (public.jwt_is_supervisor_for_unit(unit_id) OR public.jwt_is_employee_kiosk_for_unit(unit_id));
-- Sem policy de INSERT/UPDATE/DELETE: toda gravação passa por register_employee_time_record;
-- UPDATE/DELETE são bloqueados mesmo para o dono da linha pelo trigger de imutabilidade.

DROP POLICY IF EXISTS "clt: leitura e lancamento de ajustes (supervisor)" ON public.employee_time_adjustments;
CREATE POLICY "clt: leitura e lancamento de ajustes (supervisor)" ON public.employee_time_adjustments FOR ALL
  USING (public.jwt_is_supervisor_for_unit(unit_id))
  WITH CHECK (public.jwt_is_supervisor_for_unit(unit_id));

DROP POLICY IF EXISTS "clt: fechamento de competencia (supervisor)" ON public.employee_timesheet_closures;
CREATE POLICY "clt: fechamento de competencia (supervisor)" ON public.employee_timesheet_closures FOR ALL
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)));

DROP POLICY IF EXISTS "clt: periodos de ferias (supervisor)" ON public.employee_vacation_periods;
CREATE POLICY "clt: periodos de ferias (supervisor)" ON public.employee_vacation_periods FOR ALL
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)));

DROP POLICY IF EXISTS "clt: programacao de ferias (supervisor)" ON public.employee_vacation_schedules;
CREATE POLICY "clt: programacao de ferias (supervisor)" ON public.employee_vacation_schedules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)));

DROP POLICY IF EXISTS "clt: exames ocupacionais (supervisor)" ON public.employee_medical_exams;
CREATE POLICY "clt: exames ocupacionais (supervisor)" ON public.employee_medical_exams FOR ALL
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)));

DROP POLICY IF EXISTS "clt: ocorrencias (supervisor)" ON public.employee_occurrences;
CREATE POLICY "clt: ocorrencias (supervisor)" ON public.employee_occurrences FOR ALL
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)));

DROP POLICY IF EXISTS "clt: encerramentos (supervisor)" ON public.employee_terminations;
CREATE POLICY "clt: encerramentos (supervisor)" ON public.employee_terminations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND public.jwt_is_supervisor_for_unit(e.unit_id)));

DROP POLICY IF EXISTS "clt: leitura de feriados" ON public.holidays;
CREATE POLICY "clt: leitura de feriados" ON public.holidays FOR SELECT
  USING (
    (unit_id IS NULL)
    OR public.jwt_is_supervisor_for_unit(unit_id)
    OR public.jwt_is_employee_kiosk_for_unit(unit_id)
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('intern_unit', 'professional_unit', 'intern')
  );

DROP POLICY IF EXISTS "clt: escrita de feriados (supervisor)" ON public.holidays;
CREATE POLICY "clt: escrita de feriados (supervisor)" ON public.holidays FOR ALL
  USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'supervisor')
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'role' = 'supervisor');

-- employee_time_nsr: RLS ligado e NENHUMA policy — só a RPC (SECURITY DEFINER) acessa.

-- 17.5 Funções (SECURITY DEFINER)

-- Lista o roster do quiosque CLT (sem expor employees diretamente ao papel
-- de quiosque): nome, foto e descritor facial para o matching local, mais o
-- último tipo de marcação do turno em aberto (para habilitar só os botões
-- permitidos). Supervisor pode passar p_unit para consultar qualquer unidade
-- sob sua alçada; o quiosque só enxerga a própria unidade (via JWT).
CREATE OR REPLACE FUNCTION public.get_employee_kiosk_roster(p_unit text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  photo text,
  face_descriptor text,
  biometric_consent_at timestamp with time zone,
  last_type text,
  last_ts timestamp with time zone
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit text;
BEGIN
  v_unit := COALESCE(auth.jwt() -> 'user_metadata' ->> 'unit_id', p_unit);
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
   ORDER BY e.name;
END;
$$;
REVOKE ALL ON FUNCTION public.get_employee_kiosk_roster(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_kiosk_roster(text) TO authenticated;

-- Registro de ponto pelo quiosque CLT: valida papel/unidade/consentimento,
-- checa sequência entrada→intervalo→saída do turno, grava com NSR sequencial
-- e hash encadeado (por unidade) e nunca permite edição posterior.
CREATE OR REPLACE FUNCTION public.register_employee_time_record(
  p_employee_id uuid,
  p_type text,
  p_photo text DEFAULT NULL,
  p_geo jsonb DEFAULT '{}'::jsonb,
  p_biometric jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_clt_enabled boolean;
  v_last record;
  v_ts timestamp with time zone := now();
  v_work_date date;
  v_nsr bigint;
  v_prev_hash text;
  v_new_hash text;
  v_new_id uuid;
BEGIN
  IF p_type NOT IN ('entrada', 'saida', 'intervalo_inicio', 'intervalo_fim') THEN
    RAISE EXCEPTION 'invalid_type';
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND OR v_emp.status NOT IN ('ativo', 'aviso_previo') THEN
    RAISE EXCEPTION 'employee_inactive';
  END IF;
  IF NOT (public.jwt_is_employee_kiosk_for_unit(v_emp.unit_id) OR public.jwt_is_supervisor_for_unit(v_emp.unit_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT clt_enabled INTO v_clt_enabled FROM public.units WHERE id = v_emp.unit_id;
  IF NOT COALESCE(v_clt_enabled, false) THEN
    RAISE EXCEPTION 'unit_clt_disabled';
  END IF;

  IF v_emp.biometric_consent_at IS NULL THEN
    RAISE EXCEPTION 'consent_required';
  END IF;

  SELECT type, timestamp, work_date INTO v_last
    FROM public.employee_time_records
   WHERE employee_id = p_employee_id
     AND timestamp > v_ts - interval '20 hours'
   ORDER BY timestamp DESC
   LIMIT 1;

  IF v_last.type IS NOT NULL AND v_last.type = p_type AND v_last.timestamp > v_ts - interval '60 seconds' THEN
    RAISE EXCEPTION 'duplicate_record';
  END IF;

  IF p_type = 'entrada' AND v_last.type IS NOT NULL AND v_last.type <> 'saida' THEN
    RAISE EXCEPTION 'sequence_invalid';
  END IF;
  IF p_type = 'intervalo_inicio' AND (v_last.type IS NULL OR v_last.type NOT IN ('entrada', 'intervalo_fim')) THEN
    RAISE EXCEPTION 'sequence_invalid';
  END IF;
  IF p_type = 'intervalo_fim' AND (v_last.type IS NULL OR v_last.type <> 'intervalo_inicio') THEN
    RAISE EXCEPTION 'sequence_invalid';
  END IF;
  IF p_type = 'saida' AND (v_last.type IS NULL OR v_last.type NOT IN ('entrada', 'intervalo_fim')) THEN
    RAISE EXCEPTION 'sequence_invalid';
  END IF;

  v_work_date := CASE WHEN p_type = 'entrada' OR v_last.work_date IS NULL
                       THEN (v_ts AT TIME ZONE 'America/Belem')::date
                       ELSE v_last.work_date END;

  -- Contador de NSR/hash por unidade, travado durante a transação.
  INSERT INTO public.employee_time_nsr (unit_id, last_nsr, last_hash)
    VALUES (v_emp.unit_id, 0, NULL)
    ON CONFLICT (unit_id) DO NOTHING;

  PERFORM 1 FROM public.employee_time_nsr WHERE unit_id = v_emp.unit_id FOR UPDATE;

  SELECT last_nsr + 1, last_hash INTO v_nsr, v_prev_hash
    FROM public.employee_time_nsr WHERE unit_id = v_emp.unit_id;

  v_new_hash := encode(
    digest(COALESCE(v_prev_hash, '') || v_nsr::text || p_employee_id::text || p_type || v_ts::text, 'sha256'),
    'hex'
  );

  INSERT INTO public.employee_time_records (
    unit_id, nsr, employee_id, employee_name, employee_cpf, type, timestamp, work_date,
    photo, geo, auth_method, biometric, prev_hash, record_hash, created_by
  ) VALUES (
    v_emp.unit_id, v_nsr, p_employee_id, v_emp.name, v_emp.cpf, p_type, v_ts, v_work_date,
    p_photo, COALESCE(p_geo, '{}'::jsonb), 'facial', COALESCE(p_biometric, '{}'::jsonb),
    v_prev_hash, v_new_hash, auth.uid()
  ) RETURNING id INTO v_new_id;

  UPDATE public.employee_time_nsr SET last_nsr = v_nsr, last_hash = v_new_hash WHERE unit_id = v_emp.unit_id;

  RETURN jsonb_build_object(
    'ok', true, 'id', v_new_id, 'nsr', v_nsr, 'timestamp', v_ts, 'type', p_type,
    'name', v_emp.name, 'work_date', v_work_date, 'hash', v_new_hash
  );
END;
$$;
REVOKE ALL ON FUNCTION public.register_employee_time_record(uuid, text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_employee_time_record(uuid, text, text, jsonb, jsonb) TO authenticated;

-- Fecha/reabre a competência mensal (espelho de ponto) de um funcionário.
CREATE OR REPLACE FUNCTION public.close_employee_timesheet(p_employee_id uuid, p_competencia text, p_summary jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit text;
BEGIN
  SELECT unit_id INTO v_unit FROM public.employees WHERE id = p_employee_id;
  IF v_unit IS NULL OR NOT public.jwt_is_supervisor_for_unit(v_unit) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  INSERT INTO public.employee_timesheet_closures (employee_id, competencia, summary, closed_by, closed_at)
  VALUES (p_employee_id, p_competencia, COALESCE(p_summary, '{}'::jsonb), auth.uid(), now())
  ON CONFLICT (employee_id, competencia) DO UPDATE
    SET summary = EXCLUDED.summary, closed_by = EXCLUDED.closed_by, closed_at = now(), reopened_at = NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.close_employee_timesheet(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_employee_timesheet(uuid, text, jsonb) TO authenticated;

-- 17.6 Logins de quiosque CLT (um por unidade habilitada do Grupo IB), papel
-- 'employee_unit'. Ao contrário da seed do módulo PJ (16.6), NÃO apaga/recria
-- o usuário a cada execução — idempotente sem derrubar sessões já ativas.
DO $$
DECLARE
  units_data jsonb := '[
    {"email": "clt-parqueshopping@grupoib.internal", "name": "Funcionários Faça Amigos Parque Shopping", "unit_id": "faca-amigos-parque-shopping"},
    {"email": "clt-graopara@grupoib.internal",       "name": "Funcionários Faça Amigos Grão Pará",       "unit_id": "faca-amigos-grao-para"},
    {"email": "clt-clinicaa@grupoib.internal",       "name": "Funcionários Clínica A",                   "unit_id": "clinica-a"},
    {"email": "clt-clinicab@grupoib.internal",       "name": "Funcionários Clínica B",                   "unit_id": "clinica-b"}
  ]'::jsonb;
  u jsonb;
  new_id uuid;
BEGIN
  FOR u IN SELECT * FROM jsonb_array_elements(units_data) LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = (u->>'email')) THEN
      new_id := gen_random_uuid();

      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        is_sso_user, is_anonymous
      ) VALUES (
        new_id, '00000000-0000-0000-0000-000000000000', u->>'email',
        crypt('estagio123', gen_salt('bf')), now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object('name', u->>'name', 'role', 'employee_unit', 'unit_id', u->>'unit_id'),
        'authenticated', 'authenticated', now(), now(),
        '', '', '', '', false, false
      );

      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), new_id,
        jsonb_build_object('sub', new_id::text, 'email', u->>'email'),
        'email', new_id::text, now(), now(), now()
      );
    END IF;
  END LOOP;
END $$;

UPDATE public.units SET clt_enabled = true, clt_kiosk_email = 'clt-parqueshopping@grupoib.internal' WHERE id = 'faca-amigos-parque-shopping' AND clt_kiosk_email IS NULL;
UPDATE public.units SET clt_enabled = true, clt_kiosk_email = 'clt-graopara@grupoib.internal'       WHERE id = 'faca-amigos-grao-para'       AND clt_kiosk_email IS NULL;
UPDATE public.units SET clt_enabled = true, clt_kiosk_email = 'clt-clinicaa@grupoib.internal'       WHERE id = 'clinica-a'                   AND clt_kiosk_email IS NULL;
UPDATE public.units SET clt_enabled = true, clt_kiosk_email = 'clt-clinicab@grupoib.internal'       WHERE id = 'clinica-b'                   AND clt_kiosk_email IS NULL;

-- 17.7 O quiosque CLT precisa ler a própria unidade (nome/endereço/CNPJ).
DROP POLICY IF EXISTS "Permitir leitura de unidades para quiosque CLT" ON public.units;
CREATE POLICY "Permitir leitura de unidades para quiosque CLT"
    ON public.units FOR SELECT
    USING (public.jwt_is_employee_kiosk_for_unit(id));


-- =========================================================================
-- 18. AUTOCADASTRO DE PROFISSIONAIS PJ + CONTRATO PRÉ-PRONTO (Grupo IB)
-- Permite que o próprio prestador PJ preencha seu cadastro completo (dados
-- da PJ, habilitação profissional, representante legal e anexos) sem estar
-- logado, espelhando o "Cadastro Obrigatório" dos estagiários — mas com
-- deduplicação e validação de unidade feitas no servidor (o cliente anon não
-- lê `professionals` por RLS), o que a rotina de estagiário não faz. O
-- cadastro nasce 'pending_validation' e só produz PIN/registra presença após
-- o RH validar (18.6). Ver seção 16 para o restante do módulo PJ.
-- Idempotente: pode ser rodado de novo sem duplicar/quebrar nada.
-- =========================================================================

-- 18.1 Colunas novas em public.professionals
ALTER TABLE public.professionals
  -- Controle do autocadastro
  ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'validated',
  ADD COLUMN IF NOT EXISTS self_registered_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS autonomy_declaration_accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS autonomy_declaration_version text,
  ADD COLUMN IF NOT EXISTS lgpd_consent_accepted_at timestamp with time zone,
  -- Dados da Pessoa Jurídica / endereço
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS natureza_juridica text,
  ADD COLUMN IF NOT EXISTS cnae_principal text,
  ADD COLUMN IF NOT EXISTS inscricao_municipal text,
  ADD COLUMN IF NOT EXISTS endereco_cep text,
  ADD COLUMN IF NOT EXISTS endereco_logradouro text,
  ADD COLUMN IF NOT EXISTS endereco_numero text,
  ADD COLUMN IF NOT EXISTS endereco_complemento text,
  ADD COLUMN IF NOT EXISTS endereco_bairro text,
  ADD COLUMN IF NOT EXISTS endereco_cidade text,
  ADD COLUMN IF NOT EXISTS endereco_uf text,
  -- Dados bancários da PJ (pagamento contra Nota Fiscal)
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_account_type text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  -- Habilitação profissional
  ADD COLUMN IF NOT EXISTS council_uf text,
  ADD COLUMN IF NOT EXISTS council_validity date,
  ADD COLUMN IF NOT EXISTS specialties text,
  -- Representante legal (pessoa física que assina pela PJ)
  ADD COLUMN IF NOT EXISTS rep_name text,
  ADD COLUMN IF NOT EXISTS rep_cpf text,
  ADD COLUMN IF NOT EXISTS rep_rg text,
  ADD COLUMN IF NOT EXISTS rep_birthdate date,
  ADD COLUMN IF NOT EXISTS rep_email text,
  ADD COLUMN IF NOT EXISTS rep_phone text,
  ADD COLUMN IF NOT EXISTS rep_role text,
  -- Objeto e condições comerciais (alimentam o contrato)
  ADD COLUMN IF NOT EXISTS service_description text,
  ADD COLUMN IF NOT EXISTS remuneration_model text,
  ADD COLUMN IF NOT EXISTS remuneration_value numeric,
  ADD COLUMN IF NOT EXISTS payment_day integer,
  ADD COLUMN IF NOT EXISTS notice_days integer;

CREATE INDEX IF NOT EXISTS idx_professionals_registration_status ON public.professionals(registration_status);

-- 18.2 Colunas novas em public.units
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS pj_self_registration_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contrato_pj_custom_text text;

-- 18.3 Token de upload de anexos do autocadastro (usado só entre o insert do
-- cadastro e o envio dos anexos, sem sessão). RLS ligada e SEM policies —
-- mesmo padrão de public.professional_pins (16.2): só as RPCs SECURITY
-- DEFINER abaixo a leem/escrevem.
CREATE TABLE IF NOT EXISTS public.professional_self_registration_tokens (
  professional_id uuid PRIMARY KEY REFERENCES public.professionals(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  uploads_used integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.professional_self_registration_tokens ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy — inacessível pela API além das RPCs abaixo.

-- 18.4 RPC: cria o cadastro pendente do prestador (anônimo, quiosque PJ ou
-- supervisor). Faz no servidor a validação de unidade e a deduplicação que o
-- cliente anônimo não consegue fazer via SELECT (RLS bloqueia).
CREATE OR REPLACE FUNCTION public.create_professional_self_registration(
  p_unit_id text,
  p_name text,
  p_cnpj text,
  p_razao_social text,
  p_nome_fantasia text,
  p_natureza_juridica text,
  p_cnae_principal text,
  p_inscricao_municipal text,
  p_endereco_cep text,
  p_endereco_logradouro text,
  p_endereco_numero text,
  p_endereco_complemento text,
  p_endereco_bairro text,
  p_endereco_cidade text,
  p_endereco_uf text,
  p_profession text,
  p_council_type text,
  p_council_number text,
  p_council_uf text,
  p_council_validity date,
  p_specialties text,
  p_rep_name text,
  p_rep_cpf text,
  p_rep_rg text,
  p_rep_birthdate date,
  p_rep_email text,
  p_rep_phone text,
  p_rep_role text,
  p_email text,
  p_phone text,
  p_bank_name text,
  p_bank_agency text,
  p_bank_account text,
  p_bank_account_type text,
  p_pix_key text,
  p_service_description text,
  p_remuneration_model text,
  p_remuneration_value numeric,
  p_payment_day integer,
  p_notice_days integer,
  p_contract_start date,
  p_autonomy_declaration_accepted boolean,
  p_autonomy_declaration_version text,
  p_lgpd_consent_accepted boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller_role text := auth.jwt() -> 'user_metadata' ->> 'role';
  caller_unit text := auth.jwt() -> 'user_metadata' ->> 'unit_id';
  v_unit public.units%ROWTYPE;
  v_cnpj_clean text := regexp_replace(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');
  v_cpf_clean text := regexp_replace(COALESCE(p_rep_cpf, ''), '[^0-9]', '', 'g');
  v_final_status text := 'pending_validation';
  v_new_id uuid;
  v_token text;
BEGIN
  -- Apenas anônimo (quiosque de autocadastro), quiosque PJ da própria
  -- unidade, ou supervisor podem chamar esta função.
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

  -- Supervisor pode cadastrar já validado e em qualquer unidade do seu
  -- workspace; os demais chamadores (anon/quiosque) sempre nascem pendentes,
  -- e só em unidade que aceite autocadastro.
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
$$;
REVOKE ALL ON FUNCTION public.create_professional_self_registration(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, date, text, text, text, text, date, text, text, text, text, text,
  text, text, text, text, text, text, text, numeric, integer, integer, date, boolean, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_professional_self_registration(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, date, text, text, text, text, date, text, text, text, text, text,
  text, text, text, text, text, text, text, numeric, integer, integer, date, boolean, text, boolean
) TO anon, authenticated;

-- 18.5 RPC: anexa um documento do autocadastro usando o token de upload
-- (sem sessão). Um arquivo por chamada; allowlist fixa de doc_key; limite de
-- ~2MB em base64 por arquivo e no máximo 8 uploads por cadastro.
CREATE OR REPLACE FUNCTION public.attach_professional_self_registration_document(
  p_professional_id uuid,
  p_token text,
  p_doc_key text,
  p_content text,
  p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.professional_self_registration_tokens%ROWTYPE;
BEGIN
  IF p_doc_key NOT IN ('cartao_cnpj', 'contrato_social', 'carteira_conselho', 'comprovante_endereco', 'doc_identidade_representante') THEN
    RAISE EXCEPTION 'invalid_doc_key';
  END IF;
  IF length(COALESCE(p_content, '')) = 0 OR length(p_content) > 2800000 THEN
    RAISE EXCEPTION 'invalid_file_size';
  END IF;

  SELECT * INTO v_row FROM public.professional_self_registration_tokens WHERE professional_id = p_professional_id FOR UPDATE;
  IF NOT FOUND OR v_row.token_hash <> digest(COALESCE(p_token, ''), 'sha256') THEN
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
$$;
REVOKE ALL ON FUNCTION public.attach_professional_self_registration_document(uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_professional_self_registration_document(uuid, text, text, text, jsonb) TO anon, authenticated;

-- 18.6 Um cadastro pendente não pode receber PIN nem registrar presença —
-- só depois que o RH validar (registration_status = 'validated').
CREATE OR REPLACE FUNCTION public.set_professional_pin(p_professional_id uuid, p_pin text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit text;
  v_status text;
BEGIN
  SELECT unit_id, registration_status INTO v_unit, v_status FROM public.professionals WHERE id = p_professional_id;
  IF v_unit IS NULL OR NOT public.jwt_is_supervisor_for_unit(v_unit) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF v_status IS DISTINCT FROM 'validated' THEN
    RAISE EXCEPTION 'professional_pending_validation';
  END IF;
  IF NOT public.is_valid_professional_pin(p_pin) THEN
    RAISE EXCEPTION 'pin_invalid_format';
  END IF;

  INSERT INTO public.professional_pins (professional_id, pin_hash, failed_attempts, locked_until, updated_at)
  VALUES (p_professional_id, crypt(p_pin, gen_salt('bf')), 0, NULL, now())
  ON CONFLICT (professional_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash, failed_attempts = 0, locked_until = NULL, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.set_professional_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_professional_pin(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_professional_presence(
  p_professional_id uuid,
  p_pin text,
  p_action text,
  p_geo jsonb DEFAULT '{}'::jsonb,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prof public.professionals%ROWTYPE;
  v_pj_enabled boolean;
  v_last_action text;
  v_new_id uuid;
  v_ts timestamp with time zone := now();
BEGIN
  IF p_action NOT IN ('entrada', 'saida') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  SELECT * INTO v_prof FROM public.professionals WHERE id = p_professional_id;
  IF NOT FOUND OR NOT v_prof.active THEN
    RAISE EXCEPTION 'professional_inactive';
  END IF;
  IF v_prof.registration_status IS DISTINCT FROM 'validated' THEN
    RAISE EXCEPTION 'professional_pending_validation';
  END IF;
  IF NOT (public.jwt_is_professional_kiosk_for_unit(v_prof.unit_id) OR public.jwt_is_supervisor_for_unit(v_prof.unit_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT pj_enabled INTO v_pj_enabled FROM public.units WHERE id = v_prof.unit_id;
  IF NOT COALESCE(v_pj_enabled, false) THEN
    RAISE EXCEPTION 'unit_pj_disabled';
  END IF;

  PERFORM public.verify_professional_pin_internal(p_professional_id, p_pin);

  IF v_prof.terms_accepted_at IS NULL THEN
    RAISE EXCEPTION 'terms_not_accepted';
  END IF;

  SELECT action INTO v_last_action
    FROM public.professional_presence
   WHERE professional_id = p_professional_id
     AND (timestamp AT TIME ZONE 'America/Belem')::date = (v_ts AT TIME ZONE 'America/Belem')::date
   ORDER BY timestamp DESC
   LIMIT 1;

  IF p_action = 'entrada' AND v_last_action = 'entrada' THEN
    RAISE EXCEPTION 'sequence_open_entry';
  END IF;
  IF p_action = 'saida' AND (v_last_action IS NULL OR v_last_action <> 'entrada') THEN
    RAISE EXCEPTION 'sequence_no_entry';
  END IF;

  INSERT INTO public.professional_presence (professional_id, professional_name, unit_id, action, timestamp, auth_method, geo, note, created_by)
  VALUES (p_professional_id, v_prof.name, v_prof.unit_id, p_action, v_ts, 'pin', COALESCE(p_geo, '{}'::jsonb), NULLIF(trim(p_note), ''), auth.uid())
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'id', v_new_id, 'timestamp', v_ts, 'action', p_action, 'name', v_prof.name);
END;
$$;
REVOKE ALL ON FUNCTION public.register_professional_presence(uuid, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_professional_presence(uuid, text, text, jsonb, text) TO authenticated;

-- 18.7 Quiosque PJ só lista prestadores já validados.
DROP POLICY IF EXISTS "pj: leitura de profissionais" ON public.professionals;
CREATE POLICY "pj: leitura de profissionais" ON public.professionals FOR SELECT
  USING (
    public.jwt_is_supervisor_for_unit(unit_id)
    OR (public.jwt_is_professional_kiosk_for_unit(unit_id) AND registration_status = 'validated')
  );

-- 18.8 Habilita autocadastro nas unidades do Grupo IB que já têm o módulo PJ ligado.
UPDATE public.units SET pj_self_registration_enabled = true
 WHERE workspace_id = 'grupoib' AND pj_enabled = true AND pj_self_registration_enabled = false;

-- =========================================================================
-- 19. AUTOCADASTRO DE FUNCIONÁRIOS CLT (Grupo IB)
-- Espelha o autocadastro de Profissionais PJ (seção 18): o próprio candidato
-- a funcionário preenche dados pessoais/documentais e biometria facial (com
-- liveness ativo, mesmo componente da Autogestão de Biometria do estagiário)
-- sem estar logado; o cadastro nasce 'pending_validation' e SEM os campos que
-- são atribuição do RH (cargo, salário, tipo de contrato, jornada, data de
-- admissão) — esses continuam null/default até a validação em FuncionariosTab
-- (mesma tela de sempre, que já reaproveita qualquer campo pré-preenchido).
-- Idempotente: pode ser rodado de novo sem duplicar/quebrar nada.
-- =========================================================================

-- 19.1 Colunas novas em public.employees (controle do autocadastro) e relaxa
-- admission_date, que deixa de poder ser exigido no INSERT: um cadastro
-- pendente ainda não tem data de admissão definida pelo RH.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'validated',
  ADD COLUMN IF NOT EXISTS self_registered_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS lgpd_consent_accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS lgpd_consent_version text;
ALTER TABLE public.employees ALTER COLUMN admission_date DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_registration_status ON public.employees(registration_status);

-- 19.2 Colunas novas em public.units
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS clt_self_registration_enabled boolean NOT NULL DEFAULT false;

-- 19.3 Token de upload de anexos do autocadastro — mesmo padrão de
-- professional_self_registration_tokens (18.3): RLS ligada e SEM policies,
-- só as RPCs SECURITY DEFINER abaixo o leem/escrevem.
CREATE TABLE IF NOT EXISTS public.employee_self_registration_tokens (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  uploads_used integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.employee_self_registration_tokens ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy — inacessível pela API além das RPCs abaixo.

-- 19.4 RPC: cria o cadastro pendente do funcionário (anônimo/quiosque de
-- autocadastro, ou supervisor). A biometria facial (vetor de 128-d + termo de
-- consentimento) é capturada ao vivo no client via BiometricEnrollment.jsx
-- (liveness ativo) e enviada já pronta neste mesmo INSERT — diferente dos
-- documentos, é um único campo, não precisa do mecanismo de token/anexo.
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller_role text := auth.jwt() -> 'user_metadata' ->> 'role';
  v_unit public.units%ROWTYPE;
  v_cpf_clean text := regexp_replace(COALESCE(p_cpf, ''), '[^0-9]', '', 'g');
  v_final_status text := 'pending_validation';
  v_new_id uuid;
  v_token text;
  v_dep jsonb;
BEGIN
  -- Apenas anônimo (tela pública de autocadastro) ou supervisor podem chamar.
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

  -- Supervisor pode cadastrar já validado em qualquer unidade do seu
  -- workspace; os demais chamadores (anon) sempre nascem pendentes, e só em
  -- unidade que aceite autocadastro.
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
$$;
REVOKE ALL ON FUNCTION public.create_employee_self_registration(
  text, text, text, text, text, date, text, text, text, text, text, text, text, text, text, jsonb,
  text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, boolean, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_employee_self_registration(
  text, text, text, text, text, date, text, text, text, text, text, text, text, text, text, jsonb,
  text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, boolean, text, boolean
) TO anon, authenticated;

-- 19.5 RPC: anexa um documento do autocadastro usando o token de upload (sem
-- sessão). Allowlist restrita ao subconjunto de ADMISSIONAL_DOCUMENTS que faz
-- sentido o próprio candidato enviar — o restante (ASO, ficha de registro,
-- contrato assinado, termos gerados etc.) é produzido/coletado pelo RH depois
-- da validação. Limite de ~2MB em base64 por arquivo, no máximo 12 uploads.
CREATE OR REPLACE FUNCTION public.attach_employee_self_registration_document(
  p_employee_id uuid,
  p_token text,
  p_doc_key text,
  p_content text,
  p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  SELECT * INTO v_row FROM public.employee_self_registration_tokens WHERE employee_id = p_employee_id FOR UPDATE;
  IF NOT FOUND OR v_row.token_hash <> digest(COALESCE(p_token, ''), 'sha256') THEN
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
$$;
REVOKE ALL ON FUNCTION public.attach_employee_self_registration_document(uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_employee_self_registration_document(uuid, text, text, text, jsonb) TO anon, authenticated;

-- 19.6 Um cadastro pendente não pode registrar ponto — get_employee_kiosk_roster
-- e register_employee_time_record (17.5) já filtram por status/consentimento,
-- mas não por registration_status; reforça aqui para nunca listar/registrar
-- ponto de quem ainda não foi validado pelo RH.
CREATE OR REPLACE FUNCTION public.get_employee_kiosk_roster(p_unit text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  photo text,
  face_descriptor text,
  biometric_consent_at timestamp with time zone,
  last_type text,
  last_ts timestamp with time zone
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit text;
BEGIN
  v_unit := COALESCE(auth.jwt() -> 'user_metadata' ->> 'unit_id', p_unit);
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
$$;
REVOKE ALL ON FUNCTION public.get_employee_kiosk_roster(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_kiosk_roster(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_employee_time_record(
  p_employee_id uuid,
  p_type text,
  p_photo text DEFAULT NULL,
  p_geo jsonb DEFAULT '{}'::jsonb,
  p_biometric jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_clt_enabled boolean;
  v_last record;
  v_ts timestamp with time zone := now();
  v_work_date date;
  v_nsr bigint;
  v_prev_hash text;
  v_new_hash text;
  v_new_id uuid;
BEGIN
  IF p_type NOT IN ('entrada', 'saida', 'intervalo_inicio', 'intervalo_fim') THEN
    RAISE EXCEPTION 'invalid_type';
  END IF;

  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND OR v_emp.status NOT IN ('ativo', 'aviso_previo') THEN
    RAISE EXCEPTION 'employee_inactive';
  END IF;
  IF v_emp.registration_status IS DISTINCT FROM 'validated' THEN
    RAISE EXCEPTION 'employee_pending_validation';
  END IF;
  IF NOT (public.jwt_is_employee_kiosk_for_unit(v_emp.unit_id) OR public.jwt_is_supervisor_for_unit(v_emp.unit_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT clt_enabled INTO v_clt_enabled FROM public.units WHERE id = v_emp.unit_id;
  IF NOT COALESCE(v_clt_enabled, false) THEN
    RAISE EXCEPTION 'unit_clt_disabled';
  END IF;

  IF v_emp.biometric_consent_at IS NULL THEN
    RAISE EXCEPTION 'consent_required';
  END IF;

  SELECT type, timestamp, work_date INTO v_last
    FROM public.employee_time_records
   WHERE employee_id = p_employee_id
     AND timestamp > v_ts - interval '20 hours'
   ORDER BY timestamp DESC
   LIMIT 1;

  IF v_last.type IS NOT NULL AND v_last.type = p_type AND v_last.timestamp > v_ts - interval '60 seconds' THEN
    RAISE EXCEPTION 'duplicate_record';
  END IF;

  IF p_type = 'entrada' AND v_last.type IS NOT NULL AND v_last.type <> 'saida' THEN
    RAISE EXCEPTION 'sequence_invalid';
  END IF;
  IF p_type = 'intervalo_inicio' AND (v_last.type IS NULL OR v_last.type NOT IN ('entrada', 'intervalo_fim')) THEN
    RAISE EXCEPTION 'sequence_invalid';
  END IF;
  IF p_type = 'intervalo_fim' AND (v_last.type IS NULL OR v_last.type <> 'intervalo_inicio') THEN
    RAISE EXCEPTION 'sequence_invalid';
  END IF;
  IF p_type = 'saida' AND (v_last.type IS NULL OR v_last.type NOT IN ('entrada', 'intervalo_fim')) THEN
    RAISE EXCEPTION 'sequence_invalid';
  END IF;

  v_work_date := CASE WHEN p_type = 'entrada' OR v_last.work_date IS NULL
                       THEN (v_ts AT TIME ZONE 'America/Belem')::date
                       ELSE v_last.work_date END;

  -- Contador de NSR/hash por unidade, travado durante a transação.
  INSERT INTO public.employee_time_nsr (unit_id, last_nsr, last_hash)
    VALUES (v_emp.unit_id, 0, NULL)
    ON CONFLICT (unit_id) DO NOTHING;

  PERFORM 1 FROM public.employee_time_nsr WHERE unit_id = v_emp.unit_id FOR UPDATE;

  SELECT last_nsr + 1, last_hash INTO v_nsr, v_prev_hash
    FROM public.employee_time_nsr WHERE unit_id = v_emp.unit_id;

  v_new_hash := encode(
    digest(COALESCE(v_prev_hash, '') || v_nsr::text || p_employee_id::text || p_type || v_ts::text, 'sha256'),
    'hex'
  );

  INSERT INTO public.employee_time_records (
    unit_id, nsr, employee_id, employee_name, employee_cpf, type, timestamp, work_date,
    photo, geo, auth_method, biometric, prev_hash, record_hash, created_by
  ) VALUES (
    v_emp.unit_id, v_nsr, p_employee_id, v_emp.name, v_emp.cpf, p_type, v_ts, v_work_date,
    p_photo, COALESCE(p_geo, '{}'::jsonb), 'facial', COALESCE(p_biometric, '{}'::jsonb),
    v_prev_hash, v_new_hash, auth.uid()
  ) RETURNING id INTO v_new_id;

  UPDATE public.employee_time_nsr SET last_nsr = v_nsr, last_hash = v_new_hash WHERE unit_id = v_emp.unit_id;

  RETURN jsonb_build_object(
    'ok', true, 'id', v_new_id, 'nsr', v_nsr, 'timestamp', v_ts, 'type', p_type,
    'name', v_emp.name, 'work_date', v_work_date, 'hash', v_new_hash
  );
END;
$$;
REVOKE ALL ON FUNCTION public.register_employee_time_record(uuid, text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_employee_time_record(uuid, text, text, jsonb, jsonb) TO authenticated;

-- 19.7 Habilita autocadastro nas unidades do Grupo IB que já têm o módulo CLT ligado.
UPDATE public.units SET clt_self_registration_enabled = true
 WHERE workspace_id = 'grupoib' AND clt_enabled = true AND clt_self_registration_enabled = false;
