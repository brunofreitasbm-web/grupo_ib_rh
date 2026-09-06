import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, Camera, Ban, Plus, X, Printer, Lock, Unlock, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../supabase';
import {
  mapEmployeeFromDb, EMPLOYEE_LIST_FIELDS,
  mapTimeRecordFromDb, EMPLOYEE_TIME_RECORD_SELECT_FIELDS,
  mapTimeAdjustmentFromDb, mapTimeAdjustmentToDb,
  mapHolidayFromDb, getFriendlyDbErrorMessage, employeeRpcErrorMessage,
} from '../../utils/mappings';
import { computeMonth, minutesToHHMM, buildDayMarks, computeWorkedIntervals } from '../../utils/cltCalculations';
import { TIME_RECORD_TYPES } from '../../config/cltConstants';
import { getEmployeeDocumentHtml } from '../../utils/cltDocuments';
import { openPrintWindow } from '../../utils/documentPrint';
import { BRANDING } from '../../config/branding';
import { toast } from 'sonner';

// Ponto eletrônico dos Funcionários CLT: Registros (o que veio do quiosque,
// imutável), Ajustes (lançamentos do RH com justificativa — nunca editam o
// original) e Espelho (apuração mensal via cltCalculations.computeMonth).
// Ver register_employee_time_record / employee_time_adjustments no schema.
export default function PontoFuncionariosTab({ filterUnit, restrictedUnitIds = [], units = [] }) {
  const [subTab, setSubTab] = useState('registros');
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [photoModal, setPhotoModal] = useState(null);

  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ employeeId: '', workDate: '', type: 'entrada', time: '', reason: '', voidsRecordId: '' });
  const [savingAdjust, setSavingAdjust] = useState(false);

  const [espelhoEmployeeId, setEspelhoEmployeeId] = useState('');
  const [espelhoMonth, setEspelhoMonth] = useState(new Date().toISOString().slice(0, 7));
  const [closingTimesheet, setClosingTimesheet] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: empData }, { data: recData }, { data: adjData }, { data: holData }] = await Promise.all([
        supabase.from('employees').select(EMPLOYEE_LIST_FIELDS),
        supabase.from('employee_time_records').select(EMPLOYEE_TIME_RECORD_SELECT_FIELDS).order('timestamp', { ascending: false }).limit(500),
        supabase.from('employee_time_adjustments').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('holidays').select('*'),
      ]);
      if (empData) setEmployees(empData.map(mapEmployeeFromDb).filter((e) => !restrictedUnitIds.includes(e.unitId)));
      if (recData) setRecords(recData.map(mapTimeRecordFromDb).filter((r) => !restrictedUnitIds.includes(r.unitId)));
      if (adjData) setAdjustments(adjData.map(mapTimeAdjustmentFromDb).filter((a) => !restrictedUnitIds.includes(a.unitId)));
      if (holData) setHolidays(holData.map(mapHolidayFromDb));
    } catch (err) {
      console.error('Erro ao carregar ponto CLT:', err);
      toast.error('Erro ao carregar dados de ponto.');
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('clt-ponto-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_time_records' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_time_adjustments' }, () => fetchAll())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchAll]);

  const employeesOfUnit = useMemo(() => employees.filter((e) => filterUnit === 'all' || e.unitId === filterUnit), [employees, filterUnit]);
  const filteredRecords = useMemo(() => records.filter((r) => filterUnit === 'all' || r.unitId === filterUnit), [records, filterUnit]);
  const filteredAdjustments = useMemo(() => adjustments.filter((a) => filterUnit === 'all' || a.unitId === filterUnit), [adjustments, filterUnit]);
  const employeeName = (id) => employees.find((e) => e.id === id)?.name || '—';
  const unitName = (id) => units.find((u) => u.id === id)?.name || '—';

  const handleAddAdjustment = async (e) => {
    e.preventDefault();
    const emp = employees.find((x) => x.id === adjustForm.employeeId);
    if (!emp) { toast.error('Selecione o funcionário.'); return; }
    if (!adjustForm.workDate) { toast.error('Informe a data do dia trabalhado.'); return; }
    if (!adjustForm.reason.trim()) { toast.error('Justifique o ajuste.'); return; }
    if (adjustForm.type !== 'desconsiderar' && !adjustForm.time) { toast.error('Informe o horário.'); return; }
    if (adjustForm.type === 'desconsiderar' && !adjustForm.voidsRecordId) { toast.error('Selecione o registro a desconsiderar.'); return; }

    setSavingAdjust(true);
    try {
      const timestamp = adjustForm.type === 'desconsiderar' ? null : new Date(`${adjustForm.workDate}T${adjustForm.time}:00`).toISOString();
      const payload = mapTimeAdjustmentToDb({
        employeeId: emp.id, unitId: emp.unitId, workDate: adjustForm.workDate, type: adjustForm.type,
        timestamp, voidsRecordId: adjustForm.type === 'desconsiderar' ? adjustForm.voidsRecordId : null,
        reason: adjustForm.reason,
      });
      const { error } = await supabase.from('employee_time_adjustments').insert([payload]);
      if (error) throw error;
      toast.success('Ajuste lançado com sucesso.');
      setShowAdjustForm(false);
      setAdjustForm({ employeeId: '', workDate: '', type: 'entrada', time: '', reason: '', voidsRecordId: '' });
      fetchAll();
    } catch (err) {
      console.error('Erro ao lançar ajuste:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setSavingAdjust(false);
    }
  };

  const espelhoEmployee = employees.find((e) => e.id === espelhoEmployeeId) || null;
  const espelhoResult = useMemo(() => {
    if (!espelhoEmployee) return null;
    return computeMonth({
      employee: espelhoEmployee, records, adjustments, occurrences: [], holidays,
      monthKey: espelhoMonth, toleranceMinutes: 5,
    });
  }, [espelhoEmployee, records, adjustments, holidays, espelhoMonth]);

  const espelhoRowsForPrint = useMemo(() => {
    if (!espelhoResult || !espelhoEmployee) return [];
    return espelhoResult.days.map((day) => {
      const marks = buildDayMarks({ records, adjustments, employeeId: espelhoEmployee.id, dateStr: day.date });
      const { intervals } = computeWorkedIntervals(marks);
      const entrada = marks.find((m) => m.type === 'entrada');
      const saida = [...marks].reverse().find((m) => m.type === 'saida');
      const intervaloInicio = marks.find((m) => m.type === 'intervalo_inicio');
      const intervaloFim = marks.find((m) => m.type === 'intervalo_fim');
      const fmtHM = (ts) => (ts ? new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null);
      return {
        date: day.date,
        entrada: fmtHM(entrada?.timestamp),
        intervalo: intervaloInicio && intervaloFim ? `${fmtHM(intervaloInicio.timestamp)}-${fmtHM(intervaloFim.timestamp)}` : null,
        saida: fmtHM(saida?.timestamp),
        worked: minutesToHHMM(day.worked),
        extra50: minutesToHHMM(day.extra50),
        extra100: minutesToHHMM(day.extra100),
        status: day.status === 'falta_injustificada' ? 'Falta injust.' : day.status === 'falta_justificada' ? 'Falta just.' : (day.expected.isRestDay ? 'DSR' : day.expected.isHoliday ? 'Feriado' : 'Normal'),
      };
    });
  }, [espelhoResult, espelhoEmployee, records, adjustments]);

  const handlePrintEspelho = () => {
    if (!espelhoEmployee) return;
    const unit = units.find((u) => u.id === espelhoEmployee.unitId);
    const html = getEmployeeDocumentHtml('espelho_ponto', {
      employee: espelhoEmployee, unit, branding: BRANDING, dependents: [],
      extra: { competencia: espelhoMonth, rows: espelhoRowsForPrint },
    });
    openPrintWindow(html, `Espelho de Ponto - ${espelhoEmployee.name}`);
  };

  const handleCloseTimesheet = async () => {
    if (!espelhoEmployee || !espelhoResult) return;
    setClosingTimesheet(true);
    try {
      const { error } = await supabase.rpc('close_employee_timesheet', {
        p_employee_id: espelhoEmployee.id, p_competencia: espelhoMonth, p_summary: espelhoResult.totals,
      });
      if (error) throw error;
      toast.success('Competência fechada com sucesso.');
    } catch (err) {
      console.error('Erro ao fechar competência:', err);
      toast.error(employeeRpcErrorMessage(err));
    } finally {
      setClosingTimesheet(false);
    }
  };

  const recordsOfSelectedEmployee = filteredRecords.filter((r) => r.employeeId === adjustForm.employeeId && r.workDate === adjustForm.workDate);

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
          <Clock size={20} className="text-indigo-600" /> Ponto Eletrônico
        </h2>
        <div className="flex gap-1.5">
          {[['registros', 'Registros'], ['ajustes', 'Ajustes'], ['espelho', 'Espelho']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${subTab === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'registros' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
                <th className="p-3 font-semibold">Data</th>
                <th className="p-3 font-semibold">Hora</th>
                <th className="p-3 font-semibold">Funcionário</th>
                <th className="p-3 font-semibold">Unidade</th>
                <th className="p-3 font-semibold">Tipo</th>
                <th className="p-3 font-semibold">NSR</th>
                <th className="p-3 font-semibold text-right">Foto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Nenhum registro de ponto ainda.</td></tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-gray-600">{new Date(r.timestamp).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3 text-gray-600">{new Date(r.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="p-3 font-semibold text-gray-800">{r.employeeName}</td>
                    <td className="p-3 text-gray-600">{unitName(r.unitId)}</td>
                    <td className="p-3 text-gray-600">{TIME_RECORD_TYPES.find((t) => t.key === r.type)?.label || r.type}</td>
                    <td className="p-3 text-gray-500">{r.nsr}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => setPhotoModal(r)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded" title="Ver foto">
                        <Camera size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'ajustes' && (
        <div>
          <div className="p-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900">
              Registros de ponto são imutáveis (Portaria MTP 671/2021). Todo erro operacional gera um novo lançamento
              de ajuste com justificativa e autor — nunca uma edição do registro original.
            </p>
          </div>
          <div className="p-4 flex justify-end">
            <button onClick={() => setShowAdjustForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5">
              <Plus size={14} /> Lançar Ajuste
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
                  <th className="p-3 font-semibold">Data</th>
                  <th className="p-3 font-semibold">Funcionário</th>
                  <th className="p-3 font-semibold">Tipo</th>
                  <th className="p-3 font-semibold">Horário</th>
                  <th className="p-3 font-semibold">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAdjustments.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum ajuste lançado.</td></tr>
                ) : (
                  filteredAdjustments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-gray-600">{a.workDate}</td>
                      <td className="p-3 font-semibold text-gray-800">{employeeName(a.employeeId)}</td>
                      <td className="p-3 text-gray-600 flex items-center gap-1">
                        {a.type === 'desconsiderar' ? <Ban size={12} className="text-red-500" /> : null}
                        {a.type === 'desconsiderar' ? 'Desconsiderar registro' : TIME_RECORD_TYPES.find((t) => t.key === a.type)?.label}
                      </td>
                      <td className="p-3 text-gray-600">{a.timestamp ? new Date(a.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="p-3 text-gray-500 max-w-[260px] truncate" title={a.reason}>{a.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'espelho' && (
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Funcionário</label>
              <select value={espelhoEmployeeId} onChange={(e) => setEspelhoEmployeeId(e.target.value)} className="p-2 border border-gray-300 rounded-lg bg-white text-xs min-w-[220px]">
                <option value="">Selecione...</option>
                {employeesOfUnit.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Competência</label>
              <input type="month" value={espelhoMonth} onChange={(e) => setEspelhoMonth(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-xs" />
            </div>
            {espelhoEmployee && (
              <div className="flex gap-2 ml-auto">
                <button onClick={handlePrintEspelho} className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1.5">
                  <Printer size={13} /> Imprimir Espelho
                </button>
                <button onClick={handleCloseTimesheet} disabled={closingTimesheet} className="px-3 py-2 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                  {closingTimesheet ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />} Fechar Competência
                </button>
              </div>
            )}
          </div>

          {espelhoResult && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                <StatCard label="Trabalhado" value={minutesToHHMM(espelhoResult.totals.workedMinutes)} />
                <StatCard label="HE 50%" value={minutesToHHMM(espelhoResult.totals.extra50)} />
                <StatCard label="HE 100%" value={minutesToHHMM(espelhoResult.totals.extra100)} />
                <StatCard label="Noturno" value={minutesToHHMM(espelhoResult.totals.nightReduced)} />
                <StatCard label="DSR perdidos" value={espelhoResult.totals.dsrLostDays} />
                <StatCard label="Faltas injust." value={espelhoResult.totals.absencesUnjustified} />
                <StatCard label="Faltas just." value={espelhoResult.totals.absencesJustified} />
                <StatCard label="Déficit" value={minutesToHHMM(espelhoResult.totals.deficit)} />
              </div>

              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
                      <th className="p-2 font-semibold">Data</th>
                      <th className="p-2 font-semibold">Entrada</th>
                      <th className="p-2 font-semibold">Intervalo</th>
                      <th className="p-2 font-semibold">Saída</th>
                      <th className="p-2 font-semibold">Trab.</th>
                      <th className="p-2 font-semibold">HE 50%</th>
                      <th className="p-2 font-semibold">HE 100%</th>
                      <th className="p-2 font-semibold">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {espelhoRowsForPrint.map((row) => (
                      <tr key={row.date} className={row.status.startsWith('Falta') ? 'bg-red-50' : ''}>
                        <td className="p-2">{new Date(`${row.date}T00:00:00`).toLocaleDateString('pt-BR')}</td>
                        <td className="p-2">{row.entrada || '—'}</td>
                        <td className="p-2">{row.intervalo || '—'}</td>
                        <td className="p-2">{row.saida || '—'}</td>
                        <td className="p-2">{row.worked}</td>
                        <td className="p-2">{row.extra50}</td>
                        <td className="p-2">{row.extra100}</td>
                        <td className="p-2">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {showAdjustForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md relative">
            <button onClick={() => setShowAdjustForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            <h3 className="text-sm font-bold text-gray-800 mb-4">Lançar Ajuste de Ponto</h3>
            <form onSubmit={handleAddAdjustment} className="space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Funcionário</label>
                <select required value={adjustForm.employeeId} onChange={(e) => setAdjustForm({ ...adjustForm, employeeId: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs">
                  <option value="">Selecione...</option>
                  {employeesOfUnit.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Data trabalhada</label>
                <input type="date" required value={adjustForm.workDate} onChange={(e) => setAdjustForm({ ...adjustForm, workDate: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Tipo de ajuste</label>
                <select value={adjustForm.type} onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs">
                  {TIME_RECORD_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  <option value="desconsiderar">Desconsiderar registro existente</option>
                </select>
              </div>
              {adjustForm.type === 'desconsiderar' ? (
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Registro a desconsiderar</label>
                  <select required value={adjustForm.voidsRecordId} onChange={(e) => setAdjustForm({ ...adjustForm, voidsRecordId: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs">
                    <option value="">Selecione...</option>
                    {recordsOfSelectedEmployee.map((r) => (
                      <option key={r.id} value={r.id}>{TIME_RECORD_TYPES.find((t) => t.key === r.type)?.label} — {new Date(r.timestamp).toLocaleTimeString('pt-BR')} (NSR {r.nsr})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Horário</label>
                  <input type="time" required value={adjustForm.time} onChange={(e) => setAdjustForm({ ...adjustForm, time: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Justificativa *</label>
                <textarea required rows={3} value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
              </div>
              <button type="submit" disabled={savingAdjust} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg text-xs disabled:opacity-50">
                {savingAdjust ? 'Salvando...' : 'Lançar Ajuste'}
              </button>
            </form>
          </div>
        </div>
      )}

      {photoModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setPhotoModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-4 max-w-sm relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPhotoModal(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            <p className="text-xs font-semibold text-gray-700 mb-2">{photoModal.employeeName} — NSR {photoModal.nsr}</p>
            <PhotoLoader recordId={photoModal.id} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
      <p className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">{label}</p>
      <p className="text-sm font-bold text-slate-700">{value}</p>
    </div>
  );
}

// A listagem de registros nunca carrega `photo` (payload pesado); ela é
// buscada sob demanda ao abrir o modal, igual ao padrão do módulo estagiário.
function PhotoLoader({ recordId }) {
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.from('employee_time_records').select('photo').eq('id', recordId).single().then(({ data }) => {
      if (active) { setPhoto(data?.photo || null); setLoading(false); }
    });
    return () => { active = false; };
  }, [recordId]);

  if (loading) return <div className="w-64 h-48 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={24} /></div>;
  if (!photo) return <p className="text-xs text-gray-400 p-4">Sem foto registrada.</p>;
  return <img src={photo} alt="Registro de ponto" className="w-64 h-auto rounded-lg" />;
}
