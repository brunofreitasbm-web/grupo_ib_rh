// Constantes do módulo Freelance (trabalhos pontuais) — quarta categoria de
// contratação do hub, ao lado de Estagiários (Lei 11.788/2008), Profissionais
// PJ (arts. 593+ CC / art. 442-B CLT) e Funcionários CLT.
//
// ENQUADRAMENTO JURÍDICO ADOTADO (ver MODULO_FREELANCE.md para a
// fundamentação completa):
//
//   Freelance = TRABALHADOR AUTÔNOMO PESSOA FÍSICA contratado por ESCOPO
//   (obra/serviço certo e determinado), por prazo e preço fechados, sem
//   habitualidade, sem subordinação, sem pessoalidade e sem exclusividade.
//   Base: arts. 593 a 609 do Código Civil (prestação de serviço) e arts. 610+
//   (empreitada, quando há resultado/obra certa); art. 442-B da CLT, que
//   afasta a qualidade de empregado do autônomo contratado com observância
//   das formalidades legais.
//
// Cada trabalho é uma ORDEM DE SERVIÇO (OS) própria: é a OS, e não um
// contrato guarda-chuva de prazo indeterminado, que sustenta a natureza
// pontual da contratação. Pagamento por RPA, com as retenções legais, e
// escrituração no eSocial (S-2300 + S-1200) — ver FREELANCE_FISCAL_CHECKLIST.
//
// O módulo NÃO tem quiosque, PIN, ponto, escala, banco de horas nem
// biometria — por decisão de projeto, e não por falta de implementação: são
// exatamente esses artefatos que alimentam tese de subordinação/jornada em
// reclamatória. O controle é de ENTREGA (aceite do escopo), não de tempo.

// ---------------------------------------------------------------------------
// Ciclo de vida da Ordem de Serviço
// ---------------------------------------------------------------------------
// rascunho  → OS sendo montada pelo RH/gestor (ainda não enviada).
// proposta  → enviada ao freelancer; aguarda aceite do escopo e do preço.
// aceita    → escopo e preço aceitos; execução autorizada.
// entregue  → freelancer declarou a entrega; aguarda aceite/conferência.
// aceito    → entrega conferida e aceita pela contratante (gera direito ao preço).
// pago      → RPA emitido e pagamento liquidado.
// cancelada → cancelada/recusada antes da execução.
export const FREELANCE_JOB_STATUS = [
  { key: 'rascunho', label: 'Rascunho', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  { key: 'proposta', label: 'Proposta enviada', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'aceita', label: 'Aceita pelo freelancer', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { key: 'entregue', label: 'Entrega declarada', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'aceito', label: 'Entrega aceita', badge: 'bg-teal-100 text-teal-700 border-teal-200' },
  { key: 'pago', label: 'Pago (RPA emitido)', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'cancelada', label: 'Cancelada', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
];

export const freelanceJobStatusMeta = (key) =>
  FREELANCE_JOB_STATUS.find((s) => s.key === key) || FREELANCE_JOB_STATUS[0];

// Status em que o trabalho já conta como "engajamento" para fins de
// habitualidade (o risco nasce da execução, não do rascunho/cancelamento).
export const ENGAGED_JOB_STATUSES = ['aceita', 'entregue', 'aceito', 'pago'];

// ---------------------------------------------------------------------------
// Naturezas de trabalho pontual aceitas no HUB FaçaAmigos
// ---------------------------------------------------------------------------
// Deliberadamente restritas a serviços de RESULTADO, delimitáveis em escopo e
// prazo. Atividade que é o núcleo permanente da operação (recreação diária,
// recepção, terapia continuada) NÃO entra aqui: vira CLT, intermitente ou PJ.
export const FREELANCE_SERVICE_TYPES = [
  { key: 'evento', label: 'Evento / festa pontual', example: 'Recreação de uma festa específica, com data e duração definidas.' },
  { key: 'oficina', label: 'Oficina / workshop', example: 'Oficina temática única, com material e roteiro próprios.' },
  { key: 'palestra', label: 'Palestra / formação', example: 'Palestra para famílias ou capacitação pontual da equipe.' },
  { key: 'projeto_tecnico', label: 'Projeto técnico / laudo', example: 'Parecer, laudo, projeto ou material técnico entregue como obra.' },
  { key: 'producao_conteudo', label: 'Produção de conteúdo / mídia', example: 'Ensaio fotográfico, vídeo, design de campanha.' },
  { key: 'manutencao', label: 'Manutenção / serviço técnico', example: 'Reparo, montagem ou instalação com resultado certo.' },
  { key: 'cobertura_pontual', label: 'Cobertura pontual de demanda extraordinária', example: 'Demanda sazonal não recorrente; exige justificativa.' },
  { key: 'outro', label: 'Outro (descrever no escopo)', example: '' },
];

// ---------------------------------------------------------------------------
// Blindagem: limites de habitualidade
// ---------------------------------------------------------------------------
// Não existe número legal de "quantas vezes" um autônomo pode ser contratado
// sem virar empregado — habitualidade é analisada no caso concreto (art. 3º da
// CLT). Os limites abaixo são POLÍTICA INTERNA, conservadora, para que o
// sistema avise antes de o padrão de contratação virar prova contra a empresa.
export const FREELANCE_RISK_LIMITS = {
  // Trabalhos por mês, por freelancer, na mesma unidade.
  maxJobsPerMonth: 4,
  // Meses seguidos com pelo menos um trabalho.
  maxConsecutiveMonths: 3,
  // Trabalhos nos últimos 12 meses.
  maxJobsPer12Months: 12,
  // Valor pago nos últimos 12 meses (R$). Acima disso, o freelancer tende a
  // ter na contratante sua principal fonte de renda — fator de dependência
  // econômica muito usado em reclamatória.
  maxAmountPer12Months: 30000,
};

export const FREELANCE_RISK_LEVELS = {
  ok: { key: 'ok', label: 'Dentro da política', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  atencao: { key: 'atencao', label: 'Atenção', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  critico: { key: 'critico', label: 'Risco de vínculo', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
};

// ---------------------------------------------------------------------------
// Parâmetros fiscais (competência 2026)
// ---------------------------------------------------------------------------
// Pagamento a autônomo pessoa física por empresa gera, além do líquido:
//   • INSS retido do prestador: 11% sobre o valor do serviço, limitado ao
//     teto (Lei 8.212/91, art. 30, §4º);
//   • INSS patronal: 20% sobre o valor pago a contribuinte individual
//     (Lei 8.212/91, art. 22, III) — CUSTO DA EMPRESA, não desconto;
//   • IRRF pela tabela progressiva mensal;
//   • ISS conforme lei do município (Belém/PA), com retenção quando exigida.
//
// Revisar estes números a cada virada de competência/ano.
export const FREELANCE_TAX_PARAMS_YEAR = 2026;

export const INSS_CEILING = 8475.55;          // teto previdenciário 2026
export const INSS_WORKER_RATE = 0.11;         // retenção do contribuinte individual
export const INSS_WORKER_MAX = 932.31;        // 11% do teto
export const INSS_EMPLOYER_RATE = 0.20;       // contribuição patronal sobre autônomo

// Tabela progressiva mensal do IRRF (2026).
export const IRRF_TABLE = [
  { upTo: 2428.80, rate: 0, deduction: 0 },
  { upTo: 2826.65, rate: 0.075, deduction: 182.16 },
  { upTo: 3751.05, rate: 0.15, deduction: 394.16 },
  { upTo: 4664.68, rate: 0.225, deduction: 675.49 },
  { upTo: Infinity, rate: 0.275, deduction: 908.73 },
];

// Redutor legal do IRRF (Lei 15.270/2025): isenção total até R$ 5.000,00 de
// rendimento tributável mensal e redução decrescente até R$ 7.350,00.
export const IRRF_REDUCTION = {
  fullExemptionUpTo: 5000,
  partialUpTo: 7350,
  base: 978.62,
  factor: 0.133145,
};

export const IRRF_DEPENDENT_DEDUCTION = 189.59;

// ISS: alíquota padrão sugerida para serviços em Belém/PA. É configurável por
// trabalho porque varia com o item da lista da LC 116/2003 e com a legislação
// municipal — quem define é a contabilidade, não o sistema.
export const ISS_DEFAULT_RATE = 0.05;

// ---------------------------------------------------------------------------
// Checklists e textos de conformidade
// ---------------------------------------------------------------------------

// Pré-requisitos de cadastro sem os quais nenhuma OS pode ser emitida: são as
// "formalidades legais" a que o art. 442-B da CLT condiciona o afastamento do
// vínculo, mais o que a contabilidade precisa para o RPA/eSocial.
export const FREELANCE_REQUIRED_FIELDS = [
  ['name', 'Nome completo'],
  ['cpf', 'CPF'],
  ['nit', 'NIT/PIS/PASEP (eSocial)'],
  ['birthdate', 'Data de nascimento'],
  ['phone', 'Telefone'],
  ['email', 'E-mail'],
  ['enderecoLogradouro', 'Endereço (logradouro)'],
  ['enderecoCidade', 'Cidade'],
  ['enderecoUf', 'UF'],
  ['serviceArea', 'Área/atividade do serviço'],
  ['autonomyDeclarationAcceptedAt', 'Declaração de autonomia assinada'],
];

export const FREELANCE_JOB_REQUIRED_FIELDS = [
  ['title', 'Título do trabalho'],
  ['serviceType', 'Natureza do serviço'],
  ['scope', 'Escopo detalhado'],
  ['deliverable', 'Entregável / resultado esperado'],
  ['grossAmount', 'Preço fechado (R$)'],
  ['scheduledDate', 'Data prevista de execução'],
];

// Rotina fiscal/previdenciária de cada pagamento. Exibida na aba de
// Conformidade para o RH acompanhar com a contabilidade.
export const FREELANCE_FISCAL_CHECKLIST = [
  {
    key: 'esocial_s2300',
    label: 'eSocial S-2300 (trabalhador sem vínculo — início)',
    detail: 'Cadastro do autônomo no eSocial antes do primeiro pagamento; categoria 701 (contribuinte individual).',
  },
  {
    key: 'rpa',
    label: 'RPA (Recibo de Pagamento a Autônomo)',
    detail: 'Um RPA por trabalho entregue e aceito, com discriminação de INSS retido, IRRF e ISS.',
  },
  {
    key: 'esocial_s1200',
    label: 'eSocial S-1200 (remuneração da competência)',
    detail: 'Remuneração do autônomo na competência do pagamento, junto com a folha.',
  },
  {
    key: 'inss_retido',
    label: 'INSS retido (11%) recolhido em DARF/GPS',
    detail: `Limitado a ${INSS_WORKER_MAX.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por competência (11% do teto).`,
  },
  {
    key: 'inss_patronal',
    label: 'INSS patronal (20%) provisionado',
    detail: 'Custo da contratante sobre o valor pago ao autônomo — entra no custo total do trabalho.',
  },
  {
    key: 'irrf',
    label: 'IRRF pela tabela progressiva',
    detail: 'Calculado sobre o valor do serviço menos o INSS retido, com o redutor legal vigente.',
  },
  {
    key: 'iss',
    label: 'ISS conforme lei municipal',
    detail: 'Verificar item da LC 116/2003 e obrigação de retenção no município da prestação.',
  },
  {
    key: 'esocial_s2399',
    label: 'eSocial S-2399 (encerramento), quando aplicável',
    detail: 'Enviado quando o autônomo deixa de prestar serviços à contratante.',
  },
];

// Regras de conduta que preservam a natureza autônoma no dia a dia. Este é o
// conteúdo que mais pesa em auditoria: o contrato pode ser impecável e o
// vínculo ser reconhecido pela prática.
export const FREELANCE_CONDUCT_RULES = [
  'Contratar sempre por escopo e resultado, nunca por período à disposição ("um turno", "um plantão", "um dia").',
  'Não incluir o freelancer em escala, rodízio, grade de horários ou grupo de avisos de expediente.',
  'Não exigir registro de ponto, PIN, biometria ou justificativa de atraso — o módulo não oferece esses recursos.',
  'Não aplicar advertência, suspensão ou qualquer medida disciplinar: o inadimplemento se resolve por glosa da OS.',
  'Não exigir exclusividade nem impedir que atenda outros contratantes, inclusive concorrentes.',
  'Permitir substituição por profissional habilitado indicado pelo próprio freelancer (afasta pessoalidade).',
  'Não fornecer uniforme, crachá de funcionário, e-mail corporativo ou cartão de visita da empresa.',
  'Não subordinar a supervisor: a interface é de contratante × contratado, sobre entrega e prazo.',
  'Renovar a demanda por nova OS assinada, nunca por prorrogação tácita e indefinida.',
  'Quando a demanda se tornar contínua, migrar o vínculo (CLT, intermitente ou PJ) em vez de somar OS.',
];

// Referências legais citadas pelo módulo (mostradas na aba de Conformidade e
// no rodapé dos documentos gerados).
export const FREELANCE_LEGAL_REFERENCES = [
  { ref: 'CC, arts. 593 a 609', note: 'Prestação de serviço — natureza civil do contrato, preço e prazo.' },
  { ref: 'CC, arts. 610 a 626', note: 'Empreitada — quando o objeto é obra/resultado certo.' },
  { ref: 'CLT, art. 3º', note: 'Elementos do vínculo: pessoalidade, habitualidade, subordinação e onerosidade.' },
  { ref: 'CLT, art. 442-B', note: 'Autônomo contratado com as formalidades legais não é empregado.' },
  { ref: 'CLT, art. 9º', note: 'Nulidade de atos que visem desvirtuar a aplicação da lei trabalhista.' },
  { ref: 'CLT, arts. 443, §3º e 452-A', note: 'Trabalho intermitente — alternativa quando a demanda é recorrente com subordinação.' },
  { ref: 'Lei 8.212/91, art. 22, III e art. 30, §4º', note: 'INSS patronal (20%) e retenção de 11% do contribuinte individual.' },
  { ref: 'Lei 8.134/90 e Lei 15.270/2025', note: 'IRRF pela tabela progressiva e redutor mensal vigente.' },
  { ref: 'LC 116/2003', note: 'ISS — lista de serviços e município de incidência.' },
  { ref: 'Lei 13.709/2018 (LGPD)', note: 'Tratamento de dados pessoais do prestador e de terceiros.' },
  { ref: 'MP 2.200-2/2001, art. 10, §1º', note: 'Validade da assinatura eletrônica com certificado ICP-Brasil.' },
  { ref: 'STF, Tema 1389 (ARE 1.532.603)', note: 'Licitude da contratação de autônomo/PJ e ônus da prova de fraude — mérito pendente; reforça manter prova documental robusta.' },
];

// Declaração assinada pelo freelancer no cadastro (versionada). É a peça
// central da blindagem, no mesmo espírito da autonomyDeclarationText do PJ.
export const FREELANCE_AUTONOMY_DECLARATION_VERSION = '1.0';

export const FREELANCE_AUTONOMY_DECLARATION_TEXT =
  'Declaro, para os fins dos contratos de prestação de serviços autônomos que vier a firmar com a ' +
  'contratante, que: (i) exerço minha atividade por conta própria, com plena autonomia técnica e ' +
  'organizacional, assumindo os riscos do resultado; (ii) sou contratado(a) para trabalhos pontuais, ' +
  'delimitados por escopo, prazo e preço, sem habitualidade e sem garantia de nova contratação; ' +
  '(iii) não há subordinação, controle de jornada, escala ou poder disciplinar sobre mim; (iv) posso ' +
  'recusar qualquer trabalho ofertado, sem penalidade, e posso me fazer substituir por profissional ' +
  'habilitado de minha indicação; (v) não atuo em regime de exclusividade e presto serviços a outros ' +
  'contratantes; (vi) respondo pelos tributos e contribuições devidos na condição de contribuinte ' +
  'individual, autorizando as retenções legais na fonte; e (vii) tenho ciência de que estes contratos ' +
  'têm natureza exclusivamente civil, sem vínculo empregatício com a contratante.';

// Aviso fixo exibido em toda tela e documento do módulo.
export const FREELANCE_DISCLAIMER =
  'Minutas e cálculos gerados automaticamente a partir do cadastro. Valores fiscais são estimativas de ' +
  'referência e devem ser conferidos pela contabilidade; os documentos devem ser revisados pelo jurídico ' +
  'antes da assinatura.';
