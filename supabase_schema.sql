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
-- IMPORTANTE: troque estas senhas por senhas fortes assim que possível.

DELETE FROM auth.users WHERE email IN ('guimelly@portoterapia.com', 'bruno@portoterapia.com', 'isabella@portoterapia.com');

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
  -- Apenas supervisor (cadastro administrativo) ou o login de unidade/quiosque
  -- (auto-cadastro do estagiário, sempre pendente de validação) podem chamar esta função.
  IF caller_role IS DISTINCT FROM 'supervisor' AND caller_role IS DISTINCT FROM 'intern_unit' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Um login de unidade só pode se autocadastrar como pendente de validação,
  -- e apenas na própria unidade (não pode criar estagiário validado/ativo
  -- nem em outra unidade).
  IF caller_role = 'intern_unit' THEN
    final_registration_status := 'pending_validation';
    final_unit_id := caller_unit;
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

REVOKE ALL ON FUNCTION public.create_intern_user(
  text, text, text, text, text, text, integer, text, date, date, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, text, jsonb, date, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_intern_user(
  text, text, text, text, text, text, integer, text, date, date, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, text, jsonb, date, text
) TO authenticated;

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
  IF caller_role IS DISTINCT FROM 'supervisor' AND caller_role IS DISTINCT FROM 'intern_unit' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF caller_role = 'intern_unit' THEN
    final_registration_status := 'pending_validation';
    final_unit_id := caller_unit;
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

REVOKE ALL ON FUNCTION public.create_intern_user(
  text, text, text, text, text, text, integer, text, date, date, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, text, jsonb, date, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_intern_user(
  text, text, text, text, text, text, integer, text, date, date, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, text, jsonb, date, text
) TO authenticated;

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


