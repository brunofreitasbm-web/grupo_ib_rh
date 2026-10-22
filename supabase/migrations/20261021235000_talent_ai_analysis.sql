-- Adiciona suporte à Análise Preditiva de IA em talent_candidates_meta
-- Item 3: Análise Preditiva de Currículos e Match de Vagas no Banco de Talentos

ALTER TABLE public.talent_candidates_meta
ADD COLUMN IF NOT EXISTS ai_analysis jsonb DEFAULT NULL;

COMMENT ON COLUMN public.talent_candidates_meta.ai_analysis IS
'Resultado da análise preditiva de currículo, perfil comportamental e match de funções via IA (Gemini).';
