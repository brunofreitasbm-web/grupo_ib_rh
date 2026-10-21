import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebounced, isAuditRecordEvent } from '../debounce';

describe('createDebounced', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('agrupa rajadas em uma única chamada trailing', () => {
    const fn = vi.fn();
    const d = createDebounced(fn, 3000);
    d(1); d(2); d(3);
    vi.advanceTimersByTime(2999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it('cancel impede a execução pendente', () => {
    const fn = vi.fn();
    const d = createDebounced(fn, 3000);
    d();
    d.cancel();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('isAuditRecordEvent', () => {
  const row = { action: 'ocorrencia', justification: '[AUDITORIA SISTÊMICA] x' };
  it('detecta INSERT/UPDATE de auditoria', () => {
    expect(isAuditRecordEvent({ eventType: 'INSERT', new: row })).toBe(true);
  });
  it('detecta DELETE de auditoria quando old está disponível', () => {
    expect(isAuditRecordEvent({ eventType: 'DELETE', old: row })).toBe(true);
  });
  it('não ignora outros registros', () => {
    expect(isAuditRecordEvent({ eventType: 'INSERT', new: { action: 'entrada' } })).toBe(false);
    expect(isAuditRecordEvent({ eventType: 'INSERT', new: { action: 'ocorrencia', justification: 'manual' } })).toBe(false);
    expect(isAuditRecordEvent({})).toBe(false);
  });
});
