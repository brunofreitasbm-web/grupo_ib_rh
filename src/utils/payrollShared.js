// Utilidades compartilhadas entre o módulo Financeiro & Folhas e as apurações
// (PJ e CLT). Concentra o que antes estava repetido em FinanceiroTab,
// ProducaoProfissionaisTab e DocumentosProfissionaisTab.

import { supabase } from '../supabase';
import { BRANDING } from '../config/branding';
import { sanitizeHtml } from './sanitizeHtml';
import { escapeHtmlForDocument } from './helpers';

export const fmtBRL = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// NFSe pertence à competência quando o meta diz ou quando a chave segue
// 'nf-AAAA-MM-...'.
export const nfMatchesCompetencia = (doc, monthKey) =>
  doc?.meta?.competencia === monthKey || String(doc?.doc_key || '').startsWith(`nf-${monthKey}-`);

// Abre um PDF em base64 (com ou sem prefixo data:) numa nova aba.
export const openPdfBase64 = (base64Content) => {
  const clean = String(base64Content).replace(/^data:application\/pdf;base64,/, '');
  const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/pdf' });
  window.open(URL.createObjectURL(blob), '_blank');
};

// Timbre das folhas de pagamento: só a marca (símbolo + nome) e a data de
// emissão. Deliberadamente SEM CNPJ, razão social, endereço ou nome de
// unidade — o grupo tem mais de um CNPJ e a folha não deve induzir a erro.
export const buildPayrollLetterhead = () => {
  const logoSrc = BRANDING.logoPath ? `${window.location.origin}${BRANDING.logoPath}` : '';
  const now = new Date();
  const emitidoEm = `Emitido em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`;
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0f766e;padding-bottom:15px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:15px;">
        ${logoSrc ? `<img src="${logoSrc}" alt="${escapeHtmlForDocument(BRANDING.logoAlt || BRANDING.displayName)}" style="height:60px;object-fit:contain;" />` : ''}
        <h1 style="margin:0;font-size:22px;color:#134e4a;font-weight:bold;letter-spacing:0.5px;">${escapeHtmlForDocument(BRANDING.displayName)}</h1>
      </div>
      <div style="text-align:right;">
        <span style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:bold;display:block;">Documento Oficial</span>
        <span style="font-size:11px;color:#334155;font-weight:600;">${emitidoEm}</span>
      </div>
    </div>`;
};

// Bloco de assinaturas padrão das folhas (sem unidade/CNPJ).
export const buildPayrollSignatures = () => `
  <div style="margin-top:50px;display:flex;justify-content:space-between;gap:40px;page-break-inside:avoid;">
    <div style="flex:1;text-align:center;border-top:1px solid #94a3b8;padding-top:8px;">
      <p style="margin:0;font-size:11px;font-weight:bold;color:#334155;">Gestão Financeira / RH</p>
      <p style="margin:2px 0 0 0;font-size:10px;color:#64748b;">${escapeHtmlForDocument(BRANDING.displayName)}</p>
    </div>
    <div style="flex:1;text-align:center;border-top:1px solid #94a3b8;padding-top:8px;">
      <p style="margin:0;font-size:11px;font-weight:bold;color:#334155;">Direção Geral</p>
      <p style="margin:2px 0 0 0;font-size:10px;color:#64748b;">Aprovação de Pagamentos</p>
    </div>
  </div>`;

// Monta a folha completa (timbre + título + corpo + assinaturas) e abre a
// janela de impressão. Retorna false se o navegador bloqueou o popup.
export function printPayrollDocument({ title, subtitle, bodyHtml }) {
  const html = `
    <div style="font-family:Arial,sans-serif;color:#1e293b;padding:25px;max-width:900px;margin:0 auto;background:#fff;">
      ${buildPayrollLetterhead()}
      <div style="text-align:center;margin-bottom:25px;background:#f8fafc;padding:15px;border-radius:8px;border:1px solid #e2e8f0;">
        <h2 style="margin:0;font-size:18px;color:#0f172a;text-transform:uppercase;letter-spacing:1px;">${escapeHtmlForDocument(title)}</h2>
        <p style="margin:5px 0 0 0;font-size:13px;color:#0f766e;font-weight:bold;">${escapeHtmlForDocument(subtitle)}</p>
      </div>
      ${bodyHtml}
      ${buildPayrollSignatures()}
    </div>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita popups para gerar a folha de pagamento em PDF.');
    return false;
  }
  printWindow.document.write(`<!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtmlForDocument(`${title} - ${BRANDING.displayName} (${subtitle})`)}</title>
        <style>
          @media print { body { margin: 0; padding: 0; } @page { size: A4 portrait; margin: 10mm; } }
        </style>
      </head>
      <body>${sanitizeHtml(html)}</body>
    </html>`);
  printWindow.document.close();
  // Imprime só depois do carregamento (a imagem do timbre precisa estar pronta).
  printWindow.onload = () => { printWindow.print(); };
  return true;
}

// Decisão do RH sobre uma NFSe de PJ. Fonte única da escrita em
// professional_documents.meta (antes duplicada em Producao e Documentos, com
// 'validatedBy' só num dos dois). Lança o erro do Supabase para o chamador.
async function decideNf(professionalId, docKey, currentMeta, patch) {
  const { error } = await supabase
    .from('professional_documents')
    .update({
      meta: { ...currentMeta, ...patch, validatedAt: new Date().toISOString(), validatedBy: 'RH' },
    })
    .eq('professional_id', professionalId)
    .eq('doc_key', docKey);
  if (error) throw error;
}

export const approveNf = (professionalId, docKey, meta) =>
  decideNf(professionalId, docKey, meta, { status: 'aprovado' });

export const rejectNf = (professionalId, docKey, meta, reason) =>
  decideNf(professionalId, docKey, meta, { status: 'rejeitado', rejectionReason: reason });
