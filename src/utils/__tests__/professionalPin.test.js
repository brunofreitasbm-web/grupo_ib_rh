import { describe, it, expect } from 'vitest';
import { isValidProfessionalPin } from '../mappings';

// Espelha a regra da função SQL is_valid_professional_pin (supabase_schema.sql,
// seção 16.5) — a autoridade final é o banco, isto é só a validação antecipada
// no front para dar feedback imediato ao usuário.
describe('isValidProfessionalPin', () => {
  it('aceita um PIN de 6 dígitos não trivial', () => {
    expect(isValidProfessionalPin('482913')).toBe(true);
  });

  it('rejeita tamanhos diferentes de 6', () => {
    expect(isValidProfessionalPin('1234')).toBe(false);
    expect(isValidProfessionalPin('12345678')).toBe(false);
  });

  it('rejeita não numéricos', () => {
    expect(isValidProfessionalPin('12a456')).toBe(false);
  });

  it('rejeita todos os dígitos iguais', () => {
    expect(isValidProfessionalPin('000000')).toBe(false);
    expect(isValidProfessionalPin('999999')).toBe(false);
  });

  it('rejeita sequências óbvias conhecidas', () => {
    ['123456', '654321', '012345', '543210', '112233', '123123', '111222', '222333'].forEach((p) => {
      expect(isValidProfessionalPin(p)).toBe(false);
    });
  });

  it('rejeita valores vazios ou não string', () => {
    expect(isValidProfessionalPin('')).toBe(false);
    expect(isValidProfessionalPin(undefined)).toBe(false);
    expect(isValidProfessionalPin(null)).toBe(false);
  });
});
