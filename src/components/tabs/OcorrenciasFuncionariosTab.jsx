import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, Plus, X, Printer } from 'lucide-react';
import { supabase } from '../../supabase';
import {
  mapEmployeeFromDb, EMPLOYEE_LIST_FIELDS,
  mapOccurrenceFromDb, mapOccurrenceToDb, getFriendlyDbErrorMessage,
} from '../../utils/mappings';
import { diffDays, addDays } from '../../utils/cltCalculations';
import { OCCURRENCE_TYPES, ART_473_LEAVES } from '../../config/cltConstants';
import { getEmployeeDocumentHtml } from '../../utils/cltDocuments';
import { openPrintWindow } from '../../utils/documentPrint';
import { BRANDING } from '../../config/branding';
import { toast } from 'sonner';

// Ocorrências funcionais (faltas, atestados, advertências, suspensões,
// afastamentos, licenças). Deliberadamente sem campo de CID — dado de saúde
// sensível (LGPD art. 11); o atestado fica só como documento anexado.
export default function OcorrenciasFuncionariosTab({ filterUnit, restrictedUnitIds = [], units = [] }) {
  const [employees, setEmployees] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employeeId: '', type: 'falta_injustificada', startDate: '', endDate: '', days: 1, description: '', legalBasis: '' });
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: empData }, { data: occData }] = await Promise.all([
        supabase.from('employees').select(EMPLOYEE_LIST_FIELDS),
        supabase.from('employee_occurrences').select('*').order('start_date', { ascending: false }).limit(400),
      ]);
      if (empData) setEmployees(empData.map(mapEmployeeFromDb).filter((e) => !restrictedUnitIds.includes(e.unitId)));
      if (occData) setOccurrences(occData.map(mapOccurrenceFromDb));
    } catch (err) {
      console.error('Erro ao carregar ocorrências:', err);
      toast.error('Erro ao carregar ocorrências.');
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredEmployees = useMemo(() => employees.filter((e) => filterUnit === 'all' || e.unitId === filterUnit), [employees, filterUnit]);
  const filteredOccurrences = occurrences.filter((o) => filteredEmployees.some((e) => e.id === o.employeeId));
  const employeeName = (id) => employees.find((e) => e.id === id)?.name || '—';
  const typeMeta = (key) => OCCURRENCE_TYPES.find((t) => t.key === key) || OCCURRENCE_TYPES[OCCURRENCE_TYPES.length - 1];

  const applyArt473 = (key) => {
    const leave = ART_473_LEAVES.find((l) => l.key === key);
    if (!leave) return;
    setForm((f) => ({
      ...f, days: leave.days || 1, legalBasis: `Art. 473 CLT — ${leave.label}`,
      endDate: f.startDate ? addDays(f.startDate, (leave.days || 1) - 1) : f.endDate,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employeeId || !form.startDate) { toast.error('Selecione o funcionário e a data.'); return; }
    const employee = employees.find((emp) => emp.id === form.employeeId);
    const meta = typeMeta(form.type);
    const days = form.endDate ? diffDays(form.startDate, form.endDate) + 1 : Number(form.days) || 1;

    setSaving(true);
    try {
      const { error } = await supabase.from('employee_occurrences').insert([mapOccurrenceToDb({
        employeeId: form.employeeId, unitId: employee.unitId, type: form.type, startDate: form.startDate,
        endDate: form.endDate || form.startDate, days, justified: form.type !== 'falta_injustificada',
        legalBasis: form.legalBasis, description: form.description,
        affectsDsr: meta.affectsDsr, affectsVacation: meta.affectsVacation,
        inssReferral: form.type === 'atestado' && days > 15,
      })]);
      if (error) throw error;

      // Atestado > 15 dias ou afastamento INSS: sinaliza status "afastado".
      if ((form.type === 'atestado' && days > 15) || form.type === 'afastamento_inss') {
        await supabase.from('employees').update({ status: 'afastado' }).eq('id', form.employeeId);
      }

      toast.success('Ocorrência lançada com sucesso.');
      setShowForm(false);
      setForm({ employeeId: '', type: 'falta_injustificada', startDate: '', endDate: '', days: 1, description: '', legalBasis: '' });
      fetchAll();
    } catch (err) {
      console.error('Erro ao lançar ocorrência:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = (type, occurrence) => {
    const employee = employees.find((e) => e.id === occurrence.employeeId);
    const unit = units.find((u) => u.id === employee?.unitId);
    const html = getEmployeeDocumentHtml(type, {
      employee, unit, branding: BRANDING, dependents: [],
      extra: { startDate: occurrence.startDate, endDate: occurrence.endDate, days: occurrence.days, description: occurrence.description },
    });
    openPrintWindow(html, `${type === 'advertencia' ? 'Advertência' : 'Suspensão'} - ${employee?.name || ''}`);
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
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <AlertTriangle size={20} className="text-indigo-600" /> Ocorrências
        </h2>
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5">
          <Plus size={14} /> Lançar Ocorrência
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="p-3 font-semibold">Funcionário</th>
              <th className="p-3 font-semibold">Tipo</th>
              <th className="p-3 font-semibold">Período</th>
              <th className="p-3 font-semibold">Dias</th>
              <th className="p-3 font-semibold">Base legal</th>
              <th className="p-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredOccurrences.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhuma ocorrência lançada.</td></tr>
            ) : (
              filteredOccurrences.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-semibold text-gray-800">{employeeName(o.employeeId)}</td>
                  <td className="p-3 text-gray-600">{typeMeta(o.type).label}</td>
                  <td className="p-3 text-gray-600">{o.startDate}{o.endDate && o.endDate !== o.startDate ? ` a ${o.endDate}` : ''}</td>
                  <td className="p-3 text-gray-600">{o.days}</td>
                  <td className="p-3 text-gray-500 max-w-[180px] truncate" title={o.legalBasis}>{o.legalBasis || '—'}</td>
                  <td className="p-3 text-right">
                    {(o.type === 'advertencia_escrita') && (
                      <button onClick={() => handlePrint('advertencia', o)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded" title="Imprimir advertência"><Printer size={13} /></button>
                    )}
                    {o.type === 'suspensao' && (
                      <button onClick={() => handlePrint('suspensao', o)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded" title="Imprimir suspensão"><Printer size={13} /></button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            <h3 className="text-sm font-bold text-gray-800 mb-4">Lançar Ocorrência</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Funcionário</label>
                <select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs">
                  <option value="">Selecione...</option>
                  {filteredEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Tipo</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs">
                  {OCCURRENCE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              {form.type === 'falta_justificada_473' && (
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Motivo (art. 473)</label>
                  <select onChange={(e) => applyArt473(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs">
                    <option value="">Selecione...</option>
                    {ART_473_LEAVES.map((l) => <option key={l.key} value={l.key}>{l.label} {l.days ? `(${l.days}d)` : ''}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Data início</label>
                  <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Data fim (opcional)</label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Descrição</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" placeholder="Sem dados de saúde sensíveis (ex.: CID) — apenas contexto administrativo." />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg text-xs disabled:opacity-50">
                {saving ? 'Salvando...' : 'Lançar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
