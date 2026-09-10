// Templates HTML dos documentos do módulo Funcionários CLT — mesmo padrão
// visual usado em App.jsx getDocumentHtml (fonte Inter, cabeçalho com
// razão social/CNPJ/endereço da unidade), mas mantidos fora do App.jsx para
// não inflar ainda mais aquele arquivo.
//
// ctx = { employee, unit, branding, dependents, extra }
//   employee: objeto mapEmployeeFromDb
//   unit: objeto mapUnitFromDb (ou fallback de kioskUnits)
//   branding: BRANDING
//   dependents: [] de mapDependentFromDb
//   extra: dados específicos do tipo de documento (ver cada template)

import { CONTRACT_TYPES } from '../config/cltConstants';

const fmtDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR') : '____/____/________');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '____/____/________ __:__');
const fmtMoney = (v) => (v != null && v !== '' ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ ____________');
const blank = (v, fallback = '____________________') => (v && String(v).trim() ? v : fallback);

function buildHeader(unit, branding) {
  const razaoSocial = unit?.razaoSocial || branding.legalEntityName;
  const cnpj = unit?.cnpj || branding.cnpj;
  const address = unit?.address || branding.documentLocation;
  const phone = unit?.phone || branding.phone;
  const displayName = unit?.name || branding.displayName;
  const logo = unit?.logoUrl || branding.logoPath;

  return `
    <div style="text-align: center; border-bottom: 2px solid #4338ca; padding-bottom: 15px; margin-bottom: 25px;">
      ${logo ? `<img src="${logo}" style="height: 60px; margin-bottom: 10px; object-fit: contain;" alt="${displayName}" />` : ''}
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #312e81; letter-spacing: 1px;">${String(displayName).toUpperCase()}</h1>
      <p style="margin: 4px 0 0; font-size: 10px; text-transform: uppercase; color: #4b5563; font-weight: 600; letter-spacing: 1px;">${razaoSocial} • CNPJ: ${cnpj}</p>
      <p style="margin: 2px 0 0; font-size: 8px; color: #6b7280;">${address} ${phone ? `• Tel: ${phone}` : ''}</p>
    </div>
  `;
}

function buildFooter(unit, branding) {
  const razaoSocial = unit?.razaoSocial || branding.legalEntityName;
  return `
    <div style="margin-top: 50px; border-top: 1px solid #e5e7eb; padding-top: 10px; text-align: center; font-size: 8px; color: #9ca3af;">
      ${razaoSocial} • Documento eletrônico gerado pelo hub de RH para fins de registro trabalhista.
    </div>
  `;
}

function wrap(title, bodyHtml, ctx) {
  const custom = ctx.unit?.cltCustomContractText
    ? `<div style="margin-top:20px; padding:10px; border:1px dashed #c7d2fe; font-size:9px; color:#4338ca;">${ctx.unit.cltCustomContractText}</div>`
    : '';
  return `
    ${buildHeader(ctx.unit, ctx.branding)}
    <h2 style="text-align:center; font-size:15px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; color:#1f2937; margin-bottom:20px;">${title}</h2>
    <div style="font-size:11px; line-height:1.7; color:#1f2937; text-align:justify;">
      ${bodyHtml}
    </div>
    ${custom}
    ${buildFooter(ctx.unit, ctx.branding)}
  `;
}

function signatureBlock(employeeName, extraSignatureLabel) {
  return `
    <div style="display:flex; justify-content:space-between; margin-top:60px; gap:40px;">
      <div style="flex:1; text-align:center;">
        <div style="border-top:1px solid #1f2937; padding-top:6px; font-size:10px;">${blank(employeeName, 'Empregado(a)')}</div>
      </div>
      <div style="flex:1; text-align:center;">
        <div style="border-top:1px solid #1f2937; padding-top:6px; font-size:10px;">${extraSignatureLabel || 'Empregador(a) / RH'}</div>
      </div>
    </div>
  `;
}

function employeeSummary(employee) {
  return `
    <p><strong>Empregado(a):</strong> ${blank(employee?.name)} — CPF ${blank(employee?.cpf)}${employee?.ctpsNumber ? `, CTPS ${employee.ctpsNumber}/${employee.ctpsSeries || '—'}/${employee.ctpsUf || '—'}` : ''}</p>
    <p><strong>Cargo:</strong> ${blank(employee?.jobTitle)} ${employee?.cbo ? `(CBO ${employee.cbo})` : ''} — <strong>Admissão:</strong> ${fmtDate(employee?.admissionDate)}</p>
  `;
}

const TEMPLATES = {
  contrato_experiencia: (ctx) => wrap('Contrato de Experiência', `
    ${employeeSummary(ctx.employee)}
    <p>As partes acima identificadas firmam o presente <strong>Contrato de Experiência</strong>, nos termos do art. 443, §2º, "c", da CLT,
    com vigência de ${fmtDate(ctx.employee?.admissionDate)} a ${fmtDate(ctx.employee?.experienceFirstEnd)}${ctx.employee?.experienceSecondEnd ? `, prorrogável até ${fmtDate(ctx.employee?.experienceSecondEnd)}` : ', sem prorrogação'},
    respeitado o limite máximo de 90 (noventa) dias corridos somados os dois períodos.</p>
    <p><strong>Jornada:</strong> ${blank(ctx.employee?.weeklyHours)}h semanais. <strong>Salário base:</strong> ${fmtMoney(ctx.employee?.baseSalary)}.</p>
    <p><strong>Jornada e intervalos:</strong> a jornada será cumprida conforme escala definida pelo empregador, respeitados o
    limite de 8 (oito) horas diárias e 44 (quarenta e quatro) horas semanais, o intervalo intrajornada de no mínimo 1 (uma)
    hora para jornadas superiores a 6 (seis) horas e o intervalo interjornadas de 11 (onze) horas consecutivas.</p>
    <p><strong>Confidencialidade:</strong> o(a) empregado(a) obriga-se a manter sigilo sobre dados de pacientes/clientes e
    sobre informações comerciais, técnicas e estratégicas a que tiver acesso, durante a vigência do contrato e após o seu
    término, observada a Lei nº 13.709/2018 (LGPD).</p>
    <p><strong>Demais condições:</strong> aplicam-se a este contrato as normas da CLT, o regulamento interno e as políticas
    da empresa e a convenção ou acordo coletivo da categoria, que o(a) empregado(a) declara conhecer.</p>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  prorrogacao_experiencia: (ctx) => wrap('Termo de Prorrogação de Experiência', `
    ${employeeSummary(ctx.employee)}
    <p>Fica prorrogado o contrato de experiência do(a) empregado(a) acima, do dia seguinte ao término do primeiro período
    (${fmtDate(ctx.employee?.experienceFirstEnd)}) até ${fmtDate(ctx.employee?.experienceSecondEnd)}, permitida apenas esta
    única prorrogação, nos termos do art. 451 da CLT (a soma dos períodos não pode exceder 90 dias).</p>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  contrato_indeterminado: (ctx) => wrap('Contrato de Trabalho por Prazo Indeterminado', `
    ${employeeSummary(ctx.employee)}
    <p>As partes firmam contrato individual de trabalho por prazo indeterminado, com início em ${fmtDate(ctx.employee?.admissionDate)},
    jornada de ${blank(ctx.employee?.weeklyHours)}h semanais e salário base de ${fmtMoney(ctx.employee?.baseSalary)}, observadas as
    normas da CLT e da convenção/acordo coletivo aplicável${ctx.employee?.unionName ? ` (${ctx.employee.unionName})` : ''}.</p>
    <p><strong>Confidencialidade e proteção de dados:</strong> o(a) empregado(a) obriga-se a manter sigilo sobre dados de
    pacientes/clientes e sobre informações comerciais, técnicas e estratégicas a que tiver acesso, durante a vigência do
    contrato e após o seu término, observada a Lei nº 13.709/2018 (LGPD).</p>
    <p><strong>Propriedade intelectual:</strong> pertencem exclusivamente ao empregador os direitos sobre materiais,
    protocolos, métodos, textos e demais criações desenvolvidas pelo(a) empregado(a) no exercício das funções contratadas,
    nos termos da Lei nº 9.610/1998 e da Lei nº 9.279/1996.</p>
    <p><strong>Código de conduta e políticas internas:</strong> o(a) empregado(a) declara conhecer e obriga-se a observar o
    regulamento interno, o código de conduta e as demais políticas da empresa, cujo descumprimento o(a) sujeita às
    penalidades previstas no art. 482 da CLT.</p>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  ficha_registro: (ctx) => wrap('Ficha de Registro de Empregado (art. 41 CLT)', `
    <table style="width:100%; border-collapse:collapse; font-size:10px;">
      ${[
        ['Nome', ctx.employee?.name], ['CPF', ctx.employee?.cpf], ['RG', `${ctx.employee?.rg || ''} ${ctx.employee?.rgIssuer || ''}`],
        ['Data de nascimento', fmtDate(ctx.employee?.birthdate)], ['Nacionalidade', ctx.employee?.nationality], ['Naturalidade', ctx.employee?.birthplace],
        ['Estado civil', ctx.employee?.maritalStatus], ['Nome da mãe', ctx.employee?.motherName], ['Nome do pai', ctx.employee?.fatherName],
        ['CTPS', `${ctx.employee?.ctpsNumber || ''}/${ctx.employee?.ctpsSeries || ''}/${ctx.employee?.ctpsUf || ''}`], ['PIS/PASEP/NIT', ctx.employee?.pis],
        ['Endereço', [ctx.employee?.address?.logradouro, ctx.employee?.address?.numero, ctx.employee?.address?.bairro, ctx.employee?.address?.cidade, ctx.employee?.address?.uf].filter(Boolean).join(', ')],
        ['Cargo', ctx.employee?.jobTitle], ['CBO', ctx.employee?.cbo], ['Departamento', ctx.employee?.department],
        ['Data de admissão', fmtDate(ctx.employee?.admissionDate)], ['Tipo de contrato', CONTRACT_TYPES.find((c) => c.key === ctx.employee?.contractType)?.label || ctx.employee?.contractType],
        ['Salário base', fmtMoney(ctx.employee?.baseSalary)], ['Jornada semanal', `${blank(ctx.employee?.weeklyHours, '—')}h`],
      ].map(([label, value]) => `<tr><td style="padding:4px 8px; border:1px solid #e5e7eb; font-weight:700; width:35%;">${label}</td><td style="padding:4px 8px; border:1px solid #e5e7eb;">${blank(value, '—')}</td></tr>`).join('')}
    </table>
  `, ctx),

  acordo_compensacao: (ctx) => wrap('Acordo Individual de Compensação de Horas', `
    ${employeeSummary(ctx.employee)}
    <p>As partes acordam a compensação de horas de trabalho, nos termos do art. 59, §6º, da CLT, mediante o qual eventuais
    horas excedentes em um dia poderão ser compensadas com a correspondente diminuição em outro dia, dentro do mesmo mês,
    sem a geração de horas extraordinárias, respeitados os limites de jornada diária (máximo de 2 horas extras) e o
    intervalo interjornadas de 11 horas.</p>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  acordo_banco_horas: (ctx) => wrap('Acordo de Banco de Horas', `
    ${employeeSummary(ctx.employee)}
    <p>As partes acordam a instituição de banco de horas, nos termos do art. 59, §5º, da CLT, com compensação no prazo
    máximo de 6 (seis) meses contados de ${fmtDate(ctx.employee?.hoursBankStartedAt)}, mediante o qual as horas trabalhadas
    além da jornada normal serão compensadas por correspondente diminuição de jornada em outro dia, sem acréscimo salarial,
    respeitados os limites legais de jornada diária e o intervalo interjornadas.</p>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  opcao_vt: (ctx) => wrap('Declaração de Opção de Vale-Transporte', `
    ${employeeSummary(ctx.employee)}
    <p>Nos termos da Lei nº 7.418/1985, declaro estar ciente de que o Vale-Transporte se destina exclusivamente ao custeio
    das despesas de deslocamento residência-trabalho e vice-versa, e ${ctx.employee?.vtOpted ? `<strong>opto por recebê-lo</strong>,
    autorizando o desconto de até 6% do meu salário base, limitado ao valor efetivamente gasto (custo diário informado:
    ${fmtMoney(ctx.employee?.vtDailyCost)})` : '<strong>declaro não ter interesse no benefício</strong>, renunciando expressamente ao seu recebimento'}.</p>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  declaracao_dependentes_ir: (ctx) => wrap('Declaração de Dependentes para Imposto de Renda', `
    ${employeeSummary(ctx.employee)}
    <p>Declaro, para fins de desconto do Imposto de Renda Retido na Fonte, os seguintes dependentes:</p>
    <table style="width:100%; border-collapse:collapse; font-size:10px; margin-top:10px;">
      <tr><th style="padding:4px 8px; border:1px solid #e5e7eb; text-align:left;">Nome</th><th style="padding:4px 8px; border:1px solid #e5e7eb;">CPF</th><th style="padding:4px 8px; border:1px solid #e5e7eb;">Nascimento</th><th style="padding:4px 8px; border:1px solid #e5e7eb;">Parentesco</th></tr>
      ${(ctx.dependents || []).map((d) => `<tr><td style="padding:4px 8px; border:1px solid #e5e7eb;">${d.name}</td><td style="padding:4px 8px; border:1px solid #e5e7eb;">${blank(d.cpf, '—')}</td><td style="padding:4px 8px; border:1px solid #e5e7eb;">${fmtDate(d.birthdate)}</td><td style="padding:4px 8px; border:1px solid #e5e7eb;">${blank(d.relationship, '—')}</td></tr>`).join('') || '<tr><td colspan="4" style="padding:8px; text-align:center; color:#9ca3af;">Nenhum dependente informado.</td></tr>'}
    </table>
    <p style="margin-top:12px;">Comprometo-me a informar qualquer alteração nesta condição.</p>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  termo_biometria_lgpd: (ctx) => wrap('Termo de Consentimento — Uso de Biometria Facial (LGPD)', `
    ${employeeSummary(ctx.employee)}
    <p>Nos termos do art. 7º, IX, e art. 11 da Lei nº 13.709/2018 (LGPD), declaro estar ciente e consentir com a coleta e
    o tratamento do meu dado biométrico facial (dado pessoal sensível), com a finalidade exclusiva de autenticação para
    registro do ponto eletrônico no quiosque desta unidade. Fui informado(a) de que:</p>
    <ul>
      <li>o dado biométrico é utilizado apenas para comparação no momento da marcação, sem outra finalidade;</li>
      <li>posso solicitar, a qualquer momento, informações sobre o tratamento, correção ou eliminação do meu dado, observados os prazos de guarda legal dos registros trabalhistas;</li>
      <li>a recusa em fornecer o dado biométrico impede o uso do quiosque eletrônico, sendo necessário procurar o RH para alternativa de registro;</li>
      <li>as imagens capturadas no momento da marcação são guardadas pelo mesmo prazo dos registros de ponto a que se referem — 5 (cinco) anos — e eliminadas ao final desse período;</li>
      <li>os direitos previstos no art. 18 da LGPD (confirmação, acesso, correção, anonimização, portabilidade, eliminação e revogação do consentimento) podem ser exercidos junto ao setor de Recursos Humanos desta unidade, que responderá nos prazos legais.</li>
    </ul>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  termo_equipamentos: (ctx) => wrap('Termo de Responsabilidade de Equipamentos', `
    ${employeeSummary(ctx.employee)}
    <p>Declaro ter recebido os equipamentos/materiais/uniformes/EPIs relacionados a seguir, comprometendo-me a zelar por
    sua conservação e devolvê-los em caso de desligamento, sob pena de desconto no valor correspondente, mediante prévia
    autorização, conforme legislação aplicável.</p>
    <div style="border:1px solid #e5e7eb; border-radius:6px; padding:10px; min-height:60px; margin-top:10px;">${ctx.extra?.itemsText || ''}</div>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  termo_confidencialidade: (ctx) => wrap('Termo de Confidencialidade', `
    ${employeeSummary(ctx.employee)}
    <p>Comprometo-me a manter sigilo sobre todas as informações confidenciais a que tiver acesso em razão do meu vínculo
    empregatício, incluindo dados de pacientes/clientes, informações comerciais e estratégicas, mesmo após o término do
    contrato de trabalho.</p>
    <p>A obrigação de sigilo vigora durante toda a vigência do contrato de trabalho e pelo prazo de 5 (cinco) anos após o seu
    término, ou enquanto a informação mantiver caráter confidencial. O descumprimento sujeita o(a) empregado(a) à
    responsabilização civil pelas perdas e danos apurados, sem prejuízo das medidas disciplinares cabíveis — inclusive
    dispensa por justa causa (art. 482, "g", da CLT) — e das sanções penais aplicáveis.</p>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  aviso_ferias: (ctx) => wrap('Aviso de Férias', `
    ${employeeSummary(ctx.employee)}
    <p>Nos termos do art. 135 da CLT, comunicamos que suas férias, referentes ao período aquisitivo de
    ${fmtDate(ctx.extra?.acquisitionStart)} a ${fmtDate(ctx.extra?.acquisitionEnd)}, foram concedidas de
    ${fmtDate(ctx.extra?.startDate)} a ${fmtDate(ctx.extra?.endDate)} (${blank(ctx.extra?.days, '30')} dias)${ctx.extra?.abonoDays ? `, com abono pecuniário de ${ctx.extra.abonoDays} dias` : ''},
    com no mínimo 30 dias de antecedência, conforme exigido em lei.</p>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  recibo_ferias: (ctx) => wrap('Recibo de Férias', `
    ${employeeSummary(ctx.employee)}
    <p>Declaro ter recebido, nesta data, o pagamento referente às férias do período de ${fmtDate(ctx.extra?.startDate)}
    a ${fmtDate(ctx.extra?.endDate)}${ctx.extra?.abonoDays ? `, incluindo o abono pecuniário de ${ctx.extra.abonoDays} dias (art. 143 CLT)` : ''},
    acrescido do terço constitucional, nada mais tendo a reclamar a este título.</p>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  comunicacao_abono: (ctx) => wrap('Comunicação de Abono Pecuniário', `
    ${employeeSummary(ctx.employee)}
    <p>Nos termos do art. 143 da CLT, comunico o interesse em converter ${blank(ctx.extra?.abonoDays, '____')} dias de férias
    em abono pecuniário, referente ao período aquisitivo de ${fmtDate(ctx.extra?.acquisitionStart)} a ${fmtDate(ctx.extra?.acquisitionEnd)},
    respeitado o limite de 1/3 do período de férias e o prazo de até 15 dias antes do término do período aquisitivo.</p>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  advertencia: (ctx) => wrap('Advertência Escrita', `
    ${employeeSummary(ctx.employee)}
    <p><strong>Data do fato:</strong> ${fmtDate(ctx.extra?.startDate)}</p>
    <p><strong>Descrição da conduta:</strong></p>
    <div style="border:1px solid #e5e7eb; border-radius:6px; padding:10px; min-height:60px;">${ctx.extra?.description || ''}</div>
    <p style="margin-top:10px;">Fica o(a) empregado(a) advertido(a) formalmente, ficando ciente de que a reincidência poderá
    ensejar penalidades mais severas, incluindo suspensão disciplinar ou dispensa por justa causa (art. 482, CLT).</p>
    ${signatureBlock(ctx.employee?.name, 'Responsável pela advertência')}
  `, ctx),

  suspensao: (ctx) => wrap('Suspensão Disciplinar', `
    ${employeeSummary(ctx.employee)}
    <p><strong>Período de suspensão:</strong> ${fmtDate(ctx.extra?.startDate)} a ${fmtDate(ctx.extra?.endDate)} (${blank(ctx.extra?.days, '—')} dia(s), respeitado o limite de 30 dias — art. 474 CLT).</p>
    <p><strong>Motivo:</strong></p>
    <div style="border:1px solid #e5e7eb; border-radius:6px; padding:10px; min-height:60px;">${ctx.extra?.description || ''}</div>
    <p style="margin-top:10px;">Durante o período, ficam suspensos os efeitos do contrato de trabalho, sem prejuízo do tempo de serviço.</p>
    ${signatureBlock(ctx.employee?.name, 'Responsável pela suspensão')}
  `, ctx),

  aviso_previo_empregador: (ctx) => wrap('Comunicação de Aviso Prévio', `
    ${employeeSummary(ctx.employee)}
    <p>Comunicamos a concessão de aviso prévio ${ctx.extra?.noticeType === 'indenizado' ? 'indenizado' : 'trabalhado'},
    com ${blank(ctx.extra?.noticeDays, '30')} dias, contados a partir de ${fmtDate(ctx.extra?.noticeStart)}, com término
    projetado em ${fmtDate(ctx.extra?.projectedEnd)}${ctx.extra?.noticeType === 'trabalhado' ? `, ${ctx.extra?.noticeReduction === '7_dias' ? 'com redução de 7 dias corridos a cada 9 dias trabalhados' : 'com redução de 2 horas diárias na jornada'} (art. 488, CLT)` : ''}.</p>
    <p>O pagamento das verbas rescisórias deverá ocorrer em até 10 dias corridos a contar do término do contrato (art. 477, §6º, CLT), previsto para ${fmtDate(ctx.extra?.paymentDeadline)}.</p>
    ${signatureBlock(ctx.employee?.name, 'Empregador(a) / RH')}
  `, ctx),

  pedido_demissao: (ctx) => wrap('Pedido de Demissão', `
    ${employeeSummary(ctx.employee)}
    <p>Eu, ${blank(ctx.employee?.name)}, venho por meio deste comunicar minha intenção de me desligar da empresa,
    solicitando o desligamento a partir de ${fmtDate(ctx.extra?.terminationDate)}, ciente das obrigações relativas ao
    cumprimento (ou indenização) do aviso prévio, conforme legislação vigente.</p>
    ${signatureBlock(ctx.employee?.name)}
  `, ctx),

  encaminhamento_demissional: (ctx) => wrap('Encaminhamento para Exame Médico Demissional', `
    ${employeeSummary(ctx.employee)}
    <p>Encaminhamos o(a) empregado(a) acima para realização de exame médico demissional, nos termos do art. 168, II, da CLT,
    tendo em vista o desligamento previsto para ${fmtDate(ctx.extra?.terminationDate)}. O exame é condição para a formalização
    da rescisão contratual.</p>
    ${signatureBlock(ctx.employee?.name, 'Responsável pelo encaminhamento')}
  `, ctx),

  checklist_rescisorio: (ctx) => wrap('Checklist Rescisório', `
    ${employeeSummary(ctx.employee)}
    <p><strong>Tipo de rescisão:</strong> ${blank(ctx.extra?.typeLabel)}</p>
    <table style="width:100%; border-collapse:collapse; font-size:10px; margin-top:10px;">
      ${(ctx.extra?.checklist || []).map((item) => `<tr><td style="padding:4px 8px; border:1px solid #e5e7eb; width:24px; text-align:center;">${item.done ? '☑' : '☐'}</td><td style="padding:4px 8px; border:1px solid #e5e7eb;">${item.label}</td></tr>`).join('')}
    </table>
    ${signatureBlock(ctx.employee?.name, 'Responsável pelo RH')}
  `, ctx),

  espelho_ponto: (ctx) => wrap(`Espelho de Ponto — Competência ${blank(ctx.extra?.competencia)}`, `
    ${employeeSummary(ctx.employee)}
    <table style="width:100%; border-collapse:collapse; font-size:9px; margin-top:10px;">
      <tr>
        <th style="padding:3px 5px; border:1px solid #e5e7eb;">Data</th>
        <th style="padding:3px 5px; border:1px solid #e5e7eb;">Entrada</th>
        <th style="padding:3px 5px; border:1px solid #e5e7eb;">Intervalo</th>
        <th style="padding:3px 5px; border:1px solid #e5e7eb;">Saída</th>
        <th style="padding:3px 5px; border:1px solid #e5e7eb;">Trab.</th>
        <th style="padding:3px 5px; border:1px solid #e5e7eb;">HE 50%</th>
        <th style="padding:3px 5px; border:1px solid #e5e7eb;">HE 100%</th>
        <th style="padding:3px 5px; border:1px solid #e5e7eb;">Situação</th>
      </tr>
      ${(ctx.extra?.rows || []).map((r) => `<tr>
        <td style="padding:3px 5px; border:1px solid #e5e7eb;">${fmtDate(r.date)}</td>
        <td style="padding:3px 5px; border:1px solid #e5e7eb;">${r.entrada || '—'}</td>
        <td style="padding:3px 5px; border:1px solid #e5e7eb;">${r.intervalo || '—'}</td>
        <td style="padding:3px 5px; border:1px solid #e5e7eb;">${r.saida || '—'}</td>
        <td style="padding:3px 5px; border:1px solid #e5e7eb;">${r.worked || '00:00'}</td>
        <td style="padding:3px 5px; border:1px solid #e5e7eb;">${r.extra50 || '00:00'}</td>
        <td style="padding:3px 5px; border:1px solid #e5e7eb;">${r.extra100 || '00:00'}</td>
        <td style="padding:3px 5px; border:1px solid #e5e7eb;">${r.status || '—'}</td>
      </tr>`).join('')}
    </table>
    <p style="margin-top:10px; font-size:9px; color:#6b7280;">Registro eletrônico de ponto conforme Portaria MTP nº 671/2021 — registros originais são imutáveis; ajustes aparecem identificados.</p>
    ${signatureBlock(ctx.employee?.name, 'Conferido pelo RH')}
  `, ctx),

  declaracao_vinculo: (ctx) => wrap('Declaração de Vínculo Empregatício', `
    ${employeeSummary(ctx.employee)}
    <p>Declaramos, para os devidos fins, que ${blank(ctx.employee?.name)} mantém vínculo empregatício com esta empresa
    desde ${fmtDate(ctx.employee?.admissionDate)}, ocupando o cargo de ${blank(ctx.employee?.jobTitle)}${ctx.employee?.status === 'desligado' ? `, tendo sido desligado(a) em ${fmtDate(ctx.employee?.terminationDate)}` : ''}.</p>
    ${signatureBlock(null, 'Responsável pelo RH')}
  `, ctx),

  apuracao_mensal: (ctx) => wrap(`Apuração Mensal de Eventos — Competência ${blank(ctx.extra?.competencia)}`, `
    <p style="background:#fef3c7; border:1px solid #fde68a; border-radius:6px; padding:10px; font-size:10px; color:#92400e;">
      Documento de apoio à contabilidade. Contém a contagem de eventos (faltas, horas extras, adicional noturno,
      DSR, férias) e o desconto de faltas injustificadas a 1/30 do salário-base declarado por dia —
      <strong>não calcula INSS, IRRF, FGTS ou valores de rescisão</strong>.
    </p>
    <table style="width:100%; border-collapse:collapse; font-size:9px; margin-top:10px;">
      <tr>
        <th style="padding:4px; border:1px solid #e5e7eb;">Funcionário</th>
        <th style="padding:4px; border:1px solid #e5e7eb;">Salário / Dia (1/30)</th>
        <th style="padding:4px; border:1px solid #e5e7eb;">Faltas Inj.</th>
        <th style="padding:4px; border:1px solid #e5e7eb;">Faltas Just.</th>
        <th style="padding:4px; border:1px solid #e5e7eb;">HE 50%</th>
        <th style="padding:4px; border:1px solid #e5e7eb;">HE 100%</th>
        <th style="padding:4px; border:1px solid #e5e7eb;">Noturno</th>
        <th style="padding:4px; border:1px solid #e5e7eb;">DSR Perdidos</th>
        <th style="padding:4px; border:1px solid #e5e7eb;">Desconto Faltas</th>
      </tr>
      ${(ctx.extra?.rows || []).map((r) => `<tr>
        <td style="padding:4px; border:1px solid #e5e7eb;">${r.name}</td>
        <td style="padding:4px; border:1px solid #e5e7eb; text-align:center;">${r.baseSalary ? `${fmtMoney(r.baseSalary)} / ${fmtMoney(r.dailyValue)}` : '—'}</td>
        <td style="padding:4px; border:1px solid #e5e7eb; text-align:center;">${r.absencesUnjustified ?? 0}</td>
        <td style="padding:4px; border:1px solid #e5e7eb; text-align:center;">${r.absencesJustified ?? 0}</td>
        <td style="padding:4px; border:1px solid #e5e7eb; text-align:center;">${r.extra50 || '00:00'}</td>
        <td style="padding:4px; border:1px solid #e5e7eb; text-align:center;">${r.extra100 || '00:00'}</td>
        <td style="padding:4px; border:1px solid #e5e7eb; text-align:center;">${r.nightReduced || '00:00'}</td>
        <td style="padding:4px; border:1px solid #e5e7eb; text-align:center;">${r.dsrLostDays ?? 0}</td>
        <td style="padding:4px; border:1px solid #e5e7eb; text-align:right;">${r.absenceDeductionValue ? `- ${fmtMoney(r.absenceDeductionValue)}` : '—'}</td>
      </tr>`).join('')}
    </table>
  `, ctx),
};

export function getEmployeeDocumentHtml(type, ctx) {
  const builder = TEMPLATES[type];
  if (!builder) {
    return wrap('Documento não encontrado', `<p>Tipo de documento "${type}" não possui template implementado.</p>`, ctx);
  }
  return builder(ctx);
}

export function buildApuracaoCsv(rows, competencia) {
  const header = ['Funcionario', 'SalarioBase', 'ValorDia(1/30)', 'FaltasInjustificadas', 'FaltasJustificadas', 'HE50(min)', 'HE100(min)', 'AdicionalNoturno(min)', 'DSRPerdidos', 'DescontoFaltas'];
  const lines = [header.join(';')];
  for (const r of rows) {
    const money = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');
    lines.push([r.name, money(r.baseSalary), money(r.dailyValue), r.absencesUnjustified ?? 0, r.absencesJustified ?? 0, r.extra50Minutes ?? 0, r.extra100Minutes ?? 0, r.nightReducedMinutes ?? 0, r.dsrLostDays ?? 0, money(r.absenceDeductionValue)].join(';'));
  }
  return `Competencia;${competencia}\n${lines.join('\n')}`;
}

export { fmtDate, fmtDateTime, fmtMoney };
