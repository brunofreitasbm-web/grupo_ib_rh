import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  sniffMime,
  recompressPdfBytes,
  canvasToDataUrl,
  replaceFileExtension,
  downloadNameForDataUrl,
  prepareUpload,
  fileToBase64,
  IMAGE_PRESETS,
} from '../mappings';

// JPEG sintético mínimo (SOI + SOF0 3 componentes + lixo + EOI): o pdf-lib só
// lê as dimensões/componentes do SOF para embutir como DCTDecode.
const fakeJpeg = (w, h, size) => {
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  const body = new Uint8Array(size);
  const head = [0xff, 0xd8, ...sof];
  body.set(head, 0);
  body[size - 2] = 0xff;
  body[size - 1] = 0xd9;
  return body;
};

const buildPdf = async () => {
  const doc = await PDFDocument.create();
  const img = await doc.embedJpg(fakeJpeg(3000, 2000, 80_000));
  const page = doc.addPage([595, 842]);
  page.drawImage(img, { x: 0, y: 0, width: 500, height: 300 });
  return doc.save({ useObjectStreams: false });
};

describe('sniffMime', () => {
  it('detecta tipos pelos bytes', () => {
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toBe('image/png');
    expect(sniffMime(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf');
    expect(sniffMime(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffMime(new TextEncoder().encode('GIF89a'))).toBe('image/gif');
    expect(sniffMime(new TextEncoder().encode('PK\u0003\u0004xlsx'))).toBeNull();
  });
});

describe('recompressPdfBytes', () => {
  it('troca imagem DCT por versao menor', async () => {
    const bytes = await buildPdf();
    let received = null;
    const out = await recompressPdfBytes(bytes, async (b, mime) => {
      received = { len: b.length, mime };
      return { bytes: new Uint8Array(4000), width: 1500, height: 1000 };
    });
    expect(received).toEqual({ len: 80_000, mime: 'image/jpeg' });
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBeLessThan(bytes.length * 0.85);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('devolve null quando a reencodagem nao reduz', async () => {
    const bytes = await buildPdf();
    const out = await recompressPdfBytes(bytes, async () => ({ bytes: new Uint8Array(90_000), width: 10, height: 10 }));
    expect(out).toBeNull();
  });

  it('PDF assinado ou criptografado passa intacto (null)', async () => {
    const bytes = await buildPdf();
    const enc = (marker) => new Uint8Array([...bytes, ...new TextEncoder().encode(`\n${marker}\n`)]);
    const rasterize = async () => ({ bytes: new Uint8Array(10), width: 1, height: 1 });
    expect(await recompressPdfBytes(enc('/ByteRange [0 10 20 30]'), rasterize)).toBeNull();
    expect(await recompressPdfBytes(enc('/Encrypt 5 0 R'), rasterize)).toBeNull();
  });

  it('PDF ilegivel retorna null', async () => {
    expect(await recompressPdfBytes(new TextEncoder().encode('%PDF-1.4 lixo'), async () => null)).toBeNull();
  });
});

describe('helpers de upload', () => {
  it('canvasToDataUrl cai para JPEG quando WebP nao e suportado', () => {
    const calls = [];
    const canvas = {
      toDataURL: (type) => {
        calls.push(type);
        return type === 'image/webp' ? 'data:image/png;base64,AAAA' : 'data:image/jpeg;base64,BBBB';
      },
    };
    expect(canvasToDataUrl(canvas, 0.85)).toBe('data:image/jpeg;base64,BBBB');
    expect(calls).toEqual(['image/webp', 'image/jpeg']);
    const ok = { toDataURL: () => 'data:image/webp;base64,CCCC' };
    expect(canvasToDataUrl(ok)).toBe('data:image/webp;base64,CCCC');
  });

  it('replaceFileExtension e downloadNameForDataUrl', () => {
    expect(replaceFileExtension('foto.final.png', 'webp')).toBe('foto.final.webp');
    expect(downloadNameForDataUrl('rg.jpg', 'data:image/webp;base64,AA')).toBe('rg.webp');
    expect(downloadNameForDataUrl('rg.pdf', 'data:application/pdf;base64,AA')).toBe('rg.pdf');
    expect(downloadNameForDataUrl('folha.xlsx', 'data:application/octet-stream;base64,AA')).toBe('folha.xlsx');
  });

  it('presets existem', () => {
    expect(IMAGE_PRESETS.documento).toEqual({ maxSide: 2200, quality: 0.85 });
    expect(IMAGE_PRESETS.selfie.maxSide).toBeNull();
  });

  it('prepareUpload nao toca em xlsx/csv, GIF e PDF sem imagens', async () => {
    const csv = new File(['a,b\n1,2'], 'folha.csv', { type: 'text/csv' });
    const r = await prepareUpload(csv);
    expect(r.changed).toBe(false);
    expect(r.dataUrl).toBe(`data:text/csv;base64,${btoa('a,b\n1,2')}`);
    expect(r.name).toBe('folha.csv');

    const gif = new File([new TextEncoder().encode('GIF89a....')], 'a.gif', { type: 'image/gif' });
    expect((await prepareUpload(gif)).mime).toBe('image/gif');

    const doc = await PDFDocument.create();
    doc.addPage();
    const pdf = new File([await doc.save()], 'x.pdf', { type: 'application/pdf' });
    const p = await prepareUpload(pdf);
    expect(p.changed).toBe(false);
    expect(p.dataUrl.startsWith('data:application/pdf;base64,')).toBe(true);
    expect((await fileToBase64(pdf)).startsWith('data:application/pdf')).toBe(true);
  });
});
