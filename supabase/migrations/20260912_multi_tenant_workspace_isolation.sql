-- =========================================================================
-- MIGRAÇÃO DE ISOLAMENTO MULTI-TENANT POR WORKSPACE (PORTO TERAPIA & GRUPO IB)
-- Data: 2026-09-12
-- Objetivo: Garantir o isolamento de dados no Supabase através da coluna
-- workspace_id em todas as tabelas e aplicar políticas RLS rigorosas.
-- =========================================================================

-- 1. ADICIONAR COLUNA workspace_id ÀS TABELAS DO SISTEMA
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'porto-terapia';

ALTER TABLE public.interns
  ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'porto-terapia';

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'porto-terapia';

-- Tabelas dos módulos PJ e CLT (Padrão: grupoib)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'professionals') THEN
    ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'grupoib';
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'professional_presence_records') THEN
    ALTER TABLE public.professional_presence_records ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'grupoib';
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employees') THEN
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'grupoib';
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_time_entries') THEN
    ALTER TABLE public.employee_time_entries ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'grupoib';
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_users') THEN
    ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'porto-terapia';
  END IF;
END $$;

-- 2. ATUALIZAR WORKSPACE_ID DAS UNIDADES EXISTENTES
UPDATE public.units SET workspace_id = 'porto-terapia' WHERE id IN ('antonio-barreto', 'generalissimo');
UPDATE public.units SET workspace_id = 'grupoib' WHERE id IN ('faca-amigos-parque-shopping', 'faca-amigos-grao-para', 'clinica-a', 'clinica-b');

-- Atualizar estagiários vinculados às unidades do Grupo IB
UPDATE public.interns 
SET workspace_id = 'grupoib' 
WHERE unit_id IN ('faca-amigos-parque-shopping', 'faca-amigos-grao-para', 'clinica-a', 'clinica-b');

-- Sincronizar workspace_id nos registros de ponto dos estagiários
UPDATE public.records r
SET workspace_id = i.workspace_id
FROM public.interns i
WHERE r.intern_id = i.id AND i.workspace_id IS NOT NULL;

-- 3. ÍNDICES DE PERFORMANCE PARA FILTRAGEM POR WORKSPACE
CREATE INDEX IF NOT EXISTS idx_units_workspace ON public.units (workspace_id);
CREATE INDEX IF NOT EXISTS idx_interns_workspace_unit ON public.interns (workspace_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_records_workspace_intern ON public.records (workspace_id, intern_id);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'professionals') THEN
    CREATE INDEX IF NOT EXISTS idx_professionals_workspace_unit ON public.professionals (workspace_id, unit_id);
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employees') THEN
    CREATE INDEX IF NOT EXISTS idx_employees_workspace_unit ON public.employees (workspace_id, unit_id);
  END IF;
END $$;

-- 4. TRIGGER DE INTEGRIDADE (Garantir que a unidade informada pertence ao mesmo workspace)
CREATE OR REPLACE FUNCTION public.validate_workspace_unit_consistency()
RETURNS trigger AS $$
DECLARE
  target_unit_workspace text;
BEGIN
  IF NEW.unit_id IS NOT NULL THEN
    SELECT workspace_id INTO target_unit_workspace FROM public.units WHERE id = NEW.unit_id;
    IF target_unit_workspace IS NOT NULL AND target_unit_workspace <> NEW.workspace_id THEN
      RAISE EXCEPTION 'A unidade selecionada (%) pertence ao workspace %, mas o registro pertence a %', NEW.unit_id, target_unit_workspace, NEW.workspace_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_interns_workspace_unit_check ON public.interns;
CREATE TRIGGER trg_interns_workspace_unit_check
  BEFORE INSERT OR UPDATE ON public.interns
  FOR EACH ROW EXECUTE FUNCTION public.validate_workspace_unit_consistency();

-- 5. ATUALIZAR FUNÇÃO DE CRIAÇÃO DE ESTAGIÁRIO PARA SUPORTAR WORKSPACE_ID
-- Adicionar parâmetro p_workspace_id caso necessário ou preencher dinamicamente a partir da unidade
