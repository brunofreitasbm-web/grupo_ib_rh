import { ARCHIVE_RETENTION_DAYS, DISC_DEADLINE_DAYS, PROTECTED_STATUSES } from '../constants/talentBank';

const DAY_MS = 24 * 60 * 60 * 1000;

const toMs = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
};

// Dias inteiros que faltam até `days` dias após `fromIso` (pode ser <= 0).
export function daysLeft(fromIso, days, now = Date.now()) {
  const from = toMs(fromIso);
  if (from === null) return null;
  return Math.ceil((from + days * DAY_MS - now) / DAY_MS);
}

// Protegido = nunca entra no "Limpar vencidos".
//  - status de processo ativo (entrevista/análise/contatado)
//  - alocado na Simulação por Unidade
//  - convertido em Freelancer
export function isProtected({ effectiveStatus, inBasket = false, isFreelancer = false }) {
  return PROTECTED_STATUSES.includes(effectiveStatus) || Boolean(inBasket) || Boolean(isFreelancer);
}

// Dias restantes para excluir um arquivado (null se não arquivado/sem data).
export function archiveDaysLeft({ effectiveStatus, archivedAt }, now = Date.now()) {
  if (effectiveStatus !== 'ARQUIVADO') return null;
  return daysLeft(archivedAt, ARCHIVE_RETENTION_DAYS, now);
}

// Dias restantes do prazo do DISC: só conta link REAL (não "manual"), sem
// resposta, e a partir de sent_at. Manual não conta: pode ter sido respondido
// fora do sistema.
export function discDaysLeft({ discToken, discAssessment }, now = Date.now()) {
  if (discAssessment || !discToken || discToken.consumed_at || discToken.is_manual) return null;
  return daysLeft(discToken.sent_at, DISC_DEADLINE_DAYS, now);
}

// Motivo do vencimento ('arquivado' | 'disc') ou null se não vencido/protegido.
export function expiryReason(candidate, now = Date.now()) {
  if (isProtected(candidate)) return null;
  const a = archiveDaysLeft(candidate, now);
  if (a !== null && a <= 0) return 'arquivado';
  const d = discDaysLeft(candidate, now);
  if (d !== null && d <= 0) return 'disc';
  return null;
}
