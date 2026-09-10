# Segurança

Este sistema trata dados pessoais sensíveis (CPF, dados bancários, biometria facial, saúde ocupacional) de estagiários, profissionais PJ e funcionários CLT de clínicas reais. Leve reportes de segurança a sério.

## Reportar uma vulnerabilidade

Não abra uma issue pública. Contate diretamente a administração do sistema (Bruno Freitas, brunofreitasbm@gmail.com) com:

- Descrição do problema e impacto.
- Passos para reproduzir (sem executar a exploração contra dados reais de produção).
- Se possível, uma sugestão de correção.

## Escopo

Este repositório é o front-end React/Vite e as migrações/Edge Functions do Supabase do sistema de RH (`controle-de-estagiario`). O mesmo projeto Supabase também hospeda um sistema clínico separado (prontuário/agenda/faturamento) mantido em outro repositório — problemas nesse outro sistema não são cobertos aqui.

## Rotação de segredos

Os itens abaixo devem ser rotacionados imediatamente se houver suspeita de vazamento, e revisados periodicamente (recomendado: a cada 6 meses ou a cada saída de administrador):

- Segredo do webhook da Edge Function `sync-grupoib-professional` (`SYNC_WEBHOOK_SECRET`, e o cabeçalho correspondente configurado no Database Webhook do Supabase).
- Senhas das contas de quiosque (`intern_unit`, `professional_unit`, `employee_unit`) — ver decisão pendente em `SECURITY_HARDENING_PROMPT.md`, item C-1.
- `SUPABASE_SERVICE_ROLE_KEY` da Edge Function, se houver qualquer suspeita de exposição.

## Histórico de blindagem

Ver `SECURITY_HARDENING_PROMPT.md` (achados específicos deste sistema, com evidência `arquivo:linha`) e `SECURITY_HARDENING_PROMPT_GENERICO.md` (metodologia reutilizável para outros sistemas).
