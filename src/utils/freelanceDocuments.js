import { escapeHtmlForDocument } from './helpers';
import { computeFreelancePayment, formatBRL } from './freelanceCalculations';
import { FREELANCE_SERVICE_TYPES, FREELANCE_LEGAL_REFERENCES } from '../config/freelanceConstants';

// Geradores de documento do módulo Freelance — mesma técnica de
// professionalContract.js (template literal com estilos inline, aberto em
// janela própria via utils/documentPrint.openPrintWindow), em módulo
// separado por natureza jurídica: aqui o contratado é PESSOA FÍSICA
// autônoma, contratada por ESCOPO (obra/serviço certo), nunca por período à
// disposição. Ver src/config/freelanceConstants.js para o enquadramento
// legal completo.
//
// Três documentos, um por Ordem de Serviço:
//   1. getFreelanceContractHtml  — contrato de prestação de serviço autônomo
//      por escopo (assinado no início da OS, antes da execução).
//   2. getFreelanceOrderHtml     — a própria Ordem de Serviço (ficha de
//      escopo/prazo/preço), para conferência e como anexo do contrato.
//   3. getFreelanceRpaHtml       — Recibo de Pagamento a Autônomo (RPA), com
//      as retenções discriminadas, emitido após aceite da entrega.
//
// Todos são MINUTAS — precisam de revisão jurídica/contábil antes do uso em
// produção (ver FREELANCE_DISCLAIMER).

const fmtDate = (value) => {
  if (!value) return '____/____/______';
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
  } catch {
    return '____/____/______';
  }
};

const esc = (v) => escapeHtmlForDocument(v || '') || '';

const serviceTypeLabel = (key) => FREELANCE_SERVICE_TYPES.find((s) => s.key === key)?.label || key || '—';

// Lista os campos essenciais para emitir o contrato de escopo; usada para
// bloquear a emissão com lacunas (mesmo padrão de getMissingContractFields em
// professionalContract.js).
export const getMissingFreelanceContractFields = (freelancer, job) => {
  const f = freelancer || {};
  const j = job || {};
  const required = [
    ['name', 'Nome do freelancer', f],
    ['cpf', 'CPF', f],
    ['enderecoLogradouro', 'Endereço', f],
    ['title', 'Título do trabalho', j],
    ['scope', 'Escopo detalhado', j],
    ['grossAmount', 'Preço fechado (R$)', j],
  ];
  return required.filter(([field, , obj]) => !String(obj[field] || '').trim()).map(([, label]) => label);
};

const documentHeader = (unit, branding, title, subtitle) => {
  const unitRazaoSocial = unit?.razaoSocial || unit?.razao_social || branding?.legalEntityName || '';
  const unitCnpj = unit?.cnpj || branding?.cnpj || '';
  const unitAddress = unit?.address || unit?.endereco || branding?.documentLocation || '';
  const unitDisplayName = unit?.name || unit?.nome || unit?.buttonLabel || branding?.displayName || '';
  const unitLogo = unit?.logoUrl || unit?.logo_url || branding?.logoPath || '';

  return `
    <div style="text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 15px; margin-bottom: 25px;">
      ${unitLogo ? `<img src="${unitLogo}" style="height: 60px; margin-bottom: 10px; object-fit: contain;" alt="${esc(unitDisplayName)}" />` : ''}
      <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #4c1d95; letter-spacing: 1px;">${esc(unitDisplayName).toUpperCase()}</h1>
      <p style="margin: 4px 0 0; font-size: 10px; text-transform: uppercase; color: #4b5563; font-weight: 600;">${esc(unitRazaoSocial)} • CNPJ: ${esc(unitCnpj)}</p>
      <p style="margin: 2px 0 0; font-size: 8px; color: #6b7280;">${esc(unitAddress)}</p>
    </div>
    <div style="text-align: center; margin-bottom: 15px;">
      <h2 style="margin: 0; font-size: 13px; font-weight: 800; color: #111827; text-transform: uppercase;">${esc(title)}</h2>
      ${subtitle ? `<p style="margin: 2px 0 0; font-size: 8px; color: #6b7280;">${esc(subtitle)}</p>` : ''}
    </div>
  `;
};

const avisoMinuta = (extra = '') => `
  <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:6px;padding:8px 10px;margin-bottom:16px;font-size:9px;color:#6b21a8;">
    <strong>MINUTA GERADA AUTOMATICAMENTE.</strong> Documento pré-preenchido a partir do cadastro do freelancer e da
    Ordem de Serviço; deve ser revisado por profissional jurídico/contábil antes de qualquer assinatura ou pagamento.
    ${extra}
  </div>
`;

const partyTable = (freelancer, unit, branding) => {
  const f = freelancer || {};
  const unitRazaoSocial = unit?.razaoSocial || unit?.razao_social || branding?.legalEntityName || '';
  const unitCnpj = unit?.cnpj || branding?.cnpj || '';
  const unitAddress = unit?.address || unit?.endereco || branding?.documentLocation || '';

  const enderecoCompleto = [
    f.enderecoLogradouro, f.enderecoNumero && `nº ${f.enderecoNumero}`, f.enderecoComplemento,
    f.enderecoBairro, f.enderecoCidade, f.enderecoUf, f.enderecoCep && `CEP ${f.enderecoCep}`,
  ].filter(Boolean).map(esc).join(', ');

  return `
    <table style="border-collapse: collapse; margin-bottom: 12px; font-size: 9px; width: 100%;">
      <tr style="background-color: #faf5ff;">
        <td style="border: 1px solid #e9d5ff; padding: 5px; font-weight: bold;" colspan="2">CONTRATANTE</td>
      </tr>
      <tr>
        <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold; width: 25%;">Razão Social:</td>
        <td style="border: 1px solid #d1d5db; padding: 5px;">${esc(unitRazaoSocial)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">CNPJ:</td>
        <td style="border: 1px solid #d1d5db; padding: 5px;">${esc(unitCnpj)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Endereço:</td>
        <td style="border: 1px solid #d1d5db; padding: 5px;">${esc(unitAddress)}</td>
      </tr>
    </table>

    <table style="border-collapse: collapse; margin-bottom: 12px; font-size: 9px; width: 100%;">
      <tr style="background-color: #faf5ff;">
        <td style="border: 1px solid #e9d5ff; padding: 5px; font-weight: bold;" colspan="2">CONTRATADO(A) (AUTÔNOMO PESSOA FÍSICA)</td>
      </tr>
      <tr>
        <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold; width: 25%;">Nome:</td>
        <td style="border: 1px solid #d1d5db; padding: 5px;">${esc(f.name)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">CPF:</td>
        <td style="border: 1px solid #d1d5db; padding: 5px;">${esc(f.cpf)}${f.nit ? ` • NIT/PIS: ${esc(f.nit)}` : ''}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Endereço:</td>
        <td style="border: 1px solid #d1d5db; padding: 5px;">${enderecoCompleto}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Contato:</td>
        <td style="border: 1px solid #d1d5db; padding: 5px;">${esc(f.email)}${f.phone ? ` • ${esc(f.phone)}` : ''}</td>
      </tr>
    </table>
  `;
};

const signatureBlock = (unitRazaoSocial, freelancerName) => `
  <table style="width: 100%; margin-top: 50px; font-size: 9px;">
    <tr>
      <td style="width: 50%; text-align: center;">
        <div style="border-top: 1px solid #1f2937; width: 80%; margin: 0 auto; padding-top: 4px;">
          ${esc(unitRazaoSocial)}<br/>CONTRATANTE
        </div>
      </td>
      <td style="width: 50%; text-align: center;">
        <div style="border-top: 1px solid #1f2937; width: 80%; margin: 0 auto; padding-top: 4px;">
          ${esc(freelancerName)}<br/>CONTRATADO(A) — AUTÔNOMO(A)
        </div>
      </td>
    </tr>
  </table>
`;

const footer = (unitRazaoSocial) => `
  <div style="margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 10px; text-align: center; font-size: 8px; color: #9ca3af;">
    ${esc(unitRazaoSocial)} • Minuta gerada eletronicamente — sujeita a revisão jurídica/contábil antes da assinatura ou pagamento.
  </div>
`;

// ---------------------------------------------------------------------------
// 1. Contrato de Prestação de Serviço Autônomo por Escopo
// ---------------------------------------------------------------------------
export const getFreelanceContractHtml = (freelancer, job, unit, branding) => {
  const f = freelancer || {};
  const j = job || {};
  const unitRazaoSocial = unit?.razaoSocial || unit?.razao_social || branding?.legalEntityName || '';
  const unitEmail = unit?.email || unit?.contactEmail || unit?.contact_email || branding?.contactEmail || '';

  const clausesHtml = `
    <p style="margin: 10px 0;"><strong>CLÁUSULA 1ª — DO OBJETO.</strong> O presente contrato tem por objeto a
    prestação, pelo(a) CONTRATADO(A), de serviço autônomo, pontual e determinado, de
    <strong>${esc(serviceTypeLabel(j.serviceType))}</strong>, assim descrito: ${esc(j.scope)}${j.deliverable ? `, tendo como
    entregável/resultado esperado: ${esc(j.deliverable)}` : ''}. O serviço aqui contratado é ÚNICO E DETERMINADO,
    correspondente à Ordem de Serviço nº ${esc(String(j.id || '').slice(0, 8)).toUpperCase() || '____'}, não gerando
    qualquer expectativa de continuidade, renovação automática ou nova contratação.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 2ª — DA AUTONOMIA E DA NATUREZA CIVIL DO CONTRATO.</strong> O serviço
    será executado pelo(a) CONTRATADO(A) com plena autonomia técnica e organizacional, sem subordinação jurídica,
    pessoalidade ou habitualidade em relação à CONTRATANTE, competindo exclusivamente ao(à) CONTRATADO(A) definir os
    meios, o modo, os materiais e a agenda de execução do serviço dentro do prazo acordado, podendo se fazer
    substituir por profissional habilitado de sua indicação. Este instrumento tem natureza exclusivamente civil,
    regendo-se pelos artigos 593 e seguintes do Código Civil (prestação de serviço) e, no que aplicável, pelos
    artigos 610 e seguintes (empreitada), não gerando, em qualquer hipótese, vínculo empregatício com a
    CONTRATANTE, nos termos do art. 442-B da Consolidação das Leis do Trabalho (CLT).</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 3ª — DA NÃO EXCLUSIVIDADE E DA AUSÊNCIA DE SUBORDINAÇÃO.</strong> O(A)
    CONTRATADO(A) poderá prestar serviços a terceiros, inclusive a concorrentes da CONTRATANTE, não havendo
    exclusividade entre as partes. O(A) CONTRATADO(A) não integra escala, quadro de horários, grupo de comunicação
    interna de expediente ou qualquer estrutura de subordinação da CONTRATANTE, e pode recusar, sem qualquer
    penalidade, novas propostas de trabalho.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 4ª — DO PREÇO E DA FORMA DE PAGAMENTO.</strong> 4.1. Pelo serviço
    integralmente prestado e aceito pela CONTRATANTE, o(a) CONTRATADO(A) fará jus ao preço certo, fechado e global de
    ${formatBRL(j.grossAmount)}, correspondente à totalidade do escopo descrito na Cláusula 1ª, independentemente do
    tempo efetivamente empregado na execução. 4.2. O pagamento se dará mediante Recibo de Pagamento a Autônomo (RPA),
    com as retenções legais de INSS, IRRF e, quando aplicável, ISS,${j.paymentDay ? ` previsto para o dia ${esc(String(j.paymentDay))}` : ''}
    após a formal aceitação da entrega pela CONTRATANTE, exclusivamente em conta de titularidade do(a) próprio(a)
    CONTRATADO(A). 4.3. Não há remuneração fixa, mensal, mínima garantida, nem qualquer verba devida por mera
    disponibilidade ou tempo de espera: o preço é devido pela entrega do resultado, e não pelo tempo dedicado a ele.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 5ª — DA VEDAÇÃO DE LEITURA TRABALHISTA.</strong> Este contrato não
    institui jornada de trabalho, controle de horário, escala, poder disciplinar, adicional noturno ou qualquer
    outra figura da legislação trabalhista. Eventuais registros de início/entrega do serviço têm finalidade
    exclusivamente de controle de escopo e conferência para fins de pagamento, não constituindo controle de ponto ou
    de jornada nos termos do art. 74 da CLT.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 6ª — DAS OBRIGAÇÕES TRIBUTÁRIAS E PREVIDENCIÁRIAS.</strong> O(A)
    CONTRATADO(A), na qualidade de contribuinte individual (Lei nº 8.212/1991), é responsável pelo recolhimento de
    sua contribuição previdenciária, observadas as retenções que a lei impõe à CONTRATANTE (11% sobre o valor do
    serviço, limitado ao teto do INSS) e do Imposto de Renda Retido na Fonte (IRRF), quando devido, bem como do ISS
    aplicável, cabendo à CONTRATANTE o recolhimento da contribuição patronal de 20% incidente sobre o valor pago
    (Lei nº 8.212/1991, art. 22, III), como custo próprio da CONTRATANTE.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 7ª — DO PRAZO E DA RESCISÃO.</strong> Este contrato vigora
    exclusivamente para a execução do serviço descrito, com prazo previsto de entrega em
    ${j.scheduledDate ? fmtDate(j.scheduledDate) : 'data a combinar'}, extinguindo-se automaticamente com a entrega e o
    aceite do serviço e o respectivo pagamento. Qualquer das partes pode rescindir antes do início da execução, sem
    ônus. Iniciada a execução, a rescisão sem justa causa pela CONTRATANTE obriga ao pagamento proporcional ao
    serviço já executado e aceito.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 8ª — DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS.</strong> As partes
    comprometem-se a manter sigilo sobre informações confidenciais a que tiverem acesso em razão deste contrato,
    observando a Lei nº 13.709/2018 (LGPD) no tratamento de dados pessoais de terceiros.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 9ª — DA COMUNICAÇÃO ENTRE AS PARTES.</strong> Toda comunicação
    relativa a este contrato dar-se-á pelo e-mail oficial da CONTRATANTE (<strong>${esc(unitEmail) || 'a informar'}</strong>)
    e pelo e-mail do(a) CONTRATADO(A) cadastrado no sistema${f.email ? ` (<strong>${esc(f.email)}</strong>)` : ''}.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 10ª — DO FORO.</strong> Fica eleito o foro da comarca de
    ${esc(branding?.documentLocation) || esc(unit?.address)} para dirimir quaisquer controvérsias oriundas deste contrato.</p>
  `;

  return `
    <div style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; line-height: 1.6; color: #1f2937; padding: 15px;">
      ${documentHeader(unit, branding, 'Contrato de Prestação de Serviço Autônomo por Escopo', 'Natureza civil — sem vínculo empregatício (art. 442-B, CLT)')}
      ${avisoMinuta()}
      ${partyTable(f, unit, branding)}
      ${clausesHtml}
      <div style="margin-top: 40px; text-align: center; font-size: 9px;">
        <p>${esc(branding?.documentLocation) || ''}, ${new Date().toLocaleDateString('pt-BR')}.</p>
      </div>
      ${signatureBlock(unitRazaoSocial, f.name)}
      ${footer(unitRazaoSocial)}
    </div>
  `;
};

// ---------------------------------------------------------------------------
// 2. Ordem de Serviço (ficha de escopo/prazo/preço)
// ---------------------------------------------------------------------------
export const getFreelanceOrderHtml = (freelancer, job, unit, branding) => {
  const f = freelancer || {};
  const j = job || {};
  const unitRazaoSocial = unit?.razaoSocial || unit?.razao_social || branding?.legalEntityName || '';

  return `
    <div style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; line-height: 1.6; color: #1f2937; padding: 15px;">
      ${documentHeader(unit, branding, 'Ordem de Serviço — Trabalho Pontual', `OS nº ${esc(String(j.id || '').slice(0, 8)).toUpperCase() || '____'}`)}
      ${partyTable(f, unit, branding)}

      <table style="border-collapse: collapse; margin-bottom: 12px; font-size: 9px; width: 100%;">
        <tr style="background-color: #faf5ff;">
          <td style="border: 1px solid #e9d5ff; padding: 5px; font-weight: bold;" colspan="2">DADOS DO TRABALHO</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold; width: 25%;">Título:</td>
          <td style="border: 1px solid #d1d5db; padding: 5px;">${esc(j.title)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Natureza:</td>
          <td style="border: 1px solid #d1d5db; padding: 5px;">${esc(serviceTypeLabel(j.serviceType))}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Escopo:</td>
          <td style="border: 1px solid #d1d5db; padding: 5px;">${esc(j.scope)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Entregável:</td>
          <td style="border: 1px solid #d1d5db; padding: 5px;">${esc(j.deliverable) || '—'}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Data prevista:</td>
          <td style="border: 1px solid #d1d5db; padding: 5px;">${fmtDate(j.scheduledDate)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Preço fechado:</td>
          <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">${formatBRL(j.grossAmount)}</td>
        </tr>
      </table>

      <p style="margin: 10px 0; font-size: 9px; color: #4b5563;">
        Esta Ordem de Serviço formaliza um trabalho autônomo pontual, por escopo e preço fechados, sem
        habitualidade, subordinação ou exclusividade, nos termos do contrato de prestação de serviço firmado entre
        as partes.
      </p>

      <div style="margin-top: 30px; font-size: 9px;">
        <p><strong>Aceite do(a) freelancer:</strong> ao assinar, o(a) freelancer confirma que recebeu, compreendeu e
        aceita o escopo, o prazo e o preço acima, podendo recusar este trabalho sem qualquer penalidade.</p>
      </div>

      ${signatureBlock(unitRazaoSocial, f.name)}
      ${footer(unitRazaoSocial)}
    </div>
  `;
};

// ---------------------------------------------------------------------------
// 3. Recibo de Pagamento a Autônomo (RPA)
// ---------------------------------------------------------------------------
export const getFreelanceRpaHtml = (freelancer, job, unit, branding, paymentOptions = {}) => {
  const f = freelancer || {};
  const j = job || {};
  const unitRazaoSocial = unit?.razaoSocial || unit?.razao_social || branding?.legalEntityName || '';
  const unitCnpj = unit?.cnpj || branding?.cnpj || '';
  const payment = computeFreelancePayment(j, paymentOptions);

  const row = (label, value, bold) => `
    <tr>
      <td style="border: 1px solid #d1d5db; padding: 5px;${bold ? ' font-weight: bold;' : ''}">${esc(label)}</td>
      <td style="border: 1px solid #d1d5db; padding: 5px; text-align: right;${bold ? ' font-weight: bold;' : ''}">${formatBRL(value)}</td>
    </tr>
  `;

  return `
    <div style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; line-height: 1.6; color: #1f2937; padding: 15px;">
      ${documentHeader(unit, branding, 'Recibo de Pagamento a Autônomo (RPA)', j.rpaNumber ? `RPA nº ${esc(j.rpaNumber)}` : '')}
      ${avisoMinuta('Valores de referência — a contabilidade deve conferir INSS, IRRF e ISS antes da emissão oficial.')}
      ${partyTable(f, unit, branding)}

      <p style="margin: 10px 0; font-size: 9px;">
        Recebi de <strong>${esc(unitRazaoSocial)}</strong>, CNPJ ${esc(unitCnpj)}, a importância líquida de
        <strong>${formatBRL(payment.net)}</strong>, referente à prestação de serviço autônomo de
        <strong>${esc(serviceTypeLabel(j.serviceType))}</strong> (${esc(j.title)}), conforme Ordem de Serviço nº
        ${esc(String(j.id || '').slice(0, 8)).toUpperCase() || '____'}, dando plena quitação do valor.
      </p>

      <table style="border-collapse: collapse; margin: 12px 0; font-size: 9px; width: 100%;">
        <tr style="background-color: #faf5ff;">
          <td style="border: 1px solid #e9d5ff; padding: 5px; font-weight: bold;" colspan="2">DISCRIMINAÇÃO DE VALORES</td>
        </tr>
        ${row('Valor do serviço (bruto)', payment.gross, true)}
        ${row('(–) INSS retido (11%, contribuinte individual)', -payment.inssWithheld)}
        ${row('(–) IRRF (tabela progressiva)', -payment.irrf)}
        ${payment.iss ? row(`(–) ISS retido (${(payment.issRate * 100).toFixed(2)}%)`, -payment.iss) : ''}
        ${row('Valor líquido a receber', payment.net, true)}
      </table>

      <p style="margin: 10px 0; font-size: 8px; color: #6b7280;">
        Contribuição previdenciária patronal (20% sobre o valor bruto, Lei nº 8.212/1991, art. 22, III), a cargo
        exclusivo da contratante e não descontada deste recibo: ${formatBRL(payment.inssEmployerCost)}.
      </p>

      <div style="margin-top: 40px; text-align: center; font-size: 9px;">
        <p>${esc(branding?.documentLocation) || ''}, ${new Date().toLocaleDateString('pt-BR')}.</p>
      </div>

      <table style="width: 100%; margin-top: 50px; font-size: 9px;">
        <tr>
          <td style="width: 100%; text-align: center;">
            <div style="border-top: 1px solid #1f2937; width: 50%; margin: 0 auto; padding-top: 4px;">
              ${esc(f.name)} — CPF ${esc(f.cpf)}
            </div>
          </td>
        </tr>
      </table>
      ${footer(unitRazaoSocial)}
    </div>
  `;
};

export { FREELANCE_LEGAL_REFERENCES };
