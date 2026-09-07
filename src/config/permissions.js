// Catálogo canônico de papéis e permissões das contas do sistema.
//
// O papel (auth.users.raw_user_meta_data.role) continua sendo o que o servidor
// usa para RLS — ver jwt_is_supervisor_for_unit / jwt_has_workspace_access em
// supabase_schema.sql. As permissões abaixo são um refinamento POR CIMA disso:
// escondem/liberam abas e ações dentro do painel do supervisor. Elas nunca
// substituem a checagem do banco; um supervisor sem a permissão "financeiro.ver"
// simplesmente não vê a aba, mas o RLS continua sendo a barreira real.
//
// Guardadas em public.system_user_permissions (seção 21 do schema).

import { BRANDING } from './branding';

// Papéis gerenciáveis pela tela de Usuários do Sistema. Precisa bater com
// public.system_user_manageable_roles() no banco.
export const SYSTEM_ROLES = [
  {
    id: 'supervisor',
    label: 'Administrador / Supervisor',
    description: 'Acessa o painel administrativo completo (abas de RH, documentos, financeiro).',
    requiresUnit: false,
    accent: 'indigo',
  },
  {
    id: 'intern_unit',
    label: 'Quiosque de Estagiários',
    description: 'Conta compartilhada do tablet da unidade para registro de ponto de estagiários.',
    requiresUnit: true,
    accent: 'emerald',
  },
  {
    id: 'professional_unit',
    label: 'Quiosque de Profissionais PJ',
    description: 'Conta compartilhada do tablet da unidade para registro de presença de prestadores.',
    requiresUnit: true,
    accent: 'amber',
    module: 'showProfessionalsModule',
  },
  {
    id: 'employee_unit',
    label: 'Quiosque de Funcionários CLT',
    description: 'Conta compartilhada do tablet da unidade para o ponto eletrônico CLT.',
    requiresUnit: true,
    accent: 'rose',
    module: 'showEmployeesModule',
  },
];

// Papéis oferecidos neste deploy (esconde quiosque PJ/CLT onde o módulo está
// desligado no branding).
export const availableSystemRoles = () =>
  SYSTEM_ROLES.filter((r) => !r.module || BRANDING[r.module]);

export const getRoleMeta = (roleId) =>
  SYSTEM_ROLES.find((r) => r.id === roleId) || {
    id: roleId,
    label: roleId || 'Sem papel',
    description: 'Papel não reconhecido por esta versão do sistema.',
    requiresUnit: false,
    accent: 'slate',
  };

// Grupos de permissão exibidos na tela. `module` esconde o grupo inteiro nos
// deploys onde o módulo correspondente está desligado.
export const PERMISSION_GROUPS = [
  {
    id: 'estagiarios',
    label: 'Estagiários',
    permissions: [
      { id: 'estagiarios.ver', label: 'Ver estagiários e frequência', default: true },
      { id: 'estagiarios.editar', label: 'Cadastrar e editar estagiários' },
      { id: 'estagiarios.excluir', label: 'Excluir estagiários' },
      { id: 'estagiarios.senha', label: 'Resetar senha de estagiário' },
      { id: 'estagiarios.validar', label: 'Validar autocadastro pendente' },
      { id: 'estagiarios.encerrar', label: 'Encerrar contrato de estágio' },
    ],
  },
  {
    id: 'profissionais',
    label: 'Profissionais PJ',
    module: 'showProfessionalsModule',
    permissions: [
      { id: 'profissionais.ver', label: 'Ver prestadores e presença', default: true },
      { id: 'profissionais.editar', label: 'Cadastrar e editar prestadores' },
      { id: 'profissionais.pin', label: 'Definir/resetar PIN de prestador' },
      { id: 'profissionais.validar', label: 'Validar autocadastro pendente' },
      { id: 'profissionais.producao', label: 'Apurar produção e faturamento' },
      { id: 'profissionais.contrato', label: 'Gerar minuta de contrato PJ' },
    ],
  },
  {
    id: 'funcionarios',
    label: 'Funcionários CLT',
    module: 'showEmployeesModule',
    permissions: [
      { id: 'funcionarios.ver', label: 'Ver funcionários e ponto', default: true },
      { id: 'funcionarios.editar', label: 'Cadastrar e editar funcionários' },
      { id: 'funcionarios.validar', label: 'Validar autocadastro pendente' },
      { id: 'funcionarios.apuracao', label: 'Apurar banco de horas e fechar ponto' },
      { id: 'funcionarios.ferias', label: 'Programar e conceder férias' },
      { id: 'funcionarios.ocorrencias', label: 'Registrar advertências e ocorrências' },
      { id: 'funcionarios.rescisao', label: 'Processar rescisão' },
      { id: 'funcionarios.biometria', label: 'Cadastrar/reiniciar biometria facial' },
    ],
  },
  {
    id: 'documentos',
    label: 'Documentos & Dossiê',
    permissions: [
      { id: 'documentos.ver', label: 'Ver dossiê e documentos', default: true },
      { id: 'documentos.emitir', label: 'Emitir documentos e declarações' },
      { id: 'documentos.upload', label: 'Anexar documentos' },
      { id: 'documentos.excluir', label: 'Excluir documentos anexados' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    permissions: [
      { id: 'financeiro.ver', label: 'Acessar o módulo financeiro' },
      { id: 'financeiro.folha', label: 'Emitir folha de pagamento (PDF)' },
      { id: 'financeiro.exportar', label: 'Exportar planilhas e relatórios' },
    ],
  },
  {
    id: 'sistema',
    label: 'Administração do Sistema',
    permissions: [
      { id: 'sistema.configuracoes', label: 'Alterar configurações e unidades' },
      { id: 'sistema.usuarios', label: 'Gerenciar usuários do sistema' },
      { id: 'sistema.auditoria', label: 'Ver auditoria de registros' },
      { id: 'sistema.feriados', label: 'Manter calendário de feriados' },
    ],
  },
];

export const availablePermissionGroups = () =>
  PERMISSION_GROUPS.filter((g) => !g.module || BRANDING[g.module]);

export const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.id));

// Modelos prontos aplicáveis com um clique no formulário. Evitam que cada
// conta nova seja montada permissão a permissão (e é onde ficam as combinações
// que o RH de fato usa).
export const PERMISSION_PRESETS = [
  {
    id: 'admin_total',
    label: 'Administrador total',
    description: 'Todas as permissões, inclusive gestão de usuários e financeiro.',
    grants: () => ALL_PERMISSION_IDS,
  },
  {
    id: 'rh_operacional',
    label: 'RH operacional',
    description: 'Gere pessoas e documentos, sem financeiro nem administração do sistema.',
    grants: () =>
      ALL_PERMISSION_IDS.filter(
        (id) => !id.startsWith('financeiro.') && !id.startsWith('sistema.')
      ).concat('sistema.auditoria'),
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Leitura das pessoas + módulo financeiro e folha.',
    grants: () => [
      'estagiarios.ver',
      'profissionais.ver',
      'profissionais.producao',
      'funcionarios.ver',
      'funcionarios.apuracao',
      'documentos.ver',
      'financeiro.ver',
      'financeiro.folha',
      'financeiro.exportar',
    ],
  },
  {
    id: 'consulta',
    label: 'Somente consulta',
    description: 'Vê tudo o que estiver liberado, sem poder alterar nada.',
    grants: () => ALL_PERMISSION_IDS.filter((id) => id.endsWith('.ver')),
  },
];

// Permissões implícitas de cada papel de quiosque. Contas de quiosque não têm
// painel administrativo, então a matriz fina não se aplica a elas — a tela
// mostra este texto no lugar dos checkboxes.
export const KIOSK_ROLE_SCOPE = {
  intern_unit: 'Registrar ponto dos estagiários da unidade e abrir o autocadastro de estagiário.',
  professional_unit: 'Registrar presença dos prestadores da unidade e abrir o autocadastro PJ.',
  employee_unit: 'Registrar o ponto eletrônico dos funcionários CLT da unidade e abrir o autocadastro CLT.',
};

// Converte a lista de ids marcados no formulário para o jsonb salvo no banco
// (mapa id -> true), e de volta.
export const permissionsToMap = (ids = []) =>
  ids.reduce((acc, id) => ({ ...acc, [id]: true }), {});

export const permissionsToList = (map = {}) =>
  Object.keys(map || {}).filter((id) => map[id]);

export const countGrantedPermissions = (map = {}) => permissionsToList(map).length;

// Escopos de workspace atribuíveis. 'all' só aparece para quem já tem 'all'
// (o banco recusaria criar conta com escopo maior que o do chamador — ver
// assert_system_user_admin).
export const WORKSPACE_SCOPE_OPTIONS = [
  { id: 'all', label: 'Todos os workspaces', description: 'Porto Terapia + Grupo IB.' },
  { id: 'porto-terapia', label: 'Porto Terapia', description: 'Somente as unidades da Porto Terapia.' },
  { id: 'grupoib', label: 'Grupo IB', description: 'Somente as unidades do Grupo IB.' },
];
