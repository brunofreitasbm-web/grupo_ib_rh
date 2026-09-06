import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Palmtree, Printer, Plus, X, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabase';
import {
  mapEmployeeFromDb, EMPLOYEE_LIST_FIELDS,
  mapOccurrenceFromDb,
  mapVacationPeriodFromDb, mapVacationPeriodToDb,
  mapVacationScheduleFromDb, mapVacationScheduleToDb,
  mapHolidayFromDb, getFriendlyDbErrorMessage,
} from '../../utils/mappings';
import { buildVacationPeriods, validateVacationFractions, validateVacationStart, vacationDeadlines } from '../../utils/cltCalculations';
import { getEmployeeDocumentHtml } from '../../utils/cltDocuments';
import { openPrintWindow } from '../../utils/documentPrint';
import { BRANDING } from '../../config/branding';
import { toast } from 'sonner';

const STATUS_LABEL = {
  em_aquisicao: 'Em aquisição', adquirido: 'Adquirido — a programar', parcialmente_gozado: 'Parcialmente gozado',
  gozado: 'Gozado', vencido: 'Vencido', zerado: 'Zerado (afastamento > 6 meses)',
};
const STATUS_BADGE = {
  em_aquisicao: 'bg-slate-100 text-slate-700', adquirido: 'bg-amber-100 text-amber-800',
  parcialmente_gozado: 'bg-sky-100 text-sky-800', gozado: 'bg-emerald-100 text-emerald-800',
  vencido: 'bg-red-100 text-red-800', zerado: 'bg-slate-200 text-slate-600',
};

// Férias dos Funcionários CLT: períodos aquisitivo/concessivo derivados de
// buildVacationPeriods (art. 130 CLT) e sincronizados em employee_vacation_periods;
// programação de frações validada por validateVacationFractions (art. 134 §1).
export default function FeriasTab({ filterUnit, restrictedUnitIds = [], units = [] }) {
  const [employees, setEmployees] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [syncing, setSyncing] = useState(false);

  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ periodId: '', startDate: '', days: 30, abonoDays: 0 });
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: empData }, { data: occData }, { data: holData }, { data: perData }, { data: schData }] = await Promise.all([
        supabase.from('employees').select(EMPLOYEE_LIST_FIELDS),
        supabase.from('employee_occurrences').select('*'),
        supabase.from('holidays').select('*'),
        supabase.from('employee_vacation_periods').select('*'),
        supabase.from('employee_vacation_schedules').select('*').order('start_date', { ascending: false }),
      ]);
      if (empData) setEmployees(empData.map(mapEmployeeFromDb).filter((e) => !restrictedUnitIds.includes(e.unitId) && e.status !== 'desligado'));
      if (occData) setOccurrences(occData.map(mapOccurrenceFromDb));
      if (holData) setHolidays(holData.map(mapHolidayFromDb));
      if (perData) setPeriods(perData.map(mapVacationPeriodFromDb));
      if (schData) setSchedules(schData.map(mapVacationScheduleFromDb));
    } catch (err) {
      console.error('Erro ao carregar férias:', err);
      toast.error('Erro ao carregar dados de férias.');
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredEmployees = useMemo(() => employees.filter((e) => filterUnit === 'all' || e.unitId === filterUnit), [employees, filterUnit]);
  const selectedEmployee = employees.find((e) => e.id === selectedId) || null;

  const computedPeriods = useMemo(() => {
    if (!selectedEmployee) return [];
    return buildVacationPeriods(selectedEmployee, occurrences.filter((o) => o.employeeId === selectedEmployee.id));
  }, [selectedEmployee, occurrences]);

  const persistedPeriods = periods.filter((p) => p.employeeId === selectedId);
  const employeeSchedules = schedules.filter((s) => s.employeeId === selectedId);

  // Sincroniza os períodos calculados com a tabela (upsert por acquisitionStart).
  const handleSync = async () => {
    if (!selectedEmployee) return;
    setSyncing(true);
    try {
      const rows = computedPeriods.map((p) => mapVacationPeriodToDb({ ...p }));
      const { error } = await supabase.from('employee_vacation_periods').upsert(rows, { onConflict: 'employee_id,acquisition_start' });
      if (error) throw error;
      toast.success('Períodos de férias sincronizados.');
      fetchAll();
    } catch (err) {
      console.error('Erro ao sincronizar períodos de férias:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  };

  const openScheduleForm = (period) => {
    setScheduleForm({ periodId: period.id, startDate: '', days: Math.min(30, period.daysEntitled || 30), abonoDays: 0 });
    setShowScheduleForm(true);
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    const period = persistedPeriods.find((p) => p.id === scheduleForm.periodId);
    if (!period) { toast.error('Sincronize os períodos antes de programar férias.'); return; }
    if (!scheduleForm.startDate) { toast.error('Informe a data de início.'); return; }

    const existingFractions = employeeSchedules.filter((s) => s.periodId === period.id && s.status !== 'cancelado')
      .map((s) => ({ days: s.days, abonoDays: s.abonoDays }));
    const allFractions = [...existingFractions, { days: Number(scheduleForm.days), abonoDays: Number(scheduleForm.abonoDays) }];
    const fractionCheck = validateVacationFractions(allFractions, period.daysEntitled);
    if (!fractionCheck.valid) { toast.error(fractionCheck.errors.join(' ')); return; }

    const startCheck = validateVacationStart(scheduleForm.startDate, holidays, selectedEmployee);
    if (!startCheck.valid) { toast.error(startCheck.reason); return; }

    const days = Number(scheduleForm.days);
    const endDate = new Date(new Date(`${scheduleForm.startDate}T00:00:00`).getTime() + (days - 1) * 86400000).toISOString().slice(0, 10);
    const deadlines = vacationDeadlines(scheduleForm.startDate, period.acquisitionEnd);

    setSaving(true);
    try {
      const { error } = await supabase.from('employee_vacation_schedules').insert([mapVacationScheduleToDb({
        periodId: period.id, employeeId: selectedId, startDate: scheduleForm.startDate, endDate, days,
        abonoDays: Number(scheduleForm.abonoDays) || 0, noticeIssuedAt: new Date().toISOString().slice(0, 10),
        paymentDue: deadlines.paymentBy, status: 'planejado',
      })]);
      if (error) throw error;
      toast.success('Fração de férias programada.');
      setShowScheduleForm(false);
      fetchAll();
    } catch (err) {
      console.error('Erro ao programar férias:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = (type, schedule, period) => {
    const unit = units.find((u) => u.id === selectedEmployee.unitId);
    const html = getEmployeeDocumentHtml(type, {
      employee: selectedEmployee, unit, branding: BRANDING, dependents: [],
      extra: { ...schedule, acquisitionStart: period.acquisitionStart, acquisitionEnd: period.acquisitionEnd },
    });
    openPrintWindow(html, `${type === 'aviso_ferias' ? 'Aviso' : 'Recibo'} de Férias - ${selectedEmployee.name}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Palmtree size={20} className="text-indigo-600" /> Férias
        </h2>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="p-2 border border-gray-300 rounded-lg bg-white text-xs min-w-[220px]">
          <option value="">Selecione um funcionário...</option>
          {filteredEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {!selectedEmployee ? (
        <div className="bg-slate-50 m-4 rounded-xl p-8 border border-slate-100 text-center text-slate-400 text-sm">
          <Palmtree size={40} className="mx-auto text-slate-300 mb-2" />
          Selecione um funcionário para ver os períodos de férias.
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="flex justify-end">
            <button onClick={handleSync} disabled={syncing} className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> Sincronizar períodos
            </button>
          </div>

          <div className="space-y-3">
            {computedPeriods.map((p) => {
              const persisted = persistedPeriods.find((pp) => pp.acquisitionStart === p.acquisitionStart);
              const periodSchedules = persisted ? employeeSchedules.filter((s) => s.periodId === persisted.id) : [];
              return (
                <div key={p.acquisitionStart} className="border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">
                        Aquisitivo {p.acquisitionStart} a {p.acquisitionEnd} — Concessivo até {p.concessionEnd}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Direito: {p.daysEntitled} dias {p.unjustifiedAbsences > 0 ? `(${p.unjustifiedAbsences} falta(s) injustificada(s))` : ''}
                        {p.isDouble && <span className="text-red-600 font-semibold"> • Férias em dobro (art. 137)</span>}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_BADGE[p.status] || STATUS_BADGE.em_aquisicao}`}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </div>

                  {persisted && (p.status === 'adquirido' || p.status === 'parcialmente_gozado') && (
                    <button onClick={() => openScheduleForm(persisted)} className="mt-2 text-[10px] font-semibold text-indigo-700 underline flex items-center gap-1">
                      <Plus size={11} /> Programar fração de férias
                    </button>
                  )}

                  {periodSchedules.length > 0 && (
                    <table className="w-full text-left border-collapse text-[10px] mt-2">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="p-1">Início</th><th className="p-1">Fim</th><th className="p-1">Dias</th><th className="p-1">Abono</th><th className="p-1">Status</th><th className="p-1 text-right">Documentos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periodSchedules.map((s) => (
                          <tr key={s.id} className="border-t border-slate-100">
                            <td className="p-1">{s.startDate}</td>
                            <td className="p-1">{s.endDate}</td>
                            <td className="p-1">{s.days}</td>
                            <td className="p-1">{s.abonoDays}</td>
                            <td className="p-1">{s.status}</td>
                            <td className="p-1 text-right">
                              <button onClick={() => handlePrint('aviso_ferias', s, persisted)} className="text-indigo-600 hover:text-indigo-800 mr-2" title="Imprimir aviso"><Printer size={12} className="inline" /> Aviso</button>
                              <button onClick={() => handlePrint('recibo_ferias', s, persisted)} className="text-indigo-600 hover:text-indigo-800" title="Imprimir recibo"><Printer size={12} className="inline" /> Recibo</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showScheduleForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm relative">
            <button onClick={() => setShowScheduleForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            <h3 className="text-sm font-bold text-gray-800 mb-4">Programar Fração de Férias</h3>
            <form onSubmit={handleScheduleSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Data de início</label>
                <input type="date" required value={scheduleForm.startDate} onChange={(e) => setScheduleForm({ ...scheduleForm, startDate: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Dias corridos</label>
                <input type="number" min={5} max={30} required value={scheduleForm.days} onChange={(e) => setScheduleForm({ ...scheduleForm, days: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Dias de abono pecuniário (opcional, art. 143)</label>
                <input type="number" min={0} max={10} value={scheduleForm.abonoDays} onChange={(e) => setScheduleForm({ ...scheduleForm, abonoDays: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg text-xs disabled:opacity-50">
                {saving ? 'Salvando...' : 'Programar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
