import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Bell, AlertCircle, AlertTriangle, Info, Cake } from 'lucide-react';
import { supabase } from '../../supabase';
import {
  mapEmployeeFromDb, EMPLOYEE_LIST_FIELDS,
  mapVacationPeriodFromDb, mapMedicalExamFromDb, mapOccurrenceFromDb, mapTerminationFromDb,
} from '../../utils/mappings';
import { buildVacationPeriods, computeEmployeeAlerts } from '../../utils/cltCalculations';
import { ADMISSIONAL_DOCUMENTS } from '../../config/cltConstants';
import { toast } from 'sonner';

const LEVEL_META = {
  critico: { icon: AlertCircle, color: 'bg-red-50 border-red-200 text-red-800', iconColor: 'text-red-600' },
  atencao: { icon: AlertTriangle, color: 'bg-amber-50 border-amber-200 text-amber-800', iconColor: 'text-amber-600' },
  info: { icon: Info, color: 'bg-sky-50 border-sky-200 text-sky-800', iconColor: 'text-sky-600' },
};

// Central de alertas do módulo CLT: experiência vencendo, férias, ASO,
// aviso prévio, atestados > 15 dias, banco de horas > 6 meses, documentos
// admissionais pendentes e aniversariantes — via cltCalculations.computeEmployeeAlerts.
export default function AlertasFuncionariosTab({ filterUnit, restrictedUnitIds = [] }) {
  const [employees, setEmployees] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [exams, setExams] = useState([]);
  const [terminations, setTerminations] = useState([]);
  const [docsByEmployee, setDocsByEmployee] = useState({});
  const [dependentsByEmployee, setDependentsByEmployee] = useState({});
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState('all');

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: empData }, { data: occData }, { data: examData }, { data: termData }, { data: docData }, { data: depData }] = await Promise.all([
        supabase.from('employees').select(EMPLOYEE_LIST_FIELDS),
        supabase.from('employee_occurrences').select('*'),
        supabase.from('employee_medical_exams').select('*'),
        supabase.from('employee_terminations').select('*'),
        supabase.from('employee_documents').select('employee_id, doc_key'),
        supabase.from('employee_dependents').select('employee_id, birthdate'),
      ]);
      const emps = (empData || []).map(mapEmployeeFromDb).filter((e) => !restrictedUnitIds.includes(e.unitId));
      setEmployees(emps);
      setOccurrences((occData || []).map(mapOccurrenceFromDb));
      setExams((examData || []).map(mapMedicalExamFromDb));
      setTerminations((termData || []).map(mapTerminationFromDb));

      const depsByEmp = {};
      (depData || []).forEach((d) => { (depsByEmp[d.employee_id] = depsByEmp[d.employee_id] || []).push(d); });
      setDependentsByEmployee(depsByEmp);

      const docsByEmp = {};
      (docData || []).forEach((d) => { (docsByEmp[d.employee_id] = docsByEmp[d.employee_id] || new Set()).add(d.doc_key); });
      const missingCounts = {};
      emps.forEach((emp) => {
        const required = ADMISSIONAL_DOCUMENTS.filter((d) => d.required(emp, depsByEmp[emp.id] || []));
        const uploaded = docsByEmp[emp.id] || new Set();
        missingCounts[emp.id] = { missingCount: required.filter((d) => !uploaded.has(d.key)).length };
      });
      setDocsByEmployee(missingCounts);
    } catch (err) {
      console.error('Erro ao carregar alertas CLT:', err);
      toast.error('Erro ao carregar alertas.');
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredEmployees = useMemo(() => employees.filter((e) => filterUnit === 'all' || e.unitId === filterUnit), [employees, filterUnit]);

  const vacationPeriods = useMemo(() => {
    const all = [];
    for (const emp of filteredEmployees) {
      if (!emp.admissionDate) continue;
      all.push(...buildVacationPeriods(emp, occurrences.filter((o) => o.employeeId === emp.id)));
    }
    return all;
  }, [filteredEmployees, occurrences]);

  const alerts = useMemo(() => computeEmployeeAlerts({
    employees: filteredEmployees, vacationPeriods, exams, occurrences, terminations,
    documentsByEmployee: docsByEmployee,
  }), [filteredEmployees, vacationPeriods, exams, occurrences, terminations, docsByEmployee]);

  const filteredAlerts = levelFilter === 'all' ? alerts : alerts.filter((a) => a.level === levelFilter);
  const counts = { critico: alerts.filter((a) => a.level === 'critico').length, atencao: alerts.filter((a) => a.level === 'atencao').length, info: alerts.filter((a) => a.level === 'info').length };

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
          <Bell size={20} className="text-indigo-600" /> Alertas & Pendências
        </h2>
        <div className="flex gap-1.5">
          {[['all', `Todos (${alerts.length})`], ['critico', `Críticos (${counts.critico})`], ['atencao', `Atenção (${counts.atencao})`], ['info', `Informativos (${counts.info})`]].map(([key, label]) => (
            <button key={key} onClick={() => setLevelFilter(key)} className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border ${levelFilter === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-2">
        {filteredAlerts.length === 0 ? (
          <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 text-center text-slate-400 text-sm">
            Nenhum alerta nesta categoria.
          </div>
        ) : (
          filteredAlerts.map((a, i) => {
            const meta = LEVEL_META[a.level] || LEVEL_META.info;
            const Icon = a.kind === 'aniversariante' ? Cake : meta.icon;
            return (
              <div key={`${a.kind}-${a.employeeId}-${i}`} className={`border rounded-lg p-3 flex items-start gap-2.5 text-xs ${meta.color}`}>
                <Icon size={16} className={`shrink-0 mt-0.5 ${meta.iconColor}`} />
                <div className="flex-1">
                  <p className="font-semibold">{a.message}</p>
                  {a.dueDate && <p className="text-[10px] opacity-70 mt-0.5">Data de referência: {a.dueDate}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
