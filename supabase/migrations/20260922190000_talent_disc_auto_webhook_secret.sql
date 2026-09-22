-- Segredo do envio automático do Levantamento DISC (auto-send-disc-assessment).
-- A Edge Function compara o header x-webhook-secret com a env
-- DISC_AUTO_WEBHOOK_SECRET ou, sem ela, com o segredo do Vault abaixo — assim o
-- valor pode ser gravado pelo SQL Editor sem acesso ao CLI:
--
--   select vault.create_secret('<segredo>', 'disc_auto_webhook_secret');
--
-- Só a service_role (a própria Edge Function) pode ler.

create or replace function public.talent_disc_auto_webhook_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'disc_auto_webhook_secret' limit 1;
$$;

revoke all on function public.talent_disc_auto_webhook_secret() from public, anon, authenticated;
grant execute on function public.talent_disc_auto_webhook_secret() to service_role;
