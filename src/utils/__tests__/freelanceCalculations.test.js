import { describe, it, expect } from 'vitest';
import {
  computeInssWithheld,
  computeInssEmployerCost,
  computeIrrf,
  computeFreelancePayment,
  assessHabitualityRisk,
  missingFields,
} from '../freelanceCalculations';
import { FREELANCE_RISK_LIMITS, FREELANCE_REQUIRED_FIELDS } from '../../config/freelanceConstants';

describe('computeInssWithheld', () => {
  it('retém 11% do valor bruto', () => {
    expect(computeInssWithheld(1000)).toBeCloseTo(110, 2);
  });

  it('limita a 11% do teto previdenciário', () => {
    expect(computeInssWithheld(50000)).toBeCloseTo(932.31, 2);
  });

  it('considera base já usada na competência (teto mensal por prestador)', () => {
    // Teto 8475.55; já usou 8000 de base -> resta 475.55 -> 11% = 52.31
    expect(computeInssWithheld(1000, 8000)).toBeCloseTo(52.31, 1);
  });
});

describe('computeInssEmployerCost', () => {
  it('calcula 20% patronal, sem teto', () => {
    expect(computeInssEmployerCost(1000)).toBeCloseTo(200, 2);
    expect(computeInssEmployerCost(50000)).toBeCloseTo(10000, 2);
  });
});

describe('computeIrrf', () => {
  it('isenta rendimento tributável até R$ 5.000 pelo redutor legal', () => {
    expect(computeIrrf(4500, { inssWithheld: computeInssWithheld(4500) })).toBe(0);
  });

  it('aplica alguma retenção acima da faixa de isenção plena', () => {
    const gross = 8000;
    const irrf = computeIrrf(gross, { inssWithheld: computeInssWithheld(gross) });
    expect(irrf).toBeGreaterThan(0);
  });

  it('nunca retorna negativo', () => {
    expect(computeIrrf(0)).toBe(0);
    expect(computeIrrf(100, { inssWithheld: 100 })).toBeGreaterThanOrEqual(0);
  });
});

describe('computeFreelancePayment', () => {
  it('compõe líquido do prestador e custo total da empresa', () => {
    const result = computeFreelancePayment({ grossAmount: 2000 });
    expect(result.gross).toBe(2000);
    expect(result.inssWithheld).toBeGreaterThan(0);
    expect(result.net).toBeLessThan(result.gross);
    expect(result.inssEmployerCost).toBeCloseTo(400, 2);
    expect(result.employerTotalCost).toBeCloseTo(2400, 2);
  });

  it('aplica ISS somente quando issWithheld=true', () => {
    const withIss = computeFreelancePayment({ grossAmount: 1000, issWithheld: true, issRate: 0.05 });
    const withoutIss = computeFreelancePayment({ grossAmount: 1000, issWithheld: false });
    expect(withIss.iss).toBeCloseTo(50, 2);
    expect(withoutIss.iss).toBe(0);
  });
});

describe('assessHabitualityRisk', () => {
  const now = new Date('2026-09-27T12:00:00');

  it('classifica como ok quando não há trabalhos', () => {
    const risk = assessHabitualityRisk([], { now });
    expect(risk.level).toBe('ok');
    expect(risk.reasons).toHaveLength(0);
  });

  it('ignora rascunho e cancelada na contagem', () => {
    const jobs = [
      { status: 'rascunho', executedDate: '2026-09-10', grossAmount: 500 },
      { status: 'cancelada', executedDate: '2026-09-11', grossAmount: 500 },
    ];
    const risk = assessHabitualityRisk(jobs, { now });
    expect(risk.jobsThisMonth).toBe(0);
    expect(risk.level).toBe('ok');
  });

  it('marca crítico quando excede o limite mensal da política', () => {
    const limit = FREELANCE_RISK_LIMITS.maxJobsPerMonth;
    const jobs = Array.from({ length: limit + 1 }, (_, i) => ({
      status: 'aceito',
      executedDate: `2026-09-0${(i % 9) + 1}`,
      grossAmount: 300,
    }));
    const risk = assessHabitualityRisk(jobs, { now });
    expect(risk.level).toBe('critico');
    expect(risk.reasons.length).toBeGreaterThan(0);
  });

  it('marca crítico quando o valor pago em 12 meses excede a política', () => {
    const jobs = [{ status: 'pago', executedDate: '2026-09-15', grossAmount: FREELANCE_RISK_LIMITS.maxAmountPer12Months + 1 }];
    const risk = assessHabitualityRisk(jobs, { now });
    expect(risk.level).toBe('critico');
  });
});

describe('missingFields', () => {
  it('lista os rótulos dos campos obrigatórios ausentes', () => {
    const missing = missingFields({ name: 'Fulano' }, FREELANCE_REQUIRED_FIELDS);
    expect(missing).toContain('CPF');
    expect(missing).not.toContain('Nome completo');
  });
});
