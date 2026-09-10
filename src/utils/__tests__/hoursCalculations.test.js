import { describe, it, expect } from 'vitest';
import { calculateHoursSummary, calculateHoursAlerts, calculateProfessionalProduction } from '../hoursCalculations';

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

describe('calculateProfessionalProduction', () => {
  const professionals = [
    { id: 'p1', name: 'Carla Souza', unitId: 'clinica-a' },
    { id: 'p2', name: 'Marcos Lima', unitId: 'clinica-b' },
  ];

  function presenceRecord(professionalId, action, y, m, d, h, min, unitId) {
    return {
      professionalId,
      action,
      timestamp: new Date(y, m, d, h, min).toISOString(),
      unitId,
    };
  }

  it('soma horas e dias com presença por prestador na competência', () => {
    const presence = [
      presenceRecord('p1', 'entrada', 2024, 5, 10, 9, 0, 'clinica-a'),
      presenceRecord('p1', 'saida', 2024, 5, 10, 12, 0, 'clinica-a'),
      presenceRecord('p1', 'entrada', 2024, 5, 12, 14, 0, 'clinica-a'),
      presenceRecord('p1', 'saida', 2024, 5, 12, 18, 0, 'clinica-a'),
    ];
    const rows = calculateProfessionalProduction(presence, professionals, '2024-06', 'all');
    const carla = rows.find((r) => r.professional.id === 'p1');
    expect(carla.totalHours).toBeCloseTo(7, 5);
    expect(carla.daysPresent).toBe(2);
  });

  it('ignora registros de outra competência', () => {
    const presence = [
      presenceRecord('p1', 'entrada', 2024, 4, 10, 9, 0, 'clinica-a'),
      presenceRecord('p1', 'saida', 2024, 4, 10, 12, 0, 'clinica-a'),
    ];
    const rows = calculateProfessionalProduction(presence, professionals, '2024-06', 'all');
    const carla = rows.find((r) => r.professional.id === 'p1');
    expect(carla.totalHours).toBe(0);
    expect(carla.daysPresent).toBe(0);
  });

  it('filtra por unidade', () => {
    const presence = [
      presenceRecord('p1', 'entrada', 2024, 5, 10, 9, 0, 'clinica-a'),
      presenceRecord('p1', 'saida', 2024, 5, 10, 12, 0, 'clinica-a'),
      presenceRecord('p2', 'entrada', 2024, 5, 10, 9, 0, 'clinica-b'),
      presenceRecord('p2', 'saida', 2024, 5, 10, 11, 0, 'clinica-b'),
    ];
    const rows = calculateProfessionalProduction(presence, professionals, '2024-06', 'clinica-a');
    expect(rows.map((r) => r.professional.id)).toEqual(['p1']);
  });

  it('inclui prestadores sem presença com 0h/0 dias', () => {
    const rows = calculateProfessionalProduction([], professionals, '2024-06', 'all');
    expect(rows).toHaveLength(2);
    rows.forEach((r) => {
      expect(r.totalHours).toBe(0);
      expect(r.daysPresent).toBe(0);
    });
  });

  it('turno em aberto (entrada sem saída) não soma horas mas conta como dia presente', () => {
    const presence = [presenceRecord('p1', 'entrada', 2024, 5, 10, 9, 0, 'clinica-a')];
    const rows = calculateProfessionalProduction(presence, professionals, '2024-06', 'all');
    const carla = rows.find((r) => r.professional.id === 'p1');
    expect(carla.totalHours).toBe(0);
    expect(carla.daysPresent).toBe(1);
  });

  // Gratificação PJ: valor do turno x turnos com presença na competência.
  describe('turnos e gratificação', () => {
    const comValor = [
      { id: 'p1', name: 'Carla Souza', unitId: 'clinica-a', shiftValue: 1000 },
      { id: 'p2', name: 'Marcos Lima', unitId: 'clinica-b', shiftValue: 500 },
    ];

    it('conta manhã e tarde separadamente e multiplica pelo valor do turno', () => {
      const presence = [
        // Dia 10: só manhã.
        presenceRecord('p1', 'entrada', 2024, 5, 10, 8, 0, 'clinica-a'),
        presenceRecord('p1', 'saida', 2024, 5, 10, 11, 30, 'clinica-a'),
        // Dia 11: só tarde.
        presenceRecord('p1', 'entrada', 2024, 5, 11, 13, 0, 'clinica-a'),
        presenceRecord('p1', 'saida', 2024, 5, 11, 18, 0, 'clinica-a'),
        // Dia 12: manhã e tarde (dois turnos no mesmo dia).
        presenceRecord('p1', 'entrada', 2024, 5, 12, 8, 0, 'clinica-a'),
        presenceRecord('p1', 'saida', 2024, 5, 12, 17, 0, 'clinica-a'),
      ];
      const carla = calculateProfessionalProduction(presence, comValor, '2024-06', 'all')
        .find((r) => r.professional.id === 'p1');
      expect(carla.morningShifts).toBe(2);
      expect(carla.afternoonShifts).toBe(2);
      expect(carla.shiftsPresent).toBe(4);
      expect(carla.shiftValue).toBe(1000);
      expect(carla.shiftTotal).toBe(4000);
    });

    it('15 turnos a R$ 1.000,00 resultam em R$ 15.000,00 na competência', () => {
      const presence = [];
      for (let dia = 3; dia < 18; dia += 1) {
        presence.push(presenceRecord('p1', 'entrada', 2024, 5, dia, 8, 0, 'clinica-a'));
        presence.push(presenceRecord('p1', 'saida', 2024, 5, dia, 11, 0, 'clinica-a'));
      }
      const carla = calculateProfessionalProduction(presence, comValor, '2024-06', 'all')
        .find((r) => r.professional.id === 'p1');
      expect(carla.shiftsPresent).toBe(15);
      expect(carla.shiftTotal).toBe(15000);
    });

    it('saída às 12h em ponto encerra a manhã sem abrir o turno da tarde', () => {
      const presence = [
        presenceRecord('p1', 'entrada', 2024, 5, 10, 9, 0, 'clinica-a'),
        presenceRecord('p1', 'saida', 2024, 5, 10, 12, 0, 'clinica-a'),
      ];
      const carla = calculateProfessionalProduction(presence, comValor, '2024-06', 'all')
        .find((r) => r.professional.id === 'p1');
      expect(carla.morningShifts).toBe(1);
      expect(carla.afternoonShifts).toBe(0);
      expect(carla.shiftTotal).toBe(1000);
    });

    it('período em aberto conta apenas o turno da entrada', () => {
      const presence = [presenceRecord('p1', 'entrada', 2024, 5, 10, 14, 0, 'clinica-a')];
      const carla = calculateProfessionalProduction(presence, comValor, '2024-06', 'all')
        .find((r) => r.professional.id === 'p1');
      expect(carla.morningShifts).toBe(0);
      expect(carla.afternoonShifts).toBe(1);
      expect(carla.shiftTotal).toBe(1000);
    });

    it('prestador sem valor do turno cadastrado apura turnos com gratificação zero', () => {
      const presence = [
        presenceRecord('p1', 'entrada', 2024, 5, 10, 8, 0, 'clinica-a'),
        presenceRecord('p1', 'saida', 2024, 5, 10, 11, 0, 'clinica-a'),
      ];
      const carla = calculateProfessionalProduction(presence, professionals, '2024-06', 'all')
        .find((r) => r.professional.id === 'p1');
      expect(carla.shiftsPresent).toBe(1);
      expect(carla.shiftValue).toBe(0);
      expect(carla.shiftTotal).toBe(0);
    });
  });
});
