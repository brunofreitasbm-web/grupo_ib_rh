import { describe, it, expect } from 'vitest';
import {
  monthDates, weekStartOf, generateMonthSchedule, validateSchedule, pickVariableDays,
} from '../escala.js';
import { autoAbsenceDates, weekdayOf } from '../cltCalculations.js';

const intern = (over = {}) => ({ id: 'a', dailyHours: 6, ...over });
const weekdaysOf = (map) => Object.keys(map).map(weekdayOf);

describe('escala', () => {
  it('semana começa na segunda', () => {
    expect(weekStartOf('2026-11-08')).toBe('2026-11-02'); // domingo
    expect(weekStartOf('2026-11-02')).toBe('2026-11-02');
  });

  it('nunca passa de 6h/dia nem 30h/semana', () => {
    const r = generateMonthSchedule({ monthKey: '2026-11', interns: [intern({ dailyHours: 8 })] });
    expect(validateSchedule(r.a)).toEqual([]);
    expect(Math.max(...Object.values(r.a))).toBeLessThanOrEqual(6);
  });

  it('semana completa tem 5 dias de 6h com sexta e sábado', () => {
    const r = generateMonthSchedule({ monthKey: '2026-11', interns: [intern()] });
    // semana de 02 a 08/11 inteira dentro do mês
    const week = Object.keys(r.a).filter((d) => d >= '2026-11-02' && d <= '2026-11-08');
    expect(week).toHaveLength(5);
    expect(week).toContain('2026-11-06');
    expect(week).toContain('2026-11-07');
  });

  it('preserva dias fixos e desconta da cota semanal', () => {
    const fixed = { a: { '2026-11-03': 6 } };
    const r = generateMonthSchedule({ monthKey: '2026-11', interns: [intern()], fixed });
    expect(r.a['2026-11-03']).toBe(6);
    const week = Object.keys(r.a).filter((d) => d >= '2026-11-02' && d <= '2026-11-08');
    expect(week).toHaveLength(5);
  });

  it('respeita início e fim do vínculo', () => {
    const r = generateMonthSchedule({
      monthKey: '2026-11',
      interns: [intern({ startDate: '2026-11-10', endDate: '2026-11-20' })],
    });
    const days = Object.keys(r.a);
    expect(days.every((d) => d >= '2026-11-10' && d <= '2026-11-20')).toBe(true);
    expect(days.length).toBeGreaterThan(0);
  });

  it('alterna o padrão entre semanas', () => {
    const c = [0, 1, 2, 3, 4];
    expect(pickVariableDays({ weekIndex: 0, candidates: c, count: 3 })).toEqual([1, 3, 0]);
    expect(pickVariableDays({ weekIndex: 1, candidates: c, count: 3 })).toEqual([2, 4, 0]);
  });

  it('cobre o mês inteiro sem datas fora do mês', () => {
    const r = generateMonthSchedule({ monthKey: '2026-11', interns: [intern()] });
    const all = new Set(monthDates('2026-11'));
    expect(Object.keys(r.a).every((d) => all.has(d))).toBe(true);
    expect(weekdaysOf(r.a).length).toBeGreaterThan(15);
  });
});

describe('autoAbsenceDates com escala', () => {
  const base = { monthKey: '2026-11', today: '2026-11-10' };
  it('sem escala conta todo dia sem batida', () => {
    expect(autoAbsenceDates(base)).toHaveLength(9);
  });
  it('com escala conta só dia escalado', () => {
    const r = autoAbsenceDates({ ...base, scheduledDates: ['2026-11-02', '2026-11-04'], presenceDates: ['2026-11-02'] });
    expect(r).toEqual(['2026-11-04']);
  });
});
