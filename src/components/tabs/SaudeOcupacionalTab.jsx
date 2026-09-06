import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Stethoscope, Plus, X, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../supabase';
import {
  mapEmployeeFromDb, EMPLOYEE_LIST_FIELDS,
  mapMedicalExamFromDb, mapMedicalExamToDb, fileToBase64, getFriendlyDbErrorMessage,
} from '../../utils/mappings';
import { asoValidUntil } from '../../utils/cltCalculations';
import { EXAM_TYPES } from '../../config/cltConstants';
import { toast } from 'sonner';

function ageAt(birthdate, atDate) {
  if (!birthdate) return 99;
  const b = new Date(`${birthdate}T00:00:00`);
  const a = new Date(`${atDate}T00:00:00`);
  let age = a.getFullYear() - b.getFullYear();
  const m = a.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && a.getDate() < b.getDate())) age--;
  return age;
}

// Saúde Ocupacional (NR-7/PCMSO): exames admissional, periódico, retorno,
// mudança de risco e demissional, com validade calculada por asoValidUntil.
export default function SaudeOcupacionalTab({ filterUnit, restrictedUnitIds = [] }) {
  const [employees, setEmployees] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employeeId: '', examType: 'periodico', examDate: '', riskGrade: 2, result: 'apto', doctorName: '', doctorCrm: '', restrictions: '' });
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: empData }, { data: examData }] = await Promise.all([
        supabase.from('employees').select(EMPLOYEE_LIST_FIELDS),
        supabase.from('employee_medical_exams').select('*').order('exam_date', { ascending: false }),
      ]);
      if (empData) setEmployees(empData.map(mapEmployeeFromDb).filter((e) => !restrictedUnitIds.includes(e.unitId)));
      if (examData) setExams(examData.map(mapMedicalExamFromDb));
    } catch (err) {
      console.error('Erro ao carregar saúde ocupacional:', err);
      toast.error('Erro ao carregar exames.');
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredEmployees = useMemo(() => employees.filter((e) => filterUnit === 'all' || e.unitId === filterUnit), [employees, filterUnit]);
  const employeeName = (id) => employees.find((e) => e.id === id)?.name || '—';
  const filteredExams = exams.filter((x) => filteredEmployees.some((e) => e.id === x.employeeId));

  const today = new Date().toISOString().slice(0, 10);
  const examStatus = (exam) => {
    if (!exam.validUntil) return { label: 'N/A', color: 'bg-slate-100 text-slate-600' };
    if (exam.validUntil < today) return { label: 'Vencido', color: 'bg-red-100 text-red-800' };
    const daysLeft = Math.round((new Date(exam.validUntil) - new Date(today)) / 86400000);
    if (daysLeft <= 30) return { label: `Vence em ${daysLeft}d`, color: 'bg-amber-100 text-amber-800' };
    return { label: 'Válido', color: 'bg-emerald-100 text-emerald-800' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employeeId || !form.examDate) { toast.error('Selecione o funcionário e a data do exame.'); return; }
    const employee = employees.find((emp) => emp.id === form.employeeId);
    const age = ageAt(employee?.birthdate, form.examDate);
    const validUntil = asoValidUntil(form.examType, form.examDate, Number(form.riskGrade), age);

    setSaving(true);
    try {
      const { error } = await supabase.from('employee_medical_exams').insert([mapMedicalExamToDb({
        employeeId: form.employeeId, examType: form.examType, examDate: form.examDate, validUntil,
        result: form.result, riskGrade: form.riskGrade, doctorName: form.doctorName, doctorCrm: form.doctorCrm,
        restrictions: form.restrictions,
      })]);
      if (error) throw error;
      toast.success('Exame registrado com sucesso.');
      setShowForm(false);
      setForm({ employeeId: '', examType: 'periodico', examDate: '', riskGrade: 2, result: 'apto', doctorName: '', doctorCrm: '', restrictions: '' });
      fetchAll();
    } catch (err) {
      console.error('Erro ao registrar exame:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setSaving(false);
    }
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
          <Stethoscope size={20} className="text-indigo-600" /> Saúde Ocupacional (ASO / PCMSO)
        </h2>
        <button onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5">
          <Plus size={14} /> Registrar Exame
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="p-3 font-semibold">Funcionário</th>
              <th className="p-3 font-semibold">Tipo</th>
              <th className="p-3 font-semibold">Data</th>
              <th className="p-3 font-semibold">Validade</th>
              <th className="p-3 font-semibold">Resultado</th>
              <th className="p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredExams.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum exame registrado.</td></tr>
            ) : (
              filteredExams.map((x) => {
                const status = examStatus(x);
                return (
                  <tr key={x.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-semibold text-gray-800">{employeeName(x.employeeId)}</td>
                    <td className="p-3 text-gray-600">{EXAM_TYPES.find((t) => t.key === x.examType)?.label || x.examType}</td>
                    <td className="p-3 text-gray-600">{x.examDate}</td>
                    <td className="p-3 text-gray-600">{x.validUntil || 'N/A'}</td>
                    <td className="p-3 text-gray-600">
                      {x.result === 'apto' ? <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 size={12} /> Apto</span>
                        : x.result === 'inapto' ? <span className="flex items-center gap-1 text-red-700"><AlertCircle size={12} /> Inapto</span>
                        : 'Apto com restrições'}
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${status.color}`}>{status.label}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md relative">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            <h3 className="text-sm font-bold text-gray-800 mb-4">Registrar Exame Ocupacional</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Funcionário</label>
                <select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs">
                  <option value="">Selecione...</option>
                  {filteredEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Tipo de exame</label>
                  <select value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs">
                    {EXAM_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Data</label>
                  <input type="date" required value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Grau de risco (NR-4)</label>
                  <select value={form.riskGrade} onChange={(e) => setForm({ ...form, riskGrade: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs">
                    <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Resultado</label>
                  <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg bg-white text-xs">
                    <option value="apto">Apto</option>
                    <option value="apto_com_restricoes">Apto com restrições</option>
                    <option value="inapto">Inapto</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Nome do médico" value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} className="p-2 border border-gray-300 rounded-lg text-xs" />
                <input placeholder="CRM" value={form.doctorCrm} onChange={(e) => setForm({ ...form, doctorCrm: e.target.value })} className="p-2 border border-gray-300 rounded-lg text-xs" />
              </div>
              {form.result !== 'apto' && (
                <textarea placeholder="Restrições" rows={2} value={form.restrictions} onChange={(e) => setForm({ ...form, restrictions: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-xs" />
              )}
              <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg text-xs disabled:opacity-50">
                {saving ? 'Salvando...' : 'Registrar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
