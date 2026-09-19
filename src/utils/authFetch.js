// Fetch que se recupera de "JWT expired" sem exigir que o usuário recarregue a
// página. O supabase-js só renova o token pelo relógio local; se a aba ficou
// suspensa, o relógio do aparelho está adiantado/atrasado ou o refresh falhou
// em segundo plano, o servidor responde 401 mesmo com a sessão "válida" no
// cliente — e todas as telas (PostgREST + Edge Functions) quebram juntas.
//
// Ao ver esse 401: renova a sessão UMA vez (compartilhada entre requisições
// paralelas) e refaz a chamada com o token novo. Se a renovação falhar, a
// sessão está morta de verdade: encerra localmente para o app voltar ao login.

const JWT_ERROR_PATTERN = /jwt expired|invalid jwt|PGRST30[12]/i;

const isAuthEndpoint = (url) => url.includes('/auth/v1/');

const resolveUrl = (input) => (typeof input === 'string' ? input : input?.url ?? String(input));

export const isJwtExpiredResponse = async (response) => {
  if (response.status !== 401) return false;
  try {
    return JWT_ERROR_PATTERN.test(await response.clone().text());
  } catch {
    return false;
  }
};

export const createAuthAwareFetch = ({ baseFetch, supabaseUrl, refreshSession, onSessionDead }) => {
  let refreshing = null;

  const refreshOnce = () => {
    if (!refreshing) {
      refreshing = Promise.resolve()
        .then(refreshSession)
        .catch(() => null)
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
  };

  return async (input, init = {}) => {
    const response = await baseFetch(input, init);
    const url = resolveUrl(input);

    // Só chamadas ao nosso projeto; Request objects (corpo-stream) não são reenviáveis.
    if (
      typeof input !== 'string' ||
      !url.startsWith(supabaseUrl) ||
      isAuthEndpoint(url) ||
      !(await isJwtExpiredResponse(response))
    ) {
      return response;
    }

    const session = await refreshOnce();
    if (!session?.access_token) {
      await onSessionDead?.();
      return response;
    }

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${session.access_token}`);
    return baseFetch(input, { ...init, headers });
  };
};
