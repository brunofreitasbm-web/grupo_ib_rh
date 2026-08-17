import { describe, it, expect } from 'vitest';
import { validateCPF, startOfWeek, formatDistance } from '../helpers';

describe('validateCPF', () => {
  it('aceita um CPF válido (com formatação)', () => {
    expect(validateCPF('529.982.247-25')).toBe(true);
  });

  it('aceita um CPF válido (somente dígitos)', () => {
    expect(validateCPF('52998224725')).toBe(true);
  });

  it('rejeita CPF com dígito verificador incorreto', () => {
    expect(validateCPF('52998224700')).toBe(false);
  });

  it('rejeita CPF com todos os dígitos iguais', () => {
    expect(validateCPF('11111111111')).toBe(false);
  });

  it('rejeita CPF com quantidade de dígitos incorreta', () => {
    expect(validateCPF('123456')).toBe(false);
  });
});

describe('startOfWeek', () => {
  it('retorna a própria segunda-feira à meia-noite quando a data já é segunda', () => {
    const monday = new Date(2024, 5, 10, 15, 30); // segunda-feira 10/06/2024
    const result = startOfWeek(monday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(10);
    expect(result.getHours()).toBe(0);
  });

  it('retorna a segunda-feira anterior para uma quarta-feira', () => {
    const wednesday = new Date(2024, 5, 12, 10, 0);
    const result = startOfWeek(wednesday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(10);
  });

  it('retorna a segunda-feira anterior para um domingo', () => {
    const sunday = new Date(2024, 5, 16, 10, 0); // domingo 16/06/2024
    const result = startOfWeek(sunday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(10);
  });
});

describe('formatDistance', () => {
  it('formata distâncias menores que 1km em metros', () => {
    expect(formatDistance(0.35)).toBe('350 m');
  });

  it('formata distâncias maiores ou iguais a 1km em km', () => {
    expect(formatDistance(2.5)).toBe('2.50 km');
  });

  it('retorna travessão para valores inválidos', () => {
    expect(formatDistance(null)).toBe('—');
    expect(formatDistance(NaN)).toBe('—');
  });
});
