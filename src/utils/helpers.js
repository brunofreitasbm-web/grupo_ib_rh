// Início da semana (segunda-feira 00:00) — usado no acumulado semanal
export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 domingo ... 6 sábado
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

export const formatDistance = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`);

export const validateCPF = (cpf) => {
  const clean = cpf.replace(/[^\d]/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return false;
  
  return true;
};

export const formatDate = (isoString) =>
  new Date(isoString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatTime = (isoString) =>
  new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const getInternRhMetrics = (intern) => {
  const start = new Date(intern.startDate || intern.timestamp || new Date());
  const end = new Date(intern.endDate || new Date());
  const lastReport = intern.lastReportDate ? new Date(intern.lastReportDate) : null;
  const now = new Date();

  const diffMonthsTotal = (end - start) / (1000 * 60 * 60 * 24 * 30.4375);
  const monthsWorked = Math.max(0, (now - start) / (1000 * 60 * 60 * 24 * 30.4375));
  
  const isExceededLegalLimit = diffMonthsTotal > 24;
  const timeRemainingDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

  const recessAccrued = monthsWorked * 2.5;
  const recessTaken = Number(intern.recessDaysTaken) || 0;
  const recessBalance = Math.max(0, recessAccrued - recessTaken);

  let reportOverdue = false;
  let reportAgeMonths = 0;
  if (lastReport) {
    reportAgeMonths = (now - lastReport) / (1000 * 60 * 60 * 24 * 30.4375);
    if (reportAgeMonths > 6) {
      reportOverdue = true;
    }
  } else {
    if (monthsWorked > 6) {
      reportOverdue = true;
    }
  }

  // Count admissional docs (excluding any occurrences docs in document map)
  const docKeys = Object.keys(intern.documents || {}).filter(k => !k.startsWith('ocorrencia_'));
  const uploadedDocsCount = docKeys.length;
  const isAdmissionalComplete = uploadedDocsCount === 6; // 6 required documents

  return {
    start,
    end,
    monthsWorked,
    diffMonthsTotal,
    isExceededLegalLimit,
    timeRemainingDays,
    recessAccrued,
    recessTaken,
    recessBalance,
    reportOverdue,
    reportAgeMonths,
    uploadedDocsCount,
    isAdmissionalComplete,
  };
};

