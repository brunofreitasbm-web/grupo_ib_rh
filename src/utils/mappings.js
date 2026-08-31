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

export const mapUnitFromDb = (u) => ({
  id: u.id,
  name: u.name,
  address: u.address,
  lat: Number(u.lat),
  lng: Number(u.lng),
  radiusKm: Number(u.radius_km),
  radiusM: Number(u.radius_m),
  workspaceId: u.workspace_id,
  kioskEmail: u.kiosk_email,
  biometricRequired: u.biometric_required,
});

export const mapUnitToDb = (u) => ({
  id: u.id,
  name: u.name,
  address: u.address,
  lat: Number(u.lat),
  lng: Number(u.lng),
  radius_km: Number(u.radiusKm),
  radius_m: Number(u.radiusM),
  workspace_id: u.workspaceId,
  kiosk_email: u.kioskEmail,
  biometric_required: u.biometricRequired,
});
