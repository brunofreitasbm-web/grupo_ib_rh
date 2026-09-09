import DOMPurify from 'dompurify';

// Sanitiza HTML montado a partir de dados de usuário (nome de estagiário,
// endereço, observações, etc.) antes de ir para dangerouslySetInnerHTML,
// document.write ou element.innerHTML. Defesa em profundidade: mesmo que um
// campo escape da validação/escaping específica de cada gerador de
// documento, isto impede execução de <script>, atributos on*, e URLs
// javascript:. As tags/atributos abaixo cobrem o que os documentos gerados
// (contratos, declarações, folha de pagamento, listas) realmente usam —
// tabelas, imagens embutidas em base64/blob e estilo inline.
const CONFIG = {
  ALLOWED_TAGS: [
    'a', 'b', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'hr', 'i', 'iframe',
    'img', 'li', 'ol', 'p', 'small', 'span', 'strong', 'style', 'table',
    'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
  ],
  ALLOWED_ATTR: [
    'align', 'alt', 'class', 'colspan', 'height', 'href', 'id', 'rowspan',
    'src', 'style', 'target', 'title', 'width',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|data|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

export function sanitizeHtml(html) {
  if (typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, CONFIG);
}
