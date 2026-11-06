// Horário de funcionamento dos shoppings: seg a sáb 10h–22h, domingo 12h–22h.
// Unidades que não são shopping (ex.: clínica) não têm horário aqui.
export const SHOPPING_UNIT_IDS = ['faca-amigos-parque-shopping', 'faca-amigos-grao-para'];

const WEEK = { open: 10, close: 22 };
const SUNDAY = { open: 12, close: 22 };

export function isShoppingUnit(unitId) {
  return SHOPPING_UNIT_IDS.includes(unitId);
}

// weekday: Date#getDay (0=domingo). Retorna null fora de shopping.
export function openingHours(unitId, weekday) {
  if (!isShoppingUnit(unitId)) return null;
  return weekday === 0 ? SUNDAY : WEEK;
}

export function formatOpeningHours(hours) {
  return hours ? `${hours.open}h–${hours.close}h` : '';
}

// Dois turnos de alocação, iguais todos os dias: Manhã 12h–18h e Tarde 18h–22h.
// Cada turno é alocado separadamente na escala.
const SHIFT_WINDOWS = {
  'Manhã': { start: 12, end: 18 },
  'Tarde': { start: 18, end: 22 },
};
export const SHIFTS = ['Manhã', 'Tarde'];

// Horas de um turno (Manhã 6h, Tarde 4h).
export function shiftDuration(shift) {
  const w = SHIFT_WINDOWS[shift];
  return w ? w.end - w.start : 0;
}

export function shiftWindows(unitId) {
  if (!isShoppingUnit(unitId)) return null;
  return SHIFT_WINDOWS;
}

// Turno do estagiário: campo `shift` do cadastro (padrão Manhã).
export function internShift(intern) {
  return intern?.shift === 'Tarde' ? 'Tarde' : 'Manhã';
}
