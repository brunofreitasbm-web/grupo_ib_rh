import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Wallet, Hourglass, AlertCircle, AlertTriangle, Info, Cake } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { supabase } from '../../supabase';
import {
  mapEmployeeFromDb, EMPLOYEE_LIST_FIELDS,
  mapOccurrenceFromDb, mapMedicalExamFromDb, mapTerminationFromDb,
} from '../../utils/mappings';
import { buildVacationPeriods, computeEmployeeAlerts } from '../../utils/cltCalculations';
import { ADMISSIONAL_DOCUMENTS } from '../../config/cltConstants';
import { BRANDING } from '../../config/branding';

const LEVEL_META = {
  critico: { icon: AlertCircle, color: 'bg-red-50/60 border-red-100/60 text-red-950', iconColor: 'text-red-600' },
  atencao: { icon: AlertTriangle, color: 'bg-amber-50/60 border-amber-100/60 text-amber-950', iconColor: 'text-amber-600' },
  info: { icon: Info, color: 'bg-sky-50/60 border-sky-100/60 text-sky-950', iconColor: 'text-sky-600' },
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

export default function DashboardFuncionariosTab({ filterUnit, restrictedUnitIds = [], isActive = true }) {
  const [employees, setEmployees] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [exams, setExams] = useState([]);
  const [terminations, setTerminations] = useState([]);
  const [docsByEmployee, setDocsByEmployee] = useState({});
  const [loading, setLoading] = useState(true);

  const labels = BRANDING.employeeLabels || { plural: 'Funcionários CLT' };

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
      console.error('Erro ao carregar dashboard CLT:', err);
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('dashboard-clt-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_vacation_periods' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_medical_exams' }, () => fetchAll())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchAll]);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status !== 'desligado' && (filterUnit === 'all' || e.unitId === filterUnit)),
    [employees, filterUnit]
  );

  const totalPayroll = useMemo(
    () => activeEmployees.reduce((acc, e) => acc + (Number(e.baseSalary) || 0), 0),
    [activeEmployees]
  );

  const inExperience = useMemo(
    () => activeEmployees.filter((e) => e.contractType === 'experiencia'),
    [activeEmployees]
  );

  const vacationPeriods = useMemo(() => {
    const all = [];
    for (const emp of activeEmployees) {
      if (!emp.admissionDate) continue;
      all.push(...buildVacationPeriods(emp, occurrences.filter((o) => o.employeeId === emp.id)));
    }
    return all;
  }, [activeEmployees, occurrences]);

  const alerts = useMemo(() => computeEmployeeAlerts({
    employees: activeEmployees, vacationPeriods, exams, occurrences, terminations,
    documentsByEmployee: docsByEmployee,
  }), [activeEmployees, vacationPeriods, exams, occurrences, terminations, docsByEmployee]);

  const criticalCount = alerts.filter((a) => a.level === 'critico').length;
  const atencaoCount = alerts.filter((a) => a.level === 'atencao').length;

  const departmentStats = useMemo(() => {
    const stats = {};
    activeEmployees.forEach((e) => {
      const dep = e.department || 'Não informado';
      stats[dep] = (stats[dep] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  }, [activeEmployees]);

  const statusStats = useMemo(() => {
    const labelsMap = { ativo: 'Ativo', afastado: 'Afastado', ferias: 'Férias', aviso_previo: 'Aviso Prévio' };
    const stats = {};
    employees
      .filter((e) => e.status !== 'desligado' && (filterUnit === 'all' || e.unitId === filterUnit))
      .forEach((e) => {
        const s = labelsMap[e.status] || e.status || 'Ativo';
        stats[s] = (stats[s] || 0) + 1;
      });
    return Object.entries(stats).map(([name, count]) => ({ name, count }));
  }, [employees, filterUnit]);

  const birthdaysThisMonth = useMemo(() => {
    const currentMonth = new Date().getMonth();
    return activeEmployees
      .filter((e) => {
        if (!e.birthdate) return false;
        const parts = e.birthdate.split('-');
        if (parts.length !== 3) return false;
        return parseInt(parts[1], 10) - 1 === currentMonth;
      })
      .map((e) => {
        const parts = e.birthdate.split('-');
        return { id: e.id, name: e.name, day: parseInt(parts[2], 10), role: e.jobTitle || 'Colaborador(a)' };
      })
      .sort((a, b) => a.day - b.day);
  }, [activeEmployees]);

  const topAlerts = useMemo(() => {
    const order = { critico: 0, atencao: 1, info: 2 };
    return [...alerts].sort((a, b) => order[a.level] - order[b.level]).slice(0, 8);
  }, [alerts]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/10 hover:scale-[1.02] transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-indigo-100 font-semibold uppercase tracking-wider">{labels.plural || 'Funcionários'} Ativos</p>
              <h3 className="text-3xl font-extrabold mt-2">{activeEmployees.length}</h3>
            </div>
            <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm">
              <Users size={22} className="text-white" />
            </div>
          </div>
          <p className="text-[10px] text-indigo-200 mt-4 font-medium">Vínculos CLT ativos na {BRANDING.displayName}</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/10 hover:scale-[1.02] transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-emerald-100 font-semibold uppercase tracking-wider">Folha de Pagamento</p>
              <h3 className="text-3xl font-extrabold mt-2">
                {totalPayroll.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
            </div>
            <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm">
              <Wallet size={22} className="text-white" />
            </div>
          </div>
          <p className="text-[10px] text-emerald-200 mt-4 font-medium">Soma dos salários-base ativos</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/10 hover:scale-[1.02] transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-amber-100 font-semibold uppercase tracking-wider">Em Período de Experiência</p>
              <h3 className="text-3xl font-extrabold mt-2">{inExperience.length}</h3>
            </div>
            <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm">
              <Hourglass size={22} className="text-white" />
            </div>
          </div>
          <p className="text-[10px] text-amber-200 mt-4 font-medium">Contratos de experiência em curso</p>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-5 text-white shadow-lg shadow-rose-500/10 hover:scale-[1.02] transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-rose-100 font-semibold uppercase tracking-wider">Alertas Críticos</p>
              <h3 className="text-3xl font-extrabold mt-2">{criticalCount}</h3>
            </div>
            <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm">
              <AlertCircle size={22} className="text-white" />
            </div>
          </div>
          <p className="text-[10px] text-rose-200 mt-4 font-medium">{atencaoCount} alerta(s) de atenção adicionais</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Distributions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 transition-all duration-200 hover:shadow-md">
            <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider flex items-center gap-2">
              🏢 Distribuição por Departamento
            </h3>
            <div className="h-64">
              {departmentStats.length === 0 ? (
                <p className="text-center text-xs text-gray-400 italic py-4">Nenhum dado disponível.</p>
              ) : !isActive ? null : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={departmentStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {departmentStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 transition-all duration-200 hover:shadow-md">
            <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider flex items-center gap-2">
              📌 Distribuição por Situação
            </h3>
            <div className="h-64">
              {!isActive ? null : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <RechartsTooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Alertas & Pendências resumo */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-3 hover:shadow-md transition-all duration-200">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2 border-b pb-3">
              🔔 Alertas & Pendências ({alerts.length})
            </h3>
            {topAlerts.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                Nenhum alerta pendente no momento.
              </div>
            ) : (
              <div className="space-y-2">
                {topAlerts.map((a, i) => {
                  const meta = LEVEL_META[a.level] || LEVEL_META.info;
                  const Icon = a.kind === 'aniversariante' ? Cake : meta.icon;
                  return (
                    <div key={`${a.kind}-${a.employeeId}-${i}`} className={`border rounded-lg p-3 flex items-start gap-2.5 text-xs ${meta.color}`}>
                      <Icon size={15} className={`shrink-0 mt-0.5 ${meta.iconColor}`} />
                      <p className="font-semibold leading-snug">{a.message}</p>
                    </div>
                  );
                })}
                {alerts.length > topAlerts.length && (
                  <p className="text-[10px] text-slate-400 text-center pt-1">
                    +{alerts.length - topAlerts.length} outro(s) alerta(s) — veja em "Alertas & Pendências".
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-pink-500/5 to-rose-500/5 border border-pink-100 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-pink-800 uppercase tracking-wider flex items-center gap-2 border-b border-pink-100 pb-3">
              <Cake size={18} className="text-pink-500 animate-bounce" /> Aniversariantes do Mês 🎉
            </h3>
            {birthdaysThisMonth.length === 0 ? (
              <p className="text-[11px] text-pink-600/70 italic text-center py-4 bg-white/50 rounded-xl border border-dashed border-pink-200/50">
                Sem aniversariantes no mês atual.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {birthdaysThisMonth.map((b) => {
                  const isToday = new Date().getDate() === b.day;
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                        isToday
                          ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md border-transparent hover:scale-[1.01]'
                          : 'bg-white border-pink-100 hover:border-pink-200 hover:shadow-sm'
                      }`}
                    >
                      <div className="max-w-[70%]">
                        <h4 className={`text-xs font-bold truncate ${isToday ? 'text-white' : 'text-gray-800'}`}>{b.name}</h4>
                        <p className={`text-[9px] truncate mt-0.5 ${isToday ? 'text-pink-100' : 'text-gray-400'}`}>{b.role}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${isToday ? 'bg-white text-pink-600 animate-pulse' : 'bg-pink-50 text-pink-700'}`}>
                          Dia {b.day}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4 hover:shadow-md transition-all duration-200">
            <h3 className="text-sm font-bold text-gray-800 mb-2 uppercase tracking-wider flex items-center gap-2 border-b pb-3">
              💡 Insights de Gerenciamento
            </h3>
            <div className="space-y-3.5">
              {criticalCount > 0 ? (
                <div className="p-3 bg-rose-50/50 border border-rose-100/60 rounded-xl flex gap-3">
                  <span className="text-xl">🚨</span>
                  <div>
                    <h4 className="text-xs font-bold text-rose-950">Atenção Imediata</h4>
                    <p className="text-[10px] text-rose-800/90 leading-normal mt-0.5">
                      Existem <strong>{criticalCount} alerta(s) crítico(s)</strong> (experiência vencendo, ASO ou férias vencidas). Revise a aba "Alertas & Pendências".
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50/50 border border-emerald-100/60 rounded-xl flex gap-3">
                  <span className="text-xl">✅</span>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">Sem Alertas Críticos</h4>
                    <p className="text-[10px] text-emerald-800/90 leading-normal mt-0.5">Nenhum item crítico pendente no momento.</p>
                  </div>
                </div>
              )}

              {inExperience.length > 0 ? (
                <div className="p-3 bg-amber-50/60 border border-amber-100/60 rounded-xl flex gap-3">
                  <span className="text-xl">⏳</span>
                  <div>
                    <h4 className="text-xs font-bold text-amber-950">Períodos de Experiência</h4>
                    <p className="text-[10px] text-amber-800 leading-normal mt-0.5">
                      {inExperience.length} colaborador(es) em contrato de experiência — acompanhe os prazos de 45/90 dias.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-sky-50/50 border border-sky-100/60 rounded-xl flex gap-3">
                  <span className="text-xl">📋</span>
                  <div>
                    <h4 className="text-xs font-bold text-sky-950">Contratos</h4>
                    <p className="text-[10px] text-sky-800/90 leading-normal mt-0.5">Nenhum contrato em período de experiência no momento.</p>
                  </div>
                </div>
              )}

              <div className="p-3 bg-indigo-50/50 border border-indigo-100/60 rounded-xl flex gap-3">
                <span className="text-xl">🔔</span>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">Total de Pendências</h4>
                  <p className="text-[10px] text-indigo-800/90 leading-normal mt-0.5">
                    {alerts.length} alerta(s) ativo(s) no total, entre críticos, de atenção e informativos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
