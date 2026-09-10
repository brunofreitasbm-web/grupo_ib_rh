import { escapeHtmlForDocument } from './helpers';

// Gerador do Contrato de Prestação de Serviços pré-pronto para Profissionais
// PJ — mesma técnica de App.jsx:getDocumentHtml (template literal com
// estilos inline, aberto em janela própria e impresso via window.print()),
// mas em módulo separado para não engordar ainda mais App.jsx.
//
// Natureza deliberadamente civil (arts. 593 e ss. do Código Civil) e nunca
// trabalhista: ver Seção 0 do plano do módulo de autocadastro PJ (blindagem
// de vínculo). Este texto é uma MINUTA — precisa de revisão jurídica antes
// do uso em produção, o que fica explícito tanto no aviso do modal quanto no
// próprio rodapé do documento.
//
// A remuneração é por MÓDULO ASSISTENCIAL entregue (Cláusula 4ª), espelhando
// a apuração de `shiftValue` × turnos com presença. A palavra "turno" é
// deliberadamente evitada no corpo do contrato: o módulo é unidade de serviço
// entregue, não unidade de tempo à disposição — é essa qualificação que
// sustenta o preço por período sem abrir flanco de jornada/subordinação.
// Ver `modelos de Contratos PJ/Prompt_Contrato_PJ.txt`, Cláusula 6ª.

const fmtDate = (value) => {
  if (!value) return '____/____/______';
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
  } catch {
    return '____/____/______';
  }
};

const fmtMoney = (value) => {
  if (value === null || value === undefined || value === '') return 'a combinar';
  const n = Number(value);
  if (Number.isNaN(n)) return 'a combinar';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const esc = (v) => escapeHtmlForDocument(v || '') || '';

// Lista os campos essenciais para o contrato; usada para bloquear a emissão
// com lacunas em vez de gerar um documento incompleto (ver DocumentosProfissionaisTab).
export const getMissingContractFields = (professional) => {
  const p = professional || {};
  const required = [
    ['name', 'Nome do prestador'],
    ['cnpj', 'CNPJ'],
    ['razaoSocial', 'Razão Social'],
    ['profession', 'Profissão'],
    ['councilType', 'Conselho profissional'],
    ['councilNumber', 'Número do conselho'],
    ['repName', 'Nome do representante legal'],
    ['repCpf', 'CPF do representante legal'],
    ['shiftValue', 'Preço do Módulo Assistencial'],
  ];
  return required.filter(([field]) => !String(p[field] || '').trim()).map(([, label]) => label);
};

export const getProfessionalContractHtml = (professional, unit, branding) => {
  const p = professional || {};
  const u = unit || {};

  const unitRazaoSocial = u.razaoSocial || u.razao_social || branding?.legalEntityName || '';
  const unitCnpj = u.cnpj || branding?.cnpj || '';
  const unitAddress = u.address || u.endereco || branding?.documentLocation || '';
  const unitDisplayName = u.name || u.nome || u.buttonLabel || branding?.displayName || '';
  const unitLogo = u.logoUrl || u.logo_url || branding?.logoPath || '';
  const customClauses = u.contratoPjCustomText || u.contrato_pj_custom_text || '';
  const defaultClauses = branding?.contractDefaultClauses || '';

  const enderecoCompleto = [
    p.enderecoLogradouro, p.enderecoNumero && `nº ${p.enderecoNumero}`, p.enderecoComplemento,
    p.enderecoBairro, p.enderecoCidade, p.enderecoUf, p.enderecoCep && `CEP ${p.enderecoCep}`,
  ].filter(Boolean).map(esc).join(', ');

  const headerHtml = `
    <div style="text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 15px; margin-bottom: 25px;">
      ${unitLogo ? `<img src="${unitLogo}" style="height: 60px; margin-bottom: 10px; object-fit: contain;" alt="${esc(unitDisplayName)}" />` : ''}
      <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #134e4a; letter-spacing: 1px;">${esc(unitDisplayName).toUpperCase()}</h1>
      <p style="margin: 4px 0 0; font-size: 10px; text-transform: uppercase; color: #4b5563; font-weight: 600;">${esc(unitRazaoSocial)} • CNPJ: ${esc(unitCnpj)}</p>
      <p style="margin: 2px 0 0; font-size: 8px; color: #6b7280;">${esc(unitAddress)}</p>
    </div>
  `;

  const avisoMinuta = `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 10px;margin-bottom:16px;font-size:9px;color:#92400e;">
      <strong>MINUTA GERADA AUTOMATICAMENTE.</strong> Este documento foi pré-preenchido a partir do cadastro do(a)
      prestador(a) e deve ser revisado por profissional jurídico antes de qualquer assinatura.
    </div>
  `;

  const bankParts = [
    p.bankName && `Banco ${esc(p.bankName)}`,
    p.bankAgency && `agência ${esc(p.bankAgency)}`,
    p.bankAccount && `conta ${esc(p.bankAccount)}`,
    p.pixKey && `chave PIX ${esc(p.pixKey)}`,
  ].filter(Boolean);
  const bankInfo = bankParts.length ? ` (${bankParts.join(', ')})` : '';

  const clausesHtml = `
    <p style="margin: 10px 0;"><strong>CLÁUSULA 1ª — DO OBJETO.</strong> O presente contrato tem por objeto a prestação, pela
    CONTRATADA, de serviços profissionais de <strong>${esc(p.profession)}</strong>
    (${esc(p.councilType)} nº ${esc(p.councilNumber)}${p.councilUf ? `/${esc(p.councilUf)}` : ''})${p.serviceDescription ? `, consistentes em: ${esc(p.serviceDescription)}` : ', na forma e no alcance próprios de sua habilitação profissional'}.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 2ª — DA AUTONOMIA E DA NATUREZA CIVIL DO CONTRATO.</strong> Os serviços ora
    contratados serão executados pela CONTRATADA com plena autonomia técnica e organizacional, sem subordinação
    jurídica, pessoalidade ou habitualidade em relação à CONTRATANTE, competindo exclusivamente à CONTRATADA definir
    os meios, o modo e a agenda de execução dos serviços, podendo se fazer substituir por preposto(a) devidamente
    habilitado(a). O presente instrumento tem natureza exclusivamente civil, regendo-se pelos artigos 593 e seguintes
    do Código Civil, não gerando, em qualquer hipótese, vínculo empregatício entre a CONTRATANTE e a CONTRATADA, seu(sua)
    representante legal, sócios(as) ou eventuais prepostos(as), nos termos do art. 442-B da Consolidação das Leis do
    Trabalho (CLT).</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 3ª — DA NÃO EXCLUSIVIDADE.</strong> A CONTRATADA poderá prestar serviços a
    terceiros, inclusive a concorrentes da CONTRATANTE, não havendo qualquer relação de exclusividade entre as partes.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 4ª — DOS HONORÁRIOS (PREÇO POR MÓDULO ASSISTENCIAL ENTREGUE).</strong>
    4.1. Denomina-se <strong>Módulo Assistencial</strong> a unidade de serviço composta, cumulativa e
    indissociavelmente, pelos atendimentos realizados pela CONTRATADA no período matutino ou no período vespertino
    de um mesmo dia, pelo respectivo registro em prontuário e pela entrega e protocolo da documentação técnica
    correspondente. O Módulo Assistencial é unidade de <em>medição do serviço entregue</em>, e não unidade de tempo
    colocado à disposição, não se confundindo, para nenhum efeito, com turno, jornada, escala, plantão ou
    sobreaviso, na forma dos arts. 594 e 614 do Código Civil.
    4.2. Pela prestação dos serviços, a CONTRATADA fará jus ao preço unitário, certo e fechado de
    ${fmtMoney(p.shiftValue)} por Módulo Assistencial efetivamente entregue, apurando-se ao final de cada
    competência mensal o valor devido pela simples multiplicação do preço unitário pelo número de módulos
    entregues no período.
    4.3. O preço é invariável em função do tempo de permanência da CONTRATADA nas dependências da CONTRATANTE, não
    havendo acréscimo por permanência excedente nem desconto por permanência inferior, atraso ou saída antecipada,
    desde que entregue a unidade de serviço descrita no item 4.1. Não há remuneração fixa, mensal ou mínima
    garantida, nem qualquer verba devida por mera disponibilidade, comparecimento, deslocamento ou tempo de espera,
    e a CONTRATANTE não se obriga a ofertar, nem a CONTRATADA a aceitar, qualquer quantidade mínima de módulos.
    4.4. O pagamento se dará mediante emissão de Nota Fiscal${p.paymentDay ? `, previsto para o dia ${esc(String(p.paymentDay))} do mês
    subsequente à prestação dos serviços` : ', no mês subsequente à prestação dos serviços'}, exclusivamente em conta de
    titularidade da pessoa jurídica CONTRATADA${bankInfo}, vedado o pagamento em conta de pessoa física.${p.remunerationModel ? ` Modelo de remuneração de referência: ${esc(p.remunerationModel)}.` : ''}</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 4ª-A — DA VEDAÇÃO DE LEITURA TRABALHISTA DA MÉTRICA E DO REGISTRO
    DE EXECUÇÃO.</strong> A adoção do Módulo Assistencial como unidade de preço não institui nem autoriza, entre as
    partes, jornada de trabalho, controle de horário, escala, banco de horas, hora extra, adicional noturno,
    intervalo remunerado ou qualquer outra figura da legislação trabalhista. Os registros eletrônicos de início e
    término de execução dos módulos — inclusive por quiosque, PIN ou aplicativo da CONTRATANTE — têm finalidade
    exclusivamente fiscal e de conferência das entregas para emissão da Nota Fiscal, são de preenchimento
    voluntário e <strong>não constituem controle de ponto ou de jornada</strong> nos termos do art. 74 da CLT, não
    gerando consequência disciplinar nem servindo para apurar atrasos, faltas, compensações ou descontos.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 5ª — DAS OBRIGAÇÕES TRIBUTÁRIAS E PREVIDENCIÁRIAS.</strong> A CONTRATADA é
    responsável, com exclusividade, pelo recolhimento de todos os tributos incidentes sobre sua atividade, bem como
    pelos encargos previdenciários, trabalhistas (relativos a eventuais empregados ou prepostos próprios) e
    quaisquer outras obrigações decorrentes do exercício de sua atividade como pessoa jurídica.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 6ª — DA VIGÊNCIA E RESCISÃO.</strong> Este contrato vigora a partir
    ${p.contractStart ? `de ${fmtDate(p.contractStart)}` : 'da data de sua assinatura'}, por prazo indeterminado, podendo ser rescindido por qualquer das partes mediante aviso
    prévio de ${p.noticeDays ?? 30} dias, sem ônus ou multa, ressalvada a liquidação de valores pendentes.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 7ª — DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS.</strong> As partes
    comprometem-se a manter sigilo sobre informações confidenciais a que tiverem acesso em razão deste contrato,
    observando a Lei nº 13.709/2018 (LGPD) no tratamento de dados pessoais de pacientes/clientes e de terceiros.</p>

    <p style="margin: 10px 0;"><strong>CLÁUSULA 8ª — DO FORO.</strong> Fica eleito o foro da comarca de
    ${esc(branding?.documentLocation) || esc(unitAddress)} para dirimir quaisquer controvérsias oriundas deste contrato.</p>

    ${defaultClauses ? `<p style="margin: 10px 0; font-style: italic; color:#6b7280;">${esc(defaultClauses)}</p>` : ''}
    ${customClauses ? `<div style="margin-top: 14px; padding: 10px; background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 6px; font-size: 9px;"><strong>Cláusulas Aditivas da Unidade (${esc(unitDisplayName)}):</strong><br>${esc(customClauses)}</div>` : ''}
  `;

  return `
    <div style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; line-height: 1.6; color: #1f2937; padding: 15px;">
      ${headerHtml}
      ${avisoMinuta}
      <div style="text-align: center; margin-bottom: 15px;">
        <h2 style="margin: 0; font-size: 13px; font-weight: 800; color: #111827; text-transform: uppercase;">
          Contrato de Prestação de Serviços
        </h2>
        <p style="margin: 2px 0 0; font-size: 8px; color: #6b7280;">Natureza civil — sem vínculo empregatício (art. 442-B, CLT)</p>
      </div>

      <table style="border-collapse: collapse; margin-bottom: 12px; font-size: 9px; width: 100%;">
        <tr style="background-color: #f0fdfa;">
          <td style="border: 1px solid #99f6e4; padding: 5px; font-weight: bold;" colspan="2">CONTRATANTE</td>
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
        <tr style="background-color: #f0fdfa;">
          <td style="border: 1px solid #99f6e4; padding: 5px; font-weight: bold;" colspan="2">CONTRATADA (PESSOA JURÍDICA)</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold; width: 25%;">Razão Social:</td>
          <td style="border: 1px solid #d1d5db; padding: 5px;">${esc(p.razaoSocial)}${p.nomeFantasia ? ` (${esc(p.nomeFantasia)})` : ''}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">CNPJ:</td>
          <td style="border: 1px solid #d1d5db; padding: 5px;">${esc(p.cnpj)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Endereço:</td>
          <td style="border: 1px solid #d1d5db; padding: 5px;">${enderecoCompleto}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">Representada por:</td>
          <td style="border: 1px solid #d1d5db; padding: 5px;">${esc(p.repName)}${p.repRole ? `, ${esc(p.repRole)}` : ''}, CPF ${esc(p.repCpf)}, RG ${esc(p.repRg)}</td>
        </tr>
      </table>

      ${clausesHtml}

      <div style="margin-top: 40px; text-align: center; font-size: 9px;">
        <p>${esc(branding?.documentLocation) || ''}, ${new Date().toLocaleDateString('pt-BR')}.</p>
      </div>

      <table style="width: 100%; margin-top: 50px; font-size: 9px;">
        <tr>
          <td style="width: 50%; text-align: center;">
            <div style="border-top: 1px solid #1f2937; width: 80%; margin: 0 auto; padding-top: 4px;">
              ${esc(unitRazaoSocial)}<br/>CONTRATANTE
            </div>
          </td>
          <td style="width: 50%; text-align: center;">
            <div style="border-top: 1px solid #1f2937; width: 80%; margin: 0 auto; padding-top: 4px;">
              ${esc(p.repName)}<br/>CONTRATADA (${esc(p.razaoSocial)})
            </div>
          </td>
        </tr>
      </table>

      <div style="margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 10px; text-align: center; font-size: 8px; color: #9ca3af;">
        ${esc(unitRazaoSocial)} • Minuta gerada eletronicamente — sujeita a revisão jurídica antes da assinatura.
      </div>
    </div>
  `;
};
