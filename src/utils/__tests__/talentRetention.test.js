import { describe, it, expect } from 'vitest';
import { isProtected, archiveDaysLeft, discDaysLeft, expiryReason } from '../talentRetention';

const NOW = new Date('2026-10-18T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();

describe('talentRetention', () => {
  it('arquivado vence após 7 dias', () => {
    const base = { effectiveStatus: 'ARQUIVADO' };
    expect(archiveDaysLeft({ ...base, archivedAt: daysAgo(3) }, NOW)).toBe(4);
    expect(expiryReason({ ...base, archivedAt: daysAgo(7) }, NOW)).toBe('arquivado');
    expect(expiryReason({ ...base, archivedAt: daysAgo(6) }, NOW)).toBe(null);
  });

  it('link do DISC sem resposta vence após 10 dias do envio', () => {
    const c = { effectiveStatus: 'NOVO', discToken: { sent_at: daysAgo(10) } };
    expect(expiryReason(c, NOW)).toBe('disc');
    expect(expiryReason({ ...c, discToken: { sent_at: daysAgo(9) } }, NOW)).toBe(null);
  });

  it('não vence se respondeu, consumiu o link ou nunca enviou', () => {
    const tok = { sent_at: daysAgo(30) };
    expect(discDaysLeft({ discToken: tok, discAssessment: {} }, NOW)).toBe(null);
    expect(discDaysLeft({ discToken: { ...tok, consumed_at: daysAgo(1) } }, NOW)).toBe(null);
    expect(discDaysLeft({ discToken: null }, NOW)).toBe(null);
  });

  it('envio manual não conta para os 10 dias', () => {
    const c = { effectiveStatus: 'NOVO', discToken: { sent_at: daysAgo(30), is_manual: true } };
    expect(expiryReason(c, NOW)).toBe(null);
  });

  it('protegidos nunca vencem', () => {
    const old = { discToken: { sent_at: daysAgo(30) }, archivedAt: daysAgo(30) };
    for (const status of ['ENTREVISTA', 'EM_ANALISE', 'CONTATADO']) {
      expect(expiryReason({ ...old, effectiveStatus: status }, NOW)).toBe(null);
    }
    expect(isProtected({ effectiveStatus: 'NOVO', inBasket: true })).toBe(true);
    expect(isProtected({ effectiveStatus: 'NOVO', isFreelancer: true })).toBe(true);
    expect(expiryReason({ ...old, effectiveStatus: 'NOVO', inBasket: true }, NOW)).toBe(null);
  });
});
