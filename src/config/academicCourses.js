/**
 * Catálogo fechado de cursos acadêmicos e de tipos de estágio.
 *
 * Serve de base para o cadastro de estagiários e para integrações externas:
 * `value` é o texto canônico gravado em `interns.course` (mantém legibilidade
 * em contratos e relatórios) e `slug` é a chave estável para outros sistemas.
 *
 * Fontes de referência da nomenclatura: Catálogo Nacional de Cursos Superiores /
 * Cursos de Graduação do Brasil (MEC) e Catálogo Nacional de Cursos Técnicos.
 */

export const COURSE_AREAS = [
  'Saúde e Bem-estar',
  'Educação',
  'Ciências Humanas e Sociais',
  'Gestão e Negócios',
  'Exatas, Computação e Engenharias',
  'Comunicação e Artes',
  'Ciências Agrárias e Ambientais',
  'Cursos Técnicos',
];

const course = (slug, value, area) => ({ slug, value, area });

export const ACADEMIC_COURSES = [
  // ---------------------------------------------------------------- Saúde
  course('psicologia', 'Psicologia', 'Saúde e Bem-estar'),
  course('psicopedagogia', 'Psicopedagogia', 'Saúde e Bem-estar'),
  course('terapia-ocupacional', 'Terapia Ocupacional', 'Saúde e Bem-estar'),
  course('fonoaudiologia', 'Fonoaudiologia', 'Saúde e Bem-estar'),
  course('fisioterapia', 'Fisioterapia', 'Saúde e Bem-estar'),
  course('nutricao', 'Nutrição', 'Saúde e Bem-estar'),
  course('educacao-fisica', 'Educação Física', 'Saúde e Bem-estar'),
  course('enfermagem', 'Enfermagem', 'Saúde e Bem-estar'),
  course('medicina', 'Medicina', 'Saúde e Bem-estar'),
  course('odontologia', 'Odontologia', 'Saúde e Bem-estar'),
  course('farmacia', 'Farmácia', 'Saúde e Bem-estar'),
  course('biomedicina', 'Biomedicina', 'Saúde e Bem-estar'),
  course('medicina-veterinaria', 'Medicina Veterinária', 'Saúde e Bem-estar'),
  course('musicoterapia', 'Musicoterapia', 'Saúde e Bem-estar'),
  course('arteterapia', 'Arteterapia', 'Saúde e Bem-estar'),
  course('terapias-integrativas', 'Terapias Integrativas e Complementares', 'Saúde e Bem-estar'),
  course('saude-coletiva', 'Saúde Coletiva', 'Saúde e Bem-estar'),
  course('gestao-hospitalar', 'Gestão Hospitalar', 'Saúde e Bem-estar'),
  course('gerontologia', 'Gerontologia', 'Saúde e Bem-estar'),
  course('optometria', 'Optometria', 'Saúde e Bem-estar'),
  course('quiropraxia', 'Quiropraxia', 'Saúde e Bem-estar'),
  course('osteopatia', 'Osteopatia', 'Saúde e Bem-estar'),
  course('naturologia', 'Naturologia', 'Saúde e Bem-estar'),
  course('estetica-e-cosmetica', 'Estética e Cosmética', 'Saúde e Bem-estar'),
  course('radiologia', 'Radiologia / Tecnologia em Radiologia', 'Saúde e Bem-estar'),
  course('biologia', 'Ciências Biológicas', 'Saúde e Bem-estar'),

  // ------------------------------------------------------------- Educação
  course('pedagogia', 'Pedagogia', 'Educação'),
  course('educacao-especial', 'Educação Especial', 'Educação'),
  course('letras', 'Letras', 'Educação'),
  course('letras-libras', 'Letras - Libras', 'Educação'),
  course('historia', 'História', 'Educação'),
  course('geografia', 'Geografia', 'Educação'),
  course('matematica', 'Matemática', 'Educação'),
  course('fisica', 'Física', 'Educação'),
  course('quimica', 'Química', 'Educação'),
  course('filosofia', 'Filosofia', 'Educação'),
  course('sociologia', 'Sociologia', 'Educação'),
  course('artes-visuais', 'Artes Visuais', 'Educação'),
  course('musica', 'Música', 'Educação'),
  course('teatro', 'Teatro', 'Educação'),
  course('danca', 'Dança', 'Educação'),

  // ---------------------------------------- Ciências Humanas e Sociais
  course('servico-social', 'Serviço Social', 'Ciências Humanas e Sociais'),
  course('direito', 'Direito', 'Ciências Humanas e Sociais'),
  course('psicanalise', 'Psicanálise', 'Ciências Humanas e Sociais'),
  course('antropologia', 'Antropologia', 'Ciências Humanas e Sociais'),
  course('ciencias-sociais', 'Ciências Sociais', 'Ciências Humanas e Sociais'),
  course('ciencia-politica', 'Ciência Política', 'Ciências Humanas e Sociais'),
  course('teologia', 'Teologia', 'Ciências Humanas e Sociais'),
  course('relacoes-internacionais', 'Relações Internacionais', 'Ciências Humanas e Sociais'),

  // ------------------------------------------------- Gestão e Negócios
  course('administracao', 'Administração', 'Gestão e Negócios'),
  course('ciencias-contabeis', 'Ciências Contábeis', 'Gestão e Negócios'),
  course('economia', 'Ciências Econômicas', 'Gestão e Negócios'),
  course('gestao-de-rh', 'Gestão de Recursos Humanos', 'Gestão e Negócios'),
  course('gestao-financeira', 'Gestão Financeira', 'Gestão e Negócios'),
  course('gestao-comercial', 'Gestão Comercial', 'Gestão e Negócios'),
  course('marketing', 'Marketing', 'Gestão e Negócios'),
  course('logistica', 'Logística', 'Gestão e Negócios'),
  course('processos-gerenciais', 'Processos Gerenciais', 'Gestão e Negócios'),
  course('secretariado-executivo', 'Secretariado Executivo', 'Gestão e Negócios'),
  course('turismo', 'Turismo', 'Gestão e Negócios'),
  course('hotelaria', 'Hotelaria', 'Gestão e Negócios'),
  course('gastronomia', 'Gastronomia', 'Gestão e Negócios'),

  // ------------------------- Exatas, Computação e Engenharias
  course('ciencia-da-computacao', 'Ciência da Computação', 'Exatas, Computação e Engenharias'),
  course('sistemas-de-informacao', 'Sistemas de Informação', 'Exatas, Computação e Engenharias'),
  course('analise-e-desenvolvimento-de-sistemas', 'Análise e Desenvolvimento de Sistemas', 'Exatas, Computação e Engenharias'),
  course('engenharia-de-software', 'Engenharia de Software', 'Exatas, Computação e Engenharias'),
  course('redes-de-computadores', 'Redes de Computadores', 'Exatas, Computação e Engenharias'),
  course('ciencia-de-dados', 'Ciência de Dados', 'Exatas, Computação e Engenharias'),
  course('engenharia-civil', 'Engenharia Civil', 'Exatas, Computação e Engenharias'),
  course('engenharia-eletrica', 'Engenharia Elétrica', 'Exatas, Computação e Engenharias'),
  course('engenharia-mecanica', 'Engenharia Mecânica', 'Exatas, Computação e Engenharias'),
  course('engenharia-de-producao', 'Engenharia de Produção', 'Exatas, Computação e Engenharias'),
  course('engenharia-ambiental', 'Engenharia Ambiental', 'Exatas, Computação e Engenharias'),
  course('engenharia-quimica', 'Engenharia Química', 'Exatas, Computação e Engenharias'),
  course('engenharia-biomedica', 'Engenharia Biomédica', 'Exatas, Computação e Engenharias'),
  course('arquitetura-e-urbanismo', 'Arquitetura e Urbanismo', 'Exatas, Computação e Engenharias'),
  course('estatistica', 'Estatística', 'Exatas, Computação e Engenharias'),

  // ------------------------------------------- Comunicação e Artes
  course('jornalismo', 'Jornalismo', 'Comunicação e Artes'),
  course('publicidade-e-propaganda', 'Publicidade e Propaganda', 'Comunicação e Artes'),
  course('relacoes-publicas', 'Relações Públicas', 'Comunicação e Artes'),
  course('design', 'Design', 'Comunicação e Artes'),
  course('design-grafico', 'Design Gráfico', 'Comunicação e Artes'),
  course('design-de-interiores', 'Design de Interiores', 'Comunicação e Artes'),
  course('cinema-e-audiovisual', 'Cinema e Audiovisual', 'Comunicação e Artes'),
  course('moda', 'Moda', 'Comunicação e Artes'),

  // -------------------------------- Ciências Agrárias e Ambientais
  course('agronomia', 'Agronomia', 'Ciências Agrárias e Ambientais'),
  course('zootecnia', 'Zootecnia', 'Ciências Agrárias e Ambientais'),
  course('gestao-ambiental', 'Gestão Ambiental', 'Ciências Agrárias e Ambientais'),
  course('engenharia-de-alimentos', 'Engenharia de Alimentos', 'Ciências Agrárias e Ambientais'),

  // ------------------------------------------------- Cursos Técnicos
  course('tecnico-enfermagem', 'Técnico em Enfermagem', 'Cursos Técnicos'),
  course('tecnico-administracao', 'Técnico em Administração', 'Cursos Técnicos'),
  course('tecnico-secretariado', 'Técnico em Secretariado', 'Cursos Técnicos'),
  course('tecnico-informatica', 'Técnico em Informática', 'Cursos Técnicos'),
  course('tecnico-contabilidade', 'Técnico em Contabilidade', 'Cursos Técnicos'),
  course('tecnico-seguranca-do-trabalho', 'Técnico em Segurança do Trabalho', 'Cursos Técnicos'),
  course('tecnico-recursos-humanos', 'Técnico em Recursos Humanos', 'Cursos Técnicos'),
  course('tecnico-nutricao-e-dietetica', 'Técnico em Nutrição e Dietética', 'Cursos Técnicos'),
  course('tecnico-saude-bucal', 'Técnico em Saúde Bucal', 'Cursos Técnicos'),
  course('tecnico-radiologia', 'Técnico em Radiologia', 'Cursos Técnicos'),
  course('tecnico-analises-clinicas', 'Técnico em Análises Clínicas', 'Cursos Técnicos'),
  course('tecnico-farmacia', 'Técnico em Farmácia', 'Cursos Técnicos'),
];

/** Cursos agrupados por área, na ordem de `COURSE_AREAS`. */
export const COURSES_BY_AREA = COURSE_AREAS
  .map(area => ({ area, courses: ACADEMIC_COURSES.filter(c => c.area === area) }))
  .filter(g => g.courses.length > 0);

/** Lista simples dos textos canônicos aceitos em `interns.course`. */
export const COURSE_VALUES = ACADEMIC_COURSES.map(c => c.value);

const stripAccents = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const canonicalKey = (s) =>
  stripAccents(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Apelidos de cadastros antigos (texto livre) para o valor canônico.
 * Chave já normalizada por `canonicalKey`.
 */
const COURSE_ALIASES = {
  'bacharel em fonoaudiologia': 'Fonoaudiologia',
  'bacharelado em fonoaudiologia': 'Fonoaudiologia',
  'fono': 'Fonoaudiologia',
  'psicologia bacharelado': 'Psicologia',
  'bacharel em psicologia': 'Psicologia',
  'psicologia clinica': 'Psicologia',
  'psico': 'Psicologia',
  'to': 'Terapia Ocupacional',
  'terapeuta ocupacional': 'Terapia Ocupacional',
  'terapia': 'Terapia Ocupacional',
  'educacao fisica bacharelado': 'Educação Física',
  'educacao fisica licenciatura': 'Educação Física',
  'ed fisica': 'Educação Física',
  'bacharel em fisioterapia': 'Fisioterapia',
  'licenciatura plena em musica': 'Música',
  'licenciatura em musica': 'Música',
  'psicoterapia': 'Psicanálise',
  'nutricao e dietetica': 'Nutrição',
  'ads': 'Análise e Desenvolvimento de Sistemas',
  'rh': 'Gestão de Recursos Humanos',
};

const COURSE_BY_KEY = ACADEMIC_COURSES.reduce((acc, c) => {
  acc[canonicalKey(c.value)] = c;
  acc[canonicalKey(c.slug)] = c;
  return acc;
}, {});

/**
 * Converte um texto livre no valor canônico do catálogo.
 * Retorna '' quando não há correspondência (cadastro fora do catálogo).
 */
export const normalizeCourseValue = (raw) => {
  const key = canonicalKey(raw);
  if (!key) return '';
  const direct = COURSE_BY_KEY[key];
  if (direct) return direct.value;
  const alias = COURSE_ALIASES[key];
  if (alias) return alias;
  return '';
};

/** Retorna o registro completo do curso (com `slug`) a partir de qualquer texto. */
export const findCourse = (raw) => {
  const value = normalizeCourseValue(raw);
  return ACADEMIC_COURSES.find(c => c.value === value) || null;
};

/** Slug estável do curso, para integração com sistemas externos. */
export const getCourseSlug = (raw) => findCourse(raw)?.slug || '';

// ------------------------------------------------------- Tipo de estágio

export const INTERNSHIP_TYPES = [
  {
    value: 'obrigatorio',
    label: 'Obrigatório',
    description: 'Exigido pela grade curricular como requisito para a diplomação.',
  },
  {
    value: 'nao_obrigatorio',
    label: 'Não obrigatório',
    description: 'Atividade opcional, realizada como acréscimo à formação.',
  },
];

export const INTERNSHIP_TYPE_VALUES = INTERNSHIP_TYPES.map(t => t.value);

export const getInternshipTypeLabel = (value) =>
  INTERNSHIP_TYPES.find(t => t.value === value)?.label || '';
