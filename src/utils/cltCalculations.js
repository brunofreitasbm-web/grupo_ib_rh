// Núcleo de regras de jornada/férias/aviso prévio/ASO do módulo CLT. Puro
// (sem React/Supabase) e testado em __tests__/cltCalculations.test.js —
// mudar uma regra aqui deve vir acompanhado de um teste explícito com a
// referência legal no describe/it. Datas em 'AAAA-MM-DD'; minutos inteiros.

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

export function toMinutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToHHMM(totalMinutes) {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a, b) {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db - da) / 86400000);
}

// Chave de data (AAAA-MM-DD) de um timestamp ISO, no fuso America/Belem —
// nunca usar toLocaleDateString sem timeZone para agrupamentos de ponto.
export function dateKeyBelem(isoTimestamp) {
  const d = new Date(isoTimestamp);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Belem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function weekdayOf(dateStr) {
  return new Date(`${dateStr}T00:00:00`).getDay(); // 0=domingo ... 6=sábado
}

// ---------------------------------------------------------------------------
// Jornada
// ---------------------------------------------------------------------------

export function isRestDay(employee, dateStr) {
  const schedule = employee?.schedule || {};
  if (schedule.preset === '12x36') {
    if (!schedule.cycleAnchorDate) return false;
    return diffDays(schedule.cycleAnchorDate, dateStr) % 2 !== 0;
  }
  const wd = weekdayOf(dateStr);
  return !schedule.days || !schedule.days[wd];
}

export function getExpectedSchedule(employee, dateStr, holidays = []) {
  const schedule = employee?.schedule || {};
  const holiday = holidays.find((h) => h.date === dateStr && (!h.unitId || h.unitId === employee?.unitId));

  if (schedule.preset === '12x36') {
    const worksToday = schedule.cycleAnchorDate ? diffDays(schedule.cycleAnchorDate, dateStr) % 2 === 0 : false;
    const shift = schedule.shift || { start: '07:00', end: '19:00', breakMinutes: 60 };
    if (!worksToday) {
      return { expectedMinutes: 0, start: null, end: null, breakMinutes: 0, isRestDay: true, isHoliday: !!holiday, holidayName: holiday?.name || null };
    }
    const raw = toMinutes(shift.end) - toMinutes(shift.start);
    const span = raw <= 0 ? raw + 24 * 60 : raw; // atravessa a meia-noite
    return {
      expectedMinutes: Math.max(0, span - (shift.breakMinutes || 0)),
      start: shift.start, end: shift.end, breakMinutes: shift.breakMinutes || 0,
      isRestDay: false, isHoliday: !!holiday, holidayName: holiday?.name || null,
    };
  }

  const wd = weekdayOf(dateStr);
  const day = schedule.days && schedule.days[wd];
  if (!day) {
    return { expectedMinutes: 0, start: null, end: null, breakMinutes: 0, isRestDay: true, isHoliday: !!holiday, holidayName: holiday?.name || null };
  }
  const expectedMinutes = Math.max(0, toMinutes(day.end) - toMinutes(day.start) - (day.breakMinutes || 0));
  return {
    expectedMinutes, start: day.start, end: day.end, breakMinutes: day.breakMinutes || 0,
    isRestDay: false, isHoliday: !!holiday, holidayName: holiday?.name || null,
  };
}

// Próximas marcações permitidas dado o último tipo registrado no turno.
export function allowedNextTypes(lastType) {
  if (!lastType || lastType === 'saida') return ['entrada'];
  if (lastType === 'entrada') return ['intervalo_inicio', 'saida'];
  if (lastType === 'intervalo_inicio') return ['intervalo_fim'];
  if (lastType === 'intervalo_fim') return ['intervalo_inicio', 'saida'];
  return ['entrada'];
}

// Monta as marcações efetivas do dia: registros do REP + ajustes, aplicando
// anulações (voids_record_id / voids_adjustment_id). Nunca edita, só filtra.
export function buildDayMarks({ records = [], adjustments = [], employeeId, dateStr }) {
  const voidedRecordIds = new Set(
    adjustments.filter((a) => a.type === 'desconsiderar' && a.voidsRecordId).map((a) => a.voidsRecordId)
  );
  const voidedAdjustmentIds = new Set(
    adjustments.filter((a) => a.type === 'desconsiderar' && a.voidsAdjustmentId).map((a) => a.voidsAdjustmentId)
  );

  const fromRecords = records
    .filter((r) => r.employeeId === employeeId && r.workDate === dateStr && !voidedRecordIds.has(r.id))
    .map((r) => ({ type: r.type, timestamp: r.timestamp, source: 'rep', id: r.id }));

  const fromAdjustments = adjustments
    .filter((a) => a.employeeId === employeeId && a.workDate === dateStr && a.type !== 'desconsiderar' && !voidedAdjustmentIds.has(a.id))
    .map((a) => ({ type: a.type, timestamp: a.timestamp, source: 'ajuste', id: a.id }));

  return [...fromRecords, ...fromAdjustments].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export function computeWorkedIntervals(marks) {
  const intervals = [];
  let breakMinutes = 0;
  let open = null;
  let onBreak = false;
  const missingMarks = [];

  for (const mark of marks) {
    if (mark.type === 'entrada') {
      if (open) missingMarks.push('saida_antes_de_entrada');
      open = mark.timestamp;
    } else if (mark.type === 'intervalo_inicio') {
      if (open && !onBreak) { intervals.push({ start: open, end: mark.timestamp }); onBreak = true; open = null; }
      else missingMarks.push('intervalo_inicio_sem_entrada');
    } else if (mark.type === 'intervalo_fim') {
      if (onBreak) { breakMinutes += (new Date(mark.timestamp) - new Date(intervals[intervals.length - 1].end)) / 60000; open = mark.timestamp; onBreak = false; }
      else missingMarks.push('intervalo_fim_sem_inicio');
    } else if (mark.type === 'saida') {
      if (open) { intervals.push({ start: open, end: mark.timestamp }); open = null; }
      else missingMarks.push('saida_sem_entrada');
    }
  }

  const workedMinutes = intervals.reduce((sum, i) => sum + (new Date(i.end) - new Date(i.start)) / 60000, 0);
  return { intervals, breakMinutes: Math.round(breakMinutes), workedMinutes: Math.round(workedMinutes), open, missingMarks };
}

// Minutos noturnos (22h–5h) e seu equivalente em "hora reduzida" (52min30s =
// 1h, art. 73 §1 CLT): realMinutes * 60/52.5.
export function nightMinutes(intervals) {
  let realMinutes = 0;
  for (const interval of intervals) {
    let cursor = new Date(interval.start);
    const end = new Date(interval.end);
    while (cursor < end) {
      const next = new Date(Math.min(end.getTime(), cursor.getTime() + 60000));
      const hour = cursor.getHours();
      if (hour >= 22 || hour < 5) realMinutes += (next - cursor) / 60000;
      cursor = next;
    }
  }
  return { realMinutes: Math.round(realMinutes), reducedEquivalentMinutes: Math.round(realMinutes * (60 / 52.5)) };
}

export function computeDay({ employee, dateStr, marks, holidays = [], toleranceMinutes = 5, occurrences = [] }) {
  const expected = getExpectedSchedule(employee, dateStr, holidays);
  const { intervals, breakMinutes, workedMinutes, open, missingMarks } = computeWorkedIntervals(marks);
  const { realMinutes: nightRealMinutes, reducedEquivalentMinutes: nightReducedMinutes } = nightMinutes(intervals);

  const occurrence = occurrences.find((o) => dateStr >= o.startDate && dateStr <= (o.endDate || o.startDate));
  const isAbsence = marks.length === 0 && !expected.isRestDay && !expected.isHoliday;
  const absenceJustified = isAbsence && !!occurrence?.justified;

  let extra50 = 0;
  let extra100 = 0;
  let deficit = 0;
  let lateMinutes = 0;

  if (expected.isRestDay || expected.isHoliday) {
    // Trabalho em DSR/feriado fora de escala: tudo é HE 100%.
    extra100 = workedMinutes;
  } else if (!isAbsence) {
    const diff = workedMinutes - expected.expectedMinutes;
    if (diff > toleranceMinutes) extra50 = diff;
    else if (diff < -toleranceMinutes) deficit = Math.abs(diff);

    if (marks.length && expected.start) {
      const firstEntry = marks.find((m) => m.type === 'entrada');
      if (firstEntry) {
        const scheduled = new Date(`${dateStr}T${expected.start}:00`);
        const actual = new Date(firstEntry.timestamp);
        const delta = (actual - scheduled) / 60000;
        if (delta > toleranceMinutes) lateMinutes = Math.round(delta);
      }
    }
  }

  const expectedBreak = expected.expectedMinutes > 360 ? 60 : expected.expectedMinutes > 240 ? 15 : 0;
  const missingBreak = !expected.isRestDay && expected.expectedMinutes > 0 && breakMinutes === 0 && expectedBreak > 0 && workedMinutes > expectedBreak;
  const breakShort = breakMinutes > 0 && breakMinutes < expectedBreak;
  const over2hExtra = extra50 > 120 || extra100 > 120;

  return {
    date: dateStr, expected, worked: workedMinutes, breakMinutes,
    extra50: Math.round(extra50), extra100: Math.round(extra100), deficit: Math.round(deficit),
    lateMinutes, nightRealMinutes, nightReducedMinutes,
    missingBreak, breakShort, over2hExtra, isAbsence, absenceJustified,
    open, missingMarks, status: isAbsence ? (absenceJustified ? 'falta_justificada' : 'falta_injustificada') : 'normal',
  };
}

// Interjornada mínima de 11h entre a saída de um dia e a entrada do
// seguinte (art. 66 CLT). Opera sobre os intervalos brutos por dia: recebe
// [{date, intervals}] ordenado e retorna as violações (< 11h de intervalo).
export function interjornadaViolations(daysWithIntervals) {
  const violations = [];
  for (let i = 0; i < daysWithIntervals.length - 1; i++) {
    const today = daysWithIntervals[i];
    const tomorrow = daysWithIntervals[i + 1];
    if (!today.intervals.length || !tomorrow.intervals.length) continue;
    const lastExit = new Date(today.intervals[today.intervals.length - 1].end);
    const firstEntry = new Date(tomorrow.intervals[0].start);
    const gapHours = (firstEntry - lastExit) / 3600000;
    if (gapHours < 11) {
      violations.push({ date: tomorrow.date, gapHours: Math.round(gapHours * 100) / 100 });
    }
  }
  return violations;
}

export function computeMonth({ employee, records = [], adjustments = [], occurrences = [], holidays = [], monthKey, toleranceMinutes = 5 }) {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];
  const dailyIntervals = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${monthKey}-${String(d).padStart(2, '0')}`;
    const marks = buildDayMarks({ records, adjustments, employeeId: employee.id, dateStr });
    const day = computeDay({ employee, dateStr, marks, holidays, toleranceMinutes, occurrences });
    days.push(day);
    dailyIntervals.push({ date: dateStr, intervals: computeWorkedIntervals(marks).intervals });
  }

  const totals = {
    workedMinutes: 0, extra50: 0, extra100: 0, nightReduced: 0, deficit: 0,
    absencesUnjustified: 0, absencesJustified: 0, medicalDays: 0, dsrLostDays: 0,
    vacationDays: 0, hoursBankBalance: 0,
  };

  // DSR perdido: agrupa por semana (dom-sáb) e verifica falta injustificada
  // ou atraso não tolerado dentro da semana (Lei 605/49, art. 6).
  const weekMap = new Map();
  for (const day of days) {
    totals.workedMinutes += day.worked;
    totals.extra50 += day.extra50;
    totals.extra100 += day.extra100;
    totals.nightReduced += day.nightReducedMinutes;
    totals.deficit += day.deficit;
    if (day.status === 'falta_injustificada') totals.absencesUnjustified += 1;
    if (day.status === 'falta_justificada') totals.absencesJustified += 1;

    const wd = weekdayOf(day.date);
    const weekStart = addDays(day.date, -wd);
    if (!weekMap.has(weekStart)) weekMap.set(weekStart, { lostDsr: false });
    if (day.status === 'falta_injustificada' || day.lateMinutes > toleranceMinutes) {
      weekMap.get(weekStart).lostDsr = true;
    }
  }
  totals.dsrLostDays = [...weekMap.values()].filter((w) => w.lostDsr).length;
  totals.hoursBankBalance = employee?.hoursBank ? (totals.extra50 + totals.extra100 - totals.deficit) : 0;

  const violations = [];
  for (const day of days) {
    if (day.over2hExtra) violations.push({ date: day.date, kind: 'over_2h_extra' });
    if (day.breakShort) violations.push({ date: day.date, kind: 'intervalo_insuficiente' });
    if (day.missingBreak) violations.push({ date: day.date, kind: 'intervalo_nao_registrado' });
  }
  violations.push(...interjornadaViolations(dailyIntervals).map((v) => ({ date: v.date, kind: 'interjornada', gapHours: v.gapHours })));

  return { days, totals, violations };
}

// ---------------------------------------------------------------------------
// Férias
// ---------------------------------------------------------------------------

// Direito a férias conforme faltas injustificadas no período aquisitivo
// (art. 130 CLT).
export function vacationEntitlementDays(unjustifiedAbsences) {
  const n = Number(unjustifiedAbsences) || 0;
  if (n <= 5) return 30;
  if (n <= 14) return 24;
  if (n <= 23) return 18;
  if (n <= 32) return 12;
  return 0;
}

export function buildVacationPeriods(employee, occurrences = [], today = new Date().toISOString().slice(0, 10)) {
  const periods = [];
  let acqStart = employee.admissionDate;
  let guard = 0;
  while (acqStart <= today && guard < 40) {
    guard++;
    const acqEnd = addDays(acqStart, 365);
    const concessionEnd = addDays(acqEnd, 365);

    const longLeave = occurrences.find((o) =>
      o.employeeId === employee.id && o.type === 'afastamento_inss' &&
      o.startDate <= acqEnd && (o.endDate || o.startDate) >= acqStart &&
      diffDays(o.startDate, o.endDate || o.startDate) > 180
    );

    const unjustified = occurrences.filter((o) =>
      o.employeeId === employee.id && o.type === 'falta_injustificada' && o.startDate >= acqStart && o.startDate <= acqEnd
    ).reduce((sum, o) => sum + (o.days || 1), 0);

    const daysEntitled = longLeave ? 0 : vacationEntitlementDays(unjustified);

    let status = 'em_aquisicao';
    if (today > acqEnd) {
      status = longLeave ? 'zerado' : (today > concessionEnd ? 'vencido' : 'adquirido');
    }
    const concessionDaysLeft = today <= concessionEnd ? diffDays(today, concessionEnd) : -diffDays(concessionEnd, today);
    const isDouble = today > concessionEnd && status !== 'gozado';

    periods.push({
      employeeId: employee.id, acquisitionStart: acqStart, acquisitionEnd: acqEnd, concessionEnd,
      unjustifiedAbsences: unjustified, daysEntitled, status, concessionDaysLeft, isDouble,
      zeroedBy: longLeave ? 'afastamento_previdenciario_maior_6_meses' : null,
    });
    acqStart = addDays(acqStart, 365);
  }
  return periods;
}

// Fracionamento (art. 134 §1): até 3 períodos, um com ao menos 14 dias, os
// demais com ao menos 5 dias; abono pecuniário até 1/3 do direito (art. 143).
export function validateVacationFractions(fractions, daysEntitled = 30) {
  const errors = [];
  if (!fractions.length) errors.push('Informe ao menos uma fração de férias.');
  if (fractions.length > 3) errors.push('No máximo 3 frações são permitidas (art. 134 §1).');

  const totalDays = fractions.reduce((s, f) => s + (f.days || 0), 0);
  const abonoDays = fractions.reduce((s, f) => s + (f.abonoDays || 0), 0);

  if (fractions.length > 1 && !fractions.some((f) => (f.days || 0) >= 14)) {
    errors.push('Uma das frações deve ter ao menos 14 dias corridos.');
  }
  if (fractions.some((f) => (f.days || 0) < 5)) {
    errors.push('Nenhuma fração pode ter menos de 5 dias corridos.');
  }
  if (totalDays > daysEntitled) {
    errors.push(`A soma dos dias (${totalDays}) excede o direito de ${daysEntitled} dias.`);
  }
  if (abonoDays > Math.floor(daysEntitled / 3)) {
    errors.push(`O abono pecuniário não pode exceder 1/3 do direito (${Math.floor(daysEntitled / 3)} dias).`);
  }
  return { valid: errors.length === 0, errors };
}

// Início das férias não pode cair nos 2 dias que antecedem feriado/DSR (art.
// 134 §3, incluído pela Lei 13.467/2017).
export function validateVacationStart(startDate, holidays = [], employee) {
  for (let offset = 0; offset <= 2; offset++) {
    const checkDate = addDays(startDate, offset);
    const wd = weekdayOf(checkDate);
    const isDsrOrHoliday = wd === 0 || holidays.some((h) => h.date === checkDate);
    if (offset < 2 && isDsrOrHoliday) {
      return { valid: false, reason: 'As férias não podem iniciar nos 2 dias que antecedem descanso semanal ou feriado.' };
    }
  }
  return { valid: true };
}

export function vacationDeadlines(startDate, acquisitionEnd) {
  return {
    noticeBy: addDays(startDate, -30),
    paymentBy: addDays(startDate, -2),
    abonoRequestBy: addDays(acquisitionEnd, -15),
  };
}

// ---------------------------------------------------------------------------
// Contrato / experiência
// ---------------------------------------------------------------------------

export function experienceDates(admissionDate, preset) {
  const firstEnd = addDays(admissionDate, preset.firstDays - 1);
  const secondEnd = preset.secondDays > 0 ? addDays(firstEnd, preset.secondDays) : null;
  return { firstEnd, secondEnd };
}

export function contractPhase(employee, today = new Date().toISOString().slice(0, 10)) {
  if (employee.contractType !== 'experiencia') return 'padrao';
  if (employee.experienceSecondEnd && today <= employee.experienceSecondEnd) return 'segundo_periodo';
  if (employee.experienceFirstEnd && today <= employee.experienceFirstEnd) return 'primeiro_periodo';
  return 'encerrado';
}

// ---------------------------------------------------------------------------
// Aviso prévio (Lei 12.506/2011)
// ---------------------------------------------------------------------------

export function noticeDays(admissionDate, terminationDate) {
  const fullYears = Math.floor(diffDays(admissionDate, terminationDate) / 365);
  return Math.min(90, 30 + 3 * Math.max(0, fullYears));
}

export function projectNotice({ start, days, type, reduction }) {
  const end = addDays(start, days - 1);
  let workDays = days;
  if (type === 'trabalhado' && reduction === '7_dias') {
    // 7 dias corridos de folga a cada período de 9 dias trabalhados (art. 488, §único).
    workDays = days - Math.floor(days / 9) * 7;
  }
  return { end, workDays };
}

export function paymentDeadline(terminationDate) {
  return addDays(terminationDate, 10);
}

// ---------------------------------------------------------------------------
// ASO / saúde ocupacional
// ---------------------------------------------------------------------------

export function asoValidUntil(examType, examDate, riskGrade, age) {
  if (examType === 'demissional' || examType === 'admissional') return null;
  const months = riskGrade >= 3 ? 12 : (age < 45 ? 24 : 12);
  return addDays(examDate, months * 30);
}

export function demissionalRequired(lastExamDate, terminationDate, riskGrade) {
  if (!lastExamDate) return true;
  const limitDays = riskGrade >= 3 ? 90 : 135;
  return diffDays(lastExamDate, terminationDate) > limitDays;
}

export function returnExamRequired(occurrence) {
  return (occurrence?.days || 0) >= 30;
}

// ---------------------------------------------------------------------------
// Feriados móveis
// ---------------------------------------------------------------------------

export const NATIONAL_FIXED_HOLIDAYS = [
  { month: 1, day: 1, name: 'Confraternização Universal' },
  { month: 4, day: 21, name: 'Tiradentes' },
  { month: 5, day: 1, name: 'Dia do Trabalho' },
  { month: 9, day: 7, name: 'Independência do Brasil' },
  { month: 10, day: 12, name: 'Nossa Senhora Aparecida' },
  { month: 11, day: 2, name: 'Finados' },
  { month: 11, day: 15, name: 'Proclamação da República' },
  { month: 11, day: 20, name: 'Consciência Negra' },
  { month: 12, day: 25, name: 'Natal' },
];

// Algoritmo de Meeus/Jones/Butcher para a Páscoa (calendário gregoriano).
export function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function movableHolidays(year) {
  const easter = easterDate(year);
  return [
    { date: addDays(easter, -47), name: 'Carnaval' },
    { date: addDays(easter, -2), name: 'Sexta-feira Santa' },
    { date: addDays(easter, 60), name: 'Corpus Christi' },
  ];
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

export function computeEmployeeAlerts({
  employees = [], vacationPeriods = [], exams = [], occurrences = [], terminations = [],
  documentsByEmployee = {}, today = new Date().toISOString().slice(0, 10),
}) {
  const alerts = [];
  const in7 = addDays(today, 7);
  const in30 = addDays(today, 30);

  for (const emp of employees) {
    if (emp.status === 'desligado') continue;

    if (emp.contractType === 'experiencia') {
      if (emp.experienceFirstEnd && emp.experienceFirstEnd >= today && emp.experienceFirstEnd <= in7 && !emp.experienceSecondEnd) {
        alerts.push({ level: 'critico', kind: 'experiencia_vencendo', employeeId: emp.id, message: `Fim do período de experiência de ${emp.name} em ${emp.experienceFirstEnd}.`, dueDate: emp.experienceFirstEnd });
      }
      if (emp.experienceSecondEnd && emp.experienceSecondEnd >= today && emp.experienceSecondEnd <= in7) {
        alerts.push({ level: 'critico', kind: 'experiencia_vencendo', employeeId: emp.id, message: `Fim do 2º período de experiência de ${emp.name} em ${emp.experienceSecondEnd}.`, dueDate: emp.experienceSecondEnd });
      }
    }

    if (emp.hoursBank && emp.hoursBankStartedAt && diffDays(emp.hoursBankStartedAt, today) > 180) {
      alerts.push({ level: 'atencao', kind: 'banco_horas_vencido', employeeId: emp.id, message: `Banco de horas de ${emp.name} está aberto há mais de 6 meses.`, dueDate: null });
    }

    const docs = documentsByEmployee[emp.id] || [];
    const missingRequired = docs.missingCount;
    if (missingRequired > 0) {
      alerts.push({ level: 'info', kind: 'documentos_pendentes', employeeId: emp.id, message: `${emp.name} tem ${missingRequired} documento(s) admissional(is) pendente(s).`, dueDate: null });
    }
  }

  for (const period of vacationPeriods) {
    const emp = employees.find((e) => e.id === period.employeeId);
    if (!emp || emp.status === 'desligado') continue;
    if (period.status === 'vencido') {
      alerts.push({ level: 'critico', kind: 'ferias_vencidas', employeeId: emp.id, message: `Férias de ${emp.name} venceram em ${period.concessionEnd}.`, dueDate: period.concessionEnd });
    } else if (period.status === 'adquirido') {
      if (period.concessionDaysLeft <= 30) alerts.push({ level: 'critico', kind: 'ferias_concessivo_30', employeeId: emp.id, message: `Período concessivo de férias de ${emp.name} vence em ${period.concessionDaysLeft} dia(s).`, dueDate: period.concessionEnd });
      else if (period.concessionDaysLeft <= 60) alerts.push({ level: 'atencao', kind: 'ferias_concessivo_60', employeeId: emp.id, message: `Período concessivo de férias de ${emp.name} vence em ${period.concessionDaysLeft} dias.`, dueDate: period.concessionEnd });
      else if (period.concessionDaysLeft <= 90) alerts.push({ level: 'info', kind: 'ferias_concessivo_90', employeeId: emp.id, message: `Período concessivo de férias de ${emp.name} vence em ${period.concessionDaysLeft} dias.`, dueDate: period.concessionEnd });
    }
  }

  for (const exam of exams) {
    const emp = employees.find((e) => e.id === exam.employeeId);
    if (!emp || emp.status === 'desligado' || !exam.validUntil) continue;
    if (exam.validUntil < today) {
      alerts.push({ level: 'critico', kind: 'aso_vencido', employeeId: emp.id, message: `ASO de ${emp.name} venceu em ${exam.validUntil}.`, dueDate: exam.validUntil });
    } else if (exam.validUntil <= in30) {
      alerts.push({ level: 'atencao', kind: 'aso_vencendo', employeeId: emp.id, message: `ASO de ${emp.name} vence em ${exam.validUntil}.`, dueDate: exam.validUntil });
    }
  }

  for (const occ of occurrences) {
    const emp = employees.find((e) => e.id === occ.employeeId);
    if (!emp) continue;
    if (occ.type === 'atestado' && (occ.days || 0) > 15 && !occ.inssReferral) {
      alerts.push({ level: 'atencao', kind: 'atestado_encaminhar_inss', employeeId: emp.id, message: `Atestado de ${emp.name} passou de 15 dias — encaminhar ao INSS.`, dueDate: null });
    }
    if (returnExamRequired(occ)) {
      alerts.push({ level: 'atencao', kind: 'exame_retorno_pendente', employeeId: emp.id, message: `${emp.name} precisa de exame de retorno ao trabalho.`, dueDate: null });
    }
  }

  for (const term of terminations) {
    const emp = employees.find((e) => e.id === term.employeeId);
    if (!emp || !term.projectedEnd) continue;
    if (term.projectedEnd >= today) {
      alerts.push({ level: 'info', kind: 'aviso_previo_contagem', employeeId: emp.id, message: `Aviso prévio de ${emp.name} termina em ${term.projectedEnd}.`, dueDate: term.projectedEnd });
    }
  }

  for (const emp of employees) {
    if (!emp.birthdate || emp.status === 'desligado') continue;
    const [, m, d] = emp.birthdate.split('-');
    const [ty, tm] = today.split('-');
    if (m === tm) {
      alerts.push({ level: 'info', kind: 'aniversariante', employeeId: emp.id, message: `${emp.name} faz aniversário em ${d}/${m}.`, dueDate: `${ty}-${m}-${d}` });
    }
  }

  return alerts;
}
