// Perfis comportamentais esperados por FUNÇÃO, descritos em termos DISC.
//
// Usados pela subpágina "Simulação por Unidade" do Banco de Talentos para
// medir o encaixe de um candidato (que já concluiu o Levantamento de Perfil)
// com a função que ocuparia. A conta fica em src/utils/roleFit.js.
//
// Convenções:
//  - ideal: distribuição-alvo D/I/S/C (soma 100). Mesma escala de
//    scores.natural / scores.adaptado gerados por computeDiscScores.
//  - preferredPrimary: perfis primários desejáveis (pequeno bônus).
//  - cautionPrimary: perfis primários que pedem atenção (teto no score + nota;
//    NÃO é veto — a decisão continua sendo do gestor).
//  - traits: cada característica aponta o(s) fator(es) DISC que a sustentam,
//    para o vínculo ficar explícito na tela.

export const ROLE_PROFILES = [
  {
    id: 'operador_recepcao',
    label: 'Operador/Recepção',
    short: 'Recepção',
    expectedCode: 'I/S',
    ideal: { D: 20, I: 40, S: 28, C: 12 },
    preferredPrimary: ['I', 'S'],
    cautionPrimary: ['C'],
    summary:
      'Atendimento ao público, venda e venda adicional, com acolhimento das famílias. ' +
      'Perfil Comunicador (I) sustentado por Estabilidade (S) e um toque de Dominância (D) para fechar vendas.',
    traits: [
      { label: 'Atendimento ao público, simpatia e energia', factors: ['I'], why: 'Sociabilidade e entusiasmo criam bom clima na chegada das famílias.' },
      { label: 'Venda e venda adicional (pacotes/produtos)', factors: ['I', 'D'], why: 'Persuasão (I) com iniciativa e foco em resultado (D), sem ser invasivo.' },
      { label: 'Acolhimento de pais e crianças', factors: ['S'], why: 'Escuta, paciência e calma com famílias ansiosas.' },
      { label: 'Resiliência a fluxo intenso e reclamações', factors: ['S', 'D'], why: 'Constância sob pressão (S) e firmeza para resolver na hora (D).' },
      { label: 'Organização de caixa, agenda e cadastros', factors: ['C'], why: 'Precisão e cumprimento de processo, em dose que não trave o atendimento.' },
      { label: 'Trabalho em equipe e comunicação com terapeutas', factors: ['S', 'I'], why: 'Cooperação e clareza ao passar recados.' },
      { label: 'Proatividade em fila/espera', factors: ['D'], why: 'Senso de urgência para não deixar cliente esperando.' },
    ],
    attention: [
      'C muito alto tende a rigidez no balcão.',
      'D muito alto pode soar impaciente com crianças e pais.',
    ],
  },
  {
    id: 'profissional_pj',
    label: 'Profissional PJ',
    short: 'Profissional PJ',
    expectedCode: 'S/C',
    ideal: { D: 10, I: 22, S: 40, C: 28 },
    preferredPrimary: ['S', 'C'],
    cautionPrimary: ['D'],
    summary:
      'Atendimento a crianças com TEA/TDAH: paciência, cuidado, acolhimento e criatividade. ' +
      'Perfil Planejador (S) com Analista (C) para protocolos, e um toque de Influência (I) para a ludicidade.',
    traits: [
      { label: 'Paciência com comportamentos desafiadores', factors: ['S'], why: 'Tolerância, constância e ritmo previsível.' },
      { label: 'Cuidado e acolhimento da criança e da família', factors: ['S'], why: 'Empatia, escuta e vínculo seguro.' },
      { label: 'Criatividade e ludicidade nas sessões', factors: ['I'], why: 'Espontaneidade e adaptação de brincadeiras.' },
      { label: 'Registro fiel de dados e protocolos (ABA, evoluções)', factors: ['C'], why: 'Precisão, disciplina e aderência a protocolo.' },
      { label: 'Consistência na rotina e previsibilidade', factors: ['S', 'C'], why: 'Crianças com TEA respondem a rotina estável e regras claras.' },
      { label: 'Comunicação clara com pais e equipe multidisciplinar', factors: ['I', 'C'], why: 'Traduzir dados técnicos com leveza.' },
      { label: 'Autocontrole emocional e baixa reatividade', factors: ['S'], why: 'Não escalar crises; manejo calmo.' },
      { label: 'Autonomia técnica e decisão em crise (dose baixa)', factors: ['D'], why: 'Agir com firmeza quando necessário, sem dominar a relação.' },
    ],
    attention: [
      'D primário pode gerar impaciência e diretividade excessiva.',
      'I muito alto pode dispersar do protocolo.',
    ],
  },
  {
    id: 'estagiario',
    label: 'Estagiário',
    short: 'Estagiário',
    expectedCode: 'S/I',
    ideal: { D: 10, I: 30, S: 40, C: 20 },
    preferredPrimary: ['S', 'I'],
    cautionPrimary: ['D'],
    summary:
      'Apoio ao atendimento de crianças com TEA/TDAH: paciência, cuidado, acolhimento e criatividade. ' +
      'Perfil Planejador (S) com Comunicador (I), e um toque de Conformidade (C) para seguir orientações.',
    traits: [
      { label: 'Paciência e cuidado com a criança', factors: ['S'], why: 'Base do perfil; tolerância a repetição.' },
      { label: 'Acolhimento e vínculo afetivo', factors: ['S', 'I'], why: 'Calor humano e afetuosidade.' },
      { label: 'Criatividade e energia lúdica', factors: ['I'], why: 'Brincar, motivar e engajar a criança.' },
      { label: 'Abertura para aprender e receber feedback', factors: ['S', 'C'], why: 'Humildade para seguir a orientação do supervisor.' },
      { label: 'Seguir instruções e protocolos com fidelidade', factors: ['C'], why: 'Disciplina no registro e na aplicação.' },
      { label: 'Colaboração com o profissional responsável', factors: ['S'], why: 'Cooperativo, sem disputar protagonismo.' },
      { label: 'Pontualidade e constância na frequência', factors: ['S', 'C'], why: 'Confiabilidade na rotina de estágio.' },
      { label: 'Iniciativa moderada (dose baixa)', factors: ['D'], why: 'Antecipar necessidades sem tomar decisões clínicas.' },
    ],
    attention: [
      'D primário tende a autonomia excessiva para a fase de estágio.',
      'C muito alto pode inibir a ludicidade.',
    ],
  },
];

export const ROLE_BY_ID = Object.fromEntries(ROLE_PROFILES.map((r) => [r.id, r]));

export const roleLabel = (roleId) => ROLE_BY_ID[roleId]?.label || roleId;

// Unidades que aparecem como "baskets" na simulação, na ordem de exibição.
// Os dados (nome, accent, endereço) vêm de BRANDING.kioskUnits; shortLabel
// é o rótulo curto usado no quadro.
export const SIMULATION_UNITS = [
  { id: 'faca-amigos-grao-para', shortLabel: 'FaçaAmigos Grão Pará' },
  { id: 'faca-amigos-parque-shopping', shortLabel: 'FaçaAmigos Parque Shopping' },
  { id: 'clinica-a', shortLabel: 'FaçaAmigos Clínica (Umarizal)' },
];

// Classes Tailwind por accent — escritas por extenso para o scanner JIT.
export const UNIT_ACCENT_CLASSES = {
  emerald: { border: 'border-emerald-300', header: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  indigo: { border: 'border-indigo-300', header: 'bg-indigo-50 text-indigo-800', dot: 'bg-indigo-500' },
  amber: { border: 'border-amber-300', header: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  rose: { border: 'border-rose-300', header: 'bg-rose-50 text-rose-800', dot: 'bg-rose-500' },
};
