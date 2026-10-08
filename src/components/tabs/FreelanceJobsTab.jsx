import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Briefcase, Plus, X, Save, Loader2, Printer, ArrowRightLeft, AlertTriangle, FileText, Receipt, ScrollText } from 'lucide-react';
import { supabase } from '../../supabase';
import { createDebounced } from '../../utils/debounce';
import {
  mapFreelancerFromDb,
  FREELANCER_SELECT_FIELDS,
  mapFreelanceJobFromDb,
  mapFreelanceJobToDb,
  FREELANCE_JOB_SELECT_FIELDS,
  freelanceRpcErrorMessage,
  getFriendlyDbErrorMessage,
} from '../../utils/mappings';
import {
  FREELANCE_JOB_STATUS,
  FREELANCE_SERVICE_TYPES,
  FREELANCE_JOB_REQUIRED_FIELDS,
  freelanceJobStatusMeta,
  ISS_DEFAULT_RATE,
} from '../../config/freelanceConstants';
import { assessHabitualityRisk, missingFields, formatBRL, computeFreelancePayment } from '../../utils/freelanceCalculations';
import { getFreelanceContractHtml, getFreelanceOrderHtml, getFreelanceRpaHtml, getMissingFreelanceContractFields } from '../../utils/freelanceDocuments';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import { BRANDING } from '../../config/branding';
import { toast } from 'sonner';

const emptyForm = {
  freelancerId: '', unitId: '', title: '', serviceType: 'evento', scope: '', deliverable: '',
  grossAmount: '', issRate: ISS_DEFAULT_RATE, issWithheld: false, status: 'rascunho',
  scheduledDate: '', paymentDay: '', notes: '',
};

const STATUS_FLOW = ['rascunho', 'proposta', 'aceita', 'entregue', 'aceito', 'pago'];
const STATUS_TIMESTAMP_FIELD = {
  proposta: 'proposedAt', aceita: 'acceptedAt', entregue: 'deliveredAt', aceito: 'paymentAcceptedAt', pago: 'paidAt',
};

// Ordens de Serviço do módulo Freelance: cada trabalho pontual é isolado, com
// escopo, prazo e preço próprios (ver src/config/freelanceConstants.js). O
// avanço de status é sempre um passo do fluxo linear (ou cancelamento), nunca
// pulado, para deixar rastro de aceite de escopo → aceite de entrega → pagamento.
function openPrintable(html, title) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) { toast.error('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.'); return; }
  printWindow.document.write(`<html><head><title>${title}</title></head><body>${sanitizeHtml(html)}</body></html>`);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    setTimeout(() => printWindow.close(), 500);
  };
}

export default function FreelanceJobsTab({ filterUnit, restrictedUnitIds = [], units = [] }) {
  const [freelancers, setFreelancers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showManage, setShowManage] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const defaultUnitId = filterUnit !== 'all' ? filterUnit : (units?.[0]?.id || '');

  const fetchData = useCallback(async () => {
    try {
      const [{ data: fData, error: fErr }, { data: jData, error: jErr }] = await Promise.all([
        supabase.from('freelancers').select(FREELANCER_SELECT_FIELDS).order('name'),
        supabase.from('freelance_jobs').select(FREELANCE_JOB_SELECT_FIELDS).order('created_at', { ascending: false }),
      ]);
      if (fErr) throw fErr;
      if (jErr) throw jErr;
      setFreelancers((fData || []).map(mapFreelancerFromDb).filter((f) => !restrictedUnitIds.includes(f.unitId)));
      setJobs((jData || []).map(mapFreelanceJobFromDb).filter((j) => !restrictedUnitIds.includes(j.unitId)));
    } catch (err) {
      console.error('Erro ao buscar dados de Freelance:', err?.message || err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [restrictedUnitIds]);

  useEffect(() => {
    const onRealtimeChange = createDebounced(() => fetchData());
    fetchData();
    const channel = supabase
      .channel('freelance-jobs-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freelance_jobs' }, onRealtimeChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freelancers' }, onRealtimeChange)
      .subscribe();
    return () => {
      onRealtimeChange.cancel();
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const freelancerById = useMemo(() => Object.fromEntries(freelancers.map((f) => [f.id, f])), [freelancers]);
  const unitById = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units]);

  const filteredJobs = jobs.filter((j) => {
    if (filterUnit !== 'all' && j.unitId !== filterUnit) return false;
    if (statusFilter !== 'todos' && j.status !== statusFilter) return false;
    return true;
  });

  // Risco de habitualidade por freelancer, recalculado a cada mudança de jobs
  // (ver assessHabitualityRisk) — mostrado na linha da tabela e usado como
  // aviso (não bloqueio, por decisão de produto) ao criar nova OS.
  const riskByFreelancer = useMemo(() => {
    const byFreelancer = {};
    jobs.forEach((j) => { (byFreelancer[j.freelancerId] = byFreelancer[j.freelancerId] || []).push(j); });
    const risks = {};
    Object.entries(byFreelancer).forEach(([fid, list]) => { risks[fid] = assessHabitualityRisk(list); });
    return risks;
  }, [jobs]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, unitId: defaultUnitId, freelancerId: freelancers.find((f) => !defaultUnitId || f.unitId === defaultUnitId)?.id || '' });
    setShowManage(true);
  };

  const openEdit = (j) => {
    setEditingId(j.id);
    setForm({ ...emptyForm, ...j });
    setShowManage(true);
  };

  const handleFreelancerChange = (freelancerId) => {
    const f = freelancerById[freelancerId];
    setForm((prev) => ({ ...prev, freelancerId, unitId: f?.unitId || prev.unitId }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missing = missingFields(form, FREELANCE_JOB_REQUIRED_FIELDS.filter(([k]) => k !== 'title' || true));
    if (!form.freelancerId) { toast.error('Selecione o freelancer.'); return; }
    if (missing.length) { toast.error(`Preencha: ${missing.join(', ')}.`); return; }

    setSaving(true);
    try {
      const risk = assessHabitualityRisk(jobs.filter((j) => j.freelancerId === form.freelancerId));
      const dbData = mapFreelanceJobToDb({ ...form, riskLevel: risk.level });
      if (editingId) {
        const { error } = await supabase.from('freelance_jobs').update(dbData).eq('id', editingId);
        if (error) throw error;
        toast.success('Ordem de Serviço atualizada.');
      } else {
        const { error } = await supabase.from('freelance_jobs').insert([dbData]);
        if (error) throw error;
        toast.success('Ordem de Serviço criada.');
      }
      setShowManage(false);
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar Ordem de Serviço:', err);
      toast.error(freelanceRpcErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Avança um passo no fluxo linear (nunca pula etapa), gravando o timestamp
  // do passo alcançado — é esse rastro que evidencia aceite de escopo e de
  // entrega em caso de disputa.
  const advanceStatus = async (job) => {
    const idx = STATUS_FLOW.indexOf(job.status);
    if (idx === -1 || idx === STATUS_FLOW.length - 1) return;
    const nextStatus = STATUS_FLOW[idx + 1];
    const tsField = STATUS_TIMESTAMP_FIELD[nextStatus];
    try {
      const updates = { status: nextStatus };
      if (tsField) updates[tsField === 'proposedAt' ? 'proposed_at' : tsField === 'acceptedAt' ? 'accepted_at' : tsField === 'deliveredAt' ? 'delivered_at' : tsField === 'paymentAcceptedAt' ? 'payment_accepted_at' : 'paid_at'] = new Date().toISOString();
      const { error } = await supabase.from('freelance_jobs').update(updates).eq('id', job.id);
      if (error) throw error;
      toast.success(`Status atualizado para "${freelanceJobStatusMeta(nextStatus).label}".`);
      fetchData();
    } catch (err) {
      console.error('Erro ao avançar status da OS:', err);
      toast.error(freelanceRpcErrorMessage(err));
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { toast.error('Informe o motivo do cancelamento.'); return; }
    try {
      const { error } = await supabase.from('freelance_jobs').update({ status: 'cancelada', cancellation_reason: cancelReason }).eq('id', cancelTarget.id);
      if (error) throw error;
      toast.success('Ordem de Serviço cancelada.');
      setCancelTarget(null);
      setCancelReason('');
      fetchData();
    } catch (err) {
      console.error('Erro ao cancelar OS:', err);
      toast.error(freelanceRpcErrorMessage(err));
    }
  };

  const handlePrint = (kind, job) => {
    const f = freelancerById[job.freelancerId];
    const unit = unitById[job.unitId];
    if (!f) { toast.error('Freelancer não encontrado.'); return; }

    if (kind === 'contrato') {
      const missing = getMissingFreelanceContractFields(f, job);
      if (missing.length) { toast.error(`Complete antes de emitir: ${missing.join(', ')}.`); return; }
      openPrintable(getFreelanceContractHtml(f, job, unit, BRANDING), 'Contrato de Prestação de Serviço Autônomo');
    } else if (kind === 'os') {
      openPrintable(getFreelanceOrderHtml(f, job, unit, BRANDING), 'Ordem de Serviço');
    } else if (kind === 'rpa') {
      if (!['aceito', 'pago'].includes(job.status)) { toast.error('Só é possível emitir o RPA após o aceite da entrega.'); return; }
      openPrintable(getFreelanceRpaHtml(f, job, unit, BRANDING), 'Recibo de Pagamento a Autônomo (RPA)');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Briefcase size={20} className="text-violet-600" /> Trabalhos (Ordens de Serviço)
        </h2>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
            <option value="todos">Todos os status</option>
            {FREELANCE_JOB_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-sm">
            <Plus size={14} /> Nova OS
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <th className="p-3 font-semibold">Trabalho</th>
              <th className="p-3 font-semibold">Freelancer</th>
              <th className="p-3 font-semibold">Preço</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Risco</th>
              <th className="p-3 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Nenhuma Ordem de Serviço encontrada.</td></tr>
            )}
            {filteredJobs.map((j) => {
              const f = freelancerById[j.freelancerId];
              const statusMeta = freelanceJobStatusMeta(j.status);
              const risk = riskByFreelancer[j.freelancerId];
              return (
                <tr key={j.id} className="border-b border-gray-50 hover:bg-gray-50/60 align-top">
                  <td className="p-3">
                    <div className="font-medium text-gray-800">{j.title}</div>
                    <div className="text-gray-400 text-[11px]">{FREELANCE_SERVICE_TYPES.find((s) => s.key === j.serviceType)?.label || j.serviceType}</div>
                  </td>
                  <td className="p-3 text-gray-600">{f?.name || '—'}</td>
                  <td className="p-3 font-semibold text-gray-800">{formatBRL(j.grossAmount)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusMeta.badge}`}>{statusMeta.label}</span>
                  </td>
                  <td className="p-3">
                    {risk && risk.level !== 'ok' && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${risk.badge}`} title={[...risk.reasons, ...risk.warnings].join(' ')}>
                        <AlertTriangle size={11} /> {risk.levelLabel}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-1 whitespace-nowrap">
                    {STATUS_FLOW.indexOf(j.status) >= 0 && j.status !== 'pago' && (
                      <button onClick={() => advanceStatus(j)} className="text-violet-600 hover:text-violet-800 p-1.5" title={`Avançar para "${freelanceJobStatusMeta(STATUS_FLOW[STATUS_FLOW.indexOf(j.status) + 1]).label}"`}>
                        <ArrowRightLeft size={14} />
                      </button>
                    )}
                    <button onClick={() => handlePrint('os', j)} className="text-gray-500 hover:text-violet-600 p-1.5" title="Imprimir OS">
                      <FileText size={14} />
                    </button>
                    <button onClick={() => handlePrint('contrato', j)} className="text-gray-500 hover:text-violet-600 p-1.5" title="Imprimir Contrato">
                      <ScrollText size={14} />
                    </button>
                    <button onClick={() => handlePrint('rpa', j)} className="text-gray-500 hover:text-violet-600 p-1.5" title="Imprimir RPA">
                      <Receipt size={14} />
                    </button>
                    {j.status !== 'cancelada' && j.status !== 'pago' && (
                      <button onClick={() => setCancelTarget(j)} className="text-gray-500 hover:text-rose-600 p-1.5" title="Cancelar OS">
                        <X size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-800">{editingId ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}</h3>
              <button onClick={() => setShowManage(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Freelancer *</label>
                  <select value={form.freelancerId} onChange={(e) => handleFreelancerChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" required>
                    <option value="">Selecione…</option>
                    {freelancers.filter((f) => filterUnit === 'all' || f.unitId === filterUnit).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Natureza do serviço *</label>
                  <select value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2">
                    {FREELANCE_SERVICE_TYPES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Título do trabalho *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2" required />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Escopo detalhado *</label>
                  <textarea value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2" required />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Entregável / resultado esperado</label>
                  <input value={form.deliverable} onChange={(e) => setForm({ ...form, deliverable: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Preço fechado (R$) *</label>
                  <input type="number" step="0.01" min="0.01" value={form.grossAmount} onChange={(e) => setForm({ ...form, grossAmount: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Data prevista de execução *</label>
                  <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Alíquota ISS</label>
                  <input type="number" step="0.001" min="0" max="1" value={form.issRate} onChange={(e) => setForm({ ...form, issRate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={form.issWithheld} onChange={(e) => setForm({ ...form, issWithheld: e.target.checked })} />
                    ISS retido pela contratante
                  </label>
                </div>
              </div>

              {form.grossAmount && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-[11px] text-violet-900">
                  {(() => {
                    const p = computeFreelancePayment(form);
                    return (
                      <>
                        Líquido estimado ao freelancer: <strong>{formatBRL(p.net)}</strong> · INSS retido: {formatBRL(p.inssWithheld)} ·
                        IRRF: {formatBRL(p.irrf)} · Custo total da empresa (com INSS patronal 20%): <strong>{formatBRL(p.employerTotalCost)}</strong>
                      </>
                    );
                  })()}
                </div>
              )}

              {form.freelancerId && (() => {
                const risk = assessHabitualityRisk(jobs.filter((j) => j.freelancerId === form.freelancerId && j.id !== editingId));
                if (risk.level === 'ok') return null;
                return (
                  <div className={`rounded-lg p-3 text-[11px] border ${risk.level === 'critico' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    <strong>Alerta de habitualidade ({risk.levelLabel}):</strong>{' '}
                    {[...risk.reasons, ...risk.warnings].join(' ')}
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Observações internas</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowManage(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg flex items-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-800">Cancelar Ordem de Serviço</h3>
            <p className="text-xs text-gray-500">Informe o motivo do cancelamento de "{cancelTarget.title}".</p>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" autoFocus />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setCancelTarget(null); setCancelReason(''); }} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Voltar</button>
              <button onClick={handleCancel} className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg">Confirmar cancelamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
