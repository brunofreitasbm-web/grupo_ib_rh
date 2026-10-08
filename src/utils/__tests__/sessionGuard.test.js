import { describe, it, expect } from 'vitest';
import { classifySession } from '../sessionGuard';

describe('classifySession', () => {
  it('ok quando existe sessão', () => {
    expect(classifySession({ session: { access_token: 'x' } })).toBe('ok');
  });
  it('lost quando não há sessão nem erro', () => {
    expect(classifySession({ session: null, error: null })).toBe('lost');
    expect(classifySession()).toBe('lost');
  });
  it('lost quando o erro não é recuperável (refresh token inválido)', () => {
    expect(classifySession({ session: null, error: { name: 'AuthApiError', status: 400 } })).toBe('lost');
  });
  it('transient para falha de rede ou 5xx ao renovar o token', () => {
    expect(classifySession({ session: null, error: { name: 'AuthRetryableFetchError', status: 0 } })).toBe('transient');
    expect(classifySession({ session: null, error: { name: 'AuthApiError', status: 503 } })).toBe('transient');
  });
});
