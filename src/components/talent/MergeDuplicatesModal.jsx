import React, { useState, useMemo } from 'react';
import { GitMerge, Loader2 } from 'lucide-react';
import { suggestMaster } from '../../utils/talentDuplicates';
import { statusLabel } from '../../constants/talentBank';

// Revisão e mesclagem de candidaturas duplicadas (mesmo e-mail/telefone).
// O principal permanece; as demais viram aliases (overlay unido via RPC
// merge_talent_candidates) e o registro remoto delas é excluído.
export default function MergeDuplicatesModal({ clusters, busy, onCancel, onMerge }) {
  const [index, setIndex] = useState(0);
  const cluster = clusters[index];
  const [masterByCluster, setMasterByCluster] = useState({});

  const masterId = useMemo(() => {
    if (!cluster) return null;
    return masterByCluster[index] ?? String(suggestMaster(cluster).id);
  }, [cluster, index, masterByCluster]);

  if (!cluster) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-3">
          <p className="text-sm text-slate-700">Nenhum duplicado restante. 🎉</p>
          <button onClick={onCancel} className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-xl">Fechar</button>
        </div>
      </div>
    );
  }

  const aliases = cluster.filter((c) => String(c.id) !== masterId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-indigo-100 rounded-xl shrink-0">
            <GitMerge className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900">Mesclar duplicados</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Grupo {index + 1} de {clusters.length} · mesmo e-mail ou telefone. Escolha o cadastro principal.
            </p>
          </div>
          <div className="flex gap-1">
            <button disabled={index === 0} onClick={() => setIndex(index - 1)} className="px-2 py-1 text-xs border rounded-lg disabled:opacity-30">‹</button>
            <button disabled={index >= clusters.length - 1} onClick={() => setIndex(index + 1)} className="px-2 py-1 text-xs border rounded-lg disabled:opacity-30">›</button>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
          {cluster.map((c) => {
            const isMaster = String(c.id) === masterId;
            return (
              <label key={c.id} className={`flex items-start gap-3 p-3 cursor-pointer text-xs ${isMaster ? 'bg-indigo-50/60' : ''}`}>
                <input
                  type="radio"
                  name={`master-${index}`}
                  checked={isMaster}
                  onChange={() => setMasterByCluster((p) => ({ ...p, [index]: String(c.id) }))}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="font-semibold text-slate-800">{c.full_name || '—'} {isMaster && <span className="text-indigo-600">(principal)</span>}</div>
                  <div className="text-slate-500">{c.email || 'sem e-mail'} · {c.phone || 'sem telefone'}</div>
                  <div className="text-slate-400">{c.course || '—'} · {c.desired_area || '—'}</div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-white">{statusLabel(c.effectiveStatus)}</span>
                    {c.discAssessment && <span className="px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700">DISC {c.discAssessment.primary_profile}</span>}
                    {c.notes && <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-white">📝 notas</span>}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
          <p className="font-semibold">O que será feito</p>
          <p>Status mais avançado, notas somadas e DISC respondido ficam no principal. As outras {aliases.length} candidatura(s) são excluídas do Faça Amigos (currículo incluso).</p>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-50">Fechar</button>
          <button
            onClick={() => onMerge(masterId, aliases.map((a) => String(a.id)))}
            disabled={busy}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
            Mesclar neste grupo
          </button>
        </div>
      </div>
    </div>
  );
}
