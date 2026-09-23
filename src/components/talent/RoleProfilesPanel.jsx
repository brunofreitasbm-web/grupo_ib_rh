import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { DISC_FACTORS, DISC_PROFILE_INFO } from '../../utils/disc';
import { ROLE_PROFILES } from '../../config/roleProfiles';
import { TraitFactors } from './RoleFitModal';

// Referência para o gestor: o perfil DISC esperado de cada função e como cada
// característica se liga aos fatores D/I/S/C.
export default function RoleProfilesPanel() {
  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        Perfis esperados usados na Simulação por Unidade. Cada característica aponta o fator DISC que a sustenta:
        {' '}
        {DISC_FACTORS.map((f, i) => (
          <span key={f}>
            <span className={`px-1 rounded text-[10px] font-bold border ${DISC_PROFILE_INFO[f].badge}`}>{f}</span>
            {' '}{DISC_PROFILE_INFO[f].label} ({DISC_PROFILE_INFO[f].short}){i < DISC_FACTORS.length - 1 ? ' · ' : '.'}
          </span>
        ))}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {ROLE_PROFILES.map((role) => (
          <div key={role.id} className="border border-slate-200 rounded-2xl bg-white p-4 flex flex-col gap-3">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-800">{role.label}</h3>
                <span className="px-2 py-0.5 text-xs font-bold rounded-md border bg-slate-100 text-slate-700 border-slate-200">
                  {role.expectedCode}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{role.summary}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Distribuição-alvo</p>
              <div className="flex h-3 w-full rounded-full overflow-hidden border border-slate-200">
                {DISC_FACTORS.map((f) => (
                  <div
                    key={f}
                    style={{ width: `${role.ideal[f]}%`, backgroundColor: DISC_PROFILE_INFO[f].color }}
                    title={`${DISC_PROFILE_INFO[f].label}: ${role.ideal[f]}%`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                {DISC_FACTORS.map((f) => (
                  <span key={f}>{f} {role.ideal[f]}%</span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Características</p>
              <ul className="space-y-1.5">
                {role.traits.map((t) => (
                  <li key={t.label} className="text-xs text-slate-700 flex items-start gap-1.5">
                    <TraitFactors factors={t.factors} />
                    <span>
                      <span className="font-medium">{t.label}</span>
                      <span className="text-slate-500"> — {t.why}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto bg-amber-50/60 border border-amber-100 rounded-lg p-2.5">
              <p className="text-[11px] font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Pontos de atenção
              </p>
              <ul className="text-[11px] text-slate-600 list-disc pl-4 space-y-0.5">
                {role.attention.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
