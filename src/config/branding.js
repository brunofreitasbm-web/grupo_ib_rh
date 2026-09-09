// Configuração de marca/identidade por workspace. Cada deploy (Vercel) lê
// VITE_WORKSPACE_ID no build para saber qual objeto usar — o restante do
// código nunca deve checar "porto-terapia"/"grupoib" diretamente, e sim ler
// os campos abaixo (isso é o que permite reaproveitar o mesmo código-fonte
// para os dois sites sem misturar nome/logo/contas entre eles).
export const WORKSPACES = {
  'porto-terapia': {
    id: 'porto-terapia',
    appTitle: 'Gestão de Pessoas • Porto Terapia',
    shortName: 'PontoRH',
    themeColor: '#1a1a2e',
    logoPath: '/logo.jpg',
    logoAlt: 'Logo Porto Terapia',
    // Subtítulo mostrado abaixo do nome na tela de login (ver App.jsx).
    loginSubtitle: 'Registro de Frequência e Presença',
    displayName: 'Porto Terapia',
    legalEntityName: 'Porto Terapia Clínica de Psicologia LTDA',
    legalEntityShort: 'Porto Terapia Clínica de Psicologia',
    documentTagline: 'Clínica de Psicologia e Desenvolvimento Humano',
    documentLocation: 'Belém - PA',
    contactEmail: 'contato@portoterapia.com.br',
    rhEmail: 'rh@portoterapia.com.br',
    cnpj: '12.345.678/0001-90',
    phone: '(91) 98888-7777',
    // Widget de chat "Fale com a Supervisão" (estagiário) + painel espelhado
    // de atendimento na aba RH (supervisor).
    showSupervisionChat: true,
    // Domínio usado quando um estagiário é cadastrado sem e-mail próprio
    // (vira <usuario>@<fallbackInternEmailDomain>).
    fallbackInternEmailDomain: 'portoterapia.com',
    // Módulo de Profissionais PJ (prestadores de serviço) — ver ProfessionalKiosk.jsx.
    // Desligado neste site: a Porto Terapia hoje só controla estagiários.
    showProfessionalsModule: false,
    professionalTermsVersion: '1.0',
    professionalLabels: {
      singular: 'Prestador(a)',
      plural: 'Profissionais PJ',
      presence: 'Registro de Presença',
      production: 'Apuração de Produção',
    },
    professionalTermsText:
      'Este registro de presença serve exclusivamente para organização de agenda, ' +
      'segurança do local e conferência dos serviços prestados para fins de faturamento. ' +
      'Ele não constitui, e não deve ser interpretado como, controle de jornada de trabalho, ' +
      'ponto eletrônico ou qualquer forma de subordinação, sendo seu uso facultativo e ' +
      'autodeclarado pelo(a) próprio(a) prestador(a) de serviços, no âmbito do contrato de ' +
      'prestação de serviços firmado com a empresa.',
    // Autocadastro de Profissionais PJ (ver ProfessionalSelfRegistration.jsx)
    // — desligado neste site junto com o restante do módulo PJ.
    showProfessionalSelfRegistration: false,
    autonomyDeclarationVersion: '1.0',
    autonomyDeclarationText: '',
    // Módulo de Funcionários CLT — ver EmployeeKiosk.jsx. Desligado neste site
    // (a Porto Terapia hoje não usa o hub para empregados CLT).
    showEmployeesModule: false,
    biometricConsentVersion: '1.0',
    // Autocadastro de Funcionários CLT (ver EmployeeSelfRegistration.jsx) —
    // desligado neste site junto com o restante do módulo CLT.
    showEmployeeSelfRegistration: false,
    employeeLgpdConsentVersion: '1.0',
    employeeLabels: {
      singular: 'Funcionário(a)',
      plural: 'Funcionários CLT',
      timesheet: 'Ponto Eletrônico',
    },
    // Contas com role 'supervisor' que podem logar nomeadas neste site
    // (resolveAdminKey). Qualquer outro texto digitado cai no "supervisor"
    // genérico. O e-mail de cada uma é o mesmo em auth.users nos dois sites
    // (é a mesma conta Supabase) — só a lista exibida/reconhecível muda.
    // Tela de Usuários do Sistema (Configurações > Usuários do Sistema) —
    // cadastro/edição/reset de senha das contas que logam no painel e nos
    // quiosques. Desligada neste site: as contas da Porto Terapia continuam
    // sendo as fixas de adminUsers/kioskUnits.
    showSystemUsersModule: false,
    adminUsers: {
      supervisor: { label: 'Supervisor Geral', email: 'supervisor@portoterapia.com' },
      guimelly: { label: 'Guimelly', email: 'guimelly@portoterapia.com' },
      bruno: { label: 'Bruno', email: 'bruno@portoterapia.com' },
      isabella: { label: 'Isabella', email: 'isabella@portoterapia.com' },
      ian: { label: 'Ian', email: 'ian@portoterapia.com' },
    },
    // Unidades mostradas nos botões de login do quiosque (tela pré-login, sem
    // sessão — por isso não dá para consultar a tabela `units` via RLS ainda;
    // ver App.jsx). Precisam bater com os ids/kiosk_email da tabela `units`.
    kioskUnits: [
      {
        id: 'antonio-barreto',
        name: 'Antônio Barreto',
        buttonLabel: 'Estagiários - Antônio Barreto',
        loginLabel: 'Estagiário - Unidade Antônio Barreto',
        kioskEmail: 'antoniobarreto@portoterapia.com',
        razaoSocial: 'Porto Terapia Clínica de Psicologia LTDA',
        cnpj: '12.345.678/0001-90',
        address: 'R. Antônio Barreto, 2050 - Fátima, Belém - PA, 66060-021',
        phone: '(91) 98888-7777',
        accent: 'emerald',
      },
      {
        id: 'generalissimo',
        name: 'Generalíssimo Deodoro',
        buttonLabel: 'Estagiários - Generalíssimo',
        loginLabel: 'Estagiário - Unidade Generalíssimo Deodoro',
        kioskEmail: 'generalissimo@portoterapia.com',
        razaoSocial: 'Porto Terapia Clínica de Psicologia LTDA',
        cnpj: '12.345.678/0002-71',
        address: 'Av. Generalíssimo Deodoro, 564 - Nazaré, Belém - PA',
        phone: '(91) 98888-7778',
        accent: 'indigo',
      },
    ],
  },
  grupoib: {
    id: 'grupoib',
    appTitle: 'FaçaAmigos Gestão de Pessoas',
    shortName: 'PontoIB',
    themeColor: '#0f766e',
    // Kit de marca FaçaAmigos (vetorizado) — ver public/brand/README de origem
    // em Projetos/Clinica/brand. Usa o símbolo isolado (sem wordmark) porque
    // as telas do app exibem o logo em caixas pequenas/quadradas (h-10 a h-16
    // com w-auto) — a versão horizontal com texto ficava cortada nesse espaço.
    logoPath: '/brand/facaamigos-simbolo.svg',
    logoAlt: 'Símbolo Faça Amigos',
    // Subtítulo mostrado abaixo do nome na tela de login (ver App.jsx). Como
    // displayName já inclui "Gestão de Pessoas", usa a assinatura da marca
    // para não repetir o texto.
    loginSubtitle: 'Unidades e Serviços de Saúde',
    displayName: 'FaçaAmigos Gestão de Pessoas',
    // Sobrescreve a paleta "blue" do Tailwind pela paleta "teal" (verde-água)
    // só neste build — todo o app usa classes bg-blue-*/text-blue-*/etc. como
    // cor de marca; isso recolore a UI inteira sem precisar tocar em cada
    // componente. Ver tailwind.config.js.
    tailwindBlueOverride: {
      50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf',
      500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e',
    },
    legalEntityName: 'Razão social do FaçaAmigos Gestão de Pessoas (pendente)',
    legalEntityShort: 'FaçaAmigos',
    documentTagline: 'Unidades e Serviços de Saúde FaçaAmigos',
    documentLocation: 'Belém - PA',
    contactEmail: 'contato@grupoib.com.br',
    rhEmail: 'rh@grupoib.com.br',
    cnpj: '00.000.000/0001-00',
    phone: '(91) 99999-0000',
    showSupervisionChat: false,
    fallbackInternEmailDomain: 'grupoib.internal',
    // Módulo de Profissionais PJ (prestadores de serviço) — ver ProfessionalKiosk.jsx.
    // Vocabulário e regras deliberadamente distintos do estágio, para não sugerir
    // vínculo empregatício (ver seção 1 do plano de implementação do módulo).
    showProfessionalsModule: true,
    professionalTermsVersion: '1.0',
    professionalLabels: {
      singular: 'Prestador(a)',
      plural: 'Profissionais PJ',
      presence: 'Registro de Presença',
      production: 'Apuração de Produção',
    },
    professionalTermsText:
      'Este registro de presença serve exclusivamente para organização de agenda, ' +
      'segurança do local e conferência dos serviços prestados para fins de faturamento. ' +
      'Ele não constitui, e não deve ser interpretado como, controle de jornada de trabalho, ' +
      'ponto eletrônico ou qualquer forma de subordinação, sendo seu uso facultativo e ' +
      'autodeclarado pelo(a) próprio(a) prestador(a) de serviços, no âmbito do contrato de ' +
      'prestação de serviços firmado com a empresa.',
    // Autocadastro de Profissionais PJ (ver ProfessionalSelfRegistration.jsx)
    // — o próprio prestador preenche seu cadastro completo (dados da PJ,
    // habilitação, representante legal e anexos) sem estar logado, nascendo
    // 'pending_validation' até o RH validar. Ver seção 18 de supabase_schema.sql.
    showProfessionalSelfRegistration: true,
    autonomyDeclarationVersion: '1.0',
    // Aceite obrigatório e versionado, separado do consentimento LGPD — é a
    // peça central da blindagem de vínculo trabalhista deste módulo.
    autonomyDeclarationText:
      'Declaro, para os fins do contrato de prestação de serviços a ser firmado, que atuo com ' +
      'plena autonomia técnica e organizacional na execução dos serviços, sem subordinação, ' +
      'pessoalidade ou habitualidade em relação à contratante; que defino livremente minha agenda ' +
      'e forma de atendimento; que posso me fazer substituir por preposto(a) habilitado(a); que não ' +
      'atendo a esta contratante em regime de exclusividade; e que sou responsável pelos tributos, ' +
      'encargos previdenciários e obrigações civis decorrentes da minha atividade como pessoa ' +
      'jurídica. Este cadastro e o contrato dele decorrente têm natureza exclusivamente civil, sem ' +
      'qualquer vínculo empregatício com a contratante.',
    // Cláusulas padrão do contrato de prestação de serviços pré-preenchido
    // (ver ./utils/professionalContract.js); cada unidade pode complementar
    // com units.contrato_pj_custom_text.
    contractDefaultClauses:
      '[MINUTA GERADA AUTOMATICAMENTE — SUJEITA A REVISÃO JURÍDICA ANTES DA ASSINATURA.]',
    // Módulo de Funcionários CLT (empregados) — ver EmployeeKiosk.jsx. Ligado
    // no Grupo IB: terceiro tipo de vínculo do hub de RH, ao lado de
    // Estagiários e Profissionais PJ. Ao contrário do PJ, este módulo se
    // aproxima deliberadamente de controle de jornada (Portaria MTP 671/2021).
    showEmployeesModule: true,
    biometricConsentVersion: '1.0',
    // Autocadastro de Funcionários CLT (ver EmployeeSelfRegistration.jsx) — o
    // próprio candidato preenche dados pessoais/documentais e a biometria
    // facial (captura ao vivo com liveness, mesmo componente da Autogestão de
    // Biometria do estagiário) sem estar logado, nascendo 'pending_validation'
    // até o RH validar e completar cargo/salário/contrato/admissão. Ver
    // seção 19 de supabase_schema.sql.
    showEmployeeSelfRegistration: true,
    employeeLgpdConsentVersion: '1.0',
    employeeLabels: {
      singular: 'Funcionário(a)',
      plural: 'Funcionários CLT',
      timesheet: 'Ponto Eletrônico',
    },
    // Somente o Bruno é admin nomeado neste site (mesma conta Supabase de
    // sempre); Guimelly/Isabella continuam com acesso de dados ao Grupo IB
    // (workspace_scope inclui "all"), mas não aparecem como opção de login
    // aqui — só no site da Porto Terapia.
    // Tela de Usuários do Sistema (ver seção 21 de supabase_schema.sql). Ligada
    // no Grupo IB: o hub tem 3 módulos e várias unidades, então as contas de
    // painel e de quiosque precisam ser geridas pela própria UI, e não por
    // blocos SQL rodados à mão.
    showSystemUsersModule: true,
    adminUsers: {
      bruno: { label: 'Bruno', email: 'bruno@portoterapia.com' },
    },
    kioskUnits: [
      {
        id: 'faca-amigos-parque-shopping',
        name: 'Faça Amigos Parque Shopping',
        buttonLabel: 'Estagiários - Faça Amigos Parque Shopping',
        loginLabel: 'Estagiário - Faça Amigos Parque Shopping',
        kioskEmail: 'parqueshopping@grupoib.internal',
        professionalButtonLabel: 'Profissionais PJ - Faça Amigos Parque Shopping',
        professionalKioskEmail: 'pj-parqueshopping@grupoib.internal',
        employeeButtonLabel: 'Funcionários CLT - Faça Amigos Parque Shopping',
        employeeKioskEmail: 'clt-parqueshopping@grupoib.internal',
        razaoSocial: 'Faça Amigos Parque Shopping Serviços Médicos LTDA',
        cnpj: '00.000.000/0001-01',
        address: 'Rod. Augusto Montenegro, 4300 - Parque Shopping, Belém - PA',
        phone: '(91) 99111-1001',
        accent: 'emerald',
      },
      {
        id: 'faca-amigos-grao-para',
        name: 'Faça Amigos Grão Pará',
        buttonLabel: 'Estagiários - Faça Amigos Grão Pará',
        loginLabel: 'Estagiário - Faça Amigos Grão Pará',
        kioskEmail: 'graopara@grupoib.internal',
        professionalButtonLabel: 'Profissionais PJ - Faça Amigos Grão Pará',
        professionalKioskEmail: 'pj-graopara@grupoib.internal',
        employeeButtonLabel: 'Funcionários CLT - Faça Amigos Grão Pará',
        employeeKioskEmail: 'clt-graopara@grupoib.internal',
        razaoSocial: 'Faça Amigos Grão Pará Serviços Médicos LTDA',
        cnpj: '00.000.000/0001-02',
        address: 'Av. Centenário, 1050 - Shopping Bosque Grão Pará, Belém - PA',
        phone: '(91) 99111-1002',
        accent: 'indigo',
      },
      {
        id: 'clinica-a',
        name: 'Clínica A',
        buttonLabel: 'Estagiários - Clínica A',
        loginLabel: 'Estagiário - Clínica A',
        kioskEmail: 'clinicaa@grupoib.internal',
        professionalButtonLabel: 'Profissionais PJ - Clínica A',
        professionalKioskEmail: 'pj-clinicaa@grupoib.internal',
        employeeButtonLabel: 'Funcionários CLT - Clínica A',
        employeeKioskEmail: 'clt-clinicaa@grupoib.internal',
        razaoSocial: 'Clínica A Serviços de Saúde LTDA',
        cnpj: '00.000.000/0001-03',
        address: 'Av. Nazaré, 800 - Nazaré, Belém - PA',
        phone: '(91) 99111-1003',
        accent: 'amber',
      },
      {
        id: 'clinica-b',
        name: 'Clínica B',
        buttonLabel: 'Estagiários - Clínica B',
        loginLabel: 'Estagiário - Clínica B',
        kioskEmail: 'clinicab@grupoib.internal',
        professionalButtonLabel: 'Profissionais PJ - Clínica B',
        professionalKioskEmail: 'pj-clinicab@grupoib.internal',
        employeeButtonLabel: 'Funcionários CLT - Clínica B',
        employeeKioskEmail: 'clt-clinicab@grupoib.internal',
        razaoSocial: 'Clínica B Serviços de Saúde LTDA',
        cnpj: '00.000.000/0001-04',
        address: 'Av. Conselheiro Furtado, 1500 - Cremação, Belém - PA',
        phone: '(91) 99111-1004',
        accent: 'rose',
      },
    ],
  },
};

export const CURRENT_WORKSPACE_ID =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WORKSPACE_ID) ||
  'porto-terapia';

export const BRANDING = WORKSPACES[CURRENT_WORKSPACE_ID] || WORKSPACES['porto-terapia'];
