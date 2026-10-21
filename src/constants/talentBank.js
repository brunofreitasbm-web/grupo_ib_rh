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

// Cor da linha da tabela por status efetivo: fundo suave + faixa à esquerda.
// O badge da coluna Status continua sendo o sinal textual (a cor não é o único).
export const STATUS_ROW = {
  NOVO: 'bg-blue-50/40 border-l-4 border-l-blue-400 hover:bg-blue-50',
  LIDO: 'border-l-4 border-l-slate-200 hover:bg-slate-50',
  ESPERA: 'bg-amber-50/60 border-l-4 border-l-amber-400 hover:bg-amber-50',
  ENTREVISTA: 'bg-indigo-50/60 border-l-4 border-l-indigo-500 hover:bg-indigo-50',
  EM_ANALISE: 'bg-purple-50/60 border-l-4 border-l-purple-500 hover:bg-purple-50',
  CONTATADO: 'bg-emerald-50/60 border-l-4 border-l-emerald-500 hover:bg-emerald-50',
  ARQUIVADO: 'bg-rose-50/40 border-l-4 border-l-rose-300 opacity-70 hover:opacity-100',
};

// Retenção: arquivado há 7 dias e link do DISC sem resposta há 10 dias saem do banco.
export const ARCHIVE_RETENTION_DAYS = 7;
export const DISC_DEADLINE_DAYS = 10;

// Status de processo ativo: nunca são excluídos automaticamente.
export const PROTECTED_STATUSES = ['ENTREVISTA', 'EM_ANALISE', 'CONTATADO'];

export const OPPORTUNITY_LABEL = {
  REMUNERADO: 'CLT',
  VOLUNTARIO: 'Voluntário',
  ESTAGIO: 'Estágio',
  BOLSA: 'Bolsa',
  PJ: 'PJ',
};

export const statusLabel = (value) =>
  STATUS_OPTIONS.find((s) => s.value === value)?.label || value || '—';
