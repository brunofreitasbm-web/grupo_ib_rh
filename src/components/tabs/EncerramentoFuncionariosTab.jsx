import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lock, Printer, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../supabase';
import {
  mapEmployeeFromDb, EMPLOYEE_LIST_FIELDS,
  mapTerminationFromDb, mapTerminationToDb,
  mapMedicalExamFromDb, getFriendlyDbErrorMessage,
} from '../../utils/mappings';
import { noticeDays, projectNotice, paymentDeadline, demissionalRequired } from '../../utils/cltCalculations';
import { TERMINATION_TYPES, NOTICE_TYPES, RESCISION_CHECKLIST } from '../../config/cltConstants';
import { getEmployeeDocumentHtml } from '../../utils/cltDocuments';
import { openPrintWindow } from '../../utils/documentPrint';
import { BRANDING } from '../../config/branding';
import { toast } from 'sonner';

// Encerramento de contrato CLT: wizard de tipo → aviso prévio (proporcional,
// Lei 12.506/2011) → exame demissional → checklist rescisório. Datas e
// checklist apenas — NÃO calcula valores de rescisão (ver aviso no template).
export default function EncerramentoFuncionariosTab({ filterUnit, restrictedUnitIds = [], units = [] }) {
  const [employees, setEmployees] = useState([]);
  const [terminations, setTerminations] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type: 'sem_justa_causa', noticeType: 'indenizado', noticeReduction: 'nenhuma',
    noticeStart: '', terminationDate: '', notes: '', checklist: {},
  });

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: empData }, { data: termData }, { data: examData }] = await Promise.all([
        supabase.from('employees').select(EMPLOYEE_LIST_FIELDS),
        supabase.from('employee_terminations').select('*'),
        supabase.from('employee_medical_exams').select('*'),
      ]);
      if (empData) setEmployees(empData.map(mapEmployeeFromDb).filter((e) => !restrictedUnitIds.includes(e.unitId)));
      if (termData) setTerminations(termData.map(mapTerminationFromDb));
      if (examData) setExams(examData.map(mapMedicalExamFromDb));
    } catch (err) {
      console.error('Erro ao carregar encerramentos:', err);
      toast.error('Erro ao carregar dados de encerramento.');
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredEmployees = useMemo(() => employees.filter((e) => filterUnit === 'all' || e.unitId === filterUnit), [employees, filterUnit]);
  const selectedEmployee = employees.find((e) => e.id === selectedId) || null;
  const existingTermination = terminations.find((t) => t.employeeId === selectedId) || null;
  const lastExam = exams.filter((x) => x.employeeId === selectedId).sort((a, b) => (b.examDate > a.examDate ? 1 : -1))[0];

  useEffect(() => {
    if (existingTermination) {
      setForm({
        type: existingTermination.type, noticeType: existingTermination.noticeType || 'indenizado',
        noticeReduction: existingTermination.noticeReduction || 'nenhuma',
        noticeStart: existingTermination.noticeStart || '', terminationDate: existingTermination.terminationDate || '',
        notes: existingTermination.notes || '', checklist: existingTermination.checklist || {},
      });
    } else if (selectedEmployee) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const days = noticeDays(selectedEmployee.admissionDate, todayStr);
      setForm({ type: 'sem_justa_causa', noticeType: 'indenizado', noticeReduction: 'nenhuma', noticeStart: todayStr, terminationDate: '', notes: '', checklist: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const computedNoticeDays = selectedEmployee && form.noticeStart
    ? noticeDays(selectedEmployee.admissionDate, form.noticeStart) : 0;
  const projected = form.noticeStart && computedNoticeDays
    ? projectNotice({ start: form.noticeStart, days: computedNoticeDays, type: form.noticeType, reduction: form.noticeReduction })
    : null;
  const termDate = form.terminationDate || projected?.end || '';
  const payDeadline = termDate ? paymentDeadline(termDate) : '';
  const needsDemissional = selectedEmployee && termDate
    ? demissionalRequired(lastExam?.examDate, termDate, 2) : true;

  const toggleChecklistItem = (key) => setForm((f) => ({ ...f, checklist: { ...f.checklist, [key]: !f.checklist[key] } }));

  const handleSave = async () => {
    if (!selectedEmployee) return;
    setSaving(true);
    try {
      const payload = mapTerminationToDb({
        employeeId: selectedId, type: form.type, noticeType: form.noticeType, noticeReduction: form.noticeReduction,
        noticeStart: form.noticeStart, noticeDays: computedNoticeDays, projectedEnd: projected?.end || null,
        terminationDate: termDate || null, paymentDeadline: payDeadline || null, checklist: form.checklist, notes: form.notes,
      });
      const { error } = await supabase.from('employee_terminations').upsert(payload, { onConflict: 'employee_id' });
      if (error) throw error;
      toast.success('Encerramento registrado com sucesso.');
      fetchAll();
    } catch (err) {
      console.error('Erro ao salvar encerramento:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = (type) => {
    const unit = units.find((u) => u.id === selectedEmployee.unitId);
    const html = getEmployeeDocumentHtml(type, {
      employee: selectedEmployee, unit, branding: BRANDING, dependents: [],
      extra: {
        noticeType: form.noticeType, noticeReduction: form.noticeReduction, noticeDays: computedNoticeDays,
        noticeStart: form.noticeStart, projectedEnd: projected?.end, paymentDeadline: payDeadline,
        terminationDate: termDate,
        typeLabel: TERMINATION_TYPES.find((t) => t.key === form.type)?.label,
        checklist: RESCISION_CHECKLIST.map((item) => ({ label: item.label, done: !!form.checklist[item.key] })),
      },
    });
    openPrintWindow(html, `${type} - ${selectedEmployee.name}`);
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
          <Lock size={20} className="text-indigo-600" /> Desligamento / Rescisão
        </h2>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="p-2 border border-gray-300 rounded-lg bg-white text-xs min-w-[220px]">
          <option value="">Selecione um funcionário...</option>
          {filteredEmployees.filter((e) => e.status !== 'desligado').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {!selectedEmployee ? (
        <div className="bg-slate-50 m-4 rounded-xl p-8 border border-slate-100 text-center text-slate-400 text-sm">
          <Lock size={40} className="mx-auto text-slate-300 mb-2" />
          Selecione um funcionário para iniciar o processo de desligamento.
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Tipo de encerramento" as="select" value={form.type} onChange={(v) => setForm({ ...form, type: v })}>
              {TERMINATION_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Field>
            <Field label="Tipo de aviso prévio" as="select" value={form.noticeType} onChange={(v) => setForm({ ...form, noticeType: v })}>
              {NOTICE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Field>
            <Field label="Início do aviso" type="date" value={form.noticeStart} onChange={(v) => setForm({ ...form, noticeStart: v })} />
            {form.noticeType === 'trabalhado' && (
              <Field label="Modo de redução da jornada" as="select" value={form.noticeReduction} onChange={(v) => setForm({ ...form, noticeReduction: v })}>
                <option value="2h_dia">2 horas diárias</option>
                <option value="7_dias">7 dias corridos</option>
                <option value="nenhuma">Sem redução informada</option>
              </Field>
            )}
            <Field label="Data de desligamento (ajustável)" type="date" value={form.terminationDate} onChange={(v) => setForm({ ...form, terminationDate: v })} placeholder={projected?.end} />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <StatCard label="Dias de aviso (Lei 12.506)" value={computedNoticeDays} />
            <StatCard label="Término projetado" value={projected?.end || '—'} />
            <StatCard label="Prazo de pagamento (art. 477 §6)" value={payDeadline || '—'} />
            <StatCard label="Exame demissional" value={needsDemissional ? 'Necessário' : 'Dispensado'} warn={needsDemissional} />
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-2">Checklist Rescisório</h4>
            <div className="space-y-1.5">
              {RESCISION_CHECKLIST.map((item) => (
                <label key={item.key} className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={!!form.checklist[item.key]} onChange={() => toggleChecklistItem(item.key)} />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          <Field label="Observações" as="textarea" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />

          <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-gray-100">
            <button onClick={() => handlePrint('aviso_previo_empregador')} className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1.5">
              <Printer size={13} /> Aviso Prévio
            </button>
            <button onClick={() => handlePrint('encaminhamento_demissional')} className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1.5">
              <Printer size={13} /> Encaminhamento Exame
            </button>
            <button onClick={() => handlePrint('checklist_rescisorio')} className="px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1.5">
              <Printer size={13} /> Checklist
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
              <CheckCircle2 size={13} /> {saving ? 'Salvando...' : 'Confirmar Encerramento'}
            </button>
          </div>
          <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-1.5">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            Este módulo não calcula valores de rescisão (verbas, FGTS, multa). Envie o resumo de datas e eventos à contabilidade para o cálculo do TRCT.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, warn }) {
  return (
    <div className={`rounded-lg p-2 border ${warn ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
      <p className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">{label}</p>
      <p className={`text-xs font-bold ${warn ? 'text-amber-700' : 'text-slate-700'}`}>{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, as = 'input', type = 'text', placeholder = '', children }) {
  const commonProps = {
    value: value ?? '', onChange: (e) => onChange(e.target.value), placeholder,
    className: 'w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs',
  };
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      {as === 'select' ? <select {...commonProps}>{children}</select> : as === 'textarea' ? <textarea rows={2} {...commonProps} /> : <input type={type} {...commonProps} />}
    </div>
  );
}
