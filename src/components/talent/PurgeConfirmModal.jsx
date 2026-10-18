import React from 'react';
import { Trash2, Loader2 } from 'lucide-react';

// Confirmação de exclusão DEFINITIVA (candidatos vencidos ou selecionados).
// items: [{ id, name, email, reasonLabel, protectedWarning? }]
export default function PurgeConfirmModal({ title, intro, items, busy, progress, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-rose-100 rounded-xl shrink-0">
            <Trash2 className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{intro}</p>
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
          {items.map((it) => (
            <div key={it.id} className="px-3 py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 truncate">{it.name || '—'}</div>
                <div className="text-slate-400 truncate">{it.email || 'sem e-mail'}</div>
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700 font-semibold">
                {it.reasonLabel}
              </span>
            </div>
          ))}
        </div>

        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
          <p className="font-semibold">⚠️ Irreversível</p>
          <p>
            Remove o registro e o currículo do banco de origem (Faça Amigos), além de DISC, notas e
            alocações deste sistema. Quem estiver em processo ativo, na Simulação ou virou Freelancer é
            preservado.
          </p>
        </div>

        {busy && progress && (
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Excluindo… {progress.done}/{progress.total}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || items.length === 0}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Excluir {items.length} definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}
