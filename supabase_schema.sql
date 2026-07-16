-- =========================================================================
-- SCRIPT DE CRIAÇÃO DO BANCO DE DADOS - CONTROLE DE ESTAGIÁRIOS (SUPABASE)
-- Cole este script diretamente no SQL Editor do Supabase e clique em "Run".
-- =========================================================================

-- Habilitar a extensão pgcrypto para criptografia de senhas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. LIMPEZA DE TABELAS EXISTENTES (Caso queira recriar do zero)
DROP TABLE IF EXISTS public.records CASCADE;
DROP TABLE IF EXISTS public.interns CASCADE;
DROP TABLE IF EXISTS public.units CASCADE;

-- 2. TABELA DE UNIDADES
CREATE TABLE public.units (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    address text,
    lat numeric NOT NULL,
    lng numeric NOT NULL,
    radius_km numeric NOT NULL DEFAULT 1,
    radius_m numeric NOT NULL DEFAULT 1000,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. TABELA DE ESTAGIÁRIOS (Vinculada com auth.users)
CREATE TABLE public.interns (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE TABLE public.records (
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
('antonio-barreto', 'Unidade Antônio Barreto', 'R. Antônio Barreto, 2050 - Fátima, Belém - PA, 66060-021', -1.442473861453128, -48.469996243820276, 0.1, 100),
('generalissimo', 'Unidade Generalíssimo', 'Av. Generalíssimo Deodoro, 564 - Nazaré, Belém - PA', -1.4456511159378498, -48.48304674431182, 0.1, 100)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radius_km = EXCLUDED.radius_km,
  radius_m = EXCLUDED.radius_m;

-- 6. INSERÇÃO DO SUPERVISOR PADRÃO
-- E-mail: supervisor@portoterapia.com / Senha: admin123
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
  crypt('admin123', gen_salt('bf')),
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
  p_documents jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Inserir no auth.users
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
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('name', p_name, 'role', 'intern'),
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
  )
  RETURNING id INTO new_user_id;

  -- Inserir no auth.identities para permitir o login do estagiário
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
    new_user_id,
    jsonb_build_object('sub', new_user_id, 'email', p_email),
    'email',
    new_user_id::text,
    now(),
    now(),
    now()
  );

  -- Inserir no public.interns
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
    contract_termination
  ) VALUES (
    new_user_id,
    p_name,
    p_course,
    p_institution,
    p_shift,
    p_daily_hours,
    p_unit_id,
    true,
    p_start_date,
    p_end_date,
    split_part(p_email, '@', 1),
    true,
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
    p_registration_status,
    '{}'::jsonb,
    '{}'::jsonb
  );

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função 2: Excluir estagiário (deleta de auth.users e o cascade limpa public.interns)
CREATE OR REPLACE FUNCTION public.delete_intern_user(p_intern_id uuid) RETURNS void AS $$
BEGIN
  DELETE FROM public.interns WHERE id = p_intern_id;
  DELETE FROM auth.users WHERE id = p_intern_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função 3: Resetar senha do estagiário para '0000'
CREATE OR REPLACE FUNCTION public.reset_intern_password(p_intern_id uuid, p_new_password text) RETURNS void AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_intern_id;

  UPDATE public.interns
  SET is_first_login = true
  WHERE id = p_intern_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função 4: Alterar senha inicial do estagiário no primeiro login
CREATE OR REPLACE FUNCTION public.change_intern_password(p_intern_id uuid, p_new_password text) RETURNS void AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_intern_id;

  UPDATE public.interns
  SET is_first_login = false
  WHERE id = p_intern_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


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
