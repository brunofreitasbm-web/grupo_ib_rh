// Cálculos puros do módulo Freelance (trabalhos pontuais): retenções legais de
// um pagamento a autônomo pessoa física e leitura de risco de habitualidade.
//
// Módulo SEM dependência de React/Supabase de propósito (mesmo padrão de
// cltCalculations.js), para ser testável e reaproveitável pelas abas e pelos
// geradores de documento.
//
// Os parâmetros fiscais vivem em ../config/freelanceConstants.js — este
// arquivo só aplica as regras. Ver MODULO_FREELANCE.md para a
// fundamentação legal de cada retenção.

import {
  INSS_CEILING,
  INSS_WORKER_RATE,
  INSS_WORKER_MAX,
  INSS_EMPLOYER_RATE,
  IRRF_TABLE,
  IRRF_REDUCTION,
  IRRF_DEPENDENT_DEDUCTION,
  ISS_DEFAULT_RATE,
  FREELANCE_RISK_LIMITS,
  FREELANCE_RISK_LEVELS,
  ENGAGED_JOB_STATUSES,
} from '../config/freelanceConstants';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const toNumber = (v) => {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// INSS retido do contribuinte individual: 11% sobre o valor do serviço,
// limitado a 11% do teto previdenciário (Lei 8.212/91, art. 30, §4º).
// `otherBaseInMonth` permite considerar outros pagamentos ao mesmo prestador
// na mesma competência, pois o teto é mensal e não por recibo.
export const computeInssWithheld = (gross, otherBaseInMonth = 0) => {
  const already = Math.min(toNumber(otherBaseInMonth), INSS_CEILING);
  const remainingBase = Math.max(INSS_CEILING - already, 0);
  const base = Math.min(toNumber(gross), remainingBase);
  return round2(Math.min(base * INSS_WORKER_RATE, INSS_WORKER_MAX));
};

// Contribuição patronal de 20% sobre a remuneração paga a contribuinte
// individual (Lei 8.212/91, art. 22, III). Não tem teto e NÃO é descontada do
// prestador: é custo da contratante.
export const computeInssEmployerCost = (gross) => round2(toNumber(gross) * INSS_EMPLOYER_RATE);

// IRRF pela tabela progressiva mensal, com o redutor legal vigente
// (isenção total até R$ 5.000 de rendimento tributável e redução decrescente
// até R$ 7.350 — Lei 15.270/2025).
export const computeIrrf = (gross, { inssWithheld = 0, dependents = 0 } = {}) => {
  const taxableIncome = toNumber(gross);
  if (taxableIncome <= 0) return 0;

  const base = Math.max(
    taxableIncome - toNumber(inssWithheld) - toNumber(dependents) * IRRF_DEPENDENT_DEDUCTION,
    0
  );
  const bracket = IRRF_TABLE.find((b) => base <= b.upTo) || IRRF_TABLE[IRRF_TABLE.length - 1];
  const tax = Math.max(base * bracket.rate - bracket.deduction, 0);

  // Redutor aplicado sobre o imposto apurado, em função do RENDIMENTO
  // tributável (e não da base): até o teto de isenção zera; na faixa parcial
  // reduz linearmente; acima, não há redução.
  let reduction = 0;
  if (taxableIncome <= IRRF_REDUCTION.fullExemptionUpTo) {
    reduction = tax;
  } else if (taxableIncome <= IRRF_REDUCTION.partialUpTo) {
    reduction = Math.max(IRRF_REDUCTION.base - IRRF_REDUCTION.factor * taxableIncome, 0);
  }

  return round2(Math.max(tax - reduction, 0));
};

export const computeIss = (gross, { issRate = ISS_DEFAULT_RATE, issWithheld = false } = {}) =>
  issWithheld ? round2(toNumber(gross) * toNumber(issRate)) : 0;

// Composição completa de um pagamento por trabalho pontual: o que o prestador
// recebe (líquido) e o que o trabalho custa para a empresa (bruto + patronal).
export const computeFreelancePayment = (job = {}, options = {}) => {
  const gross = toNumber(job.grossAmount);
  const {
    otherBaseInMonth = 0,
    dependents = 0,
    issRate = job.issRate ?? ISS_DEFAULT_RATE,
    issWithheld = job.issWithheld ?? false,
  } = options;

  const inssWithheld = computeInssWithheld(gross, otherBaseInMonth);
  const irrf = computeIrrf(gross, { inssWithheld, dependents });
  const iss = computeIss(gross, { issRate, issWithheld });
  const inssEmployerCost = computeInssEmployerCost(gross);

  const totalWithheld = round2(inssWithheld + irrf + iss);
  return {
    gross: round2(gross),
    inssWithheld,
    irrf,
    iss,
    issRate: toNumber(issRate),
    totalWithheld,
    net: round2(gross - totalWithheld),
    inssEmployerCost,
    employerTotalCost: round2(gross + inssEmployerCost),
  };
};

// ---------------------------------------------------------------------------
// Risco de habitualidade
// ---------------------------------------------------------------------------

const monthKey = (dateish) => {
  if (!dateish) return null;
  const d = new Date(typeof dateish === 'string' && dateish.length === 10 ? `${dateish}T00:00:00` : dateish);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthsBack = (reference, count) => {
  const base = reference ? new Date(reference) : new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
};

// Só trabalhos efetivamente engajados contam (rascunho e cancelado não geram
// habitualidade). A data considerada é a de execução (ou a prevista, quando a
// execução ainda não foi registrada).
const engagedJobs = (jobs = []) =>
  jobs.filter((j) => ENGAGED_JOB_STATUSES.includes(j.status));

const jobDate = (j) => j.executedDate || j.scheduledDate || j.createdAt;

// Retorna contadores + nível de risco + motivos, para um freelancer.
// `now` é injetável para teste determinístico.
export const assessHabitualityRisk = (jobs = [], { now = new Date(), limits = FREELANCE_RISK_LIMITS } = {}) => {
  const engaged = engagedJobs(jobs);
  const last12 = monthsBack(now, 12);
  const last12Set = new Set(last12);

  const byMonth = {};
  let jobsLast12 = 0;
  let amountLast12 = 0;

  engaged.forEach((j) => {
    const key = monthKey(jobDate(j));
    if (!key) return;
    byMonth[key] = (byMonth[key] || 0) + 1;
    if (last12Set.has(key)) {
      jobsLast12 += 1;
      amountLast12 += toNumber(j.grossAmount);
    }
  });

  const currentMonth = last12[0];
  const jobsThisMonth = byMonth[currentMonth] || 0;
  const maxJobsInAnyMonth = Object.values(byMonth).reduce((m, v) => Math.max(m, v), 0);

  // Meses consecutivos com engajamento, contados de trás para frente a partir
  // do mês corrente (uma lacuna encerra a sequência).
  let consecutiveMonths = 0;
  for (const key of last12) {
    if (byMonth[key]) consecutiveMonths += 1;
    else if (consecutiveMonths > 0 || key !== currentMonth) break;
  }

  const reasons = [];
  if (jobsThisMonth > limits.maxJobsPerMonth) {
    reasons.push(`${jobsThisMonth} trabalhos no mês corrente (política: até ${limits.maxJobsPerMonth}).`);
  }
  if (consecutiveMonths > limits.maxConsecutiveMonths) {
    reasons.push(`${consecutiveMonths} meses seguidos com trabalhos (política: até ${limits.maxConsecutiveMonths}).`);
  }
  if (jobsLast12 > limits.maxJobsPer12Months) {
    reasons.push(`${jobsLast12} trabalhos em 12 meses (política: até ${limits.maxJobsPer12Months}).`);
  }
  if (amountLast12 > limits.maxAmountPer12Months) {
    reasons.push(
      `${round2(amountLast12).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} pagos em 12 meses ` +
      `(política: até ${limits.maxAmountPer12Months.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`
    );
  }

  const warnings = [];
  if (!reasons.length) {
    if (jobsThisMonth === limits.maxJobsPerMonth) {
      reasons.length === 0 && warnings.push('Último trabalho permitido no mês pela política interna.');
    }
    if (consecutiveMonths === limits.maxConsecutiveMonths) {
      warnings.push(`${consecutiveMonths}º mês seguido com trabalhos — avalie migrar o vínculo.`);
    }
    if (jobsLast12 >= limits.maxJobsPer12Months - 2 && jobsLast12 <= limits.maxJobsPer12Months) {
      warnings.push(`${jobsLast12} trabalhos em 12 meses, perto do limite da política.`);
    }
    if (
      amountLast12 >= limits.maxAmountPer12Months * 0.8 &&
      amountLast12 <= limits.maxAmountPer12Months
    ) {
      warnings.push('Valor pago em 12 meses acima de 80% do limite da política.');
    }
  }

  const level = reasons.length
    ? FREELANCE_RISK_LEVELS.critico
    : warnings.length
      ? FREELANCE_RISK_LEVELS.atencao
      : FREELANCE_RISK_LEVELS.ok;

  return {
    level: level.key,
    levelLabel: level.label,
    badge: level.badge,
    reasons,
    warnings,
    jobsThisMonth,
    maxJobsInAnyMonth,
    consecutiveMonths,
    jobsLast12,
    amountLast12: round2(amountLast12),
    engagedCount: engaged.length,
  };
};

// Pendências de formalidade de um cadastro/OS: lista de rótulos faltantes.
// Recebe os pares [campo, rótulo] de freelanceConstants para não duplicar a
// definição do que é obrigatório.
export const missingFields = (entity = {}, requiredPairs = []) =>
  requiredPairs
    .filter(([field]) => {
      const v = entity[field];
      if (typeof v === 'number') return !Number.isFinite(v) || v <= 0;
      return !String(v ?? '').trim();
    })
    .map(([, label]) => label);

export const formatBRL = (value) =>
  (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
