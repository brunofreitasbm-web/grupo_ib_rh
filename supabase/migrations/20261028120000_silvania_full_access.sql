-- ============================================================================
-- Silvania: acesso total ao sistema Porto Terapia
-- ============================================================================
-- Sintoma: ao abrir um documento na Admissão, o app mostra "Não foi possível
-- obter o conteúdo do documento no banco." — a leitura de document_contents é
-- bloqueada pelo RLS porque o JWT da Silvania não traz role='supervisor' e/ou
-- workspace_scope com 'all' em app_metadata (a RLS lê app_metadata desde
-- 20260909_harden_authorization_app_metadata.sql; só Bruno/Guimelly/Isabella
-- receberam escopo 'all' nas migrações anteriores).
--
-- Correção: mesma configuração dos demais administradores (ver
-- supabase/create_supervisors.sql). Idempotente. Depois de rodar, a Silvania
-- precisa sair e entrar de novo (ou aguardar o token renovar, ~1h) para o
-- JWT passar a carregar o novo escopo.
-- ============================================================================

UPDATE auth.users
SET
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'supervisor', 'workspace_scope', jsonb_build_array('all')),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('name', 'Silvania', 'role', 'supervisor', 'workspace_scope', jsonb_build_array('all')),
  updated_at = now()
WHERE lower(email) = 'silvania@portoterapia.com';

-- Linha de permissões granulares (o módulo de Usuários do Sistema espera uma).
INSERT INTO public.system_user_permissions (user_id, permissions, notes, updated_at)
SELECT id, '{}'::jsonb, 'Acesso total (supervisor, workspace_scope all)', now()
FROM auth.users
WHERE lower(email) = 'silvania@portoterapia.com'
ON CONFLICT (user_id) DO UPDATE SET updated_at = now();
