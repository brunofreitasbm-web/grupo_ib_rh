import { describe, it, expect } from 'vitest';
import { pedirCodigo, redefinirSenha, senhaForte } from '../recuperarSenha';

function fetchFalso(status, corpo) {
  const chamadas = [];
  const impl = async (url, init) => {
    chamadas.push({ url: String(url), corpo: JSON.parse(init.body) });
    return new Response(JSON.stringify(corpo), { status });
  };
  return { impl, chamadas };
}

describe('recuperarSenha', () => {
  it('pede o código para o sistema "rh" com o e-mail da conta', async () => {
    const { impl, chamadas } = fetchFalso(200, { challenge_id: 'abc', mensagem: 'enviado' });
    const r = await pedirCodigo('  supervisor@portoterapia.com ', impl);
    expect(chamadas[0].corpo).toEqual({ action: 'pedir', sistema: 'rh', identificador: 'supervisor@portoterapia.com' });
    expect(r.ok).toBe(true);
    expect(r.challenge_id).toBe('abc');
  });

  it('redefinir manda só os dígitos do código', async () => {
    const { impl, chamadas } = fetchFalso(200, { ok: true });
    await redefinirSenha('id-1', '123 456', 'Forte@123', impl);
    expect(chamadas[0].corpo).toEqual({ action: 'redefinir', challenge_id: 'id-1', code: '123456', new_password: 'Forte@123' });
  });

  it('erro do servidor vira mensagem e "reiniciar" pede recomeçar', async () => {
    const { impl } = fetchFalso(401, { error: 'código expirado, comece de novo', reiniciar: true });
    const r = await redefinirSenha('id-1', '000000', 'Forte@123', impl);
    expect(r).toEqual({ ok: false, erro: 'código expirado, comece de novo', reiniciar: true });
  });

  it('sem rede devolve mensagem amigável', async () => {
    const r = await pedirCodigo('a@b.com', async () => { throw new Error('offline'); });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/Sem conexão/);
  });

  it('regra da senha: 6+, maiúscula e especial', () => {
    expect(senhaForte('Forte@1')).toBe(true);
    expect(senhaForte('fraca')).toBe(false);
    expect(senhaForte('semespecial1A')).toBe(false);
    expect(senhaForte('sem@maiuscula1')).toBe(false);
  });
});
