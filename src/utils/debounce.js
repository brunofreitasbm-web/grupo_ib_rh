// Debounce trailing com cancelamento. Usado nos handlers de Realtime
// (postgres_changes) para que uma rajada de eventos dispare um único refetch.
export const REALTIME_DEBOUNCE_MS = 3000;

export const createDebounced = (fn, delay = REALTIME_DEBOUNCE_MS) => {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
};

// Eventos gerados pelo próprio motor de auditoria de ponto (App.jsx) em `records`
// não devem disparar refetch (evita loop de realimentação).
const isAuditRow = (row) =>
  !!row &&
  row.action === 'ocorrencia' &&
  String(row.justification || '').startsWith('[AUDITORIA SISTÊMICA]');

export const isAuditRecordEvent = (payload) =>
  isAuditRow(payload?.new) || (payload?.eventType === 'DELETE' && isAuditRow(payload?.old));
