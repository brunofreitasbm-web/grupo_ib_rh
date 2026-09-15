import React, { useState, useRef, useEffect } from 'react';
import { Briefcase, Check, Loader2 } from 'lucide-react';
import { ROLE_PROFILES } from '../../config/roleProfiles';

// Ação rápida para marcar a Função Interna (Operador/Recepção, Profissional
// PJ, Estagiário) direto na linha/card da pessoa, sem abrir o formulário de
// edição completo. Usado nas abas de Estagiários, Profissionais PJ e
// Funcionários CLT. onPick(roleId) grava na hora; roleId null remove a
// marcação. Mesmo padrão de dropdown bespoke de CandidateActionsMenu.
export default function RoleQuickPicker({ roleId, onPick, busy, size = 13 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const current = ROLE_PROFILES.find((r) => r.id === roleId);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        disabled={busy}
        title={current ? `Função Interna: ${current.label} (clique para alterar)` : 'Marcar Função Interna (Simulação por Unidade)'}
        className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          current
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
            : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'
        }`}
      >
        {busy ? <Loader2 size={size} className="animate-spin" /> : <Briefcase size={size} />}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 text-xs">
          <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            Função Interna (Simulação por Unidade)
          </div>
          {ROLE_PROFILES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onPick(r.id); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-1.5">
                {roleId === r.id && <Check size={12} className="text-indigo-600 shrink-0" />}
                {r.label}
              </span>
              <span className="text-[10px] text-slate-400 shrink-0">{r.expectedCode}</span>
            </button>
          ))}
          {roleId && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); onPick(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
              >
                Remover marcação
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
