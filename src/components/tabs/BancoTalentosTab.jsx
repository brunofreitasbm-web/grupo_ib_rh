import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Briefcase, Search, RefreshCw, FileText, AlertTriangle, Loader2, Phone, Mail, Sparkles, LayoutGrid, ListChecks, Users, CheckCircle } from 'lucide-react';
import { supabase } from '../../supabase';
import { toast } from 'sonner';
import { STATUS_OPTIONS, STATUS_BADGE, OPPORTUNITY_LABEL, statusLabel } from '../../constants/talentBank';
import { DISC_PROFILE_INFO } from '../../utils/disc';
import { computeRoleFit, bestRoleFor } from '../../utils/roleFit';
import { ROLE_BY_ID, SIMULATION_UNITS } from '../../config/roleProfiles';
import CandidateActionsMenu from '../talent/CandidateActionsMenu';
import CandidateNotesModal from '../talent/CandidateNotesModal';
import DiscResultModal from '../talent/DiscResultModal';
import UnitBasketBoard from '../talent/UnitBasketBoard';
import RoleFitModal from '../talent/RoleFitModal';
import RoleProfilesPanel from '../talent/RoleProfilesPanel';

const SUB_TABS = [
  { id: 'candidatos', label: 'Candidatos', icon: Users },
  { id: 'simulacao', label: 'Simulação por Unidade', icon: LayoutGrid },
  { id: 'perfis', label: 'Perfis das Funções', icon: ListChecks },
];

// Candidatos vêm somente-leitura do projeto Faça Amigos (ver fetch-talent-bank
// edge function). Status, notas e resultado DISC são uma camada local
// (overlay) neste projeto — talent_candidates_meta / talent_disc_tokens /
// talent_disc_assessments (migração 20260915_talent_bank_overlay_disc) — e o
// merge acontece aqui no cliente.

const formatDate = (candidate) => {
  const ms = candidate.created_at_ms;
  const iso = candidate.created_at_iso;
  const d = ms ? new Date(ms) : iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatShortDate = (isoString) => {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const formatDateTime = (isoString) => {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// SLA do levantamento de perfil DISC: a partir da primeira abertura do link
// pelo candidato (first_opened_at), 48h para concluir. Passado o prazo sem
// conclusão, sinaliza atraso para o gestor.
const DISC_SLA_MS = 48 * 60 * 60 * 1000;

export default function BancoTalentosTab() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('NOVO');
  const [discFilter, setDiscFilter] = useState('todos');
  const [activeSubTab, setActiveSubTab] = useState('candidatos');

  // Overlay local, indexado por candidate_id.
  const [metaById, setMetaById] = useState({});
  const [tokensById, setTokensById] = useState({});
  const [assessmentsById, setAssessmentsById] = useState({});
  // Simulação por unidade (talent_basket_assignments).
  const [basketById, setBasketById] = useState({});

  const [busyId, setBusyId] = useState(null);
  const [notesTarget, setNotesTarget] = useState(null);
  const [resultTarget, setResultTarget] = useState(null);
  const [fitTarget, setFitTarget] = useState(null); // { candidate, role, unit }
  const [resendConfirmTarget, setResendConfirmTarget] = useState(null);

  const loadOverlay = useCallback(async (ids) => {
    if (ids.length === 0) {
      setMetaById({});
      setTokensById({});
      setAssessmentsById({});
      setBasketById({});
      return;
    }
    try {
      const [metaRes, tokenRes, assessmentRes, basketRes] = await Promise.all([
        supabase.from('talent_candidates_meta').select('*').in('candidate_id', ids),
        supabase.from('talent_disc_tokens').select('candidate_id, sent_at, expires_at, consumed_at, first_opened_at').in('candidate_id', ids),
        supabase.from('talent_disc_assessments').select('*').in('candidate_id', ids),
        supabase.from('talent_basket_assignments').select('*').in('candidate_id', ids),
      ]);
      if (metaRes.error) throw metaRes.error;
      if (tokenRes.error) throw tokenRes.error;
      if (assessmentRes.error) throw assessmentRes.error;
      // A tabela da simulação pode ainda não existir (migração pendente):
      // não derruba o resto do overlay.
      if (basketRes.error) console.error('Erro ao carregar simulação por unidade:', basketRes.error);

      setMetaById(Object.fromEntries((metaRes.data || []).map((m) => [m.candidate_id, m])));
      setTokensById(Object.fromEntries((tokenRes.data || []).map((t) => [t.candidate_id, t])));
      setAssessmentsById(Object.fromEntries((assessmentRes.data || []).map((a) => [a.candidate_id, a])));
      setBasketById(Object.fromEntries((basketRes.data || []).map((b) => [b.candidate_id, b])));
    } catch (err) {
      // A camada local é um "plus" sobre a lista remota — se falhar, a tabela
      // continua funcional, só sem status próprio/notas/perfil.
      console.error('Erro ao carregar dados locais do Banco de Talentos:', err);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Busca sempre a lista completa (sem filtro remoto de status): o status
      // "efetivo" pode ter sido sobrescrito localmente, então o filtro por
      // status passa a ser feito no cliente junto com a busca textual.
      const params = new URLSearchParams({ limit: '200' });
      const { data, error: err } = await supabase.functions.invoke(
        `fetch-talent-bank?${params.toString()}`,
        { method: 'GET' }
      );
      if (err) throw err;

      const list = Array.isArray(data) ? data : (data?.candidates ?? data?.data ?? []);
      const safeList = Array.isArray(list) ? list : [];
      setCandidates(safeList);
      await loadOverlay(safeList.map((c) => c.id).filter(Boolean));
    } catch (err) {
      console.error('Erro ao carregar Banco de Talentos:', err);
      let msg = err?.message || '';
      let detailMsg = '';
      let statusCode = err?.context?.status || null;

      // Tenta extrair a mensagem detalhada enviada pelo corpo da resposta da Edge Function
      if (err?.context) {
        try {
          const res = err.context;
          const cloned = typeof res.clone === 'function' ? res.clone() : res;
          const body = await cloned.json();
          if (body?.message) detailMsg = body.message;
          else if (body?.error) detailMsg = typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
          else if (body?.details) detailMsg = typeof body.details === 'string' ? body.details : JSON.stringify(body.details);
        } catch (_) {
          try {
            const res = err.context;
            const clonedText = typeof res.clone === 'function' ? res.clone() : res;
            detailMsg = await clonedText.text();
          } catch (_) {}
        }
      }

      if (statusCode === 403 || detailMsg === 'unauthorized' || detailMsg.includes('supervisores') || detailMsg.includes('reservado')) {
        setError(detailMsg || 'Acesso negado (HTTP 403): O seu usuário precisa ser supervisor ou ter email autorizado para visualizar o Banco de Talentos.');
      } else if (statusCode === 500 || detailMsg.includes('TALENT_API') || detailMsg.includes('não configuradas')) {
        setError(detailMsg || 'Erro na Edge Function (HTTP 500): Secrets (TALENT_API_KEY e TALENT_API_ANON_KEY) não configuradas no Supabase.');
      } else if (msg.includes('Failed to send a request') || err?.name === 'FunctionsFetchError' || statusCode === 404) {
        setError('A Edge Function "fetch-talent-bank" não está acessível no projeto Supabase. Certifique-se de implantar a função via Supabase CLI (`supabase functions deploy fetch-talent-bank`).');
      } else if (msg.includes('non-2xx status code') || err?.name === 'FunctionsHttpError') {
        setError(detailMsg ? `Erro na Edge Function (${statusCode || 'non-2xx'}): ${detailMsg}` : `A Edge Function "fetch-talent-bank" retornou status HTTP ${statusCode || 'não-2xx'}. Verifique as permissões de usuário e se as variáveis TALENT_API_ANON_KEY e TALENT_API_KEY foram configuradas via Supabase CLI.`);
      } else {
        setError(detailMsg || msg || 'Não foi possível carregar os candidatos do Banco de Talentos.');
      }
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [loadOverlay]);

  useEffect(() => { load(); }, [load]);

  const enriched = useMemo(() => {
    return candidates.map((c) => {
      const meta = metaById[c.id];
      const token = tokensById[c.id];
      const assessment = assessmentsById[c.id];
      return {
        ...c,
        effectiveStatus: meta?.status || c.status,
        notes: meta?.notes || '',
        discToken: token || null,
        discAssessment: assessment || null,
        bestFit: assessment ? bestRoleFor(assessment) : null,
      };
    });
  }, [candidates, metaById, tokensById, assessmentsById]);

  // Só quem concluiu o Levantamento de Perfil entra na simulação.
  const withProfile = useMemo(() => enriched.filter((c) => c.discAssessment), [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((c) => {
      if (statusFilter !== 'todos' && c.effectiveStatus !== statusFilter) return false;

      // Filtro por Levantamento de Perfil
      const hasToken = Boolean(c.discToken);
      const hasAssessment = Boolean(c.discAssessment);
      if (discFilter === 'enviados' && (!hasToken || hasAssessment)) return false;
      if (discFilter === 'respondidos' && !hasAssessment) return false;
      if (discFilter === 'sem_envio' && (hasToken || hasAssessment)) return false;

      if (!q) return true;
      return [c.full_name, c.email, c.course, c.desired_area]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [enriched, search, statusFilter, discFilter]);

  const changeStatus = async (candidate, newStatus) => {
    setBusyId(candidate.id);
    try {
      const { error: err } = await supabase.from('talent_candidates_meta').upsert({
        candidate_id: candidate.id,
        status: newStatus,
        snapshot: { full_name: candidate.full_name, email: candidate.email, phone: candidate.phone },
        updated_at: new Date().toISOString(),
      });
      if (err) throw err;
      setMetaById((prev) => ({
        ...prev,
        [candidate.id]: { ...(prev[candidate.id] || { candidate_id: candidate.id }), status: newStatus },
      }));
      toast.success(`Status atualizado para "${statusLabel(newStatus)}".`);
    } catch (err) {
      console.error('Erro ao atualizar status do candidato:', err);
      toast.error('Não foi possível atualizar o status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleInitiateSendDisc = (candidate) => {
    if (!candidate.email) {
      toast.warning('Candidato sem e-mail cadastrado.');
      return;
    }
    // Se o candidato JÁ possui token enviado ou resposta concluída, solicita confirmação ao gestor!
    if (candidate.discToken || candidate.discAssessment) {
      setResendConfirmTarget(candidate);
    } else {
      sendDiscAssessment(candidate);
    }
  };

  const sendDiscAssessment = async (candidate) => {
    if (!candidate.email) {
      toast.warning('Candidato sem e-mail cadastrado.');
      return;
    }
    setBusyId(candidate.id);
    try {
      const { data, error: err } = await supabase.functions.invoke('send-disc-assessment', {
        body: {
          candidateId: candidate.id,
          fullName: candidate.full_name,
          email: candidate.email,
          phone: candidate.phone,
        },
      });
      if (err) throw err;
      toast.success(`Levantamento de Perfil enviado para ${data?.sentTo || candidate.email}.`);
      await loadOverlay(candidates.map((c) => c.id).filter(Boolean));
    } catch (err) {
      console.error('Erro ao enviar Levantamento de Perfil:', err);
      let detailMsg = '';
      try {
        const res = err?.context;
        const cloned = res && typeof res.clone === 'function' ? res.clone() : res;
        const body = cloned ? await cloned.json() : null;
        detailMsg = body?.message || '';
      } catch (_) {}
      toast.error(detailMsg || 'Não foi possível enviar o Levantamento de Perfil.');
    } finally {
      setBusyId(null);
    }
  };

  const markSentManual = async (candidate) => {
    if (!candidate || !candidate.id) {
      toast.warning('Candidato inválido.');
      return;
    }
    const candidateIdStr = String(candidate.id);
    setBusyId(candidate.id);
    try {
      const { error: metaErr } = await supabase.from('talent_candidates_meta').upsert(
        {
          candidate_id: candidateIdStr,
          snapshot: {
            full_name: candidate.full_name || '',
            email: candidate.email || '',
            phone: candidate.phone || '',
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'candidate_id', ignoreDuplicates: true }
      );
      if (metaErr) throw metaErr;

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const nowIso = new Date().toISOString();
      const tokenHash = `manual_${candidateIdStr.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;

      const tokenObj = {
        candidate_id: candidateIdStr,
        token_hash: tokenHash,
        expires_at: expiresAt,
        sent_at: nowIso,
        sent_to: candidate.email || 'Manual',
        attempts: 0,
        consumed_at: null,
      };

      const { error: tokenErr } = await supabase.from('talent_disc_tokens').upsert(tokenObj, { onConflict: 'candidate_id' });
      if (tokenErr) throw tokenErr;

      setTokensById((prev) => ({ ...prev, [candidate.id]: tokenObj }));
      toast.success(`Levantamento marcado como enviado para ${candidate.full_name || 'candidato'}.`);
    } catch (err) {
      const detail = err?.message || err?.details || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      console.error('Erro ao marcar como enviado manualmente:', detail, err);
      toast.error(err?.message ? `Não foi possível registrar o envio manual: ${err.message}` : 'Não foi possível registrar o envio manual.');
    } finally {
      setBusyId(null);
    }
  };

  const markAllUnsentAsSentManual = async () => {
    const unsentList = filtered.filter((c) => !c.discToken && !c.discAssessment);
    if (unsentList.length === 0) {
      toast.info('Não há candidatos sem envio na listagem atual.');
      return;
    }

    if (!window.confirm(`Deseja marcar ${unsentList.length} candidato(s) como "Levantamento Enviado (Manual)"?`)) {
      return;
    }

    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const metaRows = unsentList.map((c) => ({
        candidate_id: String(c.id),
        snapshot: {
          full_name: c.full_name || '',
          email: c.email || '',
          phone: c.phone || '',
        },
        updated_at: nowIso,
      }));
      const { error: metaErr } = await supabase.from('talent_candidates_meta').upsert(metaRows, { onConflict: 'candidate_id', ignoreDuplicates: true });
      if (metaErr) throw metaErr;

      const tokenRows = unsentList.map((c) => ({
        candidate_id: String(c.id),
        token_hash: `manual_${String(c.id).replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`,
        expires_at: expiresAt,
        sent_at: nowIso,
        sent_to: c.email || 'Manual',
        attempts: 0,
        consumed_at: null,
      }));
      const { error: tokenErr } = await supabase.from('talent_disc_tokens').upsert(tokenRows, { onConflict: 'candidate_id' });
      if (tokenErr) throw tokenErr;

      toast.success(`${unsentList.length} candidato(s) marcados como enviado(s)!`);
      await loadOverlay(candidates.map((c) => c.id).filter(Boolean));
    } catch (err) {
      const detail = err?.message || err?.details || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      console.error('Erro ao marcar envios em massa:', detail, err);
      toast.error(err?.message ? `Não foi possível concluir a marcação em massa: ${err.message}` : 'Não foi possível concluir a marcação em massa.');
    } finally {
      setLoading(false);
    }
  };

  const assignToBasket = async (candidate, unitId, roleId) => {
    const role = ROLE_BY_ID[roleId];
    const fit = computeRoleFit(candidate.discAssessment, role);
    const candidateIdStr = String(candidate.id);
    setBusyId(candidate.id);
    try {
      // Garante a linha-mãe do overlay (FK) sem sobrescrever status/notas.
      const { error: metaErr } = await supabase.from('talent_candidates_meta').upsert(
        {
          candidate_id: candidateIdStr,
          snapshot: { full_name: candidate.full_name || '', email: candidate.email || '', phone: candidate.phone || '' },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'candidate_id', ignoreDuplicates: true }
      );
      if (metaErr) throw metaErr;

      const row = {
        candidate_id: candidateIdStr,
        unit_id: unitId,
        role_id: roleId,
        fit_score: fit?.score ?? null,
        updated_at: new Date().toISOString(),
      };
      const { error: err } = await supabase.from('talent_basket_assignments').upsert(row, { onConflict: 'candidate_id' });
      if (err) throw err;
      setBasketById((prev) => ({ ...prev, [candidate.id]: row, [candidateIdStr]: row }));
      const unitLabel = SIMULATION_UNITS.find((u) => u.id === unitId)?.shortLabel || unitId;
      toast.success(`${candidate.full_name} → ${unitLabel} · ${role?.label || roleId} (compatibilidade ${fit?.score ?? '—'}).`);
    } catch (err) {
      const detail = err?.message || err?.details || err?.hint || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      console.error('Erro ao alocar candidato na simulação:', detail, err);
      toast.error(`Não foi possível salvar a alocação: ${detail}`);
    } finally {
      setBusyId(null);
    }
  };

  const removeFromBasket = async (candidate) => {
    const candidateIdStr = String(candidate.id);
    setBusyId(candidate.id);
    try {
      const { error: err } = await supabase.from('talent_basket_assignments').delete().eq('candidate_id', candidateIdStr);
      if (err) throw err;
      setBasketById((prev) => {
        const next = { ...prev };
        delete next[candidate.id];
        delete next[candidateIdStr];
        return next;
      });
      toast.success(`${candidate.full_name} removido(a) da simulação.`);
    } catch (err) {
      const detail = err?.message || err?.details || err?.hint || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      console.error('Erro ao remover candidato da simulação:', detail, err);
      toast.error(`Não foi possível remover a alocação: ${detail}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            Banco de Talentos
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Candidatos captados pelo Banco de Talentos do sistema.
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{error}</p>
        </div>
      )}

      {/* Subpáginas */}
      <div className="flex flex-wrap gap-1.5">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const active = activeSubTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveSubTab(t.id)}
              className={`px-3 py-2 text-sm font-medium rounded-xl border flex items-center gap-2 transition-colors ${
                active
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
              {t.label}
              {t.id === 'simulacao' && withProfile.length > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {withProfile.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeSubTab === 'perfis' && <RoleProfilesPanel />}

      {activeSubTab === 'simulacao' && (
        loading ? (
          <div className="p-10 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Carregando candidatos...</p>
          </div>
        ) : (
          <UnitBasketBoard
            candidates={withProfile}
            assignmentsById={basketById}
            busyId={busyId}
            onAssign={assignToBasket}
            onUnassign={removeFromBasket}
            onOpenFit={(candidate, role, unit, composition) => setFitTarget({ candidate, role, unit, composition })}
          />
        )
      )}

      <div style={{ display: activeSubTab === 'candidatos' ? 'block' : 'none' }} className="space-y-6">
      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail, curso ou área..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  statusFilter === s.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro rápido por Levantamento de Perfil */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
          <span className="font-semibold text-slate-500 mr-1">Levantamento de Perfil:</span>
          {[
            { value: 'todos', label: 'Todos' },
            { value: 'enviados', label: '📩 Enviados (Pendentes)' },
            { value: 'respondidos', label: '✅ Respondidos' },
            { value: 'sem_envio', label: '⏳ Não enviados' },
          ].map((df) => (
            <button
              key={df.value}
              type="button"
              onClick={() => setDiscFilter(df.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                discFilter === df.value
                  ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {df.label}
            </button>
          ))}

          {filtered.filter((c) => !c.discToken && !c.discAssessment).length > 0 && (
            <button
              type="button"
              onClick={markAllUnsentAsSentManual}
              disabled={loading}
              className="ml-auto px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              title="Registra manualmente o envio do Levantamento para os candidatos atualmente visíveis que não possuem envio registrado"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              Marcar {filtered.filter((c) => !c.discToken && !c.discAssessment).length} sem envio como Enviados
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Carregando candidatos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {candidates.length === 0 ? 'Nenhum candidato encontrado.' : 'Nenhum candidato corresponde ao filtro.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold">
                <tr>
                  <th className="p-3">Candidato</th>
                  <th className="p-3">Curso</th>
                  <th className="p-3">Área desejada</th>
                  <th className="p-3">Oportunidade</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Perfil (DISC)</th>
                  <th className="p-3">Data</th>
                  <th className="p-3 text-right">Currículo</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((c) => {
                  const profileInfo = c.discAssessment ? DISC_PROFILE_INFO[c.discAssessment.primary_profile] : null;
                  const pendingToken = !c.discAssessment && c.discToken && !c.discToken.consumed_at;
                  const sentAtIso = c.discToken?.sent_at;
                  const openedAt = pendingToken ? c.discToken.first_opened_at : null;
                  const isLate = Boolean(openedAt) && (Date.now() - new Date(openedAt).getTime()) > DISC_SLA_MS;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-slate-800">{c.full_name || '—'}</span>

                          {/* Tag visual direta no candidato sobre o Levantamento de Perfil */}
                          {c.discAssessment ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border border-emerald-200 bg-emerald-50 text-emerald-700" title={`Levantamento respondido em ${formatDateTime(c.discAssessment.created_at || c.discToken?.consumed_at)}`}>
                              ✅ Respondido
                            </span>
                          ) : pendingToken ? (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                              isLate
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : openedAt
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                            }`} title={sentAtIso ? `Levantamento enviado em ${formatDateTime(sentAtIso)}` : undefined}>
                              {isLate ? <AlertTriangle className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                              {isLate ? 'Atraso no preenchimento' : openedAt ? `Aberto ${formatShortDate(openedAt)}` : `Enviado ${formatShortDate(sentAtIso)}`}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-slate-200 bg-slate-50 text-slate-400">
                              ⏳ Não enviado
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                          {c.email && (
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>
                          )}
                        </div>
                        {c.notes && (
                          <div className="text-[11px] text-slate-400 mt-1 italic truncate max-w-[220px]" title={c.notes}>
                            📝 {c.notes}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">{c.course || '—'}</td>
                      <td className="p-3 text-slate-600">{c.desired_area || '—'}</td>
                      <td className="p-3 text-slate-600">{OPPORTUNITY_LABEL[c.opportunity_type] || c.opportunity_type || '—'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-md border ${STATUS_BADGE[c.effectiveStatus] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {statusLabel(c.effectiveStatus)}
                        </span>
                      </td>
                      <td className="p-3">
                        {profileInfo ? (
                          <div className="flex flex-col items-start gap-1">
                            <button
                              type="button"
                              onClick={() => setResultTarget(c)}
                              className={`px-2 py-1 text-xs font-bold rounded-md border ${profileInfo.badge}`}
                              title="Ver resultado do Levantamento de Perfil"
                            >
                              {c.discAssessment.primary_profile}
                              {c.discAssessment.secondary_profile ? `/${c.discAssessment.secondary_profile}` : ''}
                            </button>
                            <span className="text-[10px] text-emerald-700 font-semibold" title={`Respondido em ${formatDateTime(c.discAssessment.created_at || c.discToken?.consumed_at)}`}>
                              ✅ Respondido {formatShortDate(c.discAssessment.created_at || c.discToken?.consumed_at)}
                            </span>
                            {c.bestFit && (
                              <span className="text-[10px] text-slate-500 whitespace-nowrap" title="Função com maior compatibilidade (ver Simulação por Unidade)">
                                Sugestão: <span className="font-semibold">{c.bestFit.role.short}</span> {c.bestFit.fit.score}
                              </span>
                            )}
                          </div>
                        ) : pendingToken ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-md border flex items-center gap-1.5 ${
                              isLate
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : openedAt
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`} title={sentAtIso ? `Enviado em ${formatDateTime(sentAtIso)}` : undefined}>
                              <Sparkles className="w-3.5 h-3.5 shrink-0" />
                              {openedAt ? `Aberto ${formatShortDate(openedAt)}` : `Enviado ${formatShortDate(sentAtIso)}`}
                            </span>
                            <span className="text-[10px] text-slate-400" title={sentAtIso ? `Data de envio: ${formatDateTime(sentAtIso)}` : undefined}>
                              {sentAtIso ? `Enviado em ${formatDateTime(sentAtIso)}` : 'Pendente de resposta'}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-md">
                            — Não enviado
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-slate-500">{formatDate(c)}</td>
                      <td className="p-3 text-right">
                        {c.resume_url ? (
                          <a
                            href={c.resume_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Ver currículo
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <CandidateActionsMenu
                          candidate={{ ...c, hasDiscToken: Boolean(c.discToken || c.discAssessment) }}
                          effectiveStatus={c.effectiveStatus}
                          busy={busyId === c.id}
                          onChangeStatus={(newStatus) => changeStatus(c, newStatus)}
                          onSendDisc={() => handleInitiateSendDisc(c)}
                          onMarkSentManual={() => markSentManual(c)}
                          onOpenNotes={() => setNotesTarget(c)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      {resendConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3 text-amber-600">
              <div className="p-2.5 bg-amber-100 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Levantamento de Perfil já enviado
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atenção ao reenviar a avaliação para o mesmo candidato.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5">
              <p>
                <strong>Candidato:</strong> {resendConfirmTarget.full_name}
              </p>
              <p>
                <strong>E-mail:</strong> {resendConfirmTarget.email}
              </p>
              {resendConfirmTarget.discToken?.sent_at && (
                <p>
                  <strong>Envio anterior:</strong> {formatDateTime(resendConfirmTarget.discToken.sent_at)}
                </p>
              )}
              <p>
                <strong>Situação atual:</strong>{' '}
                {resendConfirmTarget.discAssessment ? (
                  <span className="font-semibold text-emerald-700">✅ Já respondido ({resendConfirmTarget.discAssessment.primary_profile})</span>
                ) : resendConfirmTarget.discToken?.first_opened_at ? (
                  <span className="font-semibold text-blue-700">👀 Link aberto pelo candidato em {formatDateTime(resendConfirmTarget.discToken.first_opened_at)}</span>
                ) : (
                  <span className="font-semibold text-amber-700">📩 Link enviado por e-mail (Aguardando resposta)</span>
                )}
              </p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
              <p className="font-semibold">⚠️ O que acontece se reenviar?</p>
              <p>
                Um novo e-mail será disparado com um novo link. Caso o link anterior ainda não tenha sido respondido, ele será invalidado.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResendConfirmTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = resendConfirmTarget;
                  setResendConfirmTarget(null);
                  sendDiscAssessment(target);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-700 flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                Sim, Reenviar Avaliação
              </button>
            </div>
          </div>
        </div>
      )}

      {fitTarget && fitTarget.candidate.discAssessment && (
        <RoleFitModal
          candidate={fitTarget.candidate}
          assessment={fitTarget.candidate.discAssessment}
          role={fitTarget.role}
          unitLabel={fitTarget.unit?.label}
          composition={fitTarget.composition}
          onClose={() => setFitTarget(null)}
        />
      )}

      {notesTarget && (
        <CandidateNotesModal
          candidate={notesTarget}
          initialNotes={notesTarget.notes}
          onClose={() => setNotesTarget(null)}
          onSaved={(savedNotes) => {
            setMetaById((prev) => ({
              ...prev,
              [notesTarget.id]: { ...(prev[notesTarget.id] || { candidate_id: notesTarget.id }), notes: savedNotes },
            }));
          }}
        />
      )}

      {resultTarget && resultTarget.discAssessment && (
        <DiscResultModal
          candidate={resultTarget}
          assessment={resultTarget.discAssessment}
          onClose={() => setResultTarget(null)}
        />
      )}
    </div>
  );
}
