import { describe, it, expect } from 'vitest';
import { calculateHoursSummary, calculateHoursAlerts } from '../hoursCalculations';

// Quarta-feira, 12/06/2024 (horário local) — usada como "agora" de referência.
// Segunda-feira da mesma semana: 10/06/2024.
const NOW = new Date(2024, 5, 12, 10, 0, 0);

const interns = [
  { name: 'Ana Silva', unitId: 'antonio-barreto' },
  { name: 'Bruno Costa', unitId: 'generalissimo' },
];

function record(internName, action, y, m, d, h, min, unitId) {
  return {
    internName,
    action,
    timestamp: new Date(y, m, d, h, min).toISOString(),
    geo: unitId ? { unitId } : {},
  };
}

describe('calculateHoursSummary', () => {
  it('soma um par entrada/saída no mesmo dia como horas de hoje e da semana', () => {
    const records = [
      record('Ana Silva', 'entrada', 2024, 5, 12, 9, 0, 'antonio-barreto'),
      record('Ana Silva', 'saida', 2024, 5, 12, 12, 0, 'antonio-barreto'),
    ];
    const rows = calculateHoursSummary(records, interns, 'all', NOW);
    const ana = rows.find((r) => r.name === 'Ana Silva');
    expect(ana.today).toBeCloseTo(3, 5);
    expect(ana.week).toBeCloseTo(3, 5);
  });

  it('turno em aberto (entrada sem saída correspondente) não soma horas', () => {
    const records = [record('Ana Silva', 'entrada', 2024, 5, 12, 9, 0, 'antonio-barreto')];
    const rows = calculateHoursSummary(records, interns, 'all', NOW);
    const ana = rows.find((r) => r.name === 'Ana Silva');
    expect(ana.today).toBe(0);
    expect(ana.week).toBe(0);
  });

  it('soma múltiplos pares entrada/saída no mesmo dia', () => {
    const records = [
      record('Ana Silva', 'entrada', 2024, 5, 12, 8, 0, 'antonio-barreto'),
      record('Ana Silva', 'saida', 2024, 5, 12, 12, 0, 'antonio-barreto'),
      record('Ana Silva', 'entrada', 2024, 5, 12, 13, 0, 'antonio-barreto'),
      record('Ana Silva', 'saida', 2024, 5, 12, 15, 0, 'antonio-barreto'),
    ];
    const rows = calculateHoursSummary(records, interns, 'all', NOW);
    const ana = rows.find((r) => r.name === 'Ana Silva');
    expect(ana.today).toBeCloseTo(6, 5);
  });

  it('conta um dia anterior da mesma semana no acumulado semanal, mas não no diário', () => {
    const records = [
      // segunda-feira da mesma semana (10/06)
      record('Ana Silva', 'entrada', 2024, 5, 10, 8, 0, 'antonio-barreto'),
      record('Ana Silva', 'saida', 2024, 5, 10, 9, 30, 'antonio-barreto'),
    ];
    const rows = calculateHoursSummary(records, interns, 'all', NOW);
    const ana = rows.find((r) => r.name === 'Ana Silva');
    expect(ana.today).toBe(0);
    expect(ana.week).toBeCloseTo(1.5, 5);
  });

  it('não conta um dia da semana anterior (cruzamento de semana começando na segunda)', () => {
    const records = [
      // segunda-feira da semana anterior (03/06)
      record('Ana Silva', 'entrada', 2024, 5, 3, 8, 0, 'antonio-barreto'),
      record('Ana Silva', 'saida', 2024, 5, 3, 10, 0, 'antonio-barreto'),
    ];
    const rows = calculateHoursSummary(records, interns, 'all', NOW);
    const ana = rows.find((r) => r.name === 'Ana Silva');
    expect(ana.week).toBe(0);
  });

  it('filtra por unidade', () => {
    const records = [
      record('Ana Silva', 'entrada', 2024, 5, 12, 9, 0, 'antonio-barreto'),
      record('Ana Silva', 'saida', 2024, 5, 12, 12, 0, 'antonio-barreto'),
      record('Bruno Costa', 'entrada', 2024, 5, 12, 9, 0, 'generalissimo'),
      record('Bruno Costa', 'saida', 2024, 5, 12, 11, 0, 'generalissimo'),
    ];
    const rows = calculateHoursSummary(records, interns, 'antonio-barreto', NOW);
    expect(rows.map((r) => r.name)).toEqual(['Ana Silva']);
  });

  it('inclui estagiários com 0h (sem registros) na lista filtrada', () => {
    const rows = calculateHoursSummary([], interns, 'all', NOW);
    expect(rows.map((r) => r.name).sort()).toEqual(['Ana Silva', 'Bruno Costa']);
    rows.forEach((r) => {
      expect(r.today).toBe(0);
      expect(r.week).toBe(0);
    });
  });
});

describe('calculateHoursAlerts', () => {
  it('gera alerta quando o total do dia excede o limite legal (6h)', () => {
    const records = [
      record('Ana Silva', 'entrada', 2024, 5, 12, 8, 0),
      record('Ana Silva', 'saida', 2024, 5, 12, 15, 0), // 7h
    ];
    const alerts = calculateHoursAlerts(records, interns, 'all', 6);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].internName).toBe('Ana Silva');
    expect(alerts[0].hours).toBe('7.0');
  });

  it('não gera alerta quando o total do dia está dentro do limite', () => {
    const records = [
      record('Ana Silva', 'entrada', 2024, 5, 12, 8, 0),
      record('Ana Silva', 'saida', 2024, 5, 12, 14, 0), // 6h
    ];
    const alerts = calculateHoursAlerts(records, interns, 'all', 6);
    expect(alerts).toHaveLength(0);
  });
});
