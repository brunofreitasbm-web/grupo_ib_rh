import { describe, it, expect } from 'vitest';
import { haversineKm } from '../useGeolocation';

describe('haversineKm', () => {
  it('retorna 0 para o mesmo ponto', () => {
    expect(haversineKm(-1.44, -48.47, -1.44, -48.47)).toBe(0);
  });

  it('calcula ~111.19km para 1 grau de longitude no equador', () => {
    expect(haversineKm(0, 0, 0, 1)).toBeCloseTo(111.1949, 3);
  });

  it('calcula a distância entre as duas unidades da Porto Terapia', () => {
    // Antônio Barreto -> Generalíssimo (Belém - PA)
    const km = haversineKm(
      -1.442473861453128, -48.469996243820276,
      -1.4456511159378498, -48.48304674431182
    );
    expect(km).toBeCloseTo(1.4931, 3);
  });
});
