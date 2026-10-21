-- =========================================================================
-- MÓDULO GRUPO IB: Configuração de Data de Apuração de Produção por Unidade
-- =========================================================================

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS pj_fechamento_dia integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS pj_fechamento_dia_util boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS pj_fechamento_hora text DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS pj_fechamento_ativo boolean DEFAULT true;

COMMENT ON COLUMN public.units.pj_fechamento_dia IS 'Dia do mês para consolidação e disparo do aviso de NFSe PJ da unidade';
COMMENT ON COLUMN public.units.pj_fechamento_dia_util IS 'Se verdadeiro, antecipa para dia útil quando a data cair em fim de semana';
COMMENT ON COLUMN public.units.pj_fechamento_hora IS 'Horário programado para o envio do e-mail aos profissionais PJ da unidade';
COMMENT ON COLUMN public.units.pj_fechamento_ativo IS 'Habilita ou pausa o disparo automatizado de NFSe para os PJ da unidade';
