// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../supabase', () => ({ supabase: {} }));

import { buildPayrollLetterhead, buildPayrollSignatures, nfMatchesCompetencia, fmtBRL } from '../payrollShared';

describe('timbre das folhas', () => {
  it('traz só a marca: sem CNPJ, razão social, unidade ou nomes antigos', () => {
    const html = `${buildPayrollLetterhead()}${buildPayrollSignatures()}`;
    expect(html).not.toMatch(/CNPJ|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/i);
    expect(html).not.toMatch(/Shopping|Centro de Terapia|Cl[ií]nica Interdisciplinar|LTDA/i);
    expect(html).toMatch(/<img /);
  });
});

describe('nfMatchesCompetencia', () => {
  it('casa por meta.competencia ou prefixo da chave', () => {
    expect(nfMatchesCompetencia({ meta: { competencia: '2026-10' }, doc_key: 'x' }, '2026-10')).toBe(true);
    expect(nfMatchesCompetencia({ meta: {}, doc_key: 'nf-2026-10-abc' }, '2026-10')).toBe(true);
    expect(nfMatchesCompetencia({ meta: {}, doc_key: 'nf-2026-09-abc' }, '2026-10')).toBe(false);
  });
});

describe('fmtBRL', () => {
  it('formata e tolera valores inválidos', () => {
    expect(fmtBRL(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
    expect(fmtBRL(undefined).replace(/\s/g, ' ')).toBe('R$ 0,00');
  });
});
