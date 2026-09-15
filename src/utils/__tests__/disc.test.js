import { describe, it, expect } from 'vitest';
import {
  DISC_GROUPS,
  DISC_TOTAL_GROUPS,
  DISC_FACTORS,
  computeDiscScores,
  validateDiscAnswers,
  discProfileCode,
} from '../disc';

const answersWith = (most, least) =>
  Array.from({ length: DISC_TOTAL_GROUPS }, (_, g) => ({ g, most, least }));

describe('DISC_GROUPS', () => {
  it('tem 24 grupos com exatamente um adjetivo de cada fator', () => {
    expect(DISC_GROUPS).toHaveLength(24);
    for (const group of DISC_GROUPS) {
      expect(group.options).toHaveLength(4);
      expect(group.options.map((o) => o.factor).sort()).toEqual([...DISC_FACTORS].sort());
    }
  });

  it('não repete adjetivos', () => {
    const words = DISC_GROUPS.flatMap((g) => g.options.map((o) => o.word));
    expect(new Set(words).size).toBe(words.length);
  });
});

describe('validateDiscAnswers', () => {
  it('rejeita respostas incompletas', () => {
    expect(validateDiscAnswers(answersWith('D', 'S').slice(0, 23))).toBe(false);
  });

  it('rejeita MAIS e MENOS iguais no mesmo grupo', () => {
    const answers = answersWith('D', 'S');
    answers[5] = { g: 5, most: 'I', least: 'I' };
    expect(validateDiscAnswers(answers)).toBe(false);
  });

  it('rejeita grupo duplicado', () => {
    const answers = answersWith('D', 'S');
    answers[1] = { g: 0, most: 'D', least: 'S' };
    expect(validateDiscAnswers(answers)).toBe(false);
  });

  it('rejeita fator desconhecido', () => {
    const answers = answersWith('D', 'S');
    answers[0] = { g: 0, most: 'X', least: 'S' };
    expect(validateDiscAnswers(answers)).toBe(false);
  });
});

describe('computeDiscScores', () => {
  it('retorna null para respostas inválidas', () => {
    expect(computeDiscScores([])).toBeNull();
  });

  it('identifica perfil D puro', () => {
    const r = computeDiscScores(answersWith('D', 'S'));
    expect(r.primary).toBe('D');
    expect(r.secondary).toBeNull();
    expect(r.adaptado.D).toBe(100);
    expect(r.saldo).toEqual({ D: 24, I: 0, S: -24, C: 0 });
  });

  it('identifica perfil primário e secundário (IS)', () => {
    const answers = [
      ...Array.from({ length: 14 }, (_, g) => ({ g, most: 'I', least: 'C' })),
      ...Array.from({ length: 10 }, (_, i) => ({ g: 14 + i, most: 'S', least: 'D' })),
    ];
    const r = computeDiscScores(answers);
    expect(r.primary).toBe('I');
    expect(r.secondary).toBe('S');
    expect(discProfileCode(r.primary, r.secondary)).toBe('IS');
  });

  it('percentuais de adaptado e natural somam 100', () => {
    const answers = DISC_GROUPS.map((group, g) => ({
      g,
      most: DISC_FACTORS[g % 4],
      least: DISC_FACTORS[(g + 1) % 4],
    }));
    const r = computeDiscScores(answers);
    const sum = (o) => Math.round(Object.values(o).reduce((a, b) => a + b, 0));
    expect(sum(r.adaptado)).toBe(100);
    expect(sum(r.natural)).toBe(100);
  });
});
