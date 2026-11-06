-- Módulos assistenciais previstos por mês no contrato global de cada prestador
-- PJ. O valor global do contrato (remuneration_value) dividido por este número
-- dá o valor de cada módulo entregue na apuração mensal. NULL = não informado
-- (a apuração não calcula valor até ser preenchido).
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS expected_modules_per_month integer
  CHECK (expected_modules_per_month IS NULL OR expected_modules_per_month > 0);
