// Constantes do módulo Funcionários CLT: tipos de contrato, jornadas padrão,
// checklist admissional, tipos de ocorrência/exame/encerramento e documentos
// gerados. Mantidas fora de cltCalculations.js (puro) e cltDocuments.js
// (templates) para serem reaproveitadas por ambos e pelas abas de UI.

export const CONTRACT_TYPES = [
  { key: 'indeterminado', label: 'Prazo indeterminado' },
  { key: 'experiencia', label: 'Contrato de experiência' },
  { key: 'tempo_determinado', label: 'Prazo determinado' },
  { key: 'intermitente', label: 'Intermitente' },
  { key: 'aprendiz', label: 'Aprendiz' },
];

// Presets de experiência: [dias 1º período, dias 2º período]. Soma nunca
// pode exceder 90 dias (art. 445, parágrafo único, CLT); só uma prorrogação.
export const EXPERIENCE_PRESETS = [
  { key: '30+60', label: '30 + 60 dias', firstDays: 30, secondDays: 60 },
  { key: '45+45', label: '45 + 45 dias', firstDays: 45, secondDays: 45 },
  { key: '90', label: '90 dias (sem prorrogação)', firstDays: 90, secondDays: 0 },
];

// Presets de jornada semanal. `days` é indexado por dia da semana (0=domingo
// ... 6=sábado). 12x36 não usa `days`: usa `cycleAnchorDate` em cltCalculations.
export const SCHEDULE_PRESETS = [
  {
    key: '44h_5x2', label: '44h — Seg a Sex 8h48 (5x2)', weeklyHours: 44,
    days: {
      1: { start: '08:00', end: '18:00', breakMinutes: 72 },
      2: { start: '08:00', end: '18:00', breakMinutes: 72 },
      3: { start: '08:00', end: '18:00', breakMinutes: 72 },
      4: { start: '08:00', end: '18:00', breakMinutes: 72 },
      5: { start: '08:00', end: '18:00', breakMinutes: 72 },
    },
  },
  {
    key: '44h_6x1', label: '44h — Seg a Sáb (6x1)', weeklyHours: 44,
    days: {
      1: { start: '08:00', end: '17:20', breakMinutes: 60 },
      2: { start: '08:00', end: '17:20', breakMinutes: 60 },
      3: { start: '08:00', end: '17:20', breakMinutes: 60 },
      4: { start: '08:00', end: '17:20', breakMinutes: 60 },
      5: { start: '08:00', end: '17:20', breakMinutes: 60 },
      6: { start: '08:00', end: '13:20', breakMinutes: 0 },
    },
  },
  {
    key: '40h', label: '40h — Seg a Sex 8h', weeklyHours: 40,
    days: {
      1: { start: '08:00', end: '17:00', breakMinutes: 60 },
      2: { start: '08:00', end: '17:00', breakMinutes: 60 },
      3: { start: '08:00', end: '17:00', breakMinutes: 60 },
      4: { start: '08:00', end: '17:00', breakMinutes: 60 },
      5: { start: '08:00', end: '17:00', breakMinutes: 60 },
    },
  },
  {
    key: '36h', label: '36h — Seg a Sex 7h12', weeklyHours: 36,
    days: {
      1: { start: '08:00', end: '16:12', breakMinutes: 60 },
      2: { start: '08:00', end: '16:12', breakMinutes: 60 },
      3: { start: '08:00', end: '16:12', breakMinutes: 60 },
      4: { start: '08:00', end: '16:12', breakMinutes: 60 },
      5: { start: '08:00', end: '16:12', breakMinutes: 60 },
    },
  },
  {
    key: '30h', label: '30h — Seg a Sex 6h', weeklyHours: 30,
    days: {
      1: { start: '08:00', end: '14:00', breakMinutes: 0 },
      2: { start: '08:00', end: '14:00', breakMinutes: 0 },
      3: { start: '08:00', end: '14:00', breakMinutes: 0 },
      4: { start: '08:00', end: '14:00', breakMinutes: 0 },
      5: { start: '08:00', end: '14:00', breakMinutes: 0 },
    },
  },
  {
    key: '12x36', label: '12x36 (plantão)', weeklyHours: 42, is12x36: true,
    shift: { start: '07:00', end: '19:00', breakMinutes: 60 },
  },
  { key: 'custom', label: 'Personalizada', weeklyHours: 44, days: {} },
];

export const EMPLOYEE_STATUS = [
  { key: 'ativo', label: 'Ativo', color: 'emerald' },
  { key: 'afastado', label: 'Afastado', color: 'amber' },
  { key: 'ferias', label: 'Em férias', color: 'sky' },
  { key: 'aviso_previo', label: 'Em aviso prévio', color: 'orange' },
  { key: 'desligado', label: 'Desligado', color: 'slate' },
];

export const TIME_RECORD_TYPES = [
  { key: 'entrada', label: 'Entrada' },
  { key: 'intervalo_inicio', label: 'Início do intervalo' },
  { key: 'intervalo_fim', label: 'Fim do intervalo' },
  { key: 'saida', label: 'Saída' },
];

// Checklist de documentos admissionais. `required(emp, dependents)` decide se
// o documento é obrigatório para aquele funcionário específico.
export const ADMISSIONAL_DOCUMENTS = [
  { key: 'rg_cnh', label: 'RG ou CNH', required: () => true },
  { key: 'cpf', label: 'CPF', required: () => true },
  { key: 'ctps_digital', label: 'CTPS Digital (impressão/print)', required: () => true },
  { key: 'pis', label: 'PIS/PASEP/NIT', required: () => true },
  { key: 'comprovante_residencia', label: 'Comprovante de Residência', required: () => true },
  { key: 'titulo_eleitor', label: 'Título de Eleitor', required: () => true },
  {
    key: 'certificado_reservista', label: 'Certificado de Reservista',
    required: (emp) => emp?.sex === 'M' && emp?.birthdate && ageFromBirthdate(emp.birthdate) >= 18 && ageFromBirthdate(emp.birthdate) <= 45,
  },
  { key: 'certidao_nascimento_casamento', label: 'Certidão de Nascimento ou Casamento', required: () => true },
  {
    key: 'certidao_cpf_dependentes', label: 'Certidão de Nascimento e CPF dos dependentes',
    required: (emp, dependents) => (dependents?.length || 0) > 0,
  },
  {
    key: 'cartao_vacinacao_filhos', label: 'Cartão de Vacinação (filhos menores de 7 anos)',
    required: (emp, dependents) => (dependents || []).some((d) => d.birthdate && ageFromBirthdate(d.birthdate) < 7),
  },
  { key: 'comprovante_escolaridade', label: 'Comprovante de Escolaridade', required: () => true },
  { key: 'foto_3x4', label: 'Foto 3x4', required: () => true },
  { key: 'aso_admissional', label: 'ASO Admissional', required: () => true },
  { key: 'contrato_assinado', label: 'Contrato de Trabalho assinado', required: () => true },
  { key: 'opcao_vt', label: 'Declaração de Opção/Renúncia de Vale-Transporte', required: () => true },
  { key: 'acordo_compensacao', label: 'Acordo de Compensação/Banco de Horas', required: (emp) => !!emp?.hoursBank },
  { key: 'termo_epi', label: 'Termo de Recebimento de EPI/Uniforme', required: () => false },
  { key: 'ficha_registro', label: 'Ficha de Registro de Empregado (art. 41 CLT)', required: () => true },
  { key: 'declaracao_dependentes_ir', label: 'Declaração de Dependentes para IR', required: () => true },
  { key: 'termo_biometria_lgpd', label: 'Termo de Consentimento — Biometria/LGPD', required: () => true },
  { key: 'termo_confidencialidade', label: 'Termo de Confidencialidade', required: () => false },
];

function ageFromBirthdate(birthdate, at = new Date()) {
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return 0;
  let age = at.getFullYear() - b.getFullYear();
  const m = at.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) age--;
  return age;
}

// Ausências legais do art. 473 CLT (dias corridos, salvo indicação contrária).
export const ART_473_LEAVES = [
  { key: 'casamento', label: 'Casamento', days: 3 },
  { key: 'obito_familiar', label: 'Falecimento de cônjuge/ascendente/descendente/irmão/dependente', days: 2 },
  { key: 'nascimento_filho', label: 'Nascimento de filho (licença-paternidade)', days: 5 },
  { key: 'doacao_sangue', label: 'Doação de sangue comprovada', days: 1 },
  { key: 'alistamento_eleitoral', label: 'Alistamento eleitoral', days: 2 },
  { key: 'servico_militar', label: 'Serviço militar (Lei do Serviço Militar)', days: 0 },
  { key: 'vestibular', label: 'Prova de vestibular', days: 0 },
  { key: 'comparecimento_juizo', label: 'Comparecimento a juízo', days: 0 },
  { key: 'representacao_sindical', label: 'Atividade de representação sindical', days: 0 },
  { key: 'exames_preventivos_cancer', label: 'Exames preventivos de câncer (1 dia/ano)', days: 1 },
  { key: 'acompanhamento_filho_consulta', label: 'Acompanhamento de filho até 6 anos em consulta médica (até 2 dias/ano)', days: 1 },
];

export const OCCURRENCE_TYPES = [
  { key: 'falta_injustificada', label: 'Falta injustificada', affectsDsr: true, affectsVacation: true, needsDoc: false },
  { key: 'falta_justificada_473', label: 'Falta justificada (art. 473)', affectsDsr: false, affectsVacation: false, needsDoc: true },
  { key: 'atestado', label: 'Atestado médico/odontológico', affectsDsr: false, affectsVacation: false, needsDoc: true, maxDays: 15 },
  { key: 'advertencia_verbal', label: 'Advertência verbal', affectsDsr: false, affectsVacation: false, needsDoc: false },
  { key: 'advertencia_escrita', label: 'Advertência escrita', affectsDsr: false, affectsVacation: false, needsDoc: true },
  { key: 'suspensao', label: 'Suspensão disciplinar (art. 474, máx. 30 dias)', affectsDsr: true, affectsVacation: true, needsDoc: true, maxDays: 30 },
  { key: 'afastamento_inss', label: 'Afastamento previdenciário (INSS, > 15 dias)', affectsDsr: false, affectsVacation: false, needsDoc: true },
  { key: 'licenca_maternidade', label: 'Licença-maternidade (120 dias)', affectsDsr: false, affectsVacation: false, needsDoc: true, maxDays: 120 },
  { key: 'licenca_paternidade', label: 'Licença-paternidade (5 dias)', affectsDsr: false, affectsVacation: false, needsDoc: true, maxDays: 5 },
  { key: 'acidente_trabalho', label: 'Acidente de trabalho (CAT)', affectsDsr: false, affectsVacation: false, needsDoc: true },
  { key: 'outros', label: 'Outra ocorrência', affectsDsr: false, affectsVacation: false, needsDoc: false },
];

// Validade padrão do ASO por grau de risco (NR-7/PCMSO). Editável por exame.
export const EXAM_TYPES = [
  { key: 'admissional', label: 'Admissional' },
  { key: 'periodico', label: 'Periódico' },
  { key: 'retorno', label: 'Retorno ao trabalho (após ≥30 dias afastado)' },
  { key: 'mudanca_risco', label: 'Mudança de função/risco' },
  { key: 'demissional', label: 'Demissional' },
];

export const RISK_GRADE_PERIODIC_MONTHS = {
  1: (age) => (age < 45 ? 24 : 12),
  2: (age) => (age < 45 ? 24 : 12),
  3: () => 12,
  4: () => 12,
};

// Demissional dispensado se o último exame (admissional/periódico/mudança de
// risco) tiver menos que este prazo em dias (art. 168 §5 CLT).
export const DEMISSIONAL_EXEMPTION_DAYS = { low: 135, high: 90 }; // low = risco 1-2, high = risco 3-4

export const TERMINATION_TYPES = [
  { key: 'sem_justa_causa', label: 'Dispensa sem justa causa' },
  { key: 'pedido_demissao', label: 'Pedido de demissão' },
  { key: 'justa_causa', label: 'Dispensa por justa causa (art. 482)' },
  { key: 'acordo_484a', label: 'Acordo entre as partes (art. 484-A)' },
  { key: 'termino_contrato', label: 'Término de contrato a prazo/experiência' },
  { key: 'falecimento', label: 'Falecimento do(a) empregado(a)' },
];

export const NOTICE_TYPES = [
  { key: 'trabalhado', label: 'Trabalhado' },
  { key: 'indenizado', label: 'Indenizado' },
  { key: 'dispensado', label: 'Dispensado (pedido de demissão)' },
  { key: 'nao_aplicavel', label: 'Não aplicável' },
];

export const RESCISION_CHECKLIST = [
  { key: 'comunicacao_aviso', label: 'Comunicação de aviso prévio entregue' },
  { key: 'exame_demissional', label: 'Exame médico demissional realizado' },
  { key: 'devolucao_equipamentos', label: 'Devolução de equipamentos/EPI/uniforme' },
  { key: 'baixa_ctps_esocial', label: 'Baixa na CTPS digital / evento de desligamento no eSocial' },
  { key: 'trct_contador', label: 'TRCT encaminhado à contabilidade' },
  { key: 'guias_fgts_seguro', label: 'Guias de FGTS/seguro-desemprego providenciadas (se sem justa causa)' },
  { key: 'pagamento_10_dias', label: 'Pagamento das verbas rescisórias em até 10 dias (art. 477 §6)' },
  { key: 'homologacao_sindical', label: 'Homologação sindical (se exigida pela CCT)' },
];

export const GENERATED_DOCUMENT_TYPES = [
  { key: 'contrato_experiencia', label: 'Contrato de Experiência' },
  { key: 'prorrogacao_experiencia', label: 'Termo de Prorrogação de Experiência' },
  { key: 'contrato_indeterminado', label: 'Contrato por Prazo Indeterminado' },
  { key: 'ficha_registro', label: 'Ficha de Registro de Empregado (art. 41)' },
  { key: 'acordo_compensacao', label: 'Acordo Individual de Compensação de Horas' },
  { key: 'acordo_banco_horas', label: 'Acordo de Banco de Horas (art. 59 §5)' },
  { key: 'opcao_vt', label: 'Declaração de Opção de Vale-Transporte' },
  { key: 'declaracao_dependentes_ir', label: 'Declaração de Dependentes para IR' },
  { key: 'termo_biometria_lgpd', label: 'Termo de Consentimento — Biometria/LGPD' },
  { key: 'termo_equipamentos', label: 'Termo de Responsabilidade de Equipamentos' },
  { key: 'termo_confidencialidade', label: 'Termo de Confidencialidade' },
  { key: 'aviso_ferias', label: 'Aviso de Férias' },
  { key: 'recibo_ferias', label: 'Recibo de Férias' },
  { key: 'comunicacao_abono', label: 'Comunicação de Abono Pecuniário' },
  { key: 'advertencia', label: 'Advertência Escrita' },
  { key: 'suspensao', label: 'Suspensão Disciplinar' },
  { key: 'aviso_previo_empregador', label: 'Comunicação de Aviso Prévio (empregador)' },
  { key: 'pedido_demissao', label: 'Pedido de Demissão' },
  { key: 'encaminhamento_demissional', label: 'Encaminhamento para Exame Demissional' },
  { key: 'checklist_rescisorio', label: 'Checklist Rescisório' },
  { key: 'espelho_ponto', label: 'Espelho de Ponto Mensal' },
  { key: 'declaracao_vinculo', label: 'Declaração de Vínculo Empregatício' },
  { key: 'apuracao_mensal', label: 'Apuração Mensal de Eventos (apoio ao contador)' },
];
