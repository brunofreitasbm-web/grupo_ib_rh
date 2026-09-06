// Inclui photo e face_descriptor: necessários para a comparação biométrica no
// quiosque (login de unidade compartilhado), que lê intern.faceDescriptor/intern.photo
// a partir desta mesma lista de estagiários.
export const INTERN_SELECT_FIELDS = 'id, name, course, institution, shift, daily_hours, unit_id, active, start_date, end_date, last_report_date, recess_days_taken, username, is_first_login, cpf, email, rg, phone, address, bank_name, bank_agency, bank_account, pix_key, emergency_name, emergency_relationship, emergency_phone, allowance, supervisor_name, registration_status, birthdate, photo, face_descriptor';

export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

export const compressImage = (file, maxWidth = 300, maxHeight = 400, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (error) => reject(error);
  });
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
  faceDescriptor: i.face_descriptor || '',
});

export const mapInternToDb = (i) => ({
  name: i.name,
  course: i.course,
  institution: i.institution,
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
  registration_status: i.registrationStatus || 'validated',
  semestral_reports: i.semestralReports || {},
  contract_termination: i.contractTermination || {},
  birthdate: i.birthdate || null,
  face_descriptor: i.faceDescriptor || null,
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
  return {
    id: u.id,
    name: u.name || '',
    address: u.address || '',
    lat: safeNum(u.lat, 0),
    lng: safeNum(u.lng, 0),
    radiusKm: safeNum(u.radius_km, 5),
    radiusM: safeNum(u.radius_m, 5000),
    workspaceId: u.workspace_id || null,
    kioskEmail: u.kiosk_email || '',
    biometricRequired: u.biometric_required || false,
    pjEnabled: u.pj_enabled || false,
    pjKioskEmail: u.pj_kiosk_email || '',
    razaoSocial: u.razao_social || '',
    cnpj: u.cnpj || '',
    phone: u.phone || '',
    logoUrl: u.logo_url || '',
    tceCustomText: u.tce_custom_text || '',
    paeCustomText: u.pae_custom_text || '',
    declaracaoCustomText: u.declaracao_custom_text || '',
    fichaCustomText: u.ficha_custom_text || '',
  };
};

export const mapUnitToDb = (u) => {
  if (!u) return {};
  return {
    id: u.id,
    name: u.name || u.nome || '',
    address: u.address || u.endereco || '',
    lat: safeNum(u.lat ?? u.latitude, 0),
    lng: safeNum(u.lng ?? u.longitude, 0),
    radius_km: safeNum(u.radiusKm ?? u.radius_km, 5),
    radius_m: safeNum(u.radiusM ?? u.radius_m, 5000),
    workspace_id: u.workspaceId || u.workspace_id || null,
    kiosk_email: u.kioskEmail || u.kiosk_email || null,
    biometric_required: u.biometricRequired !== undefined ? Boolean(u.biometricRequired) : (u.biometric_required !== undefined ? Boolean(u.biometric_required) : false),
    pj_enabled: u.pjEnabled !== undefined ? Boolean(u.pjEnabled) : (u.pj_enabled !== undefined ? Boolean(u.pj_enabled) : false),
    pj_kiosk_email: u.pjKioskEmail || u.pj_kiosk_email || null,
    razao_social: u.razaoSocial || u.razao_social || null,
    cnpj: u.cnpj || null,
    phone: u.phone || null,
    logo_url: u.logoUrl || u.logo_url || null,
    tce_custom_text: u.tceCustomText || u.tce_custom_text || null,
    pae_custom_text: u.paeCustomText || u.pae_custom_text || null,
    declaracao_custom_text: u.declaracaoCustomText || u.declaracao_custom_text || null,
    ficha_custom_text: u.fichaCustomText || u.ficha_custom_text || null,
  };
};

// =========================================================================
// MÓDULO PROFISSIONAIS PJ (prestadores de serviço) — tabelas professionals,
// professional_presence e professional_documents. Mantidas separadas dos
// mapeadores de estagiário de propósito: nada aqui deve alimentar as telas de
// ponto/bolsa de estagiários nem vice-versa.
// =========================================================================
export const PROFESSIONAL_SELECT_FIELDS = 'id, unit_id, name, profession, council_type, council_number, cpf, cnpj, razao_social, email, phone, contract_start, contract_end, contract_notes, active, terms_accepted_at, terms_version, photo, created_at';

export const mapProfessionalFromDb = (p) => ({
  id: p.id,
  unitId: p.unit_id,
  name: p.name,
  profession: p.profession || '',
  councilType: p.council_type || '',
  councilNumber: p.council_number || '',
  cpf: p.cpf || '',
  cnpj: p.cnpj || '',
  razaoSocial: p.razao_social || '',
  email: p.email || '',
  phone: p.phone || '',
  contractStart: p.contract_start || '',
  contractEnd: p.contract_end || '',
  contractNotes: p.contract_notes || '',
  active: p.active !== false,
  termsAcceptedAt: p.terms_accepted_at || null,
  termsVersion: p.terms_version || '',
  photo: p.photo || '',
  createdAt: p.created_at,
});

export const mapProfessionalToDb = (p) => ({
  unit_id: p.unitId,
  name: (p.name || '').trim(),
  profession: p.profession || null,
  council_type: p.councilType || null,
  council_number: p.councilNumber || null,
  cpf: p.cpf || null,
  cnpj: p.cnpj || null,
  razao_social: p.razaoSocial || null,
  email: p.email || null,
  phone: p.phone || null,
  contract_start: p.contractStart || null,
  contract_end: p.contractEnd || null,
  contract_notes: p.contractNotes || null,
  active: p.active !== false,
  photo: p.photo || null,
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
  if (msg.includes('pin_invalid')) return 'PIN incorreto.';
  if (msg.includes('terms_not_accepted')) return 'É necessário aceitar o termo de ciência antes do primeiro registro.';
  if (msg.includes('sequence_open_entry')) return 'Já existe uma entrada em aberto hoje. Registre a saída primeiro.';
  if (msg.includes('sequence_no_entry')) return 'Não há entrada registrada hoje. Registre a entrada antes da saída.';
  if (msg.includes('professional_inactive')) return 'Cadastro inativo. Procure a administração.';
  if (msg.includes('unit_pj_disabled')) return 'O registro de prestadores não está habilitado nesta unidade.';
  if (msg.includes('not authorized')) return 'Acesso não autorizado para esta operação.';
  return msg || 'Erro inesperado.';
};
