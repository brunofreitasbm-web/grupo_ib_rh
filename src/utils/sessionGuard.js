// Classifica o resultado de supabase.auth.getSession() antes de consultar
// tabelas que exigem login. Sem sessão o supabase-js envia só a chave anônima e
// o PostgREST responde 401 ("permission denied for table ...").
//  - 'ok'        : há sessão, pode consultar.
//  - 'transient' : sem sessão por falha de rede/servidor ao renovar o token; a
//                  sessão continua guardada no aparelho, então NÃO deslogar.
//  - 'lost'      : sem sessão e sem erro recuperável; o login se perdeu.
export const classifySession = ({ session, error } = {}) => {
  if (session) return 'ok';
  const status = Number(error?.status);
  const retryable =
    error?.name === 'AuthRetryableFetchError' ||
    status === 0 ||
    (Number.isFinite(status) && status >= 500);
  return error && retryable ? 'transient' : 'lost';
};

export const SESSION_LOST_MESSAGE = 'Sua sessão expirou. Entre novamente.';
export const SESSION_TRANSIENT_MESSAGE = 'Sem conexão para validar o login. Tentando novamente...';
