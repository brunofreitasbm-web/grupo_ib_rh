import { describe, it, expect, vi } from 'vitest';
import { createAuthAwareFetch, isJwtExpiredResponse } from '../authFetch';

const SUPABASE_URL = 'https://proj.supabase.co';
const REST_URL = `${SUPABASE_URL}/rest/v1/employees`;

const jwtExpired = () =>
  new Response(JSON.stringify({ code: 'PGRST301', message: 'JWT expired' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });

const ok = (body = '{"ok":true}') => new Response(body, { status: 200 });

const setup = ({ baseFetch, refreshSession, onSessionDead } = {}) => {
  const base = baseFetch ?? vi.fn(async () => ok());
  const refresh = refreshSession ?? vi.fn(async () => ({ access_token: 'novo-token' }));
  const dead = onSessionDead ?? vi.fn();
  const authFetch = createAuthAwareFetch({
    baseFetch: base,
    supabaseUrl: SUPABASE_URL,
    refreshSession: refresh,
    onSessionDead: dead,
  });
  return { authFetch, base, refresh, dead };
};

describe('isJwtExpiredResponse', () => {
  it('detecta 401 com JWT expired e não consome o corpo original', async () => {
    const res = jwtExpired();
    expect(await isJwtExpiredResponse(res)).toBe(true);
    expect(res.bodyUsed).toBe(false);
  });

  it('ignora status diferente de 401', async () => {
    const res = new Response('JWT expired', { status: 500 });
    expect(await isJwtExpiredResponse(res)).toBe(false);
  });
});

describe('createAuthAwareFetch', () => {
  it('repassa respostas 200 sem refresh nem retry', async () => {
    const { authFetch, base, refresh, dead } = setup();
    const res = await authFetch(REST_URL, { headers: { Authorization: 'Bearer velho' } });

    expect(res.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(dead).not.toHaveBeenCalled();
  });

  it('em 401 JWT expired renova a sessão e refaz a chamada com o token novo', async () => {
    const base = vi
      .fn()
      .mockResolvedValueOnce(jwtExpired())
      .mockResolvedValueOnce(ok('{"retry":true}'));
    const { authFetch, refresh, dead } = setup({ baseFetch: base });

    const res = await authFetch(REST_URL, {
      method: 'POST',
      body: '{"a":1}',
      headers: { Authorization: 'Bearer velho', apikey: 'anon' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ retry: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(dead).not.toHaveBeenCalled();
    expect(base).toHaveBeenCalledTimes(2);

    const [retryUrl, retryInit] = base.mock.calls[1];
    expect(retryUrl).toBe(REST_URL);
    expect(retryInit.method).toBe('POST');
    expect(retryInit.body).toBe('{"a":1}');
    expect(retryInit.headers.get('Authorization')).toBe('Bearer novo-token');
    expect(retryInit.headers.get('apikey')).toBe('anon');
  });

  it('requisições paralelas com 401 disparam um único refresh', async () => {
    let resolveRefresh;
    const refresh = vi.fn(
      () => new Promise((resolve) => { resolveRefresh = resolve; })
    );
    const base = vi.fn(async (_url, init = {}) => {
      const auth = new Headers(init.headers).get('Authorization');
      return auth === 'Bearer novo-token' ? ok() : jwtExpired();
    });
    const { authFetch } = setup({ baseFetch: base, refreshSession: refresh });

    const pending = Promise.all([
      authFetch(`${SUPABASE_URL}/rest/v1/a`, { headers: { Authorization: 'Bearer velho' } }),
      authFetch(`${SUPABASE_URL}/rest/v1/b`, { headers: { Authorization: 'Bearer velho' } }),
      authFetch(`${SUPABASE_URL}/functions/v1/c`, { headers: { Authorization: 'Bearer velho' } }),
    ]);

    // Deixa as três chamadas iniciais receberem 401 e chegarem ao refresh.
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    resolveRefresh({ access_token: 'novo-token' });

    const results = await pending;
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(base).toHaveBeenCalledTimes(6);
  });

  it('se o refresh falha, chama onSessionDead e devolve o 401 original', async () => {
    const base = vi.fn(async () => jwtExpired());
    const refresh = vi.fn(async () => { throw new Error('refresh_token_not_found'); });
    const { authFetch, dead } = setup({ baseFetch: base, refreshSession: refresh });

    const res = await authFetch(REST_URL, { headers: { Authorization: 'Bearer velho' } });

    expect(res.status).toBe(401);
    expect(await res.text()).toContain('JWT expired');
    expect(dead).toHaveBeenCalledTimes(1);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('se o refresh retorna sessão vazia, também trata como sessão morta', async () => {
    const base = vi.fn(async () => jwtExpired());
    const refresh = vi.fn(async () => null);
    const { authFetch, dead } = setup({ baseFetch: base, refreshSession: refresh });

    const res = await authFetch(REST_URL);

    expect(res.status).toBe(401);
    expect(dead).toHaveBeenCalledTimes(1);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('não intercepta 401 em /auth/v1/', async () => {
    const base = vi.fn(async () => jwtExpired());
    const { authFetch, refresh, dead } = setup({ baseFetch: base });

    const res = await authFetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`);

    expect(res.status).toBe(401);
    expect(refresh).not.toHaveBeenCalled();
    expect(dead).not.toHaveBeenCalled();
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('não intercepta 401 de URL fora do supabaseUrl', async () => {
    const base = vi.fn(async () => jwtExpired());
    const { authFetch, refresh, dead } = setup({ baseFetch: base });

    const res = await authFetch('https://outro-servico.com/api/x');

    expect(res.status).toBe(401);
    expect(refresh).not.toHaveBeenCalled();
    expect(dead).not.toHaveBeenCalled();
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('não intercepta 401 sem mensagem de JWT', async () => {
    const base = vi.fn(async () => new Response('{"message":"Invalid API key"}', { status: 401 }));
    const { authFetch, refresh, dead } = setup({ baseFetch: base });

    const res = await authFetch(REST_URL);

    expect(res.status).toBe(401);
    expect(refresh).not.toHaveBeenCalled();
    expect(dead).not.toHaveBeenCalled();
    expect(base).toHaveBeenCalledTimes(1);
  });
});
