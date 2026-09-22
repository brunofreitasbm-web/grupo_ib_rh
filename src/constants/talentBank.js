// Vocabulário do Banco de Talentos. Mantenha em sincronia com ALLOWED_STATUS em
// supabase/functions/fetch-talent-bank e export-job-applications, e com o CHECK
// de talent_candidates_meta.status (migração 20260915_talent_bank_overlay_disc).

export const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'NOVO', label: 'Novo' },
  { value: 'LIDO', label: 'Lido' },
  { value: 'ESPERA', label: 'Em espera' },
  { value: 'ENTREVISTA', label: 'Entrevista' },
  { value: 'EM_ANALISE', label: 'Em análise' },
  { value: 'CONTATADO', label: 'Contatado' },
  { value: 'ARQUIVADO', label: 'Arquivado' },
];

export const CANDIDATE_STATUSES = STATUS_OPTIONS.filter((s) => s.value !== 'todos');

export const STATUS_BADGE = {
  NOVO: 'bg-blue-100 text-blue-700 border-blue-200',
  LIDO: 'bg-slate-100 text-slate-600 border-slate-200',
  ESPERA: 'bg-amber-100 text-amber-700 border-amber-200',
  ENTREVISTA: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  EM_ANALISE: 'bg-purple-100 text-purple-700 border-purple-200',
  CONTATADO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ARQUIVADO: 'bg-rose-100 text-rose-700 border-rose-200',
};

export const OPPORTUNITY_LABEL = {
  REMUNERADO: 'CLT',
  VOLUNTARIO: 'Voluntário',
  ESTAGIO: 'Estágio',
  BOLSA: 'Bolsa',
  PJ: 'PJ',
};

export const statusLabel = (value) =>
  STATUS_OPTIONS.find((s) => s.value === value)?.label || value || '—';
