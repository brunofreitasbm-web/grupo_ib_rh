// @vitest-environment jsdom
//
// DOMPurify precisa de um DOM real; os demais testes deste projeto rodam em
// 'node' (ver vite.config.js), então este arquivo usa o ambiente jsdom só
// para si via a diretiva acima, sem mudar o padrão dos outros testes.
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../sanitizeHtml';

describe('sanitizeHtml', () => {
  it('remove <script> embutido em HTML de documento gerado', () => {
    const out = sanitizeHtml('<div>Olá<script>alert(1)</script></div>');
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain('Olá');
  });

  it('remove atributos on* (ex.: onerror em <img>)', () => {
    const out = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toMatch(/onerror/i);
  });

  it('remove href com esquema javascript:', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">clique</a>');
    expect(out).not.toMatch(/javascript:/i);
  });

  it('mantém tags e estilos usados pelos documentos gerados (tabela, estilo inline, imagem)', () => {
    const html = '<table><tr><td style="padding:8px">João da Silva</td></tr></table><img src="data:image/png;base64,abc" />';
    const out = sanitizeHtml(html);
    expect(out).toContain('<table>');
    expect(out).toContain('João da Silva');
    expect(out).toContain('style="padding:8px"');
    expect(out).toContain('data:image/png;base64,abc');
  });

  it('não quebra com entrada vazia/indefinida', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml(null)).toBe('');
  });
});
