import { addDays, weekdayOf } from './cltCalculations.js';
import { LABOR } from '../config/labor.js';

// Dias da semana (Date#getDay): 0=Dom ... 6=Sáb. A semana do shopping vai de
// segunda a domingo.
const FIXED_WEEKDAYS = [5, 6]; // sexta e sábado: sempre trabalhados
const VARIABLE_WEEKDAYS = [0, 1, 2, 3, 4]; // dom a qui: alternam

export function monthDates(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) =>
    `${monthKey}-${String(i + 1).padStart(2, '0')}`);
}

// Segunda-feira da semana que contém `dateStr`.
export function weekStartOf(dateStr) {
  return addDays(dateStr, -((weekdayOf(dateStr) + 6) % 7));
}

// Horas por dia trabalhado: dailyHours do estagiário, nunca acima do limite.
export function hoursPerDay(intern) {
  const h = Number(intern?.dailyHours) || LABOR.maxDailyHours;
  return Math.min(Math.max(h, 1), LABOR.maxDailyHours);
}

// Quantos dias de trabalho cabem na semana sem passar de 30h.
export function daysPerWeek(intern) {
  return Math.floor(LABOR.maxWeeklyHours / hoursPerDay(intern));
}

// Escolhe quais dias "variáveis" (dom a qui) o estagiário trabalha na semana.
// weekIndex: 0 para a primeira semana do mês, 1 para a segunda...
// candidates: weekdays (0..4) ainda livres e dentro do vínculo.
// count: quantos dias precisam ser escolhidos.
// Retorna uma lista de até `count` weekdays tirados de `candidates`.
// Regra padrão: semanas pares usam Seg, Qua, Dom; ímpares usam Ter, Qui, Dom.
// Dom entra nos dois porque sexta e sábado já ocupam o fim da semana; os
// demais candidatos servem só de reserva quando algum dia está indisponível.
const EVEN_WEEK_ORDER = [1, 3, 0, 2, 4];
const ODD_WEEK_ORDER = [2, 4, 0, 1, 3];

export function pickVariableDays({ weekIndex, candidates, count }) {
  const order = weekIndex % 2 === 0 ? EVEN_WEEK_ORDER : ODD_WEEK_ORDER;
  return order.filter((wd) => candidates.includes(wd)).slice(0, count);
}

// Gera a escala do mês. `fixed` = { [internId]: { [data]: horas } } com o que
// foi arrastado à mão (imutável). Retorna { [internId]: { [data]: horas } }
// já incluindo os fixos.
export function generateMonthSchedule({ monthKey, interns, fixed = {} }) {
  const dates = monthDates(monthKey);
  const weeks = new Map(); // segunda -> datas do mês nessa semana
  for (const d of dates) {
    const ws = weekStartOf(d);
    if (!weeks.has(ws)) weeks.set(ws, []);
    weeks.get(ws).push(d);
  }
  const weekStarts = [...weeks.keys()].sort();

  const result = {};
  for (const intern of interns) {
    const hours = hoursPerDay(intern);
    const out = { ...(fixed[intern.id] || {}) };
    weekStarts.forEach((ws, weekIndex) => {
      const inBond = weeks.get(ws).filter((d) =>
        (!intern.startDate || d >= intern.startDate) &&
        (!intern.endDate || d <= intern.endDate));
      const usedHours = inBond.reduce((s, d) => s + (out[d] || 0), 0);
      let slots = Math.floor((LABOR.maxWeeklyHours - usedHours) / hours);
      const free = inBond.filter((d) => !out[d]);

      // 1) sexta e sábado primeiro
      for (const d of free) {
        if (slots <= 0) break;
        if (FIXED_WEEKDAYS.includes(weekdayOf(d))) { out[d] = hours; slots--; }
      }
      // 2) o restante entre dom e qui
      if (slots > 0) {
        const byWeekday = new Map(free
          .filter((d) => !out[d] && VARIABLE_WEEKDAYS.includes(weekdayOf(d)))
          .map((d) => [weekdayOf(d), d]));
        const picked = pickVariableDays({
          weekIndex, candidates: [...byWeekday.keys()], count: slots,
        });
        for (const wd of picked.slice(0, slots)) {
          if (byWeekday.has(wd)) out[byWeekday.get(wd)] = hours;
        }
      }
    });
    result[intern.id] = out;
  }
  return result;
}

// Verifica limites por dia e por semana. Retorna lista de problemas.
export function validateSchedule(daysMap) {
  const problems = [];
  const perWeek = {};
  for (const [date, h] of Object.entries(daysMap || {})) {
    if (h > LABOR.maxDailyHours) problems.push({ type: 'day', date, hours: h });
    const ws = weekStartOf(date);
    perWeek[ws] = (perWeek[ws] || 0) + h;
  }
  for (const [weekStart, h] of Object.entries(perWeek)) {
    if (h > LABOR.maxWeeklyHours) problems.push({ type: 'week', weekStart, hours: h });
  }
  return problems;
}
