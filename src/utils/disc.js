// Levantamento de Perfil Comportamental DISC (versão genérica).
//
// Formato clássico de escolha forçada: 24 grupos com 4 adjetivos cada, um de
// cada fator (D, I, S, C). Em cada grupo o candidato marca o adjetivo que MAIS
// o descreve e o que MENOS o descreve.
//
// Leitura dos resultados:
//  - adaptado (MAIS): como a pessoa acredita que precisa agir no ambiente;
//  - natural  (MENOS invertido): comportamento espontâneo, sob menos pressão;
//  - perfil primário/secundário: saldo MAIS − MENOS de cada fator.
//
// Este módulo é puro (sem React/Supabase) para ser testado isoladamente e
// reaproveitado pela página pública e pelo modal de resultado do gestor.

export const DISC_FACTORS = ['D', 'I', 'S', 'C'];

export const DISC_TOTAL_GROUPS = 24;
export const DISC_ESTIMATED_MINUTES = 10;

// Cada grupo: [{ word, factor }]. A ordem dos fatores varia de grupo para
// grupo para que o candidato não perceba um padrão posicional.
const RAW_GROUPS = [
  ['Decidido:D', 'Comunicativo:I', 'Paciente:S', 'Detalhista:C'],
  ['Entusiasmado:I', 'Preciso:C', 'Ousado:D', 'Leal:S'],
  ['Calmo:S', 'Direto:D', 'Analítico:C', 'Sociável:I'],
  ['Cuidadoso:C', 'Persuasivo:I', 'Tranquilo:S', 'Competitivo:D'],
  ['Otimista:I', 'Firme:D', 'Organizado:C', 'Colaborativo:S'],
  ['Prestativo:S', 'Disciplinado:C', 'Animado:I', 'Determinado:D'],
  ['Exigente:D', 'Compreensivo:S', 'Expressivo:I', 'Lógico:C'],
  ['Inspirador:I', 'Constante:S', 'Assertivo:D', 'Criterioso:C'],
  ['Metódico:C', 'Corajoso:D', 'Gentil:S', 'Espontâneo:I'],
  ['Autoconfiante:D', 'Perfeccionista:C', 'Carismático:I', 'Sereno:S'],
  ['Conciliador:S', 'Extrovertido:I', 'Objetivo:D', 'Cauteloso:C'],
  ['Convincente:I', 'Previsível:S', 'Sistemático:C', 'Enérgico:D'],
  ['Reservado:C', 'Popular:I', 'Pioneiro:D', 'Bom ouvinte:S'],
  ['Independente:D', 'Cooperativo:S', 'Rigoroso:C', 'Alegre:I'],
  ['Confiável:S', 'Aventureiro:D', 'Divertido:I', 'Exato:C'],
  ['Questionador:C', 'Empolgado:I', 'Tolerante:S', 'Impulsionador:D'],
  ['Falante:I', 'Controlado:C', 'Resoluto:D', 'Harmonioso:S'],
  ['Ponderado:S', 'Líder:D', 'Correto:C', 'Envolvente:I'],
  ['Vigoroso:D', 'Amigável:S', 'Contagiante:I', 'Diplomático:C'],
  ['Consistente:C', 'Arrojado:D', 'Afetuoso:I', 'Estável:S'],
  ['Motivador:I', 'Persistente:D', 'Planejador:C', 'Acolhedor:S'],
  ['Moderado:S', 'Criativo:I', 'Focado em resultados:D', 'Cumpridor de regras:C'],
  ['Prático:D', 'Precavido:C', 'Receptivo:S', 'Descontraído:I'],
  ['Minucioso:C', 'Paciente com pessoas:S', 'Destemido:D', 'Influente:I'],
];

export const DISC_GROUPS = RAW_GROUPS.map((group, index) => ({
  index,
  options: group.map((entry) => {
    const [word, factor] = entry.split(':');
    return { word, factor };
  }),
}));

export const DISC_PROFILE_INFO = {
  D: {
    label: 'Dominância',
    short: 'Executor',
    color: '#dc2626',
    badge: 'bg-red-100 text-red-700 border-red-200',
    description:
      'Orientado a resultados e desafios. Toma decisões rápidas, assume o controle e é direto na comunicação. ' +
      'Rende melhor com autonomia e metas claras; pode soar impaciente ou pouco atento a detalhes e sentimentos.',
    strengths: ['Tomada de decisão', 'Foco em metas', 'Iniciativa', 'Senso de urgência'],
    attention: ['Impaciência', 'Pouca escuta', 'Tendência a centralizar'],
  },
  I: {
    label: 'Influência',
    short: 'Comunicador',
    color: '#d97706',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    description:
      'Sociável, entusiasmado e persuasivo. Motiva pessoas, cria bom clima e se expressa com facilidade. ' +
      'Rende melhor com interação e reconhecimento; pode se dispersar ou evitar tarefas repetitivas e detalhadas.',
    strengths: ['Comunicação', 'Relacionamento', 'Otimismo', 'Poder de persuasão'],
    attention: ['Dispersão', 'Organização', 'Acompanhamento de prazos'],
  },
  S: {
    label: 'Estabilidade',
    short: 'Planejador',
    color: '#16a34a',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    description:
      'Paciente, leal e cooperativo. Valoriza segurança, rotina e harmonia na equipe; é ótimo ouvinte e mantém constância. ' +
      'Rende melhor em ambientes previsíveis; pode resistir a mudanças bruscas e evitar conflitos necessários.',
    strengths: ['Constância', 'Trabalho em equipe', 'Escuta', 'Lealdade'],
    attention: ['Resistência a mudanças', 'Dificuldade em dizer não', 'Ritmo sob pressão'],
  },
  C: {
    label: 'Conformidade',
    short: 'Analista',
    color: '#2563eb',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    description:
      'Analítico, preciso e criterioso. Preza qualidade, regras e dados antes de decidir. ' +
      'Rende melhor com processos claros e tempo para análise; pode ser perfeccionista e cauteloso em excesso.',
    strengths: ['Qualidade', 'Precisão', 'Pensamento lógico', 'Organização'],
    attention: ['Perfeccionismo', 'Lentidão para decidir', 'Autocrítica elevada'],
  },
};

const emptyCounts = () => ({ D: 0, I: 0, S: 0, C: 0 });

// answers: [{ g, most, least }] — most/least são os FATORES ('D'|'I'|'S'|'C')
// escolhidos no grupo g. Retorna false se as respostas estiverem incompletas
// ou inválidas.
export function validateDiscAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== DISC_TOTAL_GROUPS) return false;
  const seen = new Set();
  for (const a of answers) {
    if (!a || !Number.isInteger(a.g) || a.g < 0 || a.g >= DISC_TOTAL_GROUPS) return false;
    if (seen.has(a.g)) return false;
    seen.add(a.g);
    if (!DISC_FACTORS.includes(a.most) || !DISC_FACTORS.includes(a.least)) return false;
    if (a.most === a.least) return false;
  }
  return true;
}

export function computeDiscScores(answers) {
  if (!validateDiscAnswers(answers)) return null;

  const most = emptyCounts();
  const least = emptyCounts();
  for (const a of answers) {
    most[a.most] += 1;
    least[a.least] += 1;
  }

  const round = (n) => Math.round(n * 10) / 10;
  const adaptado = emptyCounts();
  const natural = emptyCounts();
  const saldo = emptyCounts();
  for (const f of DISC_FACTORS) {
    // MAIS soma 24 no total → percentual direto.
    adaptado[f] = round((most[f] / DISC_TOTAL_GROUPS) * 100);
    // MENOS invertido: cada fator pode "não ser rejeitado" até 24 vezes, total 72.
    natural[f] = round(((DISC_TOTAL_GROUPS - least[f]) / (DISC_TOTAL_GROUPS * 3)) * 100);
    saldo[f] = most[f] - least[f];
  }

  // Ordena pelo saldo; empate desempata por MAIS e depois pela ordem D-I-S-C.
  const ranked = [...DISC_FACTORS].sort((a, b) => {
    if (saldo[b] !== saldo[a]) return saldo[b] - saldo[a];
    if (most[b] !== most[a]) return most[b] - most[a];
    return DISC_FACTORS.indexOf(a) - DISC_FACTORS.indexOf(b);
  });

  const primary = ranked[0];
  // Só consideramos perfil secundário se o segundo fator tiver saldo positivo.
  const secondary = saldo[ranked[1]] > 0 ? ranked[1] : null;

  return { most, least, saldo, adaptado, natural, primary, secondary };
}

export function discProfileCode(primary, secondary) {
  if (!primary) return '';
  return secondary ? `${primary}${secondary}` : primary;
}
