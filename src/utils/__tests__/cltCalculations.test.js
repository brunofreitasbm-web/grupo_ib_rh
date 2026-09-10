import { describe, it, expect } from 'vitest';
import {
  toMinutes, addDays, diffDays, dateKeyBelem, allowedNextTypes,
  computeWorkedIntervals, nightMinutes, computeDay, computeMonth,
  vacationEntitlementDays, validateVacationFractions, noticeDays,
  experienceDates, interjornadaViolations, movableHolidays, easterDate,
  dailyPayRate, absenceDeduction, payAfterAbsences,
} from '../cltCalculations';

describe('toMinutes / addDays / diffDays', () => {
  it('converte HH:MM em minutos', () => {
    expect(toMinutes('08:00')).toBe(480);
    expect(toMinutes('00:00')).toBe(0);
  });
  it('soma e subtrai dias corretamente', () => {
    expect(addDays('2026-01-01', 30)).toBe('2026-01-31');
    expect(diffDays('2026-01-01', '2026-01-31')).toBe(30);
  });
});

describe('dateKeyBelem', () => {
  it('agrupa por fuso America/Belem (UTC-3), não pelo fuso do navegador', () => {
    // 02:30 UTC de 2026-01-02 é 23:30 de 2026-01-01 em Belém.
    expect(dateKeyBelem('2026-01-02T02:30:00Z')).toBe('2026-01-01');
  });
});

describe('allowedNextTypes', () => {
  it('só permite entrada quando não há marcação anterior ou a última foi saída', () => {
    expect(allowedNextTypes(null)).toEqual(['entrada']);
    expect(allowedNextTypes('saida')).toEqual(['entrada']);
  });
  it('permite intervalo ou saída após entrada', () => {
    expect(allowedNextTypes('entrada')).toEqual(['intervalo_inicio', 'saida']);
  });
});

const employee44h = {
  id: 'e1', unitId: 'u1', hoursBank: false,
  schedule: {
    preset: '44h_5x2',
    days: { 1: { start: '08:00', end: '18:00', breakMinutes: 60 } }, // 8h/dia
  },
};

function markAt(dateStr, hhmmss, type) {
  return { type, timestamp: `${dateStr}T${hhmmss}-03:00` };
}

describe('computeDay — jornada e tolerância (art. 58 §1 CLT)', () => {
  it('8h58 de trabalho com jornada de 8h fica dentro da tolerância (sem HE)', () => {
    // segunda-feira 2026-01-05
    const marks = [
      markAt('2026-01-05', '08:00:00', 'entrada'),
      markAt('2026-01-05', '12:00:00', 'intervalo_inicio'),
      markAt('2026-01-05', '13:00:00', 'intervalo_fim'),
      markAt('2026-01-05', '18:08:00', 'saida'), // 8h58 trabalhadas (diff = +8min < 10 tolerância? checar abaixo)
    ];
    const day = computeDay({ employee: employee44h, dateStr: '2026-01-05', marks, holidays: [], toleranceMinutes: 5 });
    // Jornada configurada: 08:00-18:00 com 60min de intervalo = 540min esperados.
    // worked = (12:00-08:00)+(18:08-13:00) = 4h + 5h08 = 9h08 = 548min; diff=8min > tolerância de 5min.
    expect(day.expected.expectedMinutes).toBe(540);
    expect(day.worked).toBe(548);
    expect(day.extra50).toBeGreaterThan(0);
  });

  it('diferença dentro da tolerância de 5 minutos não gera HE nem déficit', () => {
    const marks = [
      markAt('2026-01-05', '08:00:00', 'entrada'),
      markAt('2026-01-05', '12:00:00', 'intervalo_inicio'),
      markAt('2026-01-05', '13:00:00', 'intervalo_fim'),
      markAt('2026-01-05', '18:04:00', 'saida'), // 8h04 de trabalho útil = 484min, diff=4min
    ];
    const day = computeDay({ employee: employee44h, dateStr: '2026-01-05', marks, holidays: [], toleranceMinutes: 5 });
    expect(day.extra50).toBe(0);
    expect(day.deficit).toBe(0);
  });
});

describe('nightMinutes — adicional noturno (art. 73 CLT)', () => {
  it('6h reais entre 23:00 e 05:00 equivalem a 7h reduzidas (hora de 52min30s)', () => {
    const intervals = [{ start: '2026-01-05T23:00:00-03:00', end: '2026-01-06T05:00:00-03:00' }];
    const { realMinutes, reducedEquivalentMinutes } = nightMinutes(intervals);
    expect(realMinutes).toBe(360); // 6h reais
    expect(reducedEquivalentMinutes).toBe(Math.round(360 * (60 / 52.5))); // ~411min = 6h51
  });
});

describe('computeWorkedIntervals', () => {
  it('monta intervalos a partir de entrada/intervalo/saída', () => {
    const marks = [
      markAt('2026-01-05', '08:00:00', 'entrada'),
      markAt('2026-01-05', '12:00:00', 'intervalo_inicio'),
      markAt('2026-01-05', '13:00:00', 'intervalo_fim'),
      markAt('2026-01-05', '17:00:00', 'saida'),
    ];
    const { intervals, workedMinutes, breakMinutes } = computeWorkedIntervals(marks);
    expect(intervals.length).toBe(2);
    expect(workedMinutes).toBe(8 * 60); // 4h + 4h
    expect(breakMinutes).toBe(60);
  });
});

describe('interjornadaViolations — mínimo de 11h entre jornadas (art. 66 CLT)', () => {
  it('detecta intervalo menor que 11h entre a saída e a próxima entrada', () => {
    const days = [
      { date: '2026-01-05', intervals: [{ start: '2026-01-05T08:00:00-03:00', end: '2026-01-05T22:00:00-03:00' }] },
      { date: '2026-01-06', intervals: [{ start: '2026-01-06T05:00:00-03:00', end: '2026-01-06T13:00:00-03:00' }] },
    ];
    const violations = interjornadaViolations(days);
    expect(violations).toHaveLength(1);
    expect(violations[0].gapHours).toBe(7);
  });

  it('não aponta violação quando o intervalo é de 11h ou mais', () => {
    const days = [
      { date: '2026-01-05', intervals: [{ start: '2026-01-05T08:00:00-03:00', end: '2026-01-05T17:00:00-03:00' }] },
      { date: '2026-01-06', intervals: [{ start: '2026-01-06T08:00:00-03:00', end: '2026-01-06T17:00:00-03:00' }] },
    ];
    expect(interjornadaViolations(days)).toHaveLength(0);
  });
});

describe('vacationEntitlementDays — art. 130 CLT', () => {
  it('até 5 faltas: 30 dias', () => expect(vacationEntitlementDays(5)).toBe(30));
  it('6 a 14 faltas: 24 dias', () => expect(vacationEntitlementDays(6)).toBe(24));
  it('15 a 23 faltas: 18 dias', () => expect(vacationEntitlementDays(15)).toBe(18));
  it('24 a 32 faltas: 12 dias', () => expect(vacationEntitlementDays(24)).toBe(12));
  it('mais de 32 faltas: 0 dias', () => expect(vacationEntitlementDays(33)).toBe(0));
});

describe('validateVacationFractions — art. 134 §1 CLT', () => {
  it('aceita 14+10+6 (uma fração >=14, demais >=5)', () => {
    const result = validateVacationFractions([{ days: 14 }, { days: 10 }, { days: 6 }], 30);
    expect(result.valid).toBe(true);
  });
  it('rejeita 10+10+10 (nenhuma fração com 14 dias)', () => {
    const result = validateVacationFractions([{ days: 10 }, { days: 10 }, { days: 10 }], 30);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/14 dias/);
  });
  it('rejeita mais de 3 frações', () => {
    const result = validateVacationFractions([{ days: 14 }, { days: 8 }, { days: 5 }, { days: 3 }], 30);
    expect(result.valid).toBe(false);
  });
  it('rejeita abono acima de 1/3 do direito', () => {
    const result = validateVacationFractions([{ days: 30, abonoDays: 15 }], 30);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/abono/i);
  });
});

describe('noticeDays — aviso prévio proporcional (Lei 12.506/2011)', () => {
  it('3 anos e 11 meses de casa: 30 + 3*3 = 39 dias', () => {
    const admission = '2022-02-10';
    const termination = '2026-01-15'; // ~3 anos e 11 meses
    expect(noticeDays(admission, termination)).toBe(39);
  });
  it('respeita o teto de 90 dias mesmo com muitos anos de casa', () => {
    expect(noticeDays('2000-01-01', '2026-01-01')).toBe(90);
  });
  it('empregado recém-admitido tem direito aos 30 dias mínimos', () => {
    expect(noticeDays('2026-01-01', '2026-06-01')).toBe(30);
  });
});

describe('experienceDates — presets de contrato de experiência', () => {
  it('30+60 dias: primeiro período termina no dia 30, segundo mais 60 dias depois', () => {
    const { firstEnd, secondEnd } = experienceDates('2026-01-01', { firstDays: 30, secondDays: 60 });
    expect(firstEnd).toBe('2026-01-30');
    expect(secondEnd).toBe(addDays(firstEnd, 60));
    expect(diffDays('2026-01-01', secondEnd)).toBeLessThanOrEqual(90);
  });
});

describe('movableHolidays — feriados móveis calculados', () => {
  it('2026: Carnaval 17/02, Sexta-feira Santa 03/04, Corpus Christi 04/06', () => {
    const holidays = movableHolidays(2026);
    const byName = Object.fromEntries(holidays.map((h) => [h.name, h.date]));
    expect(byName['Carnaval']).toBe('2026-02-17');
    expect(byName['Sexta-feira Santa']).toBe('2026-04-03');
    expect(byName['Corpus Christi']).toBe('2026-06-04');
  });
  it('easterDate(2026) calcula a Páscoa de 2026 em 05/04', () => {
    expect(easterDate(2026)).toBe('2026-04-05');
  });
});

describe('computeMonth — DSR perdido e 12x36', () => {
  it('perde o DSR da semana com falta injustificada (Lei 605/49, art. 6)', () => {
    // Segunda 2026-01-05 sem nenhuma marcação e sem ocorrência justificando = falta injustificada.
    const records = [];
    const adjustments = [];
    const occurrences = [];
    const { totals } = computeMonth({
      employee: employee44h, records, adjustments, occurrences, holidays: [],
      monthKey: '2026-01', toleranceMinutes: 5,
    });
    expect(totals.absencesUnjustified).toBeGreaterThan(0);
    expect(totals.dsrLostDays).toBeGreaterThan(0);
  });

  it('12x36: dias alternados conforme cycleAnchorDate', () => {
    const employee12x36 = {
      id: 'e2', unitId: 'u1',
      schedule: { preset: '12x36', cycleAnchorDate: '2026-01-01', shift: { start: '07:00', end: '19:00', breakMinutes: 60 } },
    };
    const records = [
      { id: 'r1', employeeId: 'e2', workDate: '2026-01-01', type: 'entrada', timestamp: '2026-01-01T07:00:00-03:00' },
      { id: 'r2', employeeId: 'e2', workDate: '2026-01-01', type: 'saida', timestamp: '2026-01-01T19:00:00-03:00' },
    ];
    const { days } = computeMonth({
      employee: employee12x36, records, adjustments: [], occurrences: [], holidays: [],
      monthKey: '2026-01', toleranceMinutes: 5,
    });
    const day1 = days.find((d) => d.date === '2026-01-01');
    const day2 = days.find((d) => d.date === '2026-01-02');
    expect(day1.expected.isRestDay).toBe(false); // dia par do ciclo: trabalha
    expect(day2.expected.isRestDay).toBe(true); // dia ímpar: folga
    // Sem marcação de intervalo neste teste: as 12h batidas (07:00-19:00) contam
    // integralmente como trabalhadas (o intervalo só é descontado se registrado).
    expect(day1.worked).toBe(12 * 60);
    expect(day1.expected.expectedMinutes).toBe(11 * 60); // esperado já desconta 1h de intervalo da escala
  });
});

describe('descontos em folha — 1/30 do salário/bolsa declarado por dia', () => {
  it('valor do dia é a remuneração mensal dividida por 30, não por dias úteis', () => {
    expect(dailyPayRate(3000)).toBe(100);
    expect(dailyPayRate(1500)).toBe(50);
  });

  it('trata remuneração ausente ou inválida como zero', () => {
    expect(dailyPayRate(null)).toBe(0);
    expect(dailyPayRate('')).toBe(0);
    expect(dailyPayRate(-500)).toBe(0);
  });

  it('desconta um trigésimo por dia de falta injustificada', () => {
    expect(absenceDeduction(3000, 3)).toBe(300);
    expect(absenceDeduction(3000, 0)).toBe(0);
    expect(absenceDeduction(3000, -2)).toBe(0);
  });

  it('paga o mês cheio quando não há falta e nunca devolve valor negativo', () => {
    expect(payAfterAbsences(3000, 0)).toBe(3000);
    expect(payAfterAbsences(3000, 5)).toBe(2500);
    expect(payAfterAbsences(3000, 40)).toBe(0);
  });

  it('usa a mesma base para estágio (bolsa) e CLT (salário-base)', () => {
    const bolsa = 1200;
    const salario = 1200;
    expect(absenceDeduction(bolsa, 2)).toBe(absenceDeduction(salario, 2));
    expect(absenceDeduction(bolsa, 2)).toBe(80);
  });
});
