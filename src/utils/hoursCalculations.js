import { startOfWeek } from './helpers';

// Agrupa os registros de ponto (entrada/saída) por estagiário + dia, pareando
// entradas com saídas em ordem cronológica e somando as horas de cada par.
// `matchesRecord` decide quais registros entram no agrupamento (o critério de
// filtro por unidade difere levemente entre o resumo de horas e os alertas —
// mantido fiel ao comportamento original de cada um).
/**
 * Pareamento genérico de eventos entrada/saída por pessoa + dia.
 * Usado tanto pelo ponto de estagiários (chave = internName) quanto pela
 * presença de prestadores PJ (chave = professionalId) — a lógica de soma é
 * idêntica: entradas consecutivas não reabrem o turno; saída sem entrada é
 * ignorada; turno em aberto não soma.
 *
 * @param {Array} records - registros com {action, timestamp}
 * @param {Object} opts
 * @param {(r) => string} opts.keyOf - identificador da pessoa em cada registro
 * @param {(r) => boolean} [opts.matches] - filtro opcional
 * @returns {Array<{key, day: Date, hours: number, events: Array}>}
 */
export function pairPresenceRecords(records, { keyOf, matches = () => true }) {
  const grouped = {};
  records.forEach((r) => {
    if (!matches(r)) return;

    const d = new Date(r.timestamp);
    const dateKey = d.toLocaleDateString('pt-BR');
    const personKey = keyOf(r);
    const key = `${personKey}|${dateKey}`;
    if (!grouped[key]) grouped[key] = { key: personKey, day: new Date(d), events: [] };
    grouped[key].events.push({ action: r.action, time: d.getTime() });
  });

  return Object.values(grouped).map((g) => {
    g.events.sort((a, b) => a.time - b.time);
    let totalMs = 0;
    let lastEntradaTime = null;
    g.events.forEach((e) => {
      if (e.action === 'entrada') {
        if (lastEntradaTime === null) lastEntradaTime = e.time;
      } else if (e.action === 'saida') {
        if (lastEntradaTime !== null) {
          totalMs += (e.time - lastEntradaTime);
          lastEntradaTime = null;
        }
      }
    });
    return { key: g.key, day: g.day, hours: totalMs / (1000 * 60 * 60), events: g.events };
  });
}

function groupHoursByInternAndDay(records, matchesRecord) {
  return pairPresenceRecords(records, { keyOf: (r) => r.internName, matches: matchesRecord })
    .map(({ key, day, hours }) => ({ internName: key, day, hours }));
}

/**
 * Acumulado de horas (hoje / semana) por estagiário, respeitando o filtro de unidade.
 * @param {Array} records - registros de ponto (mapRecordFromDb)
 * @param {Array} interns - estagiários (mapInternFromDb)
 * @param {string} filterUnit - 'all' ou id da unidade
 * @param {Date} [now] - data de referência (default: agora) — parametrizável para testes
 */
export function calculateHoursSummary(records, interns, filterUnit, now = new Date()) {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = startOfWeek(now);

  const filteredInterns = interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit);
  const filteredInternNames = new Set(filteredInterns.map(i => i.name));

  const days = groupHoursByInternAndDay(
    records,
    (r) => filterUnit === 'all' || r.geo?.unitId === filterUnit || filteredInternNames.has(r.internName)
  );

  const per = {}; // nome -> { today, week }
  days.forEach(({ internName, day, hours }) => {
    if (hours <= 0) return;
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    if (!per[internName]) per[internName] = { today: 0, week: 0 };
    if (dayStart.getTime() === todayStart.getTime()) per[internName].today += hours;
    if (dayStart >= weekStart) per[internName].week += hours;
  });

  const rows = filteredInterns.map((i) => ({
    name: i.name,
    today: per[i.name]?.today || 0,
    week: per[i.name]?.week || 0,
  }));

  if (filterUnit === 'all') {
    Object.keys(per).forEach((name) => {
      if (!rows.find((r) => r.name === name)) {
        rows.push({ name, today: per[name].today, week: per[name].week, removed: true });
      }
    });
  }
  rows.sort((a, b) => b.week - a.week);
  return rows;
}

/**
 * Lista de alertas de estagiários que excederam o limite diário de horas (Lei 11.788/2008).
 * @param {Array} records - registros de ponto (mapRecordFromDb)
 * @param {Array} interns - estagiários (mapInternFromDb)
 * @param {string} filterUnit - 'all' ou id da unidade
 * @param {number} maxDailyHours - limite legal diário (ex: 6)
 */
export function calculateHoursAlerts(records, interns, filterUnit, maxDailyHours) {
  const filteredInterns = interns.filter(i => filterUnit === 'all' || i.unitId === filterUnit);
  const filteredInternNames = new Set(filteredInterns.map(i => i.name));

  const days = groupHoursByInternAndDay(
    records,
    (r) => filterUnit === 'all' || filteredInternNames.has(r.internName)
  );

  return days
    .filter(({ hours }) => hours > maxDailyHours)
    .map(({ internName, day, hours }) => ({
      internName,
      date: day.toLocaleDateString('pt-BR'),
      hours: hours.toFixed(1),
    }));
}

// Hora de corte entre os turnos de manhã e de tarde: registros com horário
// anterior a 12h contam turno de manhã; de 12h em diante, turno de tarde.
export const SHIFT_CUTOFF_HOUR = 12;

/**
 * Turnos (manhã/tarde) tocados por um dia de presença. Cada período
 * entrada→saída é comparado com o corte das 12h: o intervalo é tratado como
 * semiaberto, de modo que uma saída às 12h em ponto encerra o turno da manhã
 * sem abrir o da tarde. Um mesmo dia rende dois turnos quando a presença
 * cobre os dois lados do corte. Período em aberto (entrada sem saída) conta
 * apenas o turno em que a entrada ocorreu.
 * @param {Array<{action: string, time: number}>} events - eventos já ordenados do dia
 * @returns {{morning: boolean, afternoon: boolean}}
 */
function shiftsOfDay(events) {
  let morning = false;
  let afternoon = false;

  const cutoffOf = (time) => {
    const d = new Date(time);
    d.setHours(SHIFT_CUTOFF_HOUR, 0, 0, 0);
    return d.getTime();
  };
  let openEntrada = null;
  events.forEach((e) => {
    if (e.action === 'entrada') {
      if (openEntrada === null) openEntrada = e.time;
    } else if (e.action === 'saida' && openEntrada !== null) {
      const start = openEntrada;
      const cutoff = cutoffOf(start);
      if (start < cutoff) morning = true;
      if (e.time > cutoff) afternoon = true;
      openEntrada = null;
    }
  });

  if (openEntrada !== null) {
    if (new Date(openEntrada).getHours() < SHIFT_CUTOFF_HOUR) morning = true;
    else afternoon = true;
  }

  return { morning, afternoon };
}

/**
 * Apuração mensal de produção de prestadores PJ: por profissional, dias com
 * presença, total de horas e turnos (manhã/tarde) com presença na competência
 * (AAAA-MM). Sem limites legais, sem alertas — é só a base de conferência da
 * Nota Fiscal e da gratificação por turno (valor do turno × turnos presentes).
 * @param {Array} presence - registros (mapProfessionalPresenceFromDb)
 * @param {Array} professionals - prestadores (mapProfessionalFromDb)
 * @param {string} monthKey - 'AAAA-MM'
 * @param {string} filterUnit - 'all' ou id da unidade
 */
export function calculateProfessionalProduction(presence, professionals, monthKey, filterUnit = 'all') {
  const [year, month] = monthKey.split('-').map(Number);
  const inMonth = (r) => {
    const d = new Date(r.timestamp);
    return d.getFullYear() === year && d.getMonth() === month - 1;
  };

  const days = pairPresenceRecords(presence, {
    keyOf: (r) => r.professionalId,
    matches: (r) => inMonth(r) && (filterUnit === 'all' || r.unitId === filterUnit),
  });

  const per = {};
  days.forEach(({ key, day, hours, events }) => {
    if (!per[key]) per[key] = { hours: 0, days: [] };
    per[key].hours += hours;
    const { morning, afternoon } = shiftsOfDay(events);
    per[key].days.push({
      date: day,
      hours,
      morning,
      afternoon,
      firstIn: events.find((e) => e.action === 'entrada')?.time || null,
      lastOut: [...events].reverse().find((e) => e.action === 'saida')?.time || null,
      open: events.length > 0 && events[events.length - 1].action === 'entrada',
    });
  });

  return professionals
    .filter((p) => filterUnit === 'all' || p.unitId === filterUnit)
    .map((p) => {
      const agg = per[p.id] || { hours: 0, days: [] };
      agg.days.sort((a, b) => a.date - b.date);
      const morningShifts = agg.days.filter((d) => d.morning).length;
      const afternoonShifts = agg.days.filter((d) => d.afternoon).length;
      const shiftsPresent = morningShifts + afternoonShifts;
      const shiftValue = Number(p.shiftValue) || 0;
      return {
        professional: p,
        totalHours: agg.hours,
        daysPresent: agg.days.filter((d) => d.hours > 0 || d.open).length,
        morningShifts,
        afternoonShifts,
        shiftsPresent,
        shiftValue,
        // Gratificação PJ = valor do turno × turnos com presença na competência.
        shiftTotal: shiftValue * shiftsPresent,
        days: agg.days,
      };
    })
    .sort((a, b) => a.professional.name.localeCompare(b.professional.name, 'pt-BR'));
}
