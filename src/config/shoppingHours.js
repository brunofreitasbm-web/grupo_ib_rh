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

// Turnos de 6h dentro do funcionamento. No domingo (12h–22h) os dois turnos
// se sobrepõem 2h (12–18 e 16–22) para cobrir a abertura e o fechamento.
const SHIFT_WINDOWS = {
  week: { 'Manhã': { start: 10, end: 16 }, 'Tarde': { start: 16, end: 22 } },
  sunday: { 'Manhã': { start: 12, end: 18 }, 'Tarde': { start: 16, end: 22 } },
};
export const SHIFTS = ['Manhã', 'Tarde'];

export function shiftWindows(unitId, weekday) {
  if (!isShoppingUnit(unitId)) return null;
  return weekday === 0 ? SHIFT_WINDOWS.sunday : SHIFT_WINDOWS.week;
}

// Turno do estagiário: campo `shift` do cadastro (padrão Manhã).
export function internShift(intern) {
  return intern?.shift === 'Tarde' ? 'Tarde' : 'Manhã';
}
