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


