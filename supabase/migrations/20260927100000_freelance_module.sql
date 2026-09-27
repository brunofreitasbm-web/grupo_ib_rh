-- =========================================================================
-- MÓDULO FREELANCE — quarta categoria de contratação do HUB FaçaAmigos
-- Data: 2026-09-27
-- =========================================================================
-- Trabalhador autônomo pessoa física contratado por ESCOPO (obra/serviço
-- certo e determinado), sem habitualidade, subordinação, pessoalidade nem
-- exclusividade — ver src/config/freelanceConstants.js para o enquadramento
-- legal completo (CC arts. 593-609/610-626; CLT art. 442-B) e
-- docs/MODULO_FREELANCE.md para a fundamentação.
--
-- Ao contrário de Profissionais PJ e Funcionários CLT, este módulo NÃO tem
-- quiosque, PIN, presença nem biometria — de propósito: são exatamente esses
-- artefatos que alimentam tese de subordinação/jornada em reclamatória. Só o
-- supervisor cadastra e gerencia (via painel administrativo ou a partir do
-- Banco de Talentos).
--
-- Cada trabalho pontual é uma Ordem de Serviço (freelance_jobs) própria — é a
-- OS por escopo, e não um cadastro guarda-chuva, que sustenta a natureza
-- pontual da contratação.
--
-- Idempotente: pode ser rodado de novo sem duplicar/quebrar nada.
-- =========================================================================

-- Tabelas

CREATE TABLE IF NOT EXISTS public.freelancers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id text NOT NULL REFERENCES public.units(id),
  name text NOT NULL,
  cpf text,
  nit text,
  birthdate date,
  email text,
  phone text,
  endereco_cep text,
  endereco_logradouro text,
  endereco_numero text,
  endereco_complemento text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_uf text,
  service_area text,
  bank_name text,
  bank_agency text,
  bank_account text,
  bank_account_type text,
  pix_key text,
  -- Vínculo opcional com o candidato de origem no Banco de Talentos
  -- (talent_candidates_meta.candidate_id é id remoto, texto — ver
  -- 20260915_talent_bank_overlay_disc.sql). Sem FK: a tabela de origem vive
  -- em outro projeto Supabase.
  source_candidate_id text,
  autonomy_declaration_accepted_at timestamp with time zone,
  autonomy_declaration_version text,
  lgpd_consent_accepted_at timestamp with time zone,
  notes text,
  photo text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

COMMENT ON TABLE public.freelancers IS
  'Cadastro de trabalhadores autônomos pessoa física para trabalhos pontuais (módulo Freelance). Sem PIN/presença/biometria por desenho — ver src/config/freelanceConstants.js.';

CREATE TABLE IF NOT EXISTS public.freelance_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id uuid NOT NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  unit_id text NOT NULL REFERENCES public.units(id),
  title text NOT NULL,
  service_type text NOT NULL,
  scope text NOT NULL,
  deliverable text,
  gross_amount numeric NOT NULL CHECK (gross_amount > 0),
  iss_rate numeric NOT NULL DEFAULT 0.05,
  iss_withheld boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'proposta', 'aceita', 'entregue', 'aceito', 'pago', 'cancelada')),
  scheduled_date date,
  executed_date date,
  proposed_at timestamp with time zone,
  accepted_at timestamp with time zone,
  delivered_at timestamp with time zone,
  payment_accepted_at timestamp with time zone,
  paid_at timestamp with time zone,
  payment_day integer,
  rpa_number text,
  cancellation_reason text,
  -- Snapshot do risco de habitualidade calculado no cliente no momento do
  -- envio da OS (assessHabitualityRisk) — denormalizado para relatório;
  -- fonte da verdade é o cálculo em src/utils/freelanceCalculations.js.
  risk_level text,
  risk_override_reason text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.freelance_jobs IS
  'Ordem de Serviço de um trabalho pontual (escopo, prazo e preço fechados). Um freelancer pode ter várias OS ao longo do tempo, cada uma isolada.';
COMMENT ON COLUMN public.freelance_jobs.risk_level IS
  'ok | atencao | critico — snapshot da política de habitualidade no momento da OS (ver assessHabitualityRisk).';

CREATE TABLE IF NOT EXISTS public.freelance_job_documents (
  job_id uuid REFERENCES public.freelance_jobs(id) ON DELETE CASCADE,
  doc_key text NOT NULL,
  content text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (job_id, doc_key)
);

COMMENT ON TABLE public.freelance_job_documents IS
  'Minutas geradas (contrato por escopo, RPA, termo de quitação) por Ordem de Serviço — mesmo padrão de professional_documents.';

CREATE INDEX IF NOT EXISTS idx_freelancers_unit_id ON public.freelancers(unit_id);
CREATE INDEX IF NOT EXISTS idx_freelancers_source_candidate ON public.freelancers(source_candidate_id);
CREATE INDEX IF NOT EXISTS idx_freelance_jobs_freelancer ON public.freelance_jobs(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_freelance_jobs_unit ON public.freelance_jobs(unit_id);
CREATE INDEX IF NOT EXISTS idx_freelance_jobs_status ON public.freelance_jobs(status);
CREATE INDEX IF NOT EXISTS idx_freelance_job_documents_job ON public.freelance_job_documents(job_id, doc_key);

ALTER TABLE public.freelancers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelance_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelance_job_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'freelance_jobs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.freelance_jobs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'freelancers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.freelancers;
  END IF;
END $$;

-- Policies — só supervisor da unidade. Sem role de quiosque: este
-- módulo não tem conta compartilhada de tablet (ver header desta migração).
DROP POLICY IF EXISTS "freelance: leitura de freelancers" ON public.freelancers;
CREATE POLICY "freelance: leitura de freelancers" ON public.freelancers FOR SELECT
  USING (public.jwt_is_supervisor_for_unit(unit_id));

DROP POLICY IF EXISTS "freelance: escrita de freelancers" ON public.freelancers;
CREATE POLICY "freelance: escrita de freelancers" ON public.freelancers FOR ALL
  USING (public.jwt_is_supervisor_for_unit(unit_id))
  WITH CHECK (public.jwt_is_supervisor_for_unit(unit_id));

DROP POLICY IF EXISTS "freelance: leitura de trabalhos" ON public.freelance_jobs;
CREATE POLICY "freelance: leitura de trabalhos" ON public.freelance_jobs FOR SELECT
  USING (public.jwt_is_supervisor_for_unit(unit_id));

DROP POLICY IF EXISTS "freelance: escrita de trabalhos" ON public.freelance_jobs;
CREATE POLICY "freelance: escrita de trabalhos" ON public.freelance_jobs FOR ALL
  USING (public.jwt_is_supervisor_for_unit(unit_id))
  WITH CHECK (public.jwt_is_supervisor_for_unit(unit_id));

DROP POLICY IF EXISTS "freelance: documentos" ON public.freelance_job_documents;
CREATE POLICY "freelance: documentos" ON public.freelance_job_documents FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.freelance_jobs j
    WHERE j.id = job_id AND public.jwt_is_supervisor_for_unit(j.unit_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.freelance_jobs j
    WHERE j.id = job_id AND public.jwt_is_supervisor_for_unit(j.unit_id)
  ));

-- Trigger de updated_at em freelance_jobs (padrão simples, sem depender
-- de função genérica pré-existente no schema).
CREATE OR REPLACE FUNCTION public.freelance_jobs_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freelance_jobs_updated_at ON public.freelance_jobs;
CREATE TRIGGER trg_freelance_jobs_updated_at
  BEFORE UPDATE ON public.freelance_jobs
  FOR EACH ROW EXECUTE FUNCTION public.freelance_jobs_set_updated_at();

-- Permissões finas (catálogo em src/config/permissions.js, grupo
-- 'freelance'): nenhuma alteração de schema necessária — system_user_permissions
-- já é um jsonb livre (seção 21.1); só o catálogo da UI muda.
