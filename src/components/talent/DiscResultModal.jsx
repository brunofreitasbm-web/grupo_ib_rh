import React from 'react';
import { X, User2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DISC_FACTORS, DISC_PROFILE_INFO, discProfileCode } from '../../utils/disc';

// Resultado do Levantamento de Perfil DISC de um candidato, visível apenas ao
// gestor (o candidato nunca vê o próprio resultado — ver DiscAssessmentPage.jsx).
export default function DiscResultModal({ candidate, assessment, onClose }) {
  if (!candidate || !assessment) return null;

  const { scores, primary_profile: primary, secondary_profile: secondary, completed_at: completedAt } = assessment;
  const primaryInfo = DISC_PROFILE_INFO[primary];
  const secondaryInfo = secondary ? DISC_PROFILE_INFO[secondary] : null;

  const chartData = DISC_FACTORS.map((f) => ({
    factor: f,
    label: DISC_PROFILE_INFO[f].label,
    Adaptado: scores?.adaptado?.[f] ?? 0,
    Natural: scores?.natural?.[f] ?? 0,
  }));

  const completedLabel = completedAt
    ? new Date(completedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

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
              <p className="text-xs text-slate-500">Levantamento concluído em {completedLabel}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span
            className="px-3 py-1.5 text-sm font-bold rounded-lg border"
            style={{ color: primaryInfo.color, borderColor: primaryInfo.color, backgroundColor: `${primaryInfo.color}14` }}
          >
            {discProfileCode(primary, secondary)} — {primaryInfo.label}
            {secondaryInfo ? ` / ${secondaryInfo.label}` : ''}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
          <p className="text-sm text-slate-700 leading-relaxed">{primaryInfo.description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">Pontos fortes</p>
              <ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5">
                {primaryInfo.strengths.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">Pontos de atenção</p>
              <ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5">
                {primaryInfo.attention.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          </div>
        </div>

        <p className="text-xs font-semibold text-slate-500 mb-2">Natural (espontâneo) vs. Adaptado (percebido)</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="factor" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Natural" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Adaptado" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
