import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Briefcase, Search, RefreshCw, FileText, AlertTriangle, Loader2, Phone, Mail } from 'lucide-react';
import { supabase } from '../../supabase';

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'NOVO', label: 'Novo' },
  { value: 'LIDO', label: 'Lido' },
  { value: 'ESPERA', label: 'Em espera' },
  { value: 'ENTREVISTA', label: 'Entrevista' },
  { value: 'EM_ANALISE', label: 'Em análise' },
  { value: 'CONTATADO', label: 'Contatado' },
  { value: 'ARQUIVADO', label: 'Arquivado' },
];

const STATUS_BADGE = {
  NOVO: 'bg-blue-100 text-blue-700 border-blue-200',
  LIDO: 'bg-slate-100 text-slate-600 border-slate-200',
  ESPERA: 'bg-amber-100 text-amber-700 border-amber-200',
  ENTREVISTA: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  EM_ANALISE: 'bg-purple-100 text-purple-700 border-purple-200',
  CONTATADO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ARQUIVADO: 'bg-rose-100 text-rose-700 border-rose-200',
};

const OPPORTUNITY_LABEL = {
  REMUNERADO: 'Remunerado',
  VOLUNTARIO: 'Voluntário',
  ESTAGIO: 'Estágio',
};

const formatDate = (candidate) => {
  const ms = candidate.created_at_ms;
  const iso = candidate.created_at_iso;
  const d = ms ? new Date(ms) : iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function BancoTalentosTab() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('NOVO');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter !== 'todos') params.set('status', statusFilter);

      const { data, error: err } = await supabase.functions.invoke(
        `fetch-talent-bank?${params.toString()}`,
        { method: 'GET' }
      );
      if (err) throw err;

      const list = Array.isArray(data) ? data : (data?.candidates ?? data?.data ?? []);
      setCandidates(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Erro ao carregar Banco de Talentos:', err);
      let msg = err?.message || '';
      let detailMsg = '';
      let statusCode = err?.context?.status || null;
      
      // Tenta extrair a mensagem detalhada enviada pelo corpo da resposta da Edge Function sem consumir a resposta principal
      if (err?.context) {
        try {
          const cloned = typeof err.context.clone === 'function' ? err.context.clone() : err.context;
          const body = await cloned.json();
          if (body?.error) detailMsg = body.error;
        } catch (_) {
          try {
            const clonedText = typeof err.context.clone === 'function' ? err.context.clone() : err.context;
            detailMsg = await clonedText.text();
          } catch (_) {}
        }
      }

      if (statusCode === 403 || detailMsg === 'unauthorized') {
        setError('Acesso negado (HTTP 403): O seu usuário logado precisa ter a role "supervisor" configurada no Supabase Auth para visualizar o Banco de Talentos.');
      } else if (statusCode === 500 || detailMsg.includes('TALENT_API') || detailMsg.includes('não configuradas')) {
        setError('Erro na Edge Function (HTTP 500): Verifique se os secrets (TALENT_API_KEY e TALENT_API_ANON_KEY) foram configurados no Supabase CLI via `supabase secrets set`.');
      } else if (msg.includes('Failed to send a request') || err?.name === 'FunctionsFetchError' || statusCode === 404) {
        setError('A Edge Function "fetch-talent-bank" não está implantada ou acessível no projeto Supabase. Certifique-se de implantar a função via Supabase CLI (`supabase functions deploy fetch-talent-bank`).');
      } else if (msg.includes('non-2xx status code') || err?.name === 'FunctionsHttpError') {
        setError(`A Edge Function "fetch-talent-bank" retornou o código de status ${statusCode || 'de erro'}${detailMsg ? `: ${detailMsg}` : '.'} Verifique os secrets do Supabase e as permissões do usuário.`);
      } else {
        setError(detailMsg || msg || 'Não foi possível carregar os candidatos do Banco de Talentos.');
      }
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      [c.full_name, c.email, c.course, c.desired_area]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [candidates, search]);

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

      {/* Filtros */}
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
                  <th className="p-3">Data</th>
                  <th className="p-3 text-right">Currículo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{c.full_name || '—'}</div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        {c.email && (
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>
                        )}
                        {c.phone && (
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-slate-600">{c.course || '—'}</td>
                    <td className="p-3 text-slate-600">{c.desired_area || '—'}</td>
                    <td className="p-3 text-slate-600">{OPPORTUNITY_LABEL[c.opportunity_type] || c.opportunity_type || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-md border ${STATUS_BADGE[c.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {STATUS_OPTIONS.find((s) => s.value === c.status)?.label || c.status || '—'}
                      </span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
