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

/**
 * Apuração mensal de produção de prestadores PJ: por profissional, dias com
 * presença e total de horas na competência (AAAA-MM). Sem limites legais,
 * sem alertas — é só a base de conferência da Nota Fiscal.
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
    per[key].days.push({
      date: day,
      hours,
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
      return {
        professional: p,
        totalHours: agg.hours,
        daysPresent: agg.days.filter((d) => d.hours > 0 || d.open).length,
        days: agg.days,
      };
    })
    .sort((a, b) => a.professional.name.localeCompare(b.professional.name, 'pt-BR'));
}
