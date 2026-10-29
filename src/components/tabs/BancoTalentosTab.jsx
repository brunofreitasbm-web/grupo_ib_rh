import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useBackLayers } from '../../hooks/useBackHandler';
import { Briefcase, Search, RefreshCw, FileText, AlertTriangle, Loader2, Phone, Mail, Sparkles, LayoutGrid, ListChecks, Users, CheckCircle, Archive, Send, MessageCircle, Trash2, GitMerge, Eye, X, Bookmark, Clock, MapPin, Building2, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabase';
import { toast } from 'sonner';
import { STATUS_OPTIONS, STATUS_BADGE, STATUS_ROW, OPPORTUNITY_LABEL, TALENT_UNIT_OPTIONS, TALENT_UNIT_LABEL, TALENT_UNIT_BADGE, normalizeCandidateUnit, statusLabel } from '../../constants/talentBank';
import { expiryReason, archiveDaysLeft, discDaysLeft } from '../../utils/talentRetention';
import { findDuplicateClusters } from '../../utils/talentDuplicates';
import PurgeConfirmModal from '../talent/PurgeConfirmModal';
import MergeDuplicatesModal from '../talent/MergeDuplicatesModal';
import { DISC_PROFILE_INFO } from '../../utils/disc';
import { computeRoleFit, bestRoleFor } from '../../utils/roleFit';
import { ROLE_BY_ID, SIMULATION_UNITS } from '../../config/roleProfiles';
import CandidateActionsMenu from '../talent/CandidateActionsMenu';
import CandidateNotesModal from '../talent/CandidateNotesModal';
import DiscResultModal from '../talent/DiscResultModal';
import UnitBasketBoard from '../talent/UnitBasketBoard';
import RoleFitModal from '../talent/RoleFitModal';
import RoleProfilesPanel from '../talent/RoleProfilesPanel';
import CandidateAiAnalysisModal from '../talent/CandidateAiAnalysisModal';
import { mapFreelancerToDb, getFriendlyDbErrorMessage } from '../../utils/mappings';

const SUB_TABS = [
  { id: 'candidatos', label: 'Candidatos', icon: Users },
  { id: 'unidades', label: 'Candidaturas por Unidade', icon: MapPin },
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

const SAVED_FILTERS_KEY = 'talent_bank_saved_filters_v1';
const DEFAULT_FILTERS = {
  unit: 'todos', status: 'NOVO', disc: 'todos', opp: 'todos', profile: 'todos', period: 'todos',
  onlyResume: false, onlyDup: false, onlyExpiring: false, onlyAi: false, sort: 'date_desc',
};
const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90 };
const BATCH = 50;
const IN_CHUNK = 100;
const PAGE_SIZE = 200;
const MAX_PAGES = 50;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const loadSavedFilters = () => {
  try { return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || '[]'); } catch { return []; }
};

export default function BancoTalentosTab({ units = [] }) {
  // Unidades para o seletor do modal de conversão em Freelancer: usa as
  // unidades reais do painel quando disponíveis, com SIMULATION_UNITS como
  // fallback (mesmo conjunto usado pela Simulação por Unidade desta aba).
  const convertUnitOptions = units.length
    ? units.map((u) => ({ id: u.id, shortLabel: u.name || u.id }))
    : SIMULATION_UNITS;
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [remoteTotal, setRemoteTotal] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const { status: statusFilter, disc: discFilter } = filters;
  const [savedFilters, setSavedFilters] = useState(loadSavedFilters);
  const [selected, setSelected] = useState(() => new Set());
  const [freelancerIds, setFreelancerIds] = useState(() => new Set());
  const [bulkProgress, setBulkProgress] = useState(null); // { label, done, total }
  const [purgePlan, setPurgePlan] = useState(null); // { title, intro, reason, items }
  const [purging, setPurging] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [merging, setMerging] = useState(false);
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
  const [aiTarget, setAiTarget] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  // Entrada do módulo Freelance a partir do Banco de Talentos: converte um
  // candidato já triado em cadastro de freelancer (unitId + serviceArea
  // escolhidos aqui; o restante do cadastro — endereço, CPF, dados bancários
  // e a Declaração de Autonomia — é completado depois em Freelancers).
  const [convertTarget, setConvertTarget] = useState(null); // candidate

  // Botão/gesto voltar do celular: fecha a subtela mais interna (ver hooks/useBackHandler).
  useBackLayers([
    { active: !!purgePlan, back: () => !purging && setPurgePlan(null) },
    { active: mergeOpen, back: () => !merging && setMergeOpen(false) },
    { active: !!resendConfirmTarget, back: () => setResendConfirmTarget(null) },
    { active: !!aiTarget, back: () => !aiLoading && setAiTarget(null) },
    { active: !!convertTarget, back: () => setConvertTarget(null) },
    { active: !!fitTarget, back: () => setFitTarget(null) },
    { active: !!notesTarget, back: () => setNotesTarget(null) },
    { active: !!resultTarget, back: () => setResultTarget(null) },
    { active: activeSubTab !== 'candidatos', back: () => setActiveSubTab('candidatos') }
  ]);
  const [convertUnitId, setConvertUnitId] = useState('');
  const [convertServiceArea, setConvertServiceArea] = useState('');
  const [convertingId, setConvertingId] = useState(null);

  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;

  const loadOverlay = useCallback(async (ids) => {
    const targetIds = (ids && ids.length > 0) ? ids : candidatesRef.current.map((c) => c.id).filter(Boolean);
    if (targetIds.length === 0) {
      setMetaById({});
      setTokensById({});
      setAssessmentsById({});
      setBasketById({});
      setFreelancerIds(new Set());
      return;
    }
    try {
      // `.in()` com centenas de ids estoura o limite de URL do PostgREST: consulta
      // em blocos e junta os resultados.
      const inChunks = async (query) => {
        const parts = await Promise.all(chunk(targetIds.map(String), IN_CHUNK).map((part) => query(part)));
        return { data: parts.flatMap((r) => r.data || []), error: parts.find((r) => r.error)?.error || null };
      };
      const [metaRes, tokenRes, assessmentRes, basketRes, freelancerRes] = await Promise.all([
        inChunks((part) => supabase.from('talent_candidates_meta').select('*').in('candidate_id', part)),
        inChunks((part) => supabase.from('talent_disc_tokens').select('candidate_id, sent_at, expires_at, consumed_at, first_opened_at, is_manual').in('candidate_id', part)),
        inChunks((part) => supabase.from('talent_disc_assessments').select('*').in('candidate_id', part)),
        inChunks((part) => supabase.from('talent_basket_assignments').select('*').in('candidate_id', part)),
        inChunks((part) => supabase.from('freelancers').select('source_candidate_id').in('source_candidate_id', part)),
      ]);
      if (metaRes.error) throw metaRes.error;
      if (tokenRes.error) throw tokenRes.error;
      if (assessmentRes.error) throw assessmentRes.error;
      // A tabela da simulação pode ainda não existir (migração pendente):
      // não derruba o resto do overlay.
      if (basketRes.error) console.error('Erro ao carregar simulação por unidade:', basketRes.error);

      // Quem virou Freelancer é protegido da exclusão automática; se a consulta
      // falhar, o servidor (purge-talent-candidates) revalida de qualquer forma.
      if (freelancerRes.error) console.error('Erro ao carregar vínculos de freelancer:', freelancerRes.error);
      setFreelancerIds(new Set((freelancerRes.data || []).map((f) => String(f.source_candidate_id))));

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
      // A API limita cada página a 200: busca página a página (offset) até
      // completar o `total` informado, sem repetir ids.
      const byId = new Map();
      let total = null;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
        const { data, error: err } = await supabase.functions.invoke(
          `fetch-talent-bank?${params.toString()}`,
          { method: 'GET' }
        );
        if (err) throw err;

        const list = Array.isArray(data) ? data : (data?.candidates ?? data?.data ?? []);
        const rows = Array.isArray(list) ? list : [];
        if (typeof data?.total === 'number') total = data.total;
        rows.forEach((c) => c?.id && byId.set(c.id, c));
        // Termina quando a página veio incompleta, vazia, ou já cobriu o total
        // (o servidor pode ocultar excluídos, então não dá para exigir 200 exatos).
        if (rows.length === 0 || total === null || (page + 1) * PAGE_SIZE >= total) break;
      }
      const safeList = [...byId.values()];
      setRemoteTotal(total ?? safeList.length);
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
      const basket = basketById[c.id];
      const normalizedUnit = normalizeCandidateUnit(c, basket);
      return {
        ...c,
        effectiveStatus: meta?.status || c.status,
        normalizedUnit,
        unitLabel: TALENT_UNIT_LABEL[normalizedUnit] || normalizedUnit,
        notes: meta?.notes || '',
        discToken: token || null,
        discAssessment: assessment || null,
        aiAnalysis: meta?.ai_analysis || null,
        bestFit: assessment ? bestRoleFor(assessment) : null,
        archivedAt: meta?.archived_at || null,
        inBasket: Boolean(basket),
        isFreelancer: freelancerIds.has(String(c.id)),
      };
    }).map((c) => ({
      ...c,
      archiveLeft: archiveDaysLeft(c),
      discLeft: discDaysLeft(c),
      expiry: expiryReason(c),
    }));
  }, [candidates, metaById, tokensById, assessmentsById, basketById, freelancerIds]);

  const { clusters: duplicateClusters, clusterById } = useMemo(() => findDuplicateClusters(enriched), [enriched]);
  const expiredList = useMemo(() => enriched.filter((c) => c.expiry), [enriched]);
  const statusCounts = useMemo(() => {
    const counts = { todos: enriched.length };
    enriched.forEach((c) => { counts[c.effectiveStatus] = (counts[c.effectiveStatus] || 0) + 1; });
    return counts;
  }, [enriched]);

  const unitCounts = useMemo(() => {
    const counts = { todos: enriched.length };
    enriched.forEach((c) => {
      counts[c.normalizedUnit] = (counts[c.normalizedUnit] || 0) + 1;
    });
    return counts;
  }, [enriched]);

  // Candidaturas agrupadas e separadas por cada unidade correspondente
  const candidatesByUnit = useMemo(() => {
    const map = {};
    TALENT_UNIT_OPTIONS.filter((u) => u.value !== 'todos').forEach((u) => {
      map[u.value] = [];
    });
    enriched.forEach((c) => {
      const uKey = c.normalizedUnit || 'SEM_UNIDADE';
      if (!map[uKey]) map[uKey] = [];
      map[uKey].push(c);
    });
    return map;
  }, [enriched]);

  // Todos entram na simulação; quem ainda não fez o Levantamento fica sem Role Fit (selo "Sem DISC").
  const withProfile = useMemo(() => enriched.filter((c) => c.discAssessment), [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((c) => {
      if (statusFilter !== 'todos' && c.effectiveStatus !== statusFilter) return false;
      if (filters.unit !== 'todos' && c.normalizedUnit !== filters.unit) return false;

      // Filtro por Levantamento de Perfil
      const hasToken = Boolean(c.discToken);
      const hasAssessment = Boolean(c.discAssessment);
      if (discFilter === 'enviados' && (!hasToken || hasAssessment)) return false;
      if (discFilter === 'respondidos' && !hasAssessment) return false;
      if (discFilter === 'sem_envio' && (hasToken || hasAssessment)) return false;

      if (filters.opp !== 'todos' && c.opportunity_type !== filters.opp) return false;
      if (filters.profile !== 'todos' && c.discAssessment?.primary_profile !== filters.profile) return false;
      if (filters.period !== 'todos') {
        const ms = c.created_at_ms || (c.created_at_iso ? new Date(c.created_at_iso).getTime() : 0);
        if (!ms || Date.now() - ms > PERIOD_DAYS[filters.period] * 86400000) return false;
      }
      if (filters.onlyResume && !c.resume_url) return false;
      if (filters.onlyDup && !clusterById.has(String(c.id))) return false;
      if (filters.onlyExpiring) {
        const left = Math.min(c.archiveLeft ?? Infinity, c.discLeft ?? Infinity);
        if (left > 2) return false;
      }
      if (filters.onlyAi && !c.aiAnalysis) return false;

      if (!q) return true;
      const qDigits = q.replace(/\D/g, '');
      return [c.full_name, c.email, c.course, c.desired_area]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
        || (qDigits.length >= 4 && String(c.phone || '').replace(/\D/g, '').includes(qDigits));
    }).sort((a, b) => {
      const ts = (c) => c.created_at_ms || (c.created_at_iso ? new Date(c.created_at_iso).getTime() : 0) || 0;
      if (filters.sort === 'date_asc') return ts(a) - ts(b);
      if (filters.sort === 'name') return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'pt-BR');
      if (filters.sort === 'fit') return (b.bestFit?.fit.score ?? -1) - (a.bestFit?.fit.score ?? -1);
      if (filters.sort === 'ai') return (b.aiAnalysis?.overallFitScore ?? -1) - (a.aiAnalysis?.overallFitScore ?? -1);
      return ts(b) - ts(a);
    });
  }, [enriched, search, statusFilter, discFilter, filters, clusterById]);

  const changeStatus = async (candidate, newStatus) => {
    setBusyId(candidate.id);
    try {
      const { error: err } = await supabase.from('talent_candidates_meta').upsert({
        candidate_id: candidate.id,
        status: newStatus,
        // Marca quando entrou em Arquivado (base dos 7 dias); zera ao sair.
        archived_at: newStatus === 'ARQUIVADO' ? (candidate.archivedAt || new Date().toISOString()) : null,
        snapshot: { full_name: candidate.full_name, email: candidate.email, phone: candidate.phone },
        updated_at: new Date().toISOString(),
      });
      if (err) throw err;
      setMetaById((prev) => ({
        ...prev,
        [candidate.id]: {
          ...(prev[candidate.id] || { candidate_id: candidate.id }),
          status: newStatus,
          archived_at: newStatus === 'ARQUIVADO' ? (candidate.archivedAt || new Date().toISOString()) : null,
        },
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
      await loadOverlay();
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

  const handleAnalyzeCandidate = async (candidate) => {
    if (!candidate || !candidate.id) return;
    setAiTarget(candidate);
    setAiLoading(true);
    try {
      const { data, error: err } = await supabase.functions.invoke('analyze-talent-candidate', {
        body: {
          candidateId: candidate.id,
          fullName: candidate.full_name,
          email: candidate.email,
          phone: candidate.phone,
          course: candidate.course,
          desiredArea: candidate.desired_area,
          opportunityType: candidate.opportunity_type,
          resumeUrl: candidate.resume_url,
          discAssessment: candidate.discAssessment,
          notes: candidate.notes,
        },
      });

      if (err) {
        let detailMsg = '';
        try {
          const res = err?.context;
          const cloned = res && typeof res.clone === 'function' ? res.clone() : res;
          const body = cloned ? await cloned.json() : null;
          detailMsg = body?.message || '';
        } catch (_) {}
        throw new Error(detailMsg || err.message || 'Falha ao processar análise com IA.');
      }

      if (data?.aiAnalysis) {
        const candidateIdStr = String(candidate.id);
        setMetaById((prev) => ({
          ...prev,
          [candidate.id]: {
            ...(prev[candidate.id] || { candidate_id: candidate.id }),
            ai_analysis: data.aiAnalysis,
          },
          [candidateIdStr]: {
            ...(prev[candidateIdStr] || { candidate_id: candidateIdStr }),
            ai_analysis: data.aiAnalysis,
          },
        }));
        setAiTarget((prev) => (prev ? { ...prev, aiAnalysis: data.aiAnalysis } : prev));
        toast.success(`Parecer de IA gerado com sucesso para ${candidate.full_name}!`);
      }
    } catch (err) {
      console.error('Erro ao analisar candidato com IA:', err);
      toast.error(err.message || 'Não foi possível gerar a análise com IA.');
    } finally {
      setAiLoading(false);
    }
  };

  const bulkAnalyzeAi = async (list) => {
    if (list.length === 0) return;
    setBulkProgress({ label: 'Analisando com IA', done: 0, total: list.length });
    let ok = 0;
    let fail = 0;
    for (const c of list) {
      try {
        const { data, error: err } = await supabase.functions.invoke('analyze-talent-candidate', {
          body: {
            candidateId: c.id,
            fullName: c.full_name,
            email: c.email,
            phone: c.phone,
            course: c.course,
            desiredArea: c.desired_area,
            opportunityType: c.opportunity_type,
            resumeUrl: c.resume_url,
            discAssessment: c.discAssessment,
            notes: c.notes,
          },
        });
        if (err || !data?.aiAnalysis) throw err || new Error('Sem resposta');
        setMetaById((prev) => ({
          ...prev,
          [c.id]: {
            ...(prev[c.id] || { candidate_id: c.id }),
            ai_analysis: data.aiAnalysis,
          },
          [String(c.id)]: {
            ...(prev[String(c.id)] || { candidate_id: String(c.id) }),
            ai_analysis: data.aiAnalysis,
          },
        }));
        ok++;
      } catch (err) {
        console.error(`Falha ao analisar candidato ${c.full_name}:`, err);
        fail++;
      }
      setBulkProgress({ label: 'Analisando com IA', done: ok + fail, total: list.length });
    }
    setBulkProgress(null);
    toast[fail ? 'warning' : 'success'](`${ok} candidato(s) analisado(s) com IA${fail ? `, ${fail} com falha` : ''}.`);
    setSelected(new Set());
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

  const openConvertToFreelancer = (candidate) => {
    setConvertTarget(candidate);
    setConvertUnitId(convertUnitOptions[0]?.id || '');
    setConvertServiceArea(candidate.desired_area || '');
  };

  const handleConfirmConvertToFreelancer = async () => {
    if (!convertTarget) return;
    if (!convertUnitId) { toast.error('Selecione a unidade.'); return; }
    setConvertingId(convertTarget.id);
    try {
      const dbData = mapFreelancerToDb({
        unitId: convertUnitId,
        name: convertTarget.full_name || 'Freelancer sem nome',
        email: convertTarget.email || '',
        phone: convertTarget.phone || '',
        serviceArea: convertServiceArea,
        sourceCandidateId: String(convertTarget.id),
        active: true,
      });
      const { error } = await supabase.from('freelancers').insert([dbData]);
      if (error) throw error;
      toast.success(`${convertTarget.full_name || 'Candidato'} cadastrado como freelancer. Complete o cadastro (CPF, endereço e Declaração de Autonomia) na aba Freelancers antes de emitir a primeira Ordem de Serviço.`);
      setConvertTarget(null);
      setConvertServiceArea('');
    } catch (err) {
      console.error('Erro ao converter candidato em freelancer:', err);
      toast.error(getFriendlyDbErrorMessage(err));
    } finally {
      setConvertingId(null);
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
      await loadOverlay();
    } catch (err) {
      const detail = err?.message || err?.details || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      console.error('Erro ao marcar envios em massa:', detail, err);
      toast.error(err?.message ? `Não foi possível concluir a marcação em massa: ${err.message}` : 'Não foi possível concluir a marcação em massa.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Seleção + ações em massa -------------------------------------------
  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev);
    const key = String(id);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(String(c.id)));
  const toggleSelectAll = () => setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((c) => String(c.id))));
  const selectedCandidates = useMemo(() => enriched.filter((c) => selected.has(String(c.id))), [enriched, selected]);

  // Processa em lotes com progresso e resumo ok/falhas (não trava a tela em 200 linhas).
  const bulkChangeStatus = async (list, newStatus, label) => {
    if (list.length === 0) return;
    setBulkProgress({ label, done: 0, total: list.length });
    let ok = 0;
    let fail = 0;
    const nowIso = new Date().toISOString();
    for (const part of chunk(list, BATCH)) {
      const rows = part.map((c) => ({
        candidate_id: String(c.id),
        status: newStatus,
        archived_at: newStatus === 'ARQUIVADO' ? (c.archivedAt || nowIso) : null,
        snapshot: { full_name: c.full_name || '', email: c.email || '', phone: c.phone || '' },
        updated_at: nowIso,
      }));
      const { error: err } = await supabase.from('talent_candidates_meta').upsert(rows, { onConflict: 'candidate_id' });
      if (err) {
        console.error('Erro na ação em massa:', err);
        fail += part.length;
      } else {
        ok += part.length;
        setMetaById((prev) => {
          const next = { ...prev };
          rows.forEach((r) => { next[r.candidate_id] = { ...(next[r.candidate_id] || {}), ...r }; });
          return next;
        });
      }
      setBulkProgress({ label, done: ok + fail, total: list.length });
    }
    setBulkProgress(null);
    if (fail) toast.warning(`${ok} atualizado(s), ${fail} com falha.`);
    else toast.success(`${ok} candidato(s) → "${statusLabel(newStatus)}".`);
    setSelected(new Set());
  };

  const bulkSendDisc = async (list) => {
    const withEmail = list.filter((c) => c.email && !c.discAssessment && !c.discToken);
    const skipped = list.length - withEmail.length;
    if (withEmail.length === 0) {
      toast.info('Nenhum selecionado precisa de envio (já enviado/respondido ou sem e-mail).');
      return;
    }
    setBulkProgress({ label: 'Enviando Levantamento', done: 0, total: withEmail.length });
    let ok = 0;
    let fail = 0;
    for (const part of chunk(withEmail, 5)) {
      const results = await Promise.allSettled(part.map((c) => supabase.functions.invoke('send-disc-assessment', {
        body: { candidateId: c.id, fullName: c.full_name, email: c.email, phone: c.phone },
      }).then(({ error: err }) => { if (err) throw err; })));
      results.forEach((r) => (r.status === 'fulfilled' ? (ok += 1) : (fail += 1)));
      setBulkProgress({ label: 'Enviando Levantamento', done: ok + fail, total: withEmail.length });
    }
    setBulkProgress(null);
    await loadOverlay(candidates.map((c) => c.id).filter(Boolean));
    toast[fail ? 'warning' : 'success'](`${ok} enviado(s)${fail ? `, ${fail} com falha` : ''}${skipped ? ` · ${skipped} ignorado(s)` : ''}.`);
    setSelected(new Set());
  };

  // ---- Exclusão definitiva (servidor revalida elegibilidade/proteções) -------
  const reasonLabel = { arquivado: 'Arquivado > 7 dias', disc: 'DISC sem resposta > 10 dias', manual: 'Exclusão manual', duplicado: 'Duplicado' };
  const openPurgePlan = (title, intro, list, reasonFor) => {
    if (list.length === 0) { toast.info('Nada a excluir.'); return; }
    setPurgePlan({
      title,
      intro,
      items: list.map((c) => ({ id: String(c.id), name: c.full_name, email: c.email, reason: reasonFor(c), reasonLabel: reasonLabel[reasonFor(c)] })),
    });
  };
  const openPurgeExpired = () => openPurgePlan(
    'Limpar candidatos vencidos',
    'Arquivados há 7+ dias ou sem preencher o DISC há 10+ dias (contados do envio do link).',
    expiredList,
    (c) => c.expiry,
  );
  const openPurgeSelected = (list) => openPurgePlan(
    'Excluir candidatos selecionados',
    'Exclusão manual definitiva.',
    list,
    () => 'manual',
  );

  const confirmPurge = async () => {
    if (!purgePlan) return;
    const byReason = {};
    purgePlan.items.forEach((it) => { (byReason[it.reason] ||= []).push(it.id); });
    const total = purgePlan.items.length;
    setPurging(true);
    setBulkProgress({ label: 'Excluindo', done: 0, total });
    const deleted = new Set();
    let failed = 0;
    let refused = 0;
    let doneCount = 0;
    try {
      for (const [reason, ids] of Object.entries(byReason)) {
        for (const part of chunk(ids, 100)) {
          const { data, error: err } = await supabase.functions.invoke('purge-talent-candidates', { body: { ids: part, reason } });
          if (err) {
            let detail = '';
            try { detail = (await err.context?.json?.())?.message || ''; } catch (_) {}
            throw new Error(detail || err.message || 'Falha ao excluir.');
          }
          (data?.deleted || []).forEach((id) => deleted.add(String(id)));
          failed += (data?.failed || []).length;
          refused += (data?.refused || []).length;
          doneCount += part.length;
          setBulkProgress({ label: 'Excluindo', done: doneCount, total });
        }
      }
      const gone = (id) => deleted.has(String(id));
      setCandidates((prev) => prev.filter((c) => !gone(c.id)));
      const prune = (prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !gone(k)));
      setMetaById(prune); setTokensById(prune); setAssessmentsById(prune); setBasketById(prune);
      setSelected(new Set());
      setPurgePlan(null);
      const extra = [failed && `${failed} falharam`, refused && `${refused} preservados (protegidos/fora do prazo)`].filter(Boolean).join(' · ');
      toast[failed ? 'warning' : 'success'](`${deleted.size} candidato(s) excluído(s)${extra ? ` · ${extra}` : ''}.`);
    } catch (err) {
      console.error('Erro ao excluir candidatos:', err);
      toast.error(err.message || 'Não foi possível excluir. Nada foi apagado no trecho que falhou.');
    } finally {
      setPurging(false);
      setBulkProgress(null);
    }
  };

  // ---- Mesclagem de duplicados -------------------------------------------
  const mergeGroup = async (masterId, aliasIds) => {
    setMerging(true);
    try {
      for (const aliasId of aliasIds) {
        const { error: err } = await supabase.rpc('merge_talent_candidates', { p_master: masterId, p_alias: aliasId });
        if (err) throw err;
      }
      // Exclui o registro remoto dos aliases; se falhar, o alias já fica oculto pelo servidor.
      const { error: purgeErr } = await supabase.functions.invoke('purge-talent-candidates', { body: { ids: aliasIds, reason: 'duplicado' } });
      if (purgeErr) toast.warning('Mesclado, mas o registro original no Faça Amigos não foi excluído (ficará oculto).');
      else toast.success(`${aliasIds.length} duplicado(s) mesclado(s).`);
      await load();
    } catch (err) {
      console.error('Erro ao mesclar duplicados:', err);
      toast.error(err?.message === 'forbidden' ? 'Somente supervisores podem mesclar.' : 'Não foi possível mesclar.');
    } finally {
      setMerging(false);
    }
  };

  // ---- Filtros salvos (por navegador) --------------------------------------
  const persistSaved = (list) => {
    setSavedFilters(list);
    try { localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(list)); } catch (_) {}
  };
  const saveCurrentFilters = () => {
    const name = window.prompt('Nome do filtro salvo:');
    if (!name?.trim()) return;
    persistSaved([...savedFilters.filter((f) => f.name !== name.trim()), { name: name.trim(), filters, search }]);
  };

  // Atalhos na linha focada: A arquivar · E enviar DISC · N notas · X selecionar.
  const onRowKeyDown = (e, c) => {
    if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'a') changeStatus(c, c.effectiveStatus === 'ARQUIVADO' ? 'CONTATADO' : 'ARQUIVADO');
    else if (k === 'e') handleInitiateSendDisc(c);
    else if (k === 'n') setNotesTarget(c);
    else if (k === 'x') toggleSelect(c.id);
    else return;
    e.preventDefault();
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
            {!loading && candidates.length > 0 && (
              <span className="ml-1 font-semibold text-slate-600">
                Exibindo {candidates.length}{remoteTotal && remoteTotal !== candidates.length ? ` de ${remoteTotal}` : ''} candidatura(s).
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start md:self-auto">
          {duplicateClusters.length > 0 && (
            <button
              onClick={() => setMergeOpen(true)}
              className="px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 flex items-center gap-2"
            >
              <GitMerge className="w-4 h-4" />
              Duplicados ({duplicateClusters.length})
            </button>
          )}
          <button
            onClick={openPurgeExpired}
            disabled={expiredList.length === 0 || loading}
            className="px-3 py-2 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exclui arquivados há 7+ dias e quem não preencheu o DISC em 10+ dias"
          >
            <Trash2 className="w-4 h-4" />
            Limpar vencidos ({expiredList.length})
          </button>
          <button
            onClick={load}
            className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
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

      {activeSubTab === 'unidades' && (
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Distribuição de Candidaturas por Unidade
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Visão consolidada das candidaturas separadas por cada unidade à qual o candidato se candidatou ou demonstrou interesse.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-100 text-blue-800 self-start sm:self-auto">
                Total: {enriched.length} candidatura(s)
              </span>
            </div>

            {/* Cards de resumo por unidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
              {TALENT_UNIT_OPTIONS.filter((u) => u.value !== 'todos').map((u) => {
                const count = unitCounts[u.value] || 0;
                const pct = enriched.length ? Math.round((count / enriched.length) * 100) : 0;
                return (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => {
                      setFilter('unit', u.value);
                      setActiveSubTab('candidatos');
                    }}
                    className="p-3 bg-white border border-slate-200 rounded-xl text-left hover:border-blue-400 hover:shadow-xs transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        TALENT_UNIT_BADGE[u.value] || 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {u.shortLabel || u.label}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{pct}%</span>
                    </div>
                    <div className="text-2xl font-black text-slate-800 mt-2">{count}</div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between mt-1">
                      <span>candidatos</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seções por Unidade */}
          <div className="space-y-6">
            {TALENT_UNIT_OPTIONS.filter((u) => u.value !== 'todos').map((u) => {
              const list = candidatesByUnit[u.value] || [];
              return (
                <div key={u.value} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${
                        u.color === 'emerald' ? 'bg-emerald-500' :
                        u.color === 'indigo' ? 'bg-indigo-500' :
                        u.color === 'amber' ? 'bg-amber-500' :
                        u.color === 'purple' ? 'bg-purple-500' : 'bg-slate-400'
                      }`} />
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          {u.label}
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            {list.length}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500">
                          {u.value === 'AMBAS'
                            ? 'Candidatos com disponibilidade para qualquer unidade ou ambas as lojas/clínica'
                            : u.value === 'SEM_UNIDADE'
                            ? 'Candidaturas sem unidade explícita no formulário de inscrição'
                            : `Candidaturas direcionadas para a unidade ${u.label}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFilter('unit', u.value);
                        setActiveSubTab('candidatos');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 self-start sm:self-auto flex items-center gap-1.5 transition-colors"
                    >
                      Filtrar na tabela principal
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {list.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Nenhum candidato inscrito nesta unidade até o momento.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {list.map((c) => {
                        const profileInfo = c.discAssessment ? DISC_PROFILE_INFO[c.discAssessment.primary_profile] : null;
                        return (
                          <div key={c.id} className="p-4 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-slate-800 text-sm">{c.full_name || '—'}</span>
                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${
                                  STATUS_BADGE[c.effectiveStatus] || 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {statusLabel(c.effectiveStatus)}
                                </span>
                                {c.opportunity_type && (
                                  <span className="px-2 py-0.5 text-[10px] font-medium rounded border border-slate-200 bg-slate-50 text-slate-600">
                                    {OPPORTUNITY_LABEL[c.opportunity_type] || c.opportunity_type}
                                  </span>
                                )}
                                {profileInfo && (
                                  <button
                                    type="button"
                                    onClick={() => setResultTarget(c)}
                                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${profileInfo.badge}`}
                                  >
                                    DISC: {c.discAssessment.primary_profile}
                                  </button>
                                )}
                                {c.aiAnalysis && (
                                  <button
                                    type="button"
                                    onClick={() => setAiTarget(c)}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border border-indigo-200 bg-indigo-50 text-indigo-700"
                                  >
                                    <Sparkles className="w-3 h-3 text-indigo-600" />
                                    IA: {c.aiAnalysis.overallFitScore}%
                                  </button>
                                )}
                              </div>
                              <div className="text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                                {c.email && (
                                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>
                                )}
                                {c.phone && (
                                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>
                                )}
                                {c.course && (
                                  <span className="text-slate-700 font-medium">Curso: {c.course}</span>
                                )}
                                {c.desired_area && (
                                  <span className="text-slate-600">Área: {c.desired_area}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                              {c.resume_url && (
                                <a
                                  href={c.resume_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-blue-600 font-medium flex items-center gap-1.5 text-xs shadow-2xs"
                                  title="Ver currículo"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Currículo
                                </a>
                              )}
                              <button
                                type="button"
                                disabled={busyId === c.id || !c.email}
                                onClick={() => handleInitiateSendDisc(c)}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-1.5 text-xs shadow-2xs disabled:opacity-40"
                                title="Enviar Levantamento DISC"
                              >
                                <Send className="w-3.5 h-3.5 text-blue-600" />
                                Enviar DISC
                              </button>
                              <CandidateActionsMenu
                                candidate={{ ...c, hasDiscToken: Boolean(c.discToken || c.discAssessment) }}
                                effectiveStatus={c.effectiveStatus}
                                busy={busyId === c.id}
                                onChangeStatus={(newStatus) => changeStatus(c, newStatus)}
                                onSendDisc={() => handleInitiateSendDisc(c)}
                                onMarkSentManual={() => markSentManual(c)}
                                onOpenNotes={() => setNotesTarget(c)}
                                onConvertFreelance={() => openConvertToFreelancer(c)}
                                onAnalyzeAi={() => {
                                  if (c.aiAnalysis) setAiTarget(c);
                                  else handleAnalyzeCandidate(c);
                                }}
                                onDelete={() => openPurgeSelected([c])}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                onClick={() => setFilter('status', s.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  statusFilter === s.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                }`}
              >
                {s.label}
                <span className="ml-1 opacity-70">{statusCounts[s.value] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filtro por Unidade da Candidatura */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
          <span className="font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            Unidade:
          </span>
          {TALENT_UNIT_OPTIONS.map((u) => (
            <button
              key={u.value}
              type="button"
              onClick={() => setFilter('unit', u.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                filters.unit === u.value
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-semibold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {u.shortLabel || u.label}
              <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                filters.unit === u.value ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {unitCounts[u.value] || 0}
              </span>
            </button>
          ))}
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
              onClick={() => setFilter('disc', df.value)}
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

        {/* Filtros avançados */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <select value={filters.unit} onChange={(e) => setFilter('unit', e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 bg-white font-medium">
            {TALENT_UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.value === 'todos' ? 'Unidade: todas' : u.label}
              </option>
            ))}
          </select>
          <select value={filters.opp} onChange={(e) => setFilter('opp', e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 bg-white">
            <option value="todos">Oportunidade: todas</option>
            {Object.entries(OPPORTUNITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filters.profile} onChange={(e) => setFilter('profile', e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 bg-white">
            <option value="todos">Perfil DISC: todos</option>
            {['D', 'I', 'S', 'C'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filters.period} onChange={(e) => setFilter('period', e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 bg-white">
            <option value="todos">Candidatura: qualquer data</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
          <select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 bg-white">
            <option value="date_desc">Mais recentes</option>
            <option value="date_asc">Mais antigos</option>
            <option value="name">Nome (A–Z)</option>
            <option value="fit">Maior compatibilidade</option>
            <option value="ai">Maior score IA</option>
          </select>
          {[
            ['onlyResume', 'Com currículo'],
            ['onlyAi', 'Com análise IA'],
            ['onlyDup', `Duplicados (${clusterById.size})`],
            ['onlyExpiring', 'Vencendo em ≤2 dias'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key, !filters[key])}
              className={`px-2.5 py-1 font-medium rounded-lg border transition-colors ${filters[key] ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {savedFilters.map((sf) => (
              <span key={sf.name} className="inline-flex items-center border border-blue-200 bg-blue-50 text-blue-700 rounded-lg overflow-hidden">
                <button type="button" className="px-2 py-1 font-medium" onClick={() => { setFilters({ ...DEFAULT_FILTERS, ...sf.filters }); setSearch(sf.search || ''); }}>
                  <Bookmark className="w-3 h-3 inline mr-1" />{sf.name}
                </button>
                <button type="button" title="Remover filtro salvo" className="px-1.5 py-1 hover:bg-blue-100" onClick={() => persistSaved(savedFilters.filter((f) => f.name !== sf.name))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button type="button" onClick={saveCurrentFilters} className="px-2.5 py-1 font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
              + Salvar filtro
            </button>
            <button type="button" onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(''); }} className="px-2.5 py-1 font-medium rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
              Limpar
            </button>
          </span>
        </div>
      </div>

      {/* Barra de ações em massa */}
      {(selected.size > 0 || bulkProgress) && (
        <div className="sticky top-2 z-30 flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-xl shadow-lg text-xs">
          {bulkProgress ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{bulkProgress.label}… {bulkProgress.done}/{bulkProgress.total}</span>
          ) : (
            <>
              <span className="font-semibold">{selected.size} selecionado(s)</span>
              <button type="button" onClick={() => bulkAnalyzeAi(selectedCandidates)} className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 font-medium shadow-xs"><Sparkles className="w-3.5 h-3.5" />Avaliar com IA</button>
              <button type="button" onClick={() => bulkChangeStatus(selectedCandidates, 'ARQUIVADO', 'Arquivando')} className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-1.5"><Archive className="w-3.5 h-3.5" />Arquivar</button>
              <button type="button" onClick={() => bulkChangeStatus(selectedCandidates, 'LIDO', 'Marcando como lido')} className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />Marcar lido</button>
              <button type="button" onClick={() => bulkSendDisc(selectedCandidates)} className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />Enviar DISC</button>
              <button type="button" onClick={() => openPurgeSelected(selectedCandidates)} className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Excluir</button>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto px-2 py-1 rounded-lg hover:bg-white/10">Limpar seleção</button>
            </>
          )}
        </div>
      )}

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
                  <th className="p-3 w-8">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} title="Selecionar todos os filtrados" />
                  </th>
                  <th className="p-3">Candidato</th>
                  <th className="p-3">Unidade Pretendida</th>
                  <th className="p-3">Curso / Área</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Perfil (DISC)</th>
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
                    <tr
                      key={c.id}
                      tabIndex={0}
                      onKeyDown={(e) => onRowKeyDown(e, c)}
                      className={`outline-none focus:ring-2 focus:ring-inset focus:ring-blue-300 ${STATUS_ROW[c.effectiveStatus] || 'border-l-4 border-l-transparent hover:bg-slate-50'}`}
                    >
                      <td className="p-3 align-top">
                        <input type="checkbox" checked={selected.has(String(c.id))} onChange={() => toggleSelect(c.id)} />
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-slate-800">{c.full_name || '—'}</span>

                          {clusterById.has(String(c.id)) && (
                            <button type="button" onClick={() => setMergeOpen(true)} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border border-indigo-200 bg-indigo-50 text-indigo-700" title="Possível candidatura duplicada — clique para revisar">
                              <GitMerge className="w-3 h-3" />Duplicado ×{duplicateClusters[clusterById.get(String(c.id))].length}
                            </button>
                          )}
                          {c.archiveLeft !== null && !c.expiry && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border border-rose-200 bg-rose-50 text-rose-700" title="Candidato arquivado é excluído do banco após 7 dias">
                              <Clock className="w-3 h-3" />Exclui em {c.archiveLeft}d
                            </span>
                          )}
                          {c.discLeft !== null && !c.expiry && !c.inBasket && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border border-orange-200 bg-orange-50 text-orange-700" title="Sem preencher o DISC em 10 dias do envio, o candidato é excluído">
                              <Clock className="w-3 h-3" />DISC vence em {c.discLeft}d
                            </span>
                          )}
                          {c.expiry && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border border-rose-300 bg-rose-100 text-rose-800">
                              <Trash2 className="w-3 h-3" />Vencido
                            </span>
                          )}

                          {/* Tag visual de Análise Preditiva de IA */}
                          {c.aiAnalysis && (
                            <button
                              type="button"
                              onClick={() => setAiTarget(c)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
                              title="Ver Parecer de IA (Gemini)"
                            >
                              <Sparkles className="w-3 h-3 text-indigo-600" />
                              IA: {c.aiAnalysis.overallFitScore}% · {c.aiAnalysis.topRecommendedRole || 'Aderente'}
                            </button>
                          )}

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
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border ${
                          TALENT_UNIT_BADGE[c.normalizedUnit] || 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>
                          <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                          {c.unitLabel || 'Sem unidade'}
                        </span>
                        {c.preferred_unit && c.normalizedUnit !== 'SEM_UNIDADE' && (
                          <div className="text-[10px] text-slate-400 mt-0.5 ml-1">
                            Inscrito: {c.preferred_unit}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 text-xs">
                        <div className="font-medium text-slate-700 text-sm">{c.course || '—'}</div>
                        <div className="mt-0.5">{c.desired_area || '—'}</div>
                        <div className="mt-0.5 text-slate-400">{OPPORTUNITY_LABEL[c.opportunity_type] || c.opportunity_type || '—'}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-md border ${STATUS_BADGE[c.effectiveStatus] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {statusLabel(c.effectiveStatus)}
                        </span>
                        <div className="mt-1 text-[11px] text-slate-500">{formatDate(c)}</div>
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
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-0.5">
                          {c.resume_url && (
                            <a
                              href={c.resume_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-white hover:text-blue-800"
                              title="Ver currículo"
                            >
                              <FileText className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            type="button"
                            disabled={busyId === c.id || aiLoading}
                            onClick={() => {
                              if (c.aiAnalysis) setAiTarget(c);
                              else handleAnalyzeCandidate(c);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              c.aiAnalysis
                                ? 'text-indigo-600 hover:bg-white hover:text-indigo-800'
                                : 'text-slate-400 hover:bg-white hover:text-indigo-600'
                            }`}
                            title={c.aiAnalysis ? 'Ver Parecer de IA' : 'Avaliar com IA (Gemini)'}
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            onClick={() => changeStatus(c, c.effectiveStatus === 'ARQUIVADO' ? 'CONTATADO' : 'ARQUIVADO')}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-rose-600 disabled:opacity-40"
                            title={c.effectiveStatus === 'ARQUIVADO' ? 'Desarquivar (A)' : 'Arquivar (A)'}
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === c.id || !c.email}
                            onClick={() => handleInitiateSendDisc(c)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-blue-600 disabled:opacity-30"
                            title={c.email ? 'Enviar Levantamento DISC (E)' : 'Candidato sem e-mail'}
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          {c.phone && (
                            <a
                              href={`https://wa.me/55${String(c.phone).replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-emerald-600"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}
                        <CandidateActionsMenu
                          candidate={{ ...c, hasDiscToken: Boolean(c.discToken || c.discAssessment) }}
                          effectiveStatus={c.effectiveStatus}
                          busy={busyId === c.id}
                          onChangeStatus={(newStatus) => changeStatus(c, newStatus)}
                          onSendDisc={() => handleInitiateSendDisc(c)}
                          onMarkSentManual={() => markSentManual(c)}
                          onOpenNotes={() => setNotesTarget(c)}
                          onConvertFreelance={() => openConvertToFreelancer(c)}
                          onAnalyzeAi={() => {
                            if (c.aiAnalysis) setAiTarget(c);
                            else handleAnalyzeCandidate(c);
                          }}
                          onDelete={() => openPurgeSelected([c])}
                        />
                        </div>
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

      {purgePlan && (
        <PurgeConfirmModal
          title={purgePlan.title}
          intro={purgePlan.intro}
          items={purgePlan.items}
          busy={purging}
          progress={bulkProgress}
          onCancel={() => setPurgePlan(null)}
          onConfirm={confirmPurge}
        />
      )}

      {mergeOpen && (
        <MergeDuplicatesModal
          clusters={duplicateClusters}
          busy={merging}
          onCancel={() => setMergeOpen(false)}
          onMerge={mergeGroup}
        />
      )}

      {convertTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3 text-violet-700">
              <div className="p-2.5 bg-violet-100 rounded-xl shrink-0">
                <Briefcase className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Cadastrar como Freelancer</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Entra no módulo Freelance como trabalhador autônomo pessoa física, para trabalhos pontuais.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5">
              <p><strong>Candidato:</strong> {convertTarget.full_name}</p>
              <p><strong>E-mail:</strong> {convertTarget.email || '—'}</p>
              <p><strong>Telefone:</strong> {convertTarget.phone || '—'}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Unidade</label>
              <select
                value={convertUnitId}
                onChange={(e) => setConvertUnitId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                {convertUnitOptions.map((u) => (
                  <option key={u.id} value={u.id}>{u.shortLabel}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Área/atividade do serviço</label>
              <input
                value={convertServiceArea}
                onChange={(e) => setConvertServiceArea(e.target.value)}
                placeholder="Ex.: recreação de eventos, fotografia…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Este passo só cria o cadastro básico. CPF, endereço, dados bancários e a Declaração de Autonomia
              precisam ser completados na aba Freelancers antes de emitir a primeira Ordem de Serviço.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConvertTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmConvertToFreelancer}
                disabled={convertingId === convertTarget.id}
                className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-60"
              >
                {convertingId === convertTarget.id ? 'Cadastrando…' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {aiTarget && (
        <CandidateAiAnalysisModal
          candidate={aiTarget}
          analysis={aiTarget.aiAnalysis || metaById[aiTarget.id]?.ai_analysis}
          loading={aiLoading}
          onReanalyze={handleAnalyzeCandidate}
          onClose={() => !aiLoading && setAiTarget(null)}
        />
      )}
    </div>
  );
}
