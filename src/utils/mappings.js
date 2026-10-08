// Lista padrão (roda a cada evento Realtime): SEM photo/face_descriptor, que são
// base64/vetores pesados. Busque sob demanda com src/utils/internBiometry.js.
export const INTERN_SELECT_FIELDS = 'id, name, course, institution, internship_type, shift, daily_hours, unit_id, active, start_date, end_date, last_report_date, recess_days_taken, username, is_first_login, cpf, email, rg, phone, address, bank_name, bank_agency, bank_account, pix_key, emergency_name, emergency_relationship, emergency_phone, allowance, supervisor_name, registration_status, birthdate, role_id';

// Variante com biometria: use SOMENTE em telas/consultas estreitas (nunca em listas
// recarregadas por Realtime).
export const INTERN_SELECT_FIELDS_WITH_BIOMETRY = `${INTERN_SELECT_FIELDS}, photo, face_descriptor`;

// ---------------------------------------------------------------------------
// Uploads: compressão no navegador (imagem -> WebP, PDF -> imagens recomprimidas)
// ---------------------------------------------------------------------------

// Presets: lado maior em px (null = mantém a resolução de captura) e qualidade.
export const IMAGE_PRESETS = {
  documento: { maxSide: 2200, quality: 0.85 }, // legibilidade de texto
  foto: { maxSide: 1600, quality: 0.82 },
  avatar: { maxSide: 512, quality: 0.82 },
  selfie: { maxSide: null, quality: 0.85 }, // biometria: não reduz a captura
};

export const PDF_MIN_GAIN = 0.15; // só substitui o original se economizar >= 15%
const PDF_MAX_BYTES = 20 * 1024 * 1024; // acima disso não vale o custo no navegador
const PDF_MAX_LONG_SIDE = 2339; // ~200 dpi no lado maior de uma folha A4
const PDF_MAX_SHORT_SIDE = 1654; // ~200 dpi no lado menor de uma folha A4

const ascii = (bytes, start, end) => {
  let s = '';
  for (let i = start; i < end && i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
};

// Detecta o tipo real pelos bytes (não confia em file.type).
export const sniffMime = (bytes) => {
  if (!bytes || bytes.length < 4) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG') return 'image/png';
  if (ascii(bytes, 0, 4) === 'GIF8') return 'image/gif';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';
  if (ascii(bytes, 0, 5) === '%PDF-') return 'application/pdf';
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
  }
  return null;
};

const EXT_BY_MIME = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

export const replaceFileExtension = (name, ext) => {
  const base = String(name || 'arquivo').replace(/\.[^./\\]+$/, '');
  return `${base}.${ext}`;
};

const bytesToBase64 = (bytes) => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

export const blobToDataUrl = async (blob, mimeOverride) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${mimeOverride || blob.type || 'application/octet-stream'};base64,${bytesToBase64(bytes)}`;
};

// canvas.toDataURL em WebP com fallback para JPEG quando o navegador não
// consegue gerar WebP (nesse caso o toDataURL devolve PNG).
export const canvasToDataUrl = (canvas, quality = 0.85) => {
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/jpeg', quality);
};

const canvasToBlobType = (canvas, type, quality) =>
  new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } catch {
      resolve(null);
    }
  });

const decodeImage = async (blob) => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close?.() };
    } catch {
      // cai para <img>
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return { source: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, release: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
};

const fitSize = (width, height, maxWidth, maxHeight) => {
  let scale = 1;
  if (maxWidth) scale = Math.min(scale, maxWidth / width);
  if (maxHeight) scale = Math.min(scale, maxHeight / height);
  if (scale >= 1) return { width, height }; // sem upscale
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

/**
 * Comprime uma imagem (PNG/JPEG/WebP) para WebP, corrigindo orientação EXIF e
 * sem upscale. Fallback para JPEG se o navegador não gerar WebP. Se o resultado
 * ficar maior que o original (já WebP/JPEG), devolve o original.
 * Retorna { blob, mime, ext, changed }.
 */
export const compressImageToBlob = async (file, { maxWidth = null, maxHeight = null, quality = 0.85 } = {}) => {
  const original = { blob: file, mime: file.type, ext: EXT_BY_MIME[file.type] || 'bin', changed: false };
  const decoded = await decodeImage(file);
  try {
    const { width, height } = fitSize(decoded.width, decoded.height, maxWidth, maxHeight);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(decoded.source, 0, 0, width, height); // WebP preserva alpha

    let blob = await canvasToBlobType(canvas, 'image/webp', quality);
    if (!blob || blob.type !== 'image/webp') {
      // JPEG não tem alpha: redesenha sobre fundo branco
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      blob = await canvasToBlobType(canvas, 'image/jpeg', quality);
    }
    if (!blob) return original;

    const sameDims = width === decoded.width && height === decoded.height;
    if ((file.type === 'image/webp' || file.type === 'image/jpeg') && sameDims && blob.size >= file.size) {
      return original;
    }
    return { blob, mime: blob.type, ext: EXT_BY_MIME[blob.type] || 'webp', changed: true };
  } finally {
    decoded.release();
  }
};

/**
 * Mantém a API histórica (devolve data URL), agora em WebP.
 * Arquivos que não são imagem raster (PDF, GIF, SVG, HEIC...) passam como estão.
 */
export const compressImage = async (file, maxWidth = 300, maxHeight = 400, quality = 0.7) => {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = sniffMime(head);
  if (mime !== 'image/png' && mime !== 'image/jpeg' && mime !== 'image/webp') {
    return blobToDataUrl(file, mime || undefined);
  }
  const typed = file.type === mime ? file : new Blob([file], { type: mime });
  const result = await compressImageToBlob(typed, { maxWidth, maxHeight, quality });
  return blobToDataUrl(result.blob, result.mime);
};

const FLAG_SIGNED_OR_ENCRYPTED = ['/ByteRange', '/Encrypt', '/SigFlags', '/Type /Sig', '/Type/Sig', '/FT /Sig', '/FT/Sig'];

// Busca textual nos bytes crus: pega assinatura/criptografia mesmo em PDFs
// que o pdf-lib consegue abrir.
const pdfLooksSignedOrEncrypted = (bytes) => {
  const text = ascii(bytes, 0, bytes.length);
  return FLAG_SIGNED_OR_ENCRYPTED.some((flag) => text.includes(flag));
};

// Reencoda uma imagem embutida como JPEG q0.8, limitada a ~200 dpi.
// Entrada: bytes JPEG (DCTDecode) ou pixels crus RGBA (FlateDecode).
const browserRasterize = async (bytes, mime, rawPixels) => {
  const decoded = rawPixels ? null : await decodeImage(new Blob([bytes], { type: mime }));
  try {
    let source;
    let width;
    let height;
    if (rawPixels) {
      width = rawPixels.width;
      height = rawPixels.height;
      source = document.createElement('canvas');
      source.width = width;
      source.height = height;
      source.getContext('2d').putImageData(new ImageData(rawPixels.rgba, width, height), 0, 0);
    } else {
      width = decoded.width;
      height = decoded.height;
      source = decoded.source;
    }
    const target = limitPdfImage(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlobType(canvas, 'image/jpeg', 0.8);
    if (!blob) return null;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
  } finally {
    decoded?.release();
  }
};

// Limita a ~200 dpi equivalentes em A4 (sem upscale).
const limitPdfImage = (width, height) => {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  const scale = Math.min(1, PDF_MAX_LONG_SIDE / long, PDF_MAX_SHORT_SIDE / short);
  if (scale >= 1) return { width, height };
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

/**
 * Núcleo da recompressão de PDF (testável sem DOM): recebe bytes e uma função
 * `rasterize(bytes, mime, rawPixels)` -> { bytes, width, height } | null.
 * Retorna Uint8Array novo ou null quando não vale a pena (ou não é seguro).
 */
export const recompressPdfBytes = async (bytes, rasterize) => {
  if (bytes.length > PDF_MAX_BYTES) return null;
  if (pdfLooksSignedOrEncrypted(bytes)) return null;

  const { PDFDocument, PDFName, PDFRawStream, PDFNumber, PDFBool, decodePDFRawStream } = await import('pdf-lib');
  let pdfDoc;
  try {
    pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch {
    return null; // criptografado ou ilegível: original intacto
  }

  const context = pdfDoc.context;
  let replaced = 0;
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (dict.get(PDFName.of('Subtype')) !== PDFName.of('Image')) continue;
    if (dict.has(PDFName.of('SMask')) || dict.has(PDFName.of('Mask')) || dict.has(PDFName.of('Decode'))) continue;
    const imageMask = dict.get(PDFName.of('ImageMask'));
    if (imageMask instanceof PDFBool && imageMask.asBoolean()) continue;
    const bpc = dict.get(PDFName.of('BitsPerComponent'));
    if (bpc instanceof PDFNumber && bpc.asNumber() !== 8) continue;
    const cs = dict.get(PDFName.of('ColorSpace'));
    const csName = cs instanceof PDFName ? cs.asString() : null;
    if (csName !== '/DeviceRGB' && csName !== '/DeviceGray') continue;
    const widthObj = dict.get(PDFName.of('Width'));
    const heightObj = dict.get(PDFName.of('Height'));
    if (!(widthObj instanceof PDFNumber) || !(heightObj instanceof PDFNumber)) continue;
    const width = widthObj.asNumber();
    const height = heightObj.asNumber();

    const filter = dict.get(PDFName.of('Filter'));
    const filterName = filter instanceof PDFName ? filter.asString() : null;
    const originalSize = obj.getContents().length;

    let out = null;
    try {
      if (filterName === '/DCTDecode') {
        out = await rasterize(obj.getContents(), 'image/jpeg', null);
      } else if (filterName === '/FlateDecode' && !dict.has(PDFName.of('DecodeParms'))) {
        const raw = decodePDFRawStream(obj).decode();
        const comps = csName === '/DeviceRGB' ? 3 : 1;
        if (raw.length !== width * height * comps) continue;
        const rgba = new Uint8ClampedArray(width * height * 4);
        for (let i = 0, p = 0; i < width * height; i++) {
          if (comps === 3) {
            rgba[p++] = raw[i * 3];
            rgba[p++] = raw[i * 3 + 1];
            rgba[p++] = raw[i * 3 + 2];
          } else {
            rgba[p++] = raw[i];
            rgba[p++] = raw[i];
            rgba[p++] = raw[i];
          }
          rgba[p++] = 255;
        }
        out = await rasterize(null, null, { width, height, rgba });
      } else {
        continue;
      }
    } catch {
      continue;
    }
    if (!out || out.bytes.length >= originalSize) continue;

    const newStream = context.stream(out.bytes, {
      Type: 'XObject',
      Subtype: 'Image',
      Width: out.width,
      Height: out.height,
      ColorSpace: 'DeviceRGB', // o JPEG gerado pelo canvas é sempre RGB
      BitsPerComponent: 8,
      Filter: 'DCTDecode',
    });
    context.assign(ref, newStream);
    replaced += 1;
    await new Promise((r) => setTimeout(r, 0)); // devolve o controle à UI
  }

  if (!replaced) return null;
  return pdfDoc.save({ useObjectStreams: true });
};

/**
 * Recomprime as imagens embutidas de um PDF. Devolve o original se o PDF for
 * assinado/criptografado, ilegível, sem imagens elegíveis ou se o ganho for < 15%.
 * Roda no thread principal (precisa de canvas); cede o controle entre imagens.
 */
export const compressPdf = async (file) => {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const out = await recompressPdfBytes(bytes, browserRasterize);
    if (!out || out.length > bytes.length * (1 - PDF_MIN_GAIN)) return file;
    return new Blob([out], { type: 'application/pdf' });
  } catch {
    return file;
  }
};

/**
 * Ponto único de entrada: roteia pelo tipo REAL (bytes), aplica o preset e
 * devolve { dataUrl, mime, ext, name, blob, changed }.
 * xlsx/csv/GIF/SVG/HEIC e qualquer outro tipo passam intactos.
 */
export const prepareUpload = async (file, preset = 'documento') => {
  const cfg = IMAGE_PRESETS[preset] || IMAGE_PRESETS.documento;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = sniffMime(head);

  let blob = file;
  let mime = sniffed || file.type || 'application/octet-stream';
  let changed = false;

  try {
    if (sniffed === 'image/png' || sniffed === 'image/jpeg' || sniffed === 'image/webp') {
      const typed = file.type === sniffed ? file : new Blob([file], { type: sniffed });
      const res = await compressImageToBlob(typed, { maxWidth: cfg.maxSide, maxHeight: cfg.maxSide, quality: cfg.quality });
      blob = res.blob;
      mime = res.mime;
      changed = res.changed;
    } else if (sniffed === 'application/pdf') {
      const res = await compressPdf(file);
      changed = res !== file;
      blob = res;
      mime = 'application/pdf';
    }
  } catch {
    blob = file; // nunca perder o arquivo
    changed = false;
  }

  const ext = changed ? EXT_BY_MIME[mime] : (file.name?.match(/\.([^./\\]+)$/)?.[1]?.toLowerCase() || EXT_BY_MIME[mime] || 'bin');
  return {
    dataUrl: await blobToDataUrl(blob, mime),
    mime,
    ext,
    name: changed && file.name ? replaceFileExtension(file.name, ext) : file.name,
    blob,
    changed,
  };
};

export const fileToBase64 = async (file, preset = 'documento') => (await prepareUpload(file, preset)).dataUrl;

// Nome de download coerente com o conteúdo gravado (ex.: .jpg enviado -> .webp).
export const downloadNameForDataUrl = (filename, dataUrl) => {
  const m = /^data:([^;,]+)/.exec(dataUrl || '');
  const ext = m && EXT_BY_MIME[m[1]];
  if (!ext || !filename) return filename;
  const current = filename.match(/\.([^./\\]+)$/)?.[1]?.toLowerCase();
  const same = current === ext || (ext === 'jpg' && current === 'jpeg');
  return same || !/\.(png|jpe?g|webp|pdf)$/i.test(filename) ? filename : replaceFileExtension(filename, ext);
};

export const getFriendlyDbErrorMessage = (err) => {
  const rawMessage = String(err?.message || err || '');
  const isDuplicateKey = err?.code === '23505' || /duplicate key value violates unique constraint/i.test(rawMessage);

  if (isDuplicateKey) {
    if (/username_key/i.test(rawMessage)) {
      return 'Já existe um estagiário cadastrado com um nome de usuário igual (gerado a partir do nome completo). Verifique se este cadastro já não foi feito antes ou ajuste o nome informado.';
    }
    if (/cpf_key/i.test(rawMessage)) {
      return 'Já existe um estagiário cadastrado com este CPF. Verifique se este cadastro já não foi feito antes.';
    }
    if (/email_key/i.test(rawMessage)) {
      return 'Já existe um estagiário cadastrado com este e-mail. Verifique se este cadastro já não foi feito antes.';
    }
    return 'Este cadastro já existe nos registros. Verifique se as informações já não foram cadastradas anteriormente.';
  }

  return rawMessage;
};

export const generateUsername = (fullName) => {
  const clean = fullName.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, '');
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[parts.length - 1]}`;
  } else if (parts.length === 1) {
    return `${parts[0]}.estagio`;
  }
  return 'estagiario';
};

export const mapInternFromDb = (i) => ({
  id: i.id,
  name: i.name,
  course: i.course,
  institution: i.institution,
  internshipType: i.internship_type || '',
  shift: i.shift,
  dailyHours: i.daily_hours,
  unitId: i.unit_id,
  active: i.active,
  startDate: i.start_date,
  endDate: i.end_date,
  lastReportDate: i.last_report_date,
  recessDaysTaken: i.recess_days_taken,
  username: i.username,
  isFirstLogin: i.is_first_login,
  documents: i.documents || {},
  photo: i.photo,
  cpf: i.cpf || '',
  email: i.email || '',
  rg: i.rg || '',
  phone: i.phone || '',
  address: i.address || '',
  bankName: i.bank_name || '',
  bankAgency: i.bank_agency || '',
  bankAccount: i.bank_account || '',
  pixKey: i.pix_key || '',
  emergencyName: i.emergency_name || '',
  emergencyRelationship: i.emergency_relationship || 'Pais',
  emergencyPhone: i.emergency_phone || '',
  allowance: Number(i.allowance) || 0,
  supervisorName: i.supervisor_name || '',
  registrationStatus: i.registration_status || 'validated',
  semestralReports: i.semestral_reports || {},
  contractTermination: i.contract_termination || {},
  birthdate: i.birthdate || '',
  // undefined = coluna não carregada (não confundir com 'sem biometria').
  faceDescriptor: i.face_descriptor === undefined ? undefined : (i.face_descriptor || ''),
  // Função esperada na Simulação por Unidade do Banco de Talentos (ver
  // src/config/roleProfiles.js). Nula até o gestor marcar.
  roleId: i.role_id || '',
});

export const mapInternToDb = (i) => ({
  name: i.name,
  course: i.course,
  institution: i.institution,
  internship_type: i.internshipType || null,
  shift: i.shift,
  daily_hours: i.dailyHours,
  unit_id: i.unitId,
  active: i.active !== false,
  start_date: i.startDate,
  end_date: i.endDate,
  last_report_date: i.lastReportDate,
  recess_days_taken: Number(i.recessDaysTaken) || 0,
  username: i.username,
  is_first_login: i.isFirstLogin !== false,
  documents: i.documents || {},
  // Omitido quando undefined (JSON.stringify descarta) -> não sobrescreve a foto.
  photo: i.photo,
  cpf: i.cpf || '',
  email: i.email || '',
  rg: i.rg || '',
  phone: i.phone || '',
  address: i.address || '',
  bank_name: i.bankName || '',
  bank_agency: i.bankAgency || '',
  bank_account: i.bankAccount || '',
  pix_key: i.pixKey || '',
  emergency_name: i.emergencyName || '',
  emergency_relationship: i.emergencyRelationship || 'Pais',
  emergency_phone: i.emergencyPhone || '',
  allowance: Number(i.allowance) || 0,
  supervisor_name: i.supervisorName || '',
  role_id: i.roleId || null,
  registration_status: i.registrationStatus || 'validated',
  semestral_reports: i.semestralReports || {},
  contract_termination: i.contractTermination || {},
  birthdate: i.birthdate || null,
  // Só envia se carregado/definido: evita apagar a biometria num update quando a
  // lista padrão não traz face_descriptor.
  ...(i.faceDescriptor !== undefined ? { face_descriptor: i.faceDescriptor || null } : {}),
});

export const mapRecordFromDb = (r) => ({
  id: r.id,
  internId: r.intern_id,
  internName: r.intern_name,
  action: r.action,
  justification: r.justification,
  timestamp: r.timestamp,
  photo: r.photo,
  isManual: r.is_manual,
  justificationDoc: r.justification_doc,
  geo: r.geo,
  daysAway: r.days_away || 0,
});

export const mapRecordToDb = (r) => ({
  intern_id: r.internId,
  intern_name: r.internName,
  action: r.action,
  justification: r.justification,
  timestamp: r.timestamp,
  photo: r.photo,
  is_manual: r.isManual,
  justification_doc: r.justificationDoc,
  geo: r.geo,
  days_away: Number(r.daysAway) || 0,
});

const safeNum = (val, fallback = 0) => {
  if (val === undefined || val === null || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

export const mapUnitFromDb = (u) => {
  if (!u) return {};
  const radiusM = safeNum(u.radius_m, safeNum(u.radius_km, 5) * 1000);
  const radiusKm = safeNum(u.radius_km, radiusM / 1000);
  return {
    id: u.id,
    name: u.name || '',
    address: u.address || '',
    lat: safeNum(u.lat, 0),
    lng: safeNum(u.lng, 0),
    radiusKm,
    radiusM,
    geofenceRequired: u.geofence_required === true,
    workspaceId: u.workspace_id || null,
    kioskEmail: u.kiosk_email || '',
    biometricRequired: u.biometric_required || false,
    pjEnabled: u.pj_enabled || false,
    pjKioskEmail: u.pj_kiosk_email || '',
    pjSelfRegistrationEnabled: u.pj_self_registration_enabled || false,
    contratoPjCustomText: u.contrato_pj_custom_text || '',
    razaoSocial: u.razao_social || '',
    cnpj: u.cnpj || '',
    phone: u.phone || '',
    logoUrl: u.logo_url || '',
    tceCustomText: u.tce_custom_text || '',
    paeCustomText: u.pae_custom_text || '',
    declaracaoCustomText: u.declaracao_custom_text || '',
    fichaCustomText: u.ficha_custom_text || '',
    cltEnabled: u.clt_enabled || false,
    cltKioskEmail: u.clt_kiosk_email || '',
    cltToleranceMinutes: safeNum(u.clt_tolerance_minutes, 5),
    cltGeofenceRequired: u.clt_geofence_required !== false,
    cltCustomContractText: u.clt_custom_contract_text || '',
    cltSelfRegistrationEnabled: u.clt_self_registration_enabled || false,
  };
};

export const mapUnitToDb = (u) => {
  if (!u) return {};
  const radiusM = safeNum(u.radiusM ?? u.radius_m, safeNum(u.radiusKm ?? u.radius_km, 5) * 1000);
  const radiusKm = safeNum(u.radiusKm ?? u.radius_km, radiusM / 1000);
  return {
    id: u.id,
    name: u.name || u.nome || '',
    address: u.address || u.endereco || '',
    lat: safeNum(u.lat ?? u.latitude, 0),
    lng: safeNum(u.lng ?? u.longitude, 0),
    radius_km: radiusKm,
    radius_m: radiusM,
    geofence_required: Boolean(u.geofenceRequired ?? u.geofence_required),
    workspace_id: u.workspaceId || u.workspace_id || null,
    kiosk_email: u.kioskEmail || u.kiosk_email || null,
    biometric_required: u.biometricRequired !== undefined ? Boolean(u.biometricRequired) : (u.biometric_required !== undefined ? Boolean(u.biometric_required) : false),
    pj_enabled: u.pjEnabled !== undefined ? Boolean(u.pjEnabled) : (u.pj_enabled !== undefined ? Boolean(u.pj_enabled) : false),
    pj_kiosk_email: u.pjKioskEmail || u.pj_kiosk_email || null,
    pj_self_registration_enabled: u.pjSelfRegistrationEnabled !== undefined ? Boolean(u.pjSelfRegistrationEnabled) : (u.pj_self_registration_enabled !== undefined ? Boolean(u.pj_self_registration_enabled) : false),
    contrato_pj_custom_text: u.contratoPjCustomText || u.contrato_pj_custom_text || null,
    razao_social: u.razaoSocial || u.razao_social || null,
    cnpj: u.cnpj || null,
    phone: u.phone || null,
    logo_url: u.logoUrl || u.logo_url || null,
    tce_custom_text: u.tceCustomText || u.tce_custom_text || null,
    pae_custom_text: u.paeCustomText || u.pae_custom_text || null,
    declaracao_custom_text: u.declaracaoCustomText || u.declaracao_custom_text || null,
    ficha_custom_text: u.fichaCustomText || u.ficha_custom_text || null,
    clt_enabled: u.cltEnabled !== undefined ? Boolean(u.cltEnabled) : (u.clt_enabled !== undefined ? Boolean(u.clt_enabled) : false),
    clt_kiosk_email: u.cltKioskEmail || u.clt_kiosk_email || null,
    clt_tolerance_minutes: safeNum(u.cltToleranceMinutes ?? u.clt_tolerance_minutes, 5),
    clt_geofence_required: (u.cltGeofenceRequired ?? u.clt_geofence_required) !== false,
    clt_custom_contract_text: u.cltCustomContractText || u.clt_custom_contract_text || null,
    clt_self_registration_enabled: u.cltSelfRegistrationEnabled !== undefined ? Boolean(u.cltSelfRegistrationEnabled) : (u.clt_self_registration_enabled !== undefined ? Boolean(u.clt_self_registration_enabled) : false),
  };
};

export const safeUpsertUnits = async (supabaseClient, dbUnits) => {
  if (!supabaseClient) return { error: new Error('Cliente Supabase não fornecido') };
  const payload = Array.isArray(dbUnits)
    ? dbUnits.map(u => ({ ...u }))
    : [{ ...dbUnits }];

  let { error } = await supabaseClient.from('units').upsert(payload);

  let maxRetries = 10;
  const removedColumns = [];
  while (error && maxRetries > 0) {
    const errorStr = error.message || error.details || error.hint || JSON.stringify(error);
    const match =
      errorStr.match(/Could not find the '([^']+)' column/i) ||
      errorStr.match(/column "([^"]+)" of relation/i) ||
      errorStr.match(/column '([^']+)' does not exist/i);

    if (match && match[1]) {
      const missingCol = match[1];
      if (removedColumns.includes(missingCol)) {
        break;
      }
      removedColumns.push(missingCol);
      console.warn(`[safeUpsertUnits] Coluna '${missingCol}' ausente na tabela 'units' no Supabase. Removendo do payload e tentando novamente...`);
      payload.forEach(item => {
        delete item[missingCol];
      });
      const retryResult = await supabaseClient.from('units').upsert(payload);
      error = retryResult.error;
      maxRetries--;
    } else {
      break;
    }
  }

  if (removedColumns.length > 0 && !error) {
    console.info(`[safeUpsertUnits] Unidade(s) salva(s) com sucesso com fallback (colunas ausentes no schema do banco: ${removedColumns.join(', ')}).`);
  }

  return { error, payload, removedColumns };
};


// =========================================================================
// MÓDULO PROFISSIONAIS PJ (prestadores de serviço) — tabelas professionals,
// professional_presence e professional_documents. Mantidas separadas dos
// mapeadores de estagiário de propósito: nada aqui deve alimentar as telas de
// ponto/bolsa de estagiários nem vice-versa.
// =========================================================================
export const PROFESSIONAL_SELECT_FIELDS = 'id, unit_id, name, profession, council_type, council_number, council_uf, council_validity, specialties, cpf, cnpj, razao_social, nome_fantasia, natureza_juridica, cnae_principal, inscricao_municipal, endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, email, phone, bank_name, bank_agency, bank_account, bank_account_type, pix_key, birthdate, rep_name, rep_cpf, rep_rg, rep_birthdate, rep_email, rep_phone, rep_role, service_description, remuneration_model, remuneration_value, payment_day, notice_days, contract_start, contract_end, contract_notes, active, registration_status, self_registered_at, autonomy_declaration_accepted_at, autonomy_declaration_version, lgpd_consent_accepted_at, terms_accepted_at, terms_version, photo, created_at, role_id';

export const mapProfessionalFromDb = (p) => ({
  id: p.id,
  unitId: p.unit_id,
  name: p.name,
  profession: p.profession || '',
  councilType: p.council_type || '',
  councilNumber: p.council_number || '',
  councilUf: p.council_uf || '',
  councilValidity: p.council_validity || '',
  specialties: p.specialties || '',
  cpf: p.cpf || '',
  cnpj: p.cnpj || '',
  razaoSocial: p.razao_social || '',
  nomeFantasia: p.nome_fantasia || '',
  naturezaJuridica: p.natureza_juridica || '',
  cnaePrincipal: p.cnae_principal || '',
  inscricaoMunicipal: p.inscricao_municipal || '',
  enderecoCep: p.endereco_cep || '',
  enderecoLogradouro: p.endereco_logradouro || '',
  enderecoNumero: p.endereco_numero || '',
  enderecoComplemento: p.endereco_complemento || '',
  enderecoBairro: p.endereco_bairro || '',
  enderecoCidade: p.endereco_cidade || '',
  enderecoUf: p.endereco_uf || '',
  email: p.email || '',
  phone: p.phone || '',
  bankName: p.bank_name || '',
  bankAgency: p.bank_agency || '',
  bankAccount: p.bank_account || '',
  bankAccountType: p.bank_account_type || '',
  pixKey: p.pix_key || '',
  birthdate: p.birthdate || '',
  repName: p.rep_name || '',
  repCpf: p.rep_cpf || '',
  repRg: p.rep_rg || '',
  repBirthdate: p.rep_birthdate || '',
  repEmail: p.rep_email || '',
  repPhone: p.rep_phone || '',
  repRole: p.rep_role || '',
  serviceDescription: p.service_description || '',
  remunerationModel: p.remuneration_model || '',
  remunerationValue: p.remuneration_value ?? '',
  shiftValue: p.shift_value ?? p.remuneration_value ?? '',
  paymentDay: p.payment_day ?? '',
  noticeDays: p.notice_days ?? '',
  contractStart: p.contract_start || '',
  contractEnd: p.contract_end || '',
  contractNotes: p.contract_notes || '',
  active: p.active !== false,
  registrationStatus: p.registration_status || 'validated',
  selfRegisteredAt: p.self_registered_at || null,
  autonomyDeclarationAcceptedAt: p.autonomy_declaration_accepted_at || null,
  autonomyDeclarationVersion: p.autonomy_declaration_version || '',
  lgpdConsentAcceptedAt: p.lgpd_consent_accepted_at || null,
  termsAcceptedAt: p.terms_accepted_at || null,
  termsVersion: p.terms_version || '',
  photo: p.photo || '',
  createdAt: p.created_at,
  roleId: p.role_id || '',
});

export const mapProfessionalToDb = (p) => ({
  unit_id: p.unitId,
  name: (p.name || '').trim(),
  profession: p.profession || null,
  council_type: p.councilType || null,
  council_number: p.councilNumber || null,
  council_uf: p.councilUf || null,
  council_validity: p.councilValidity || null,
  specialties: p.specialties || null,
  cpf: p.cpf || null,
  cnpj: p.cnpj || null,
  razao_social: p.razaoSocial || null,
  nome_fantasia: p.nomeFantasia || null,
  natureza_juridica: p.naturezaJuridica || null,
  cnae_principal: p.cnaePrincipal || null,
  inscricao_municipal: p.inscricaoMunicipal || null,
  endereco_cep: p.enderecoCep || null,
  endereco_logradouro: p.enderecoLogradouro || null,
  endereco_numero: p.enderecoNumero || null,
  endereco_complemento: p.enderecoComplemento || null,
  endereco_bairro: p.enderecoBairro || null,
  endereco_cidade: p.enderecoCidade || null,
  endereco_uf: p.enderecoUf || null,
  email: p.email || null,
  phone: p.phone || null,
  bank_name: p.bankName || null,
  bank_agency: p.bankAgency || null,
  bank_account: p.bankAccount || null,
  bank_account_type: p.bankAccountType || null,
  pix_key: p.pixKey || null,
  birthdate: p.birthdate || null,
  rep_name: p.repName || null,
  rep_cpf: p.repCpf || null,
  rep_rg: p.repRg || null,
  rep_birthdate: p.repBirthdate || null,
  rep_email: p.repEmail || null,
  rep_phone: p.repPhone || null,
  rep_role: p.repRole || null,
  service_description: p.serviceDescription || null,
  remuneration_model: p.remunerationModel || null,
  remuneration_value: p.remunerationValue === '' || p.remunerationValue == null ? null : Number(p.remunerationValue),
  payment_day: p.paymentDay === '' || p.paymentDay == null ? null : Number(p.paymentDay),
  notice_days: p.noticeDays === '' || p.noticeDays == null ? null : Number(p.noticeDays),
  contract_start: p.contractStart || null,
  contract_end: p.contractEnd || null,
  contract_notes: p.contractNotes || null,
  active: p.active !== false,
  photo: p.photo || null,
  role_id: p.roleId || null,
});

export const PROFESSIONAL_PRESENCE_SELECT_FIELDS = 'id, professional_id, professional_name, unit_id, action, timestamp, auth_method, geo, note, created_by, created_at';

export const mapProfessionalPresenceFromDb = (r) => ({
  id: r.id,
  professionalId: r.professional_id,
  professionalName: r.professional_name,
  unitId: r.unit_id,
  action: r.action,
  timestamp: r.timestamp,
  authMethod: r.auth_method || 'pin',
  geo: r.geo || {},
  note: r.note || '',
  createdBy: r.created_by || null,
});

// Regra de PIN espelhada da função SQL is_valid_professional_pin (validação
// antecipada no front; a autoridade final é o banco).
const TRIVIAL_PINS = new Set(['123456', '654321', '012345', '543210', '112233', '123123', '111222', '222333']);
export const isValidProfessionalPin = (pin) => {
  const p = String(pin || '');
  if (!/^[0-9]{6}$/.test(p)) return false;
  if (/^(\d)\1{5}$/.test(p)) return false;
  return !TRIVIAL_PINS.has(p);
};

// Traduz os códigos de erro lançados pelas RPCs do módulo PJ.
export const professionalRpcErrorMessage = (err) => {
  const msg = String(err?.message || err || '');
  if (msg.includes('pin_not_set')) return 'Este prestador ainda não possui PIN. Solicite a definição do PIN à administração.';
  if (msg.includes('pin_locked')) return 'PIN bloqueado temporariamente por excesso de tentativas. Aguarde 15 minutos e tente novamente.';
  if (msg.includes('pin_invalid_format')) return 'O PIN deve ter exatamente 6 dígitos e não pode ser uma sequência óbvia (ex.: 123456, 000000).';
  if (msg.includes('pin_must_be_changed')) return 'Por segurança, você precisa trocar o PIN padrão antes de registrar presença.';
  if (msg.includes('pin_invalid')) return 'PIN incorreto.';
  if (msg.includes('terms_not_accepted')) return 'É necessário aceitar o termo de ciência antes do primeiro registro.';
  if (msg.includes('sequence_open_entry')) return 'Já existe uma entrada em aberto hoje. Registre a saída primeiro.';
  if (msg.includes('sequence_no_entry')) return 'Não há entrada registrada hoje. Registre a entrada antes da saída.';
  if (msg.includes('professional_inactive')) return 'Cadastro inativo. Procure a administração.';
  if (msg.includes('unit_pj_disabled')) return 'O registro de prestadores não está habilitado nesta unidade.';
  if (msg.includes('professional_pending_validation')) return 'Este cadastro ainda não foi validado pela administração.';
  if (msg.includes('self_registration_disabled')) return 'O autocadastro não está habilitado para esta unidade.';
  if (msg.includes('duplicate_cnpj')) return 'Já existe um prestador cadastrado com este CNPJ nesta unidade.';
  if (msg.includes('duplicate_cpf')) return 'Já existe um prestador cadastrado com o CPF deste representante nesta unidade.';
  if (msg.includes('missing_required_fields')) return 'Preencha todos os campos obrigatórios do cadastro.';
  if (msg.includes('autonomy_declaration_required')) return 'É necessário aceitar a Declaração de Autonomia do Prestador de Serviços.';
  if (msg.includes('lgpd_consent_required')) return 'É necessário aceitar o consentimento de tratamento de dados (LGPD).';
  if (msg.includes('invalid_doc_key')) return 'Tipo de documento inválido.';
  if (msg.includes('invalid_file_size')) return 'Arquivo inválido ou excede o limite de 2MB.';
  if (msg.includes('invalid_file_type')) return 'Tipo de arquivo não permitido. Envie imagem (JPG, PNG, WebP) ou PDF.';
  if (msg.includes('invalid_token') || msg.includes('token_expired')) return 'Sessão de envio de documentos expirada. Reinicie o cadastro.';
  if (msg.includes('upload_limit_reached')) return 'Limite de anexos deste cadastro atingido.';
  if (msg.includes('not authorized')) return 'Acesso não autorizado para esta operação.';
  return msg || 'Erro inesperado.';
};

// =========================================================================
// MÓDULO FUNCIONÁRIOS CLT (empregados) — tabelas employees, employee_*,
// holidays. Terceiro tipo de vínculo, mantido isolado dos mapeadores de
// estagiário e de PJ (ver supabase_schema.sql, seção 17).
// =========================================================================

// Inclui photo e face_descriptor: necessários para o matching biométrico no
// quiosque CLT. Usada no cadastro (FuncionariosTab) e onde a foto é exibida.
export const EMPLOYEE_SELECT_FIELDS = 'id, unit_id, name, cpf, rg, rg_issuer, birthdate, sex, marital_status, education, nationality, birthplace, mother_name, father_name, phone, email, address, ctps_number, ctps_series, ctps_uf, pis, voter_title, reservist_cert, cnh, cnh_category, bank_name, bank_agency, bank_account, bank_account_type, pix_key, job_title, cbo, department, admission_date, contract_type, experience_first_end, experience_second_end, contract_end, base_salary, weekly_hours, schedule, work_regime, night_work, hours_bank, hours_bank_started_at, vt_opted, vt_daily_cost, vr_opted, health_plan, union_name, cba_reference, photo, face_descriptor, biometric_consent_at, biometric_consent_version, status, termination_date, notes, registration_status, self_registered_at, lgpd_consent_accepted_at, lgpd_consent_version, created_at, updated_at, role_id';

// Versão enxuta para listas/tabelas — nunca carrega photo/face_descriptor.
export const EMPLOYEE_LIST_FIELDS = 'id, unit_id, name, cpf, job_title, department, admission_date, contract_type, status, weekly_hours, hours_bank, birthdate, base_salary';

export const mapEmployeeFromDb = (e) => ({
  id: e.id,
  unitId: e.unit_id,
  name: e.name || '',
  cpf: e.cpf || '',
  rg: e.rg || '',
  rgIssuer: e.rg_issuer || '',
  birthdate: e.birthdate || '',
  sex: e.sex || '',
  maritalStatus: e.marital_status || '',
  education: e.education || '',
  nationality: e.nationality || '',
  birthplace: e.birthplace || '',
  motherName: e.mother_name || '',
  fatherName: e.father_name || '',
  phone: e.phone || '',
  email: e.email || '',
  address: e.address || {},
  ctpsNumber: e.ctps_number || '',
  ctpsSeries: e.ctps_series || '',
  ctpsUf: e.ctps_uf || '',
  pis: e.pis || '',
  voterTitle: e.voter_title || '',
  reservistCert: e.reservist_cert || '',
  cnh: e.cnh || '',
  cnhCategory: e.cnh_category || '',
  bankName: e.bank_name || '',
  bankAgency: e.bank_agency || '',
  bankAccount: e.bank_account || '',
  bankAccountType: e.bank_account_type || '',
  pixKey: e.pix_key || '',
  jobTitle: e.job_title || '',
  cbo: e.cbo || '',
  department: e.department || '',
  admissionDate: e.admission_date || '',
  contractType: e.contract_type || 'indeterminado',
  experienceFirstEnd: e.experience_first_end || '',
  experienceSecondEnd: e.experience_second_end || '',
  contractEnd: e.contract_end || '',
  baseSalary: e.base_salary != null ? Number(e.base_salary) : null,
  weeklyHours: Number(e.weekly_hours) || 44,
  schedule: e.schedule || {},
  workRegime: e.work_regime || '',
  nightWork: !!e.night_work,
  hoursBank: !!e.hours_bank,
  hoursBankStartedAt: e.hours_bank_started_at || '',
  vtOpted: !!e.vt_opted,
  vtDailyCost: e.vt_daily_cost != null ? Number(e.vt_daily_cost) : null,
  vrOpted: !!e.vr_opted,
  healthPlan: !!e.health_plan,
  unionName: e.union_name || '',
  cbaReference: e.cba_reference || '',
  photo: e.photo || '',
  faceDescriptor: e.face_descriptor || '',
  biometricConsentAt: e.biometric_consent_at || null,
  biometricConsentVersion: e.biometric_consent_version || '',
  status: e.status || 'ativo',
  terminationDate: e.termination_date || '',
  notes: e.notes || '',
  registrationStatus: e.registration_status || 'validated',
  selfRegisteredAt: e.self_registered_at || null,
  lgpdConsentAcceptedAt: e.lgpd_consent_accepted_at || null,
  lgpdConsentVersion: e.lgpd_consent_version || '',
  createdAt: e.created_at,
  updatedAt: e.updated_at,
  roleId: e.role_id || '',
});

export const mapEmployeeToDb = (e) => ({
  unit_id: e.unitId,
  name: (e.name || '').trim(),
  cpf: e.cpf || null,
  rg: e.rg || null,
  rg_issuer: e.rgIssuer || null,
  birthdate: e.birthdate || null,
  sex: e.sex || null,
  marital_status: e.maritalStatus || null,
  education: e.education || null,
  nationality: e.nationality || null,
  birthplace: e.birthplace || null,
  mother_name: e.motherName || null,
  father_name: e.fatherName || null,
  phone: e.phone || null,
  email: e.email || null,
  address: e.address || {},
  ctps_number: e.ctpsNumber || null,
  ctps_series: e.ctpsSeries || null,
  ctps_uf: e.ctpsUf || null,
  pis: e.pis || null,
  voter_title: e.voterTitle || null,
  reservist_cert: e.reservistCert || null,
  cnh: e.cnh || null,
  cnh_category: e.cnhCategory || null,
  bank_name: e.bankName || null,
  bank_agency: e.bankAgency || null,
  bank_account: e.bankAccount || null,
  bank_account_type: e.bankAccountType || null,
  pix_key: e.pixKey || null,
  job_title: e.jobTitle || null,
  cbo: e.cbo || null,
  department: e.department || null,
  admission_date: e.admissionDate || null,
  contract_type: e.contractType || 'indeterminado',
  experience_first_end: e.experienceFirstEnd || null,
  experience_second_end: e.experienceSecondEnd || null,
  contract_end: e.contractEnd || null,
  base_salary: e.baseSalary != null && e.baseSalary !== '' ? Number(e.baseSalary) : null,
  weekly_hours: Number(e.weeklyHours) || 44,
  schedule: e.schedule || {},
  work_regime: e.workRegime || null,
  night_work: !!e.nightWork,
  hours_bank: !!e.hoursBank,
  hours_bank_started_at: e.hoursBankStartedAt || null,
  vt_opted: !!e.vtOpted,
  vt_daily_cost: e.vtDailyCost != null && e.vtDailyCost !== '' ? Number(e.vtDailyCost) : null,
  vr_opted: !!e.vrOpted,
  health_plan: !!e.healthPlan,
  union_name: e.unionName || null,
  cba_reference: e.cbaReference || null,
  photo: e.photo || null,
  face_descriptor: e.faceDescriptor || null,
  biometric_consent_at: e.biometricConsentAt || null,
  biometric_consent_version: e.biometricConsentVersion || null,
  status: e.status || 'ativo',
  termination_date: e.terminationDate || null,
  notes: e.notes || null,
  role_id: e.roleId || null,
});

export const mapDependentFromDb = (d) => ({
  id: d.id,
  employeeId: d.employee_id,
  name: d.name || '',
  cpf: d.cpf || '',
  birthdate: d.birthdate || '',
  relationship: d.relationship || '',
  forIr: !!d.for_ir,
  forSalarioFamilia: !!d.for_salario_familia,
});

export const mapDependentToDb = (d) => ({
  employee_id: d.employeeId,
  name: (d.name || '').trim(),
  cpf: d.cpf || null,
  birthdate: d.birthdate || null,
  relationship: d.relationship || null,
  for_ir: !!d.forIr,
  for_salario_familia: !!d.forSalarioFamilia,
});

// Sem `photo`: listas de ponto não devem carregar a imagem (só sob demanda).
export const EMPLOYEE_TIME_RECORD_SELECT_FIELDS = 'id, unit_id, nsr, employee_id, employee_name, employee_cpf, type, timestamp, work_date, geo, auth_method, biometric, record_hash, created_by, created_at';

export const mapTimeRecordFromDb = (r) => ({
  id: r.id,
  unitId: r.unit_id,
  nsr: r.nsr,
  employeeId: r.employee_id,
  employeeName: r.employee_name,
  employeeCpf: r.employee_cpf || '',
  type: r.type,
  timestamp: r.timestamp,
  workDate: r.work_date,
  geo: r.geo || {},
  authMethod: r.auth_method || 'facial',
  biometric: r.biometric || {},
  recordHash: r.record_hash || '',
  createdBy: r.created_by || null,
});

export const mapTimeAdjustmentFromDb = (a) => ({
  id: a.id,
  employeeId: a.employee_id,
  unitId: a.unit_id,
  workDate: a.work_date,
  type: a.type,
  timestamp: a.timestamp,
  voidsRecordId: a.voids_record_id || null,
  voidsAdjustmentId: a.voids_adjustment_id || null,
  reason: a.reason || '',
  evidenceDoc: a.evidence_doc || {},
  createdBy: a.created_by || null,
  createdAt: a.created_at,
});

export const mapTimeAdjustmentToDb = (a) => ({
  employee_id: a.employeeId,
  unit_id: a.unitId,
  work_date: a.workDate,
  type: a.type,
  timestamp: a.timestamp || null,
  voids_record_id: a.voidsRecordId || null,
  voids_adjustment_id: a.voidsAdjustmentId || null,
  reason: a.reason || '',
  evidence_doc: a.evidenceDoc || {},
});

export const mapVacationPeriodFromDb = (p) => ({
  id: p.id,
  employeeId: p.employee_id,
  acquisitionStart: p.acquisition_start,
  acquisitionEnd: p.acquisition_end,
  concessionEnd: p.concession_end,
  unjustifiedAbsences: p.unjustified_absences || 0,
  daysEntitled: p.days_entitled != null ? p.days_entitled : 30,
  suspendedReason: p.suspended_reason || '',
  status: p.status || 'em_aquisicao',
});

export const mapVacationPeriodToDb = (p) => ({
  employee_id: p.employeeId,
  acquisition_start: p.acquisitionStart,
  acquisition_end: p.acquisitionEnd,
  concession_end: p.concessionEnd,
  unjustified_absences: Number(p.unjustifiedAbsences) || 0,
  days_entitled: Number(p.daysEntitled) || 30,
  suspended_reason: p.suspendedReason || null,
  status: p.status || 'em_aquisicao',
});

export const mapVacationScheduleFromDb = (s) => ({
  id: s.id,
  periodId: s.period_id,
  employeeId: s.employee_id,
  startDate: s.start_date,
  endDate: s.end_date,
  days: s.days,
  abonoDays: s.abono_days || 0,
  noticeIssuedAt: s.notice_issued_at || '',
  paymentDue: s.payment_due || '',
  paymentDoneAt: s.payment_done_at || '',
  status: s.status || 'planejado',
  docNoticeKey: s.doc_notice_key || '',
  docReceiptKey: s.doc_receipt_key || '',
});

export const mapVacationScheduleToDb = (s) => ({
  period_id: s.periodId,
  employee_id: s.employeeId,
  start_date: s.startDate,
  end_date: s.endDate,
  days: Number(s.days) || 0,
  abono_days: Number(s.abonoDays) || 0,
  notice_issued_at: s.noticeIssuedAt || null,
  payment_due: s.paymentDue || null,
  payment_done_at: s.paymentDoneAt || null,
  status: s.status || 'planejado',
  doc_notice_key: s.docNoticeKey || null,
  doc_receipt_key: s.docReceiptKey || null,
});

export const mapMedicalExamFromDb = (x) => ({
  id: x.id,
  employeeId: x.employee_id,
  examType: x.exam_type,
  examDate: x.exam_date,
  validUntil: x.valid_until || '',
  result: x.result || '',
  riskGrade: x.risk_grade != null ? x.risk_grade : null,
  doctorName: x.doctor_name || '',
  doctorCrm: x.doctor_crm || '',
  restrictions: x.restrictions || '',
  docKey: x.doc_key || '',
});

export const mapMedicalExamToDb = (x) => ({
  employee_id: x.employeeId,
  exam_type: x.examType,
  exam_date: x.examDate,
  valid_until: x.validUntil || null,
  result: x.result || null,
  risk_grade: x.riskGrade != null && x.riskGrade !== '' ? Number(x.riskGrade) : null,
  doctor_name: x.doctorName || null,
  doctor_crm: x.doctorCrm || null,
  restrictions: x.restrictions || null,
  doc_key: x.docKey || null,
});

export const mapOccurrenceFromDb = (o) => ({
  id: o.id,
  employeeId: o.employee_id,
  unitId: o.unit_id,
  type: o.type,
  startDate: o.start_date,
  endDate: o.end_date || '',
  days: o.days || 1,
  justified: !!o.justified,
  legalBasis: o.legal_basis || '',
  description: o.description || '',
  affectsDsr: !!o.affects_dsr,
  affectsVacation: !!o.affects_vacation,
  inssReferral: !!o.inss_referral,
  catNumber: o.cat_number || '',
  docKey: o.doc_key || '',
});

export const mapOccurrenceToDb = (o) => ({
  employee_id: o.employeeId,
  unit_id: o.unitId,
  type: o.type,
  start_date: o.startDate,
  end_date: o.endDate || null,
  days: Number(o.days) || 1,
  justified: !!o.justified,
  legal_basis: o.legalBasis || null,
  description: o.description || null,
  affects_dsr: !!o.affectsDsr,
  affects_vacation: !!o.affectsVacation,
  inss_referral: !!o.inssReferral,
  cat_number: o.catNumber || null,
  doc_key: o.docKey || null,
});

export const mapTerminationFromDb = (t) => ({
  employeeId: t.employee_id,
  type: t.type,
  noticeType: t.notice_type || '',
  noticeReduction: t.notice_reduction || '',
  noticeStart: t.notice_start || '',
  noticeDays: t.notice_days != null ? t.notice_days : null,
  projectedEnd: t.projected_end || '',
  terminationDate: t.termination_date || '',
  demissionalExamId: t.demissional_exam_id || null,
  paymentDeadline: t.payment_deadline || '',
  checklist: t.checklist || {},
  notes: t.notes || '',
});

export const mapTerminationToDb = (t) => ({
  employee_id: t.employeeId,
  type: t.type,
  notice_type: t.noticeType || null,
  notice_reduction: t.noticeReduction || null,
  notice_start: t.noticeStart || null,
  notice_days: t.noticeDays != null && t.noticeDays !== '' ? Number(t.noticeDays) : null,
  projected_end: t.projectedEnd || null,
  termination_date: t.terminationDate || null,
  demissional_exam_id: t.demissionalExamId || null,
  payment_deadline: t.paymentDeadline || null,
  checklist: t.checklist || {},
  notes: t.notes || null,
});

export const mapHolidayFromDb = (h) => ({
  id: h.id,
  date: h.date,
  name: h.name,
  scope: h.scope || 'nacional',
  workspaceId: h.workspace_id || null,
  unitId: h.unit_id || null,
  recurring: !!h.recurring,
});

export const mapHolidayToDb = (h) => ({
  date: h.date,
  name: (h.name || '').trim(),
  scope: h.scope || 'nacional',
  workspace_id: h.workspaceId || null,
  unit_id: h.unitId || null,
  recurring: !!h.recurring,
});

// Traduz os códigos de erro lançados pelas RPCs do módulo CLT.
export const employeeRpcErrorMessage = (err) => {
  const msg = String(err?.message || err || '');
  if (msg.includes('employee_inactive')) return 'Cadastro inativo ou desligado. Procure o RH.';
  if (msg.includes('unit_clt_disabled')) return 'O ponto eletrônico CLT não está habilitado nesta unidade.';
  if (msg.includes('consent_required')) return 'Termo de consentimento biométrico pendente. Procure o RH para regularizar.';
  if (msg.includes('sequence_invalid')) return 'Marcação fora de sequência (verifique se já bateu entrada/intervalo/saída hoje).';
  if (msg.includes('duplicate_record')) return 'Esta marcação já foi registrada há poucos segundos.';
  if (msg.includes('time_record_immutable')) return 'Registros de ponto não podem ser alterados ou excluídos. Lance um ajuste com justificativa.';
  if (msg.includes('employee_pending_validation')) return 'Este cadastro ainda não foi validado pelo RH.';
  if (msg.includes('self_registration_disabled')) return 'O autocadastro não está habilitado para esta unidade.';
  if (msg.includes('duplicate_cpf')) return 'Já existe um funcionário cadastrado com este CPF nesta unidade.';
  if (msg.includes('missing_required_fields')) return 'Preencha todos os campos obrigatórios do cadastro.';
  if (msg.includes('biometric_required')) return 'É necessário concluir a captura da biometria facial e aceitar o termo de consentimento.';
  if (msg.includes('lgpd_consent_required')) return 'É necessário aceitar o consentimento de tratamento de dados (LGPD).';
  if (msg.includes('invalid_doc_key')) return 'Tipo de documento inválido.';
  if (msg.includes('invalid_file_size')) return 'Arquivo inválido ou excede o limite de 2MB.';
  if (msg.includes('invalid_file_type')) return 'Tipo de arquivo não permitido. Envie imagem (JPG, PNG, WebP) ou PDF.';
  if (msg.includes('invalid_token') || msg.includes('token_expired')) return 'Sessão de envio de documentos expirada. Reinicie o cadastro.';
  if (msg.includes('upload_limit_reached')) return 'Limite de anexos deste cadastro atingido.';
  if (msg.includes('not authorized')) return 'Acesso não autorizado para esta operação.';
  if (msg.includes('invalid_type')) return 'Tipo de marcação inválido.';
  return msg || 'Erro inesperado.';
};

// =========================================================================
// Módulo Freelance (trabalhos pontuais) — ver supabase/migrations/
// 20260927100000_freelance_module.sql e src/config/freelanceConstants.js.
// =========================================================================

export const FREELANCER_SELECT_FIELDS = 'id, unit_id, name, cpf, nit, birthdate, email, phone, endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, service_area, bank_name, bank_agency, bank_account, bank_account_type, pix_key, source_candidate_id, autonomy_declaration_accepted_at, autonomy_declaration_version, lgpd_consent_accepted_at, notes, photo, active, created_at';

export const mapFreelancerFromDb = (f) => ({
  id: f.id,
  unitId: f.unit_id,
  name: f.name,
  cpf: f.cpf || '',
  nit: f.nit || '',
  birthdate: f.birthdate || '',
  email: f.email || '',
  phone: f.phone || '',
  enderecoCep: f.endereco_cep || '',
  enderecoLogradouro: f.endereco_logradouro || '',
  enderecoNumero: f.endereco_numero || '',
  enderecoComplemento: f.endereco_complemento || '',
  enderecoBairro: f.endereco_bairro || '',
  enderecoCidade: f.endereco_cidade || '',
  enderecoUf: f.endereco_uf || '',
  serviceArea: f.service_area || '',
  bankName: f.bank_name || '',
  bankAgency: f.bank_agency || '',
  bankAccount: f.bank_account || '',
  bankAccountType: f.bank_account_type || '',
  pixKey: f.pix_key || '',
  sourceCandidateId: f.source_candidate_id || '',
  autonomyDeclarationAcceptedAt: f.autonomy_declaration_accepted_at || null,
  autonomyDeclarationVersion: f.autonomy_declaration_version || '',
  lgpdConsentAcceptedAt: f.lgpd_consent_accepted_at || null,
  notes: f.notes || '',
  photo: f.photo || '',
  active: f.active !== false,
  createdAt: f.created_at,
});

export const mapFreelancerToDb = (f) => ({
  unit_id: f.unitId,
  name: (f.name || '').trim(),
  cpf: f.cpf || null,
  nit: f.nit || null,
  birthdate: f.birthdate || null,
  email: f.email || null,
  phone: f.phone || null,
  endereco_cep: f.enderecoCep || null,
  endereco_logradouro: f.enderecoLogradouro || null,
  endereco_numero: f.enderecoNumero || null,
  endereco_complemento: f.enderecoComplemento || null,
  endereco_bairro: f.enderecoBairro || null,
  endereco_cidade: f.enderecoCidade || null,
  endereco_uf: f.enderecoUf || null,
  service_area: f.serviceArea || null,
  bank_name: f.bankName || null,
  bank_agency: f.bankAgency || null,
  bank_account: f.bankAccount || null,
  bank_account_type: f.bankAccountType || null,
  pix_key: f.pixKey || null,
  source_candidate_id: f.sourceCandidateId || null,
  autonomy_declaration_accepted_at: f.autonomyDeclarationAcceptedAt || null,
  autonomy_declaration_version: f.autonomyDeclarationVersion || null,
  lgpd_consent_accepted_at: f.lgpdConsentAcceptedAt || null,
  notes: f.notes || null,
  photo: f.photo || null,
  active: f.active !== false,
});

export const FREELANCE_JOB_SELECT_FIELDS = 'id, freelancer_id, unit_id, title, service_type, scope, deliverable, gross_amount, iss_rate, iss_withheld, status, scheduled_date, executed_date, proposed_at, accepted_at, delivered_at, payment_accepted_at, paid_at, payment_day, rpa_number, cancellation_reason, risk_level, risk_override_reason, notes, created_at, updated_at';

export const mapFreelanceJobFromDb = (j) => ({
  id: j.id,
  freelancerId: j.freelancer_id,
  unitId: j.unit_id,
  title: j.title,
  serviceType: j.service_type || '',
  scope: j.scope || '',
  deliverable: j.deliverable || '',
  grossAmount: j.gross_amount ?? '',
  issRate: j.iss_rate ?? 0.05,
  issWithheld: !!j.iss_withheld,
  status: j.status || 'rascunho',
  scheduledDate: j.scheduled_date || '',
  executedDate: j.executed_date || '',
  proposedAt: j.proposed_at || null,
  acceptedAt: j.accepted_at || null,
  deliveredAt: j.delivered_at || null,
  paymentAcceptedAt: j.payment_accepted_at || null,
  paidAt: j.paid_at || null,
  paymentDay: j.payment_day ?? '',
  rpaNumber: j.rpa_number || '',
  cancellationReason: j.cancellation_reason || '',
  riskLevel: j.risk_level || '',
  riskOverrideReason: j.risk_override_reason || '',
  notes: j.notes || '',
  createdAt: j.created_at,
  updatedAt: j.updated_at,
});

export const mapFreelanceJobToDb = (j) => ({
  freelancer_id: j.freelancerId,
  unit_id: j.unitId,
  title: (j.title || '').trim(),
  service_type: j.serviceType || null,
  scope: (j.scope || '').trim(),
  deliverable: j.deliverable || null,
  gross_amount: j.grossAmount === '' || j.grossAmount == null ? null : Number(j.grossAmount),
  iss_rate: j.issRate === '' || j.issRate == null ? 0.05 : Number(j.issRate),
  iss_withheld: !!j.issWithheld,
  status: j.status || 'rascunho',
  scheduled_date: j.scheduledDate || null,
  executed_date: j.executedDate || null,
  proposed_at: j.proposedAt || null,
  accepted_at: j.acceptedAt || null,
  delivered_at: j.deliveredAt || null,
  payment_accepted_at: j.paymentAcceptedAt || null,
  paid_at: j.paidAt || null,
  payment_day: j.paymentDay === '' || j.paymentDay == null ? null : Number(j.paymentDay),
  rpa_number: j.rpaNumber || null,
  cancellation_reason: j.cancellationReason || null,
  risk_level: j.riskLevel || null,
  risk_override_reason: j.riskOverrideReason || null,
  notes: j.notes || null,
});

// Traduz os códigos de erro que o banco pode lançar nas escritas do módulo
// Freelance (constraints de CHECK — ver a migração do módulo).
export const freelanceRpcErrorMessage = (err) => {
  const msg = String(err?.message || err || '');
  if (msg.includes('freelance_jobs_gross_amount_check')) return 'O preço fechado do trabalho deve ser maior que zero.';
  if (msg.includes('freelance_jobs_status_check')) return 'Status de Ordem de Serviço inválido.';
  if (msg.includes('not authorized') || msg.includes('permission denied')) return 'Acesso não autorizado para esta operação.';
  return msg || 'Erro inesperado.';
};
