import React, { useMemo } from 'react';
import { X, User2, CheckCircle2, AlertTriangle, Info, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DISC_FACTORS, DISC_PROFILE_INFO, discProfileCode } from '../../utils/disc';
import { computeRoleFit, FIT_LEVELS } from '../../utils/roleFit';
import { teamSynergyNote } from '../../utils/teamFit';

const SYNERGY_TONE_CLASSES = {
  empty: 'bg-slate-50 border-slate-200 text-slate-500',
  positive: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  caution: 'bg-amber-50 border-amber-200 text-amber-700',
  neutral: 'bg-sky-50 border-sky-200 text-sky-700',
};

// Detalhe do encaixe de um candidato com uma função (e unidade) na simulação:
// compatibilidade com o perfil esperado da função (roleFit.js) e, quando
// disponível, sinergia com a composição DISC da equipe já contratada que
// ocupa o mesmo quadrante (composition, de teamFit.js). Mesmo esqueleto de
// DiscResultModal.jsx.
export default function RoleFitModal({ candidate, assessment, role, unitLabel, composition, onClose }) {
  const fit = useMemo(() => computeRoleFit(assessment, role), [assessment, role]);
  const synergy = useMemo(() => teamSynergyNote(assessment, composition), [assessment, composition]);
  if (!candidate || !assessment || !role || !fit) return null;

  const level = FIT_LEVELS[fit.level];
  const primaryInfo = DISC_PROFILE_INFO[assessment.primary_profile];

  const chartData = DISC_FACTORS.map((f) => ({
    factor: f,
    label: DISC_PROFILE_INFO[f].label,
    Candidato: fit.vector[f],
    Esperado: role.ideal[f],
  }));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 my-8">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <User2 className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">{candidate.full_name}</h3>
              <p className="text-xs text-slate-500">
                {role.label}{unitLabel ? ` · ${unitLabel}` : ''}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div
            className="flex items-baseline gap-1 px-4 py-2 rounded-xl border"
            style={{ color: level.color, borderColor: level.color, backgroundColor: `${level.color}14` }}
          >
            <span className="text-3xl font-black leading-none">{fit.score}</span>
            <span className="text-xs font-semibold">/100</span>
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: level.color }}>{level.label}</p>
            <p className="text-xs text-slate-500">
              Candidato {discProfileCode(assessment.primary_profile, assessment.secondary_profile)}
              {primaryInfo ? ` (${primaryInfo.short})` : ''} · esperado {role.expectedCode}
            </p>
          </div>
        </div>

        {synergy && (
          <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 mb-4 ${SYNERGY_TONE_CLASSES[synergy.tone]}`}>
            <Users className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide">Sinergia com a equipe atual</p>
              <p className="text-xs mt-0.5">{synergy.note}</p>
              {composition?.count > 0 && (
                <p className="text-[10px] mt-1 opacity-80">
                  Composição atual: {['D', 'I', 'S', 'C'].filter((f) => composition.counts[f] > 0).map((f) => `${f} ${composition.counts[f]}`).join(' · ')}
                </p>
              )}
            </div>
          </div>
        )}

        {fit.notes.length > 0 && (
          <div className="space-y-1.5 mb-5">
            {fit.notes.map((n) => (
              <p key={n} className="text-xs text-slate-600 flex items-start gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                {n}
              </p>
            ))}
          </div>
        )}

        <p className="text-xs font-semibold text-slate-500 mb-2">Perfil do candidato vs. esperado para a função</p>
        <div className="h-52 mb-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="factor" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Esperado" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Candidato" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Características atendidas
            </p>
            {fit.matchedTraits.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhuma dentro da tolerância.</p>
            ) : (
              <ul className="text-xs text-slate-700 space-y-1">
                {fit.matchedTraits.map((t) => (
                  <li key={t.label} className="flex items-start gap-1.5">
                    <TraitFactors factors={t.factors} />
                    <span>{t.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Pontos de atenção
            </p>
            {fit.cautionTraits.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum ponto de atenção.</p>
            ) : (
              <ul className="text-xs text-slate-700 space-y-1">
                {fit.cautionTraits.map((t) => (
                  <li key={t.label} className="flex items-start gap-1.5">
                    <TraitFactors factors={t.factors} />
                    <span>{t.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export function TraitFactors({ factors }) {
  return (
    <span className="inline-flex gap-0.5 shrink-0 mt-px">
      {factors.map((f) => (
        <span
          key={f}
          className={`px-1 rounded text-[10px] font-bold border ${DISC_PROFILE_INFO[f].badge}`}
          title={DISC_PROFILE_INFO[f].label}
        >
          {f}
        </span>
      ))}
    </span>
  );
}
