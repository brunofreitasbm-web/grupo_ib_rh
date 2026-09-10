/**
 * Catálogo fechado de profissões dos Profissionais PJ.
 *
 * Espelha a lógica de `academicCourses.js` (mesmo formato `slug`/`value`/`area`
 * e mesma normalização de texto livre): `value` é o texto canônico gravado em
 * `professionals.profession` — usado em contratos, minutas e relatórios — e
 * `slug` é a chave estável para integrações externas.
 *
 * `courseSlug` amarra a profissão ao curso equivalente do catálogo acadêmico,
 * de modo que estagiário e prestador falem a mesma língua; `council` é o
 * conselho de classe usual, usado para pré-preencher o campo "Conselho".
 *
 * Escopo: clínica de desenvolvimento infantil, terapias e serviços de apoio.
 */

export const PROFESSION_AREAS = [
  'Terapias e Reabilitação',
  'Análise do Comportamento (ABA)',
  'Educação e Desenvolvimento Infantil',
  'Gestão, Administrativo e Apoio',
];

const profession = (slug, value, area, { council = '', courseSlug = '' } = {}) =>
  ({ slug, value, area, council, courseSlug });

export const PROFESSIONS = [
  // ------------------------------------------- Terapias e Reabilitação
  profession('psicologo', 'Psicólogo(a)', 'Terapias e Reabilitação', { council: 'CRP', courseSlug: 'psicologia' }),
  profession('neuropsicologo', 'Neuropsicólogo(a)', 'Terapias e Reabilitação', { council: 'CRP', courseSlug: 'psicologia' }),
  profession('psicopedagogo', 'Psicopedagogo(a)', 'Terapias e Reabilitação', { courseSlug: 'psicopedagogia' }),
  profession('fonoaudiologo', 'Fonoaudiólogo(a)', 'Terapias e Reabilitação', { council: 'CRFa', courseSlug: 'fonoaudiologia' }),
  profession('terapeuta-ocupacional', 'Terapeuta Ocupacional', 'Terapias e Reabilitação', { council: 'CREFITO', courseSlug: 'terapia-ocupacional' }),
  profession('fisioterapeuta', 'Fisioterapeuta', 'Terapias e Reabilitação', { council: 'CREFITO', courseSlug: 'fisioterapia' }),
  profession('nutricionista', 'Nutricionista', 'Terapias e Reabilitação', { council: 'CRN', courseSlug: 'nutricao' }),
  profession('educador-fisico', 'Educador(a) Físico(a)', 'Terapias e Reabilitação', { council: 'CREF', courseSlug: 'educacao-fisica' }),
  profession('psicomotricista', 'Psicomotricista', 'Terapias e Reabilitação', { courseSlug: 'educacao-fisica' }),
  profession('musicoterapeuta', 'Musicoterapeuta', 'Terapias e Reabilitação', { courseSlug: 'musicoterapia' }),
  profession('arteterapeuta', 'Arteterapeuta', 'Terapias e Reabilitação', { courseSlug: 'arteterapia' }),
  profession('equoterapeuta', 'Equoterapeuta', 'Terapias e Reabilitação'),
  profession('psicanalista', 'Psicanalista', 'Terapias e Reabilitação', { courseSlug: 'psicanalise' }),
  profession('terapeuta-integrativo', 'Terapeuta Integrativo(a)', 'Terapias e Reabilitação', { courseSlug: 'terapias-integrativas' }),

  // --------------------------------- Análise do Comportamento (ABA)
  profession('analista-do-comportamento', 'Analista do Comportamento', 'Análise do Comportamento (ABA)', { courseSlug: 'psicologia' }),
  profession('supervisor-de-caso-aba', 'Supervisor(a) de Caso (ABA)', 'Análise do Comportamento (ABA)', { courseSlug: 'psicologia' }),
  profession('terapeuta-aba', 'Terapeuta ABA', 'Análise do Comportamento (ABA)'),
  profession('aplicador-aba', 'Aplicador(a) ABA', 'Análise do Comportamento (ABA)'),
  profession('acompanhante-terapeutico', 'Acompanhante Terapêutico (AT)', 'Análise do Comportamento (ABA)'),
  profession('mediador-terapeutico', 'Mediador(a) Terapêutico(a)', 'Análise do Comportamento (ABA)'),
  profession('coordenador-clinico', 'Coordenador(a) Clínico(a)', 'Análise do Comportamento (ABA)'),

  // ------------------------ Educação e Desenvolvimento Infantil
  profession('pedagogo', 'Pedagogo(a)', 'Educação e Desenvolvimento Infantil', { courseSlug: 'pedagogia' }),
  profession('professor-educacao-especial', 'Professor(a) de Educação Especial', 'Educação e Desenvolvimento Infantil', { courseSlug: 'educacao-especial' }),
  profession('mediador-escolar', 'Mediador(a) Escolar / Auxiliar de Inclusão', 'Educação e Desenvolvimento Infantil', { courseSlug: 'pedagogia' }),
  profession('interprete-de-libras', 'Intérprete de Libras', 'Educação e Desenvolvimento Infantil', { courseSlug: 'letras-libras' }),
  profession('professor-de-musica', 'Professor(a) de Música', 'Educação e Desenvolvimento Infantil', { courseSlug: 'musica' }),
  profession('professor-de-artes', 'Professor(a) de Artes', 'Educação e Desenvolvimento Infantil', { courseSlug: 'artes-visuais' }),
  profession('professor-de-danca', 'Professor(a) de Dança', 'Educação e Desenvolvimento Infantil', { courseSlug: 'danca' }),
  profession('professor-de-teatro', 'Professor(a) de Teatro', 'Educação e Desenvolvimento Infantil', { courseSlug: 'teatro' }),

  // ----------------------------- Gestão, Administrativo e Apoio
  profession('coordenador-administrativo', 'Coordenador(a) Administrativo(a)', 'Gestão, Administrativo e Apoio', { courseSlug: 'administracao' }),
  profession('assistente-administrativo', 'Assistente Administrativo(a)', 'Gestão, Administrativo e Apoio', { courseSlug: 'tecnico-administracao' }),
  profession('recepcionista', 'Recepcionista', 'Gestão, Administrativo e Apoio'),
  profession('auxiliar-de-servicos-gerais', 'Auxiliar de Serviços Gerais', 'Gestão, Administrativo e Apoio'),
  profession('contador', 'Contador(a)', 'Gestão, Administrativo e Apoio', { council: 'CRC', courseSlug: 'ciencias-contabeis' }),
  profession('advogado', 'Advogado(a)', 'Gestão, Administrativo e Apoio', { council: 'OAB', courseSlug: 'direito' }),
  profession('analista-de-rh', 'Analista de Recursos Humanos', 'Gestão, Administrativo e Apoio', { courseSlug: 'gestao-de-rh' }),
  profession('analista-financeiro', 'Analista Financeiro(a)', 'Gestão, Administrativo e Apoio', { courseSlug: 'gestao-financeira' }),
  profession('analista-de-marketing', 'Analista de Marketing', 'Gestão, Administrativo e Apoio', { courseSlug: 'marketing' }),
  profession('designer-grafico', 'Designer Gráfico(a)', 'Gestão, Administrativo e Apoio', { courseSlug: 'design-grafico' }),
  profession('analista-de-ti', 'Analista de TI / Desenvolvedor(a) de Software', 'Gestão, Administrativo e Apoio', { courseSlug: 'analise-e-desenvolvimento-de-sistemas' }),
  profession('tecnico-seguranca-do-trabalho', 'Técnico(a) em Segurança do Trabalho', 'Gestão, Administrativo e Apoio', { courseSlug: 'tecnico-seguranca-do-trabalho' }),
  profession('motorista', 'Motorista', 'Gestão, Administrativo e Apoio'),
];

/** Profissões agrupadas por área, na ordem de `PROFESSION_AREAS`. */
export const PROFESSIONS_BY_AREA = PROFESSION_AREAS
  .map(area => ({ area, professions: PROFESSIONS.filter(p => p.area === area) }))
  .filter(g => g.professions.length > 0);

/** Lista simples dos textos canônicos aceitos em `professionals.profession`. */
export const PROFESSION_VALUES = PROFESSIONS.map(p => p.value);

const stripAccents = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const canonicalKey = (s) =>
  stripAccents(s)
    .toLowerCase()
    .replace(/\(a\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Apelidos de cadastros antigos (texto livre) para o valor canônico.
 * Chave já normalizada por `canonicalKey`.
 */
const PROFESSION_ALIASES = {
  'psicologa': 'Psicólogo(a)',
  'psicologo clinico': 'Psicólogo(a)',
  'psicologia': 'Psicólogo(a)',
  'psico': 'Psicólogo(a)',
  'neuropsicologa': 'Neuropsicólogo(a)',
  'psicopedagoga': 'Psicopedagogo(a)',
  'fonoaudiologa': 'Fonoaudiólogo(a)',
  'fonoaudiologia': 'Fonoaudiólogo(a)',
  'fono': 'Fonoaudiólogo(a)',
  'to': 'Terapeuta Ocupacional',
  'terapia ocupacional': 'Terapeuta Ocupacional',
  'fisioterapia': 'Fisioterapeuta',
  'fisio': 'Fisioterapeuta',
  'nutricao': 'Nutricionista',
  'educador fisico': 'Educador(a) Físico(a)',
  'educadora fisica': 'Educador(a) Físico(a)',
  'profissional de educacao fisica': 'Educador(a) Físico(a)',
  'educacao fisica': 'Educador(a) Físico(a)',
  'at': 'Acompanhante Terapêutico (AT)',
  'aba': 'Terapeuta ABA',
  'aplicador aba': 'Aplicador(a) ABA',
  'aplicadora aba': 'Aplicador(a) ABA',
  'supervisor aba': 'Supervisor(a) de Caso (ABA)',
  'supervisora aba': 'Supervisor(a) de Caso (ABA)',
  'supervisor de caso': 'Supervisor(a) de Caso (ABA)',
  'analista do comportamento aplicada': 'Analista do Comportamento',
  'mediadora terapeutica': 'Mediador(a) Terapêutico(a)',
  'coordenadora clinica': 'Coordenador(a) Clínico(a)',
  'pedagoga': 'Pedagogo(a)',
  'pedagogia': 'Pedagogo(a)',
  'professora de educacao especial': 'Professor(a) de Educação Especial',
  'educacao especial': 'Professor(a) de Educação Especial',
  'mediadora escolar': 'Mediador(a) Escolar / Auxiliar de Inclusão',
  'mediador escolar': 'Mediador(a) Escolar / Auxiliar de Inclusão',
  'auxiliar de inclusao': 'Mediador(a) Escolar / Auxiliar de Inclusão',
  'libras': 'Intérprete de Libras',
  'auxiliar administrativo': 'Assistente Administrativo(a)',
  'administrativo': 'Assistente Administrativo(a)',
  'secretaria': 'Recepcionista',
  'auxiliar de limpeza': 'Auxiliar de Serviços Gerais',
  'servicos gerais': 'Auxiliar de Serviços Gerais',
  'contabilidade': 'Contador(a)',
  'advogada': 'Advogado(a)',
  'rh': 'Analista de Recursos Humanos',
  'analista de rh': 'Analista de Recursos Humanos',
  'financeiro': 'Analista Financeiro(a)',
  'marketing': 'Analista de Marketing',
  'social media': 'Analista de Marketing',
  'designer': 'Designer Gráfico(a)',
  'ti': 'Analista de TI / Desenvolvedor(a) de Software',
  'desenvolvedor': 'Analista de TI / Desenvolvedor(a) de Software',
};

const PROFESSION_BY_KEY = PROFESSIONS.reduce((acc, p) => {
  acc[canonicalKey(p.value)] = p;
  acc[canonicalKey(p.slug)] = p;
  return acc;
}, {});

/**
 * Converte um texto livre no valor canônico do catálogo.
 * Retorna '' quando não há correspondência (cadastro fora do catálogo).
 */
export const normalizeProfessionValue = (raw) => {
  const key = canonicalKey(raw);
  if (!key) return '';
  const direct = PROFESSION_BY_KEY[key];
  if (direct) return direct.value;
  const alias = PROFESSION_ALIASES[key];
  if (alias) return alias;
  return '';
};

/** Retorna o registro completo da profissão (com `slug`) a partir de qualquer texto. */
export const findProfession = (raw) => {
  const value = normalizeProfessionValue(raw);
  return PROFESSIONS.find(p => p.value === value) || null;
};

/** Slug estável da profissão, para integração com sistemas externos. */
export const getProfessionSlug = (raw) => findProfession(raw)?.slug || '';

/** Conselho de classe usual da profissão (ex.: 'CRP'); '' quando não há. */
export const getProfessionCouncil = (raw) => findProfession(raw)?.council || '';

/** Slug do curso acadêmico equivalente, em `academicCourses.js`. */
export const getProfessionCourseSlug = (raw) => findProfession(raw)?.courseSlug || '';
