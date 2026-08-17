import { startOfWeek } from './helpers';

// Agrupa os registros de ponto (entrada/saída) por estagiário + dia, pareando
// entradas com saídas em ordem cronológica e somando as horas de cada par.
// `matchesRecord` decide quais registros entram no agrupamento (o critério de
// filtro por unidade difere levemente entre o resumo de horas e os alertas —
// mantido fiel ao comportamento original de cada um).
function groupHoursByInternAndDay(records, matchesRecord) {
  const grouped = {};
  records.forEach((r) => {
    if (!matchesRecord(r)) return;

    const d = new Date(r.timestamp);
    const dateKey = d.toLocaleDateString('pt-BR');
    const key = `${r.internName}|${dateKey}`;
    if (!grouped[key]) grouped[key] = { internName: r.internName, day: new Date(d), events: [] };
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
    return { internName: g.internName, day: g.day, hours: totalMs / (1000 * 60 * 60) };
  });
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
