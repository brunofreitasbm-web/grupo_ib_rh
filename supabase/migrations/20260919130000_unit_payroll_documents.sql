-- Folhas de pagamento por unidade (aba Financeiro > Folhas das Unidades).
-- O front (FinanceiroTab, PayrollUploadModal, PublicPayrollUploadModal) já
-- lê/grava esta tabela, mas ela nunca foi criada: todas as chamadas davam 404.
-- Acesso restrito a supervisores da unidade (mesmo helper das demais tabelas);
-- sem política para anon — o conteúdo é a folha em base64.

CREATE TABLE IF NOT EXISTS public.unit_payroll_documents (
  id text PRIMARY KEY,
  unit_id text NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  doc_key text NOT NULL,
  content text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unit_payroll_documents_unit_created
  ON public.unit_payroll_documents (unit_id, created_at DESC);

ALTER TABLE public.unit_payroll_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unit_payroll_documents_supervisor_all ON public.unit_payroll_documents;
CREATE POLICY unit_payroll_documents_supervisor_all ON public.unit_payroll_documents
  FOR ALL TO authenticated
  USING (public.jwt_is_supervisor_for_unit(unit_id))
  WITH CHECK (public.jwt_is_supervisor_for_unit(unit_id));
