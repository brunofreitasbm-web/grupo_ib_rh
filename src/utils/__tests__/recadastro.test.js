import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  consultarStatusRecadastro,
  pedirTicketRecadastro,
  decidirRecadastro,
  destinoRecadastro,
  verificarRecadastro,
  CHAVE_VISTO,
} from '../recadastro';

const resposta = (corpo, status = 200) =>
  new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status });
const STATUS = { pendente: true, bloquear: false, dias_restantes: 5 };
const URL_OK = 'https://gestao.institutofacaamigos.com.br/#recadastro&c=abc123';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('consultarStatusRecadastro', () => {
  it('chave_desligada_seguir: sem a flag nao chama a rede e devolve null', async () => {
    const f = vi.fn();
    expect(await consultarStatusRecadastro('tok', f)).toBeNull();
    vi.stubEnv('VITE_GESTAO_RECADASTRO', '0');
    expect(await consultarStatusRecadastro('tok', f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('com a flag ligada chama recadastro_status com sistema rh e Bearer, sem token na URL', async () => {
    vi.stubEnv('VITE_GESTAO_RECADASTRO', '1');
    const f = vi.fn(async () => resposta(STATUS));
    expect(await consultarStatusRecadastro('tok', f)).toEqual(STATUS);
    const [url, init] = f.mock.calls[0];
    expect(url).not.toContain('tok');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ action: 'recadastro_status', sistema: 'rh' });
  });

  it('falhas devolvem null: rede, status != 200, JSON invalido, formato inesperado', async () => {
    vi.stubEnv('VITE_GESTAO_RECADASTRO', '1');
    expect(await consultarStatusRecadastro('t', async () => { throw new Error('rede'); })).toBeNull();
    expect(await consultarStatusRecadastro('t', async () => resposta(STATUS, 500))).toBeNull();
    expect(await consultarStatusRecadastro('t', async () => resposta(STATUS, 401))).toBeNull();
    expect(await consultarStatusRecadastro('t', async () => resposta('nao-json'))).toBeNull();
    expect(await consultarStatusRecadastro('t', async () => resposta({ foo: 1 }))).toBeNull();
    expect(await consultarStatusRecadastro('', async () => resposta(STATUS))).toBeNull();
  });

  it('timeout_3s_devolve_null: fetch que nunca responde', async () => {
    vi.stubEnv('VITE_GESTAO_RECADASTRO', '1');
    vi.useFakeTimers();
    const p = consultarStatusRecadastro('t', () => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(3001);
    expect(await p).toBeNull();
  });
});

describe('pedirTicketRecadastro', () => {
  it('devolve a url do ticket e usa recadastro_ticket', async () => {
    vi.stubEnv('VITE_GESTAO_RECADASTRO', '1');
    const f = vi.fn(async () => resposta({ url: URL_OK }));
    expect(await pedirTicketRecadastro('tok', f)).toBe(URL_OK);
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ action: 'recadastro_ticket', sistema: 'rh' });
  });

  it('envia o proprio host em voltar_host (padrao: window.location.host)', async () => {
    vi.stubEnv('VITE_GESTAO_RECADASTRO', '1');
    const f = vi.fn(async () => resposta({ url: URL_OK }));
    await pedirTicketRecadastro('tok', f, 'porto-terapia-gestao.vercel.app');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({
      action: 'recadastro_ticket', sistema: 'rh', voltar_host: 'porto-terapia-gestao.vercel.app',
    });
    vi.stubGlobal('window', { location: { host: 'rh.institutofacaamigos.com.br' } });
    try {
      await pedirTicketRecadastro('tok', f);
      expect(JSON.parse(f.mock.calls[1][1].body).voltar_host).toBe('rh.institutofacaamigos.com.br');
    } finally { vi.unstubAllGlobals(); }
  });

  it('null para flag desligada, erro, status != 200, sem url ou url nao string', async () => {
    const f = vi.fn(async () => resposta({ url: URL_OK }));
    expect(await pedirTicketRecadastro('t', f)).toBeNull();
    expect(f).not.toHaveBeenCalled();
    vi.stubEnv('VITE_GESTAO_RECADASTRO', '1');
    expect(await pedirTicketRecadastro('t', async () => resposta({ url: URL_OK }, 403))).toBeNull();
    expect(await pedirTicketRecadastro('t', async () => resposta({ pendente: false }))).toBeNull();
    expect(await pedirTicketRecadastro('t', async () => resposta({ url: 5 }))).toBeNull();
    expect(await pedirTicketRecadastro('t', async () => { throw new Error('x'); })).toBeNull();
  });
});

describe('decidirRecadastro', () => {
  it('status_null_seguir', () => expect(decidirRecadastro(null, false)).toBe('seguir'));
  it('nao pendente segue', () =>
    expect(decidirRecadastro({ pendente: false, bloquear: false, dias_restantes: 7 }, false)).toBe('seguir'));
  it('pendente_primeira_vez_vai', () => expect(decidirRecadastro(STATUS, false)).toBe('ir'));
  it('pendente_ja_visto_segue', () => expect(decidirRecadastro(STATUS, true)).toBe('seguir'));
  it('bloquear_sempre_vai', () => {
    const b = { pendente: true, bloquear: true, dias_restantes: 0 };
    expect(decidirRecadastro(b, false)).toBe('ir');
    expect(decidirRecadastro(b, true)).toBe('ir');
  });
});

describe('destinoRecadastro', () => {
  it('aceita https no host padrao', () => expect(destinoRecadastro(URL_OK)).toBe(URL_OK));
  it('respeita VITE_GESTAO_HUB_HOST', () => {
    vi.stubEnv('VITE_GESTAO_HUB_HOST', 'hub.exemplo.com.br');
    expect(destinoRecadastro('https://hub.exemplo.com.br/#recadastro&c=x')).not.toBeNull();
    expect(destinoRecadastro(URL_OK)).toBeNull();
  });
  it.each([
    ['http', 'http://gestao.institutofacaamigos.com.br/#c=1'],
    ['host alheio', 'https://evil.com/#recadastro'],
    ['sufixo enganoso', 'https://gestao.institutofacaamigos.com.br.evil.com/'],
    ['prefixo enganoso', 'https://evilgestao.institutofacaamigos.com.br/'],
    ['usuario@', 'https://gestao.institutofacaamigos.com.br@evil.com/'],
    ['com credenciais', 'https://u:p@gestao.institutofacaamigos.com.br/'],
    ['javascript', 'javascript:alert(1)'],
    ['relativa', '/#recadastro'],
    ['vazia', ''],
    ['nao string', null],
  ])('rejeita %s', (_n, u) => expect(destinoRecadastro(u)).toBeNull());
});

describe('verificarRecadastro (orquestracao)', () => {
  const mkStorage = (inicial = {}) => {
    const m = { ...inicial };
    return { getItem: (k) => m[k] ?? null, setItem: vi.fn((k, v) => { m[k] = v; }), m };
  };
  const ligar = () => vi.stubEnv('VITE_GESTAO_RECADASTRO', '1');

  it('pendente primeira vez: pede ticket, marca visto e redireciona', async () => {
    ligar();
    const storage = mkStorage();
    const assign = vi.fn();
    const f = vi.fn(async (_u, init) =>
      JSON.parse(init.body).action === 'recadastro_status' ? resposta(STATUS) : resposta({ url: URL_OK }));
    expect(await verificarRecadastro('tok', { fetchImpl: f, storage, assign, host: 'porto-terapia-gestao.vercel.app' })).toBe('ir');
    expect(assign).toHaveBeenCalledWith(URL_OK);
    expect(storage.m[CHAVE_VISTO]).toBe('1');
    const ticket = f.mock.calls.map((c) => JSON.parse(c[1].body)).find((b) => b.action === 'recadastro_ticket');
    expect(ticket.voltar_host).toBe('porto-terapia-gestao.vercel.app');
  });

  it('pendente sem ticket (null/invalido): segue, nao redireciona nem marca', async () => {
    ligar();
    for (const ticket of [resposta({ error: 'x' }, 500), resposta({ url: 'https://evil.com/x' })]) {
      const storage = mkStorage();
      const assign = vi.fn();
      const f = async (_u, init) =>
        JSON.parse(init.body).action === 'recadastro_status' ? resposta(STATUS) : ticket.clone();
      expect(await verificarRecadastro('tok', { fetchImpl: f, storage, assign })).toBe('seguir');
      expect(assign).not.toHaveBeenCalled();
      expect(storage.setItem).not.toHaveBeenCalled();
    }
  });

  it('ja visto e nao bloqueado: nem pede ticket', async () => {
    ligar();
    const assign = vi.fn();
    const f = vi.fn(async () => resposta(STATUS));
    const storage = mkStorage({ [CHAVE_VISTO]: '1' });
    expect(await verificarRecadastro('tok', { fetchImpl: f, storage, assign })).toBe('seguir');
    expect(f).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it('sessionStorage indisponivel: nao quebra e segue ao falhar leitura', async () => {
    ligar();
    const storage = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
    const assign = vi.fn();
    const f = async (_u, init) =>
      JSON.parse(init.body).action === 'recadastro_status' ? resposta(STATUS) : resposta({ url: URL_OK });
    await expect(verificarRecadastro('tok', { fetchImpl: f, storage, assign })).resolves.toBe('ir');
  });

  it('nunca lanca: assign que falha vira seguir', async () => {
    ligar();
    const f = async (_u, init) =>
      JSON.parse(init.body).action === 'recadastro_status' ? resposta(STATUS) : resposta({ url: URL_OK });
    const assign = () => { throw new Error('x'); };
    expect(await verificarRecadastro('tok', { fetchImpl: f, storage: mkStorage(), assign })).toBe('seguir');
  });

  it('flag desligada: seguir sem rede', async () => {
    const f = vi.fn();
    expect(await verificarRecadastro('tok', { fetchImpl: f, storage: mkStorage(), assign: vi.fn() })).toBe('seguir');
    expect(f).not.toHaveBeenCalled();
  });
});
