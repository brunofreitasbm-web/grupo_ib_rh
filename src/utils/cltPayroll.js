// Fonte única da apuração mensal CLT: usada pela aba Apuração Mensal e pela
// Folha CLT do módulo Financeiro. Evita duplicar a carga paginada e o cálculo.

import { supabase } from '../supabase';
import {
  mapEmployeeFromDb, EMPLOYEE_LIST_FIELDS,
  mapTimeRecordFromDb, EMPLOYEE_TIME_RECORD_SELECT_FIELDS,
  mapTimeAdjustmentFromDb, mapHolidayFromDb, mapOccurrenceFromDb,
} from './mappings';
import { computeMonth, minutesToHHMM, dailyPayRate, absenceDeduction, payAfterAbsences } from './cltCalculations';

// Pagina por mês: o teto padrão do Supabase (1000 linhas) truncava a apuração
// e gerava faltas falsas nos funcionários do fim da lista.
async function fetchPaged(table, fields, dateCol, first, last) {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(fields)
      .gte(dateCol, first).lte(dateCol, last)
      .order(dateCol, { ascending: true }).order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

export async function fetchCltMonthData(monthKey, restrictedUnitIds = []) {
  const [year, month] = monthKey.split('-').map(Number);
  const first = `${monthKey}-01`;
  const last = `${monthKey}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

  const [{ data: empData }, recData, adjData, { data: holData }, { data: occData }] = await Promise.all([
    supabase.from('employees').select(`${EMPLOYEE_LIST_FIELDS}, bank_name, bank_agency, bank_account, pix_key`),
    fetchPaged('employee_time_records', EMPLOYEE_TIME_RECORD_SELECT_FIELDS, 'work_date', first, last),
    fetchPaged('employee_time_adjustments', '*', 'work_date', first, last),
    supabase.from('holidays').select('*'),
    supabase.from('employee_occurrences').select('*').lte('start_date', last).limit(2000),
  ]);

  return {
    employees: (empData || []).map(mapEmployeeFromDb).filter((e) => !restrictedUnitIds.includes(e.unitId)),
    records: recData.map(mapTimeRecordFromDb),
    adjustments: adjData.map(mapTimeAdjustmentFromDb),
    holidays: (holData || []).map(mapHolidayFromDb),
    occurrences: (occData || []).map(mapOccurrenceFromDb),
  };
}

// Linhas da apuração/folha por funcionário ativo. Atraso e déficit de horas
// NÃO geram desconto: só falta (dia sem ponto) injustificada. Ocorrência
// justificada (atestado/abono) afasta a falta. Desconto = 1/30 do salário-base
// por falta injustificada (mesma base da folha de estagiários).
export function buildCltRows({ employees, records, adjustments, holidays, occurrences }, monthKey, filterUnit = 'all') {
  return employees
    .filter((e) => (filterUnit === 'all' || e.unitId === filterUnit) && e.status !== 'desligado')
    .map((emp) => {
      const empOccurrences = occurrences.filter((o) => o.employeeId === emp.id);
      const { totals } = computeMonth({ employee: emp, records, adjustments, occurrences: empOccurrences, holidays, monthKey, toleranceMinutes: 5 });
      const baseSalary = Number(emp.baseSalary) || 0;
      return {
        id: emp.id, name: emp.name, unitId: emp.unitId,
        cpf: emp.cpf, bankName: emp.bankName, bankAgency: emp.bankAgency, bankAccount: emp.bankAccount, pixKey: emp.pixKey,
        baseSalary,
        dailyValue: dailyPayRate(baseSalary),
        absenceDeductionValue: absenceDeduction(baseSalary, totals.absencesUnjustified),
        payAfterAbsences: payAfterAbsences(baseSalary, totals.absencesUnjustified),
        absencesUnjustified: totals.absencesUnjustified, absencesJustified: totals.absencesJustified,
        extra50: minutesToHHMM(totals.extra50), extra100: minutesToHHMM(totals.extra100),
        extra50Minutes: totals.extra50, extra100Minutes: totals.extra100,
        nightReduced: minutesToHHMM(totals.nightReduced), nightReducedMinutes: totals.nightReduced,
        dsrLostDays: totals.dsrLostDays,
      };
    });
}
