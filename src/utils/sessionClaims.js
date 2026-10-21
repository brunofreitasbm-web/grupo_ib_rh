// role / unit_id / workspace_scope são autorização e só a service role grava em
// app_metadata (user_metadata é editável pelo próprio usuário; o trigger
// block_client_role_metadata_write barra essas 3 chaves por lá). Contas
// provisionadas pelo Hub de Gestão têm esses claims só em app_metadata, então a
// UI precisa ler de lá. app_metadata vence; user_metadata segue valendo para as
// contas de quiosque antigas, que têm o papel nos dois lugares.
const CLAIMS = ['role', 'unit_id', 'workspace_scope'];

export function withAppClaims(user) {
  if (!user) return user;
  const app = user.app_metadata || {};
  const merged = { ...(user.user_metadata || {}) };
  for (const key of CLAIMS) {
    if (app[key] !== undefined && app[key] !== null) merged[key] = app[key];
  }
  return { ...user, user_metadata: merged };
}
