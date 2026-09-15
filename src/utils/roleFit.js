// Encaixe (fit) entre o resultado DISC de um candidato e o perfil esperado de
// uma função (src/config/roleProfiles.js).
//
// Módulo puro (sem React/Supabase) para ser testado isoladamente.
//
// Método:
//  1. Perfil consolidado do candidato = média de natural (espontâneo) e
//     adaptado (percebido) por fator. Ambos já somam 100 → o consolidado também.
//  2. Distância L1 até o ideal da função: Σ|cand − ideal|. Como as duas
//     distribuições somam 100, o máximo teórico é 200 → score = 100 − dist/2.
//  3. Bônus de +5 se o perfil primário está entre os preferidos; teto de 65 e
//     nota se está entre os de atenção (não é veto).
//  4. Nível: alta ≥ 75, média 50–74, baixa < 50.

import { DISC_FACTORS, DISC_PROFILE_INFO } from './disc';
import { ROLE_PROFILES } from '../config/roleProfiles';

export const FIT_LEVELS = {
  alta: { label: 'Alta compatibilidade', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', color: '#16a34a' },
  media: { label: 'Compatível com ressalvas', badge: 'bg-amber-100 text-amber-700 border-amber-200', color: '#d97706' },
  baixa: { label: 'Baixa compatibilidade', badge: 'bg-red-100 text-red-700 border-red-200', color: '#dc2626' },
};

export const PREFERRED_BONUS = 5;
export const CAUTION_CAP = 65;
export const TRAIT_TOLERANCE = 8;

const round1 = (n) => Math.round(n * 10) / 10;

// Vetor consolidado D/I/S/C a partir de scores { natural, adaptado }.
// Aceita ausência de um dos lados (usa o outro) — defensivo para dados antigos.
export function candidateProfileVector(scores) {
  const out = {};
  for (const f of DISC_FACTORS) {
    const nat = Number(scores?.natural?.[f]);
    const adp = Number(scores?.adaptado?.[f]);
    const hasNat = Number.isFinite(nat);
    const hasAdp = Number.isFinite(adp);
    if (hasNat && hasAdp) out[f] = round1((nat + adp) / 2);
    else if (hasNat) out[f] = round1(nat);
    else if (hasAdp) out[f] = round1(adp);
    else out[f] = 0;
  }
  return out;
}

export function fitLevel(score) {
  if (score >= 75) return 'alta';
  if (score >= 50) return 'media';
  return 'baixa';
}

// assessment: linha de talent_disc_assessments ({ scores, primary_profile, secondary_profile }).
// role: item de ROLE_PROFILES.
export function computeRoleFit(assessment, role) {
  if (!assessment || !role) return null;

  const vector = candidateProfileVector(assessment.scores);
  const diffs = {};
  let distance = 0;
  for (const f of DISC_FACTORS) {
    diffs[f] = round1(vector[f] - role.ideal[f]);
    distance += Math.abs(vector[f] - role.ideal[f]);
  }

  let score = 100 - distance / 2;
  const notes = [];
  const primary = assessment.primary_profile;
  const primaryInfo = primary ? DISC_PROFILE_INFO[primary] : null;

  if (primary && role.preferredPrimary.includes(primary)) {
    score += PREFERRED_BONUS;
    notes.push(`Perfil primário ${primary} (${primaryInfo.short}) é um dos preferidos para ${role.label}.`);
  }
  if (primary && role.cautionPrimary.includes(primary)) {
    score = Math.min(score, CAUTION_CAP);
    notes.push(`Perfil primário ${primary} (${primaryInfo.short}) pede atenção nesta função — avaliar em entrevista.`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  // Uma característica conta como atendida se TODOS os fatores que a sustentam
  // estão no mínimo próximos (tolerância) do alvo.
  const matchedTraits = [];
  const cautionTraits = [];
  for (const trait of role.traits) {
    const ok = trait.factors.every((f) => vector[f] >= role.ideal[f] - TRAIT_TOLERANCE);
    (ok ? matchedTraits : cautionTraits).push(trait);
  }

  return {
    score,
    level: fitLevel(score),
    vector,
    diffs,
    matchedTraits,
    cautionTraits,
    notes,
  };
}

// Melhor função para o candidato: { role, fit } ou null.
export function bestRoleFor(assessment, roles = ROLE_PROFILES) {
  if (!assessment) return null;
  let best = null;
  for (const role of roles) {
    const fit = computeRoleFit(assessment, role);
    if (fit && (!best || fit.score > best.fit.score)) best = { role, fit };
  }
  return best;
}
