// Configuração de marca/identidade por workspace. Cada deploy (Vercel) lê
// VITE_WORKSPACE_ID no build para saber qual objeto usar — o restante do
// código nunca deve checar "porto-terapia"/"grupoib" diretamente, e sim ler
// os campos abaixo (isso é o que permite reaproveitar o mesmo código-fonte
// para os dois sites sem misturar nome/logo/contas entre eles).
export const WORKSPACES = {
  'porto-terapia': {
    id: 'porto-terapia',
    appTitle: 'Controle de Estagiário • Porto Terapia',
    shortName: 'PontoRH',
    themeColor: '#1a1a2e',
    logoPath: '/logo.jpg',
    logoAlt: 'Logo Porto Terapia',
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
    // Contas com role 'supervisor' que podem logar nomeadas neste site
    // (resolveAdminKey). Qualquer outro texto digitado cai no "supervisor"
    // genérico. O e-mail de cada uma é o mesmo em auth.users nos dois sites
    // (é a mesma conta Supabase) — só a lista exibida/reconhecível muda.
    adminUsers: {
      supervisor: { label: 'Supervisor Geral', email: 'supervisor@portoterapia.com' },
      guimelly: { label: 'Guimelly', email: 'guimelly@portoterapia.com' },
      bruno: { label: 'Bruno', email: 'bruno@portoterapia.com' },
      isabella: { label: 'Isabella', email: 'isabella@portoterapia.com' },
    },
    // Unidades mostradas nos botões de login do quiosque (tela pré-login, sem
    // sessão — por isso não dá para consultar a tabela `units` via RLS ainda;
    // ver App.jsx). Precisam bater com os ids/kiosk_email da tabela `units`.
    kioskUnits: [
      {
        id: 'antonio-barreto',
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
    appTitle: 'Controle de Estagiário • Grupo IB',
    shortName: 'PontoIB',
    themeColor: '#0f766e',
    // Sem logo próprio ainda — telas com logo simplesmente não mostram nada
    // (ver checagens `BRANDING.logoPath &&` em App.jsx/FinanceiroTab.jsx).
    logoPath: null,
    logoAlt: 'Logo Grupo IB',
    displayName: 'Grupo IB',
    // Sobrescreve a paleta "blue" do Tailwind pela paleta "teal" (verde-água)
    // só neste build — todo o app usa classes bg-blue-*/text-blue-*/etc. como
    // cor de marca; isso recolore a UI inteira sem precisar tocar em cada
    // componente. Ver tailwind.config.js.
    tailwindBlueOverride: {
      50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf',
      500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e',
    },
    legalEntityName: 'Razão social do Grupo IB (pendente)',
    legalEntityShort: 'Grupo IB',
    documentTagline: 'Unidades e Serviços de Saúde Grupo IB',
    documentLocation: 'Belém - PA',
    contactEmail: 'contato@grupoib.com.br',
    rhEmail: 'rh@grupoib.com.br',
    cnpj: '00.000.000/0001-00',
    phone: '(91) 99999-0000',
    showSupervisionChat: false,
    fallbackInternEmailDomain: 'grupoib.internal',
    // Somente o Bruno é admin nomeado neste site (mesma conta Supabase de
    // sempre); Guimelly/Isabella continuam com acesso de dados ao Grupo IB
    // (workspace_scope inclui "all"), mas não aparecem como opção de login
    // aqui — só no site da Porto Terapia.
    adminUsers: {
      bruno: { label: 'Bruno', email: 'bruno@portoterapia.com' },
    },
    kioskUnits: [
      {
        id: 'faca-amigos-parque-shopping',
        buttonLabel: 'Estagiários - Faça Amigos Parque Shopping',
        loginLabel: 'Estagiário - Faça Amigos Parque Shopping',
        kioskEmail: 'parqueshopping@grupoib.internal',
        razaoSocial: 'Faça Amigos Parque Shopping Serviços Médicos LTDA',
        cnpj: '00.000.000/0001-01',
        address: 'Rod. Augusto Montenegro, 4300 - Parque Shopping, Belém - PA',
        phone: '(91) 99111-1001',
        accent: 'emerald',
      },
      {
        id: 'faca-amigos-grao-para',
        buttonLabel: 'Estagiários - Faça Amigos Grão Pará',
        loginLabel: 'Estagiário - Faça Amigos Grão Pará',
        kioskEmail: 'graopara@grupoib.internal',
        razaoSocial: 'Faça Amigos Grão Pará Serviços Médicos LTDA',
        cnpj: '00.000.000/0001-02',
        address: 'Av. Centenário, 1050 - Shopping Bosque Grão Pará, Belém - PA',
        phone: '(91) 99111-1002',
        accent: 'indigo',
      },
      {
        id: 'clinica-a',
        buttonLabel: 'Estagiários - Clínica A',
        loginLabel: 'Estagiário - Clínica A',
        kioskEmail: 'clinicaa@grupoib.internal',
        razaoSocial: 'Clínica A Serviços de Saúde LTDA',
        cnpj: '00.000.000/0001-03',
        address: 'Av. Nazaré, 800 - Nazaré, Belém - PA',
        phone: '(91) 99111-1003',
        accent: 'amber',
      },
      {
        id: 'clinica-b',
        buttonLabel: 'Estagiários - Clínica B',
        loginLabel: 'Estagiário - Clínica B',
        kioskEmail: 'clinicab@grupoib.internal',
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
