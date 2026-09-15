// Sinergia entre um candidato simulado e a equipe JÁ CONTRATADA que ocupa o
// mesmo quadrante (unidade × função) na Simulação por Unidade do Banco de
// Talentos. Complementa roleFit.js (candidato vs. perfil esperado da função)
// com candidato vs. composição real do time.
//
// Módulo puro (sem React/Supabase) para ser testado isoladamente.

import { DISC_FACTORS, DISC_PROFILE_INFO } from './disc';
import { candidateProfileVector } from './roleFit';

// members: [{ primary_profile, scores }] — resultados DISC (staff_disc_assessments)
// de quem já está no quadrante.
export function teamDiscComposition(members) {
  const counts = { D: 0, I: 0, S: 0, C: 0 };
  const vectorSum = { D: 0, I: 0, S: 0, C: 0 };
  let n = 0;

  for (const m of members || []) {
    if (!m?.primary_profile) continue;
    counts[m.primary_profile] = (counts[m.primary_profile] || 0) + 1;
    const v = candidateProfileVector(m.scores);
    for (const f of DISC_FACTORS) vectorSum[f] += v[f];
    n += 1;
  }

  const avgVector = n > 0
    ? Object.fromEntries(DISC_FACTORS.map((f) => [f, Math.round((vectorSum[f] / n) * 10) / 10]))
    : null;

  let dominantFactor = null;
  if (n > 0) {
    let max = -1;
    for (const f of DISC_FACTORS) {
      if (counts[f] > max) { max = counts[f]; dominantFactor = f; }
    }
    if (max === 0) dominantFactor = null;
  }

  return { count: n, counts, avgVector, dominantFactor };
}

// Nota de sinergia entre o candidato e a composição atual do quadrante.
// tone: 'empty' (sem gente ainda) | 'positive' (traz complementaridade) |
// 'caution' (reforça um padrão já dominante) | 'neutral'.
export function teamSynergyNote(assessment, composition) {
  if (!assessment?.primary_profile) return null;
  const primary = assessment.primary_profile;
  const primaryInfo = DISC_PROFILE_INFO[primary];

  if (!composition || composition.count === 0) {
    return {
      tone: 'empty',
      note: 'Ainda não há colaboradores com DISC registrado nesta função/unidade para comparar.',
    };
  }

  const share = composition.counts[primary] / composition.count;

  if (share >= 0.5) {
    return {
      tone: 'caution',
      note: `A equipe já tem ${composition.counts[primary]} de ${composition.count} pessoas com perfil ${primary} (${primaryInfo.short}) predominante — este candidato reforça o padrão; pode faltar diversidade de estilos.`,
    };
  }

  if (composition.counts[primary] === 0) {
    return {
      tone: 'positive',
      note: `A equipe não tem ninguém com perfil ${primary} (${primaryInfo.short}) predominante — este candidato traz um estilo complementar ao time.`,
    };
  }

  return {
    tone: 'neutral',
    note: `Perfil ${primary} (${primaryInfo.short}) já presente na equipe, mas sem predominar — combinação equilibrada.`,
  };
}
