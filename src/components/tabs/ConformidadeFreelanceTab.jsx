import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ShieldCheck, AlertTriangle, ListChecks, Scale, Info } from 'lucide-react';
import { supabase } from '../../supabase';
import {
  mapFreelancerFromDb,
  FREELANCER_SELECT_FIELDS,
  mapFreelanceJobFromDb,
  FREELANCE_JOB_SELECT_FIELDS,
  getFriendlyDbErrorMessage,
} from '../../utils/mappings';
import {
  FREELANCE_FISCAL_CHECKLIST,
  FREELANCE_CONDUCT_RULES,
  FREELANCE_LEGAL_REFERENCES,
  FREELANCE_DISCLAIMER,
} from '../../config/freelanceConstants';
import { assessHabitualityRisk, formatBRL } from '../../utils/freelanceCalculations';
import { toast } from 'sonner';

// Painel de Conformidade do módulo Freelance: visão consolidada do risco de
// habitualidade por freelancer, checklist fiscal/previdenciário de referência
// e as regras de conduta e bases legais que sustentam o enquadramento
// autônomo. Somente leitura — os dados vêm de freelancers/freelance_jobs
// (mesmas tabelas das outras abas do módulo).
export default function ConformidadeFreelanceTab({ filterUnit, restrictedUnitIds = [] }) {
  const [freelancers, setFreelancers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [{ data: fData, error: fErr }, { data: jData, error: jErr }] = await Promise.all([
        supabase.from('freelancers').select(FREELANCER_SELECT_FIELDS).order('name'),
        supabase.from('freelance_jobs').select(FREELANCE_JOB_SELECT_FIELDS),
      ]);
      if (fErr) throw fErr;
      if (jErr) throw jErr;
      setFreelancers((fData || []).map(mapFreelancerFromDb).filter((f) => !restrictedUnitIds.includes(f.unitId)));
      setJobs((jData || []).map(mapFreelanceJobFromDb).filter((j) => !restrictedUnitIds.includes(j.unitId)));
    } catch (err) {
      console.error('Erro ao carregar conformidade Freelance:', err?.message || err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredFreelancers = freelancers.filter((f) => filterUnit === 'all' || f.unitId === filterUnit);

  const riskRows = useMemo(() => {
    return filteredFreelancers
      .map((f) => {
        const fJobs = jobs.filter((j) => j.freelancerId === f.id);
        const risk = assessHabitualityRisk(fJobs);
        return { freelancer: f, risk, jobCount: fJobs.length };
      })
      .sort((a, b) => {
        const order = { critico: 0, atencao: 1, ok: 2 };
        return order[a.risk.level] - order[b.risk.level];
      });
  }, [filteredFreelancers, jobs]);

  const criticalCount = riskRows.filter((r) => r.risk.level === 'critico').length;
  const atencaoCount = riskRows.filter((r) => r.risk.level === 'atencao').length;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-xs text-violet-900 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5" />
        <p>{FREELANCE_DISCLAIMER}</p>
      </div>

      {/* Painel de risco de habitualidade */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <AlertTriangle size={20} className="text-violet-600" /> Risco de Habitualidade
          </h2>
          <div className="flex gap-2 text-[11px]">
            {criticalCount > 0 && <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700 font-semibold">{criticalCount} em risco de vínculo</span>}
            {atencaoCount > 0 && <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">{atencaoCount} em atenção</span>}
            {criticalCount === 0 && atencaoCount === 0 && <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Nenhum alerta</span>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
                <th className="p-3 font-semibold">Freelancer</th>
                <th className="p-3 font-semibold">Trabalhos (12m)</th>
                <th className="p-3 font-semibold">Valor pago (12m)</th>
                <th className="p-3 font-semibold">Meses seguidos</th>
                <th className="p-3 font-semibold">Nível</th>
                <th className="p-3 font-semibold">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {riskRows.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">Nenhum freelancer cadastrado.</td></tr>
              )}
              {riskRows.map(({ freelancer, risk }) => (
                <tr key={freelancer.id} className="border-b border-gray-50 hover:bg-gray-50/60 align-top">
                  <td className="p-3 font-medium text-gray-800">{freelancer.name}</td>
                  <td className="p-3 text-gray-600">{risk.jobsLast12}</td>
                  <td className="p-3 text-gray-600">{formatBRL(risk.amountLast12)}</td>
                  <td className="p-3 text-gray-600">{risk.consecutiveMonths}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${risk.badge}`}>{risk.levelLabel}</span>
                  </td>
                  <td className="p-3 text-gray-500 text-[11px] max-w-xs">{[...risk.reasons, ...risk.warnings].join(' ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Checklist fiscal/previdenciário */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <ListChecks size={20} className="text-violet-600" /> Checklist Fiscal e Previdenciário
          </h2>
          <p className="text-[11px] text-gray-500 mt-1">Rotina de referência por pagamento — acompanhar com a contabilidade.</p>
        </div>
        <ul className="divide-y divide-gray-100">
          {FREELANCE_FISCAL_CHECKLIST.map((item) => (
            <li key={item.key} className="p-3 flex items-start gap-3">
              <ShieldCheck size={15} className="text-violet-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-800">{item.label}</div>
                <div className="text-xs text-gray-500">{item.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Regras de conduta */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <AlertTriangle size={20} className="text-violet-600" /> Regras de Conduta (Blindagem)
          </h2>
          <p className="text-[11px] text-gray-500 mt-1">O contrato pode ser impecável e o vínculo ainda ser reconhecido pela prática — siga estas regras no dia a dia.</p>
        </div>
        <ul className="divide-y divide-gray-100">
          {FREELANCE_CONDUCT_RULES.map((rule, i) => (
            <li key={i} className="p-3 text-sm text-gray-700 flex gap-3">
              <span className="text-violet-400 font-bold">{i + 1}.</span> {rule}
            </li>
          ))}
        </ul>
      </div>

      {/* Referências legais */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Scale size={20} className="text-violet-600" /> Base Legal
          </h2>
        </div>
        <ul className="divide-y divide-gray-100">
          {FREELANCE_LEGAL_REFERENCES.map((r) => (
            <li key={r.ref} className="p-3 text-xs">
              <span className="font-semibold text-gray-800">{r.ref}</span>
              <span className="text-gray-500"> — {r.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
