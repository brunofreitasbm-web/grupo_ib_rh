import { describe, it, expect } from 'vitest';
import {
  candidateProfileVector,
  computeRoleFit,
  bestRoleFor,
  fitLevel,
  CAUTION_CAP,
  PREFERRED_BONUS,
} from '../roleFit';
import { ROLE_PROFILES, ROLE_BY_ID } from '../../config/roleProfiles';
import { DISC_FACTORS } from '../disc';

const assessmentFrom = (vector, primary, secondary = null) => ({
  scores: { natural: { ...vector }, adaptado: { ...vector } },
  primary_profile: primary,
  secondary_profile: secondary,
});

describe('ROLE_PROFILES', () => {
  it('tem ideal somando 100 e características ligadas a fatores DISC válidos', () => {
    for (const role of ROLE_PROFILES) {
      const sum = DISC_FACTORS.reduce((acc, f) => acc + role.ideal[f], 0);
      expect(sum).toBe(100);
      for (const trait of role.traits) {
        expect(trait.factors.length).toBeGreaterThan(0);
        for (const f of trait.factors) expect(DISC_FACTORS).toContain(f);
      }
    }
  });
});

describe('candidateProfileVector', () => {
  it('faz a média entre natural e adaptado', () => {
    const v = candidateProfileVector({
      natural: { D: 10, I: 20, S: 30, C: 40 },
      adaptado: { D: 30, I: 20, S: 10, C: 40 },
    });
    expect(v).toEqual({ D: 20, I: 20, S: 20, C: 40 });
  });

  it('usa só o lado disponível quando falta o outro', () => {
    const v = candidateProfileVector({ natural: { D: 25, I: 25, S: 25, C: 25 } });
    expect(v).toEqual({ D: 25, I: 25, S: 25, C: 25 });
  });
});

describe('fitLevel', () => {
  it('classifica nos limiares', () => {
    expect(fitLevel(75)).toBe('alta');
    expect(fitLevel(74)).toBe('media');
    expect(fitLevel(50)).toBe('media');
    expect(fitLevel(49)).toBe('baixa');
  });
});

describe('computeRoleFit', () => {
  it('perfil idêntico ao ideal com primário preferido dá 100', () => {
    const role = ROLE_BY_ID.operador_recepcao;
    const fit = computeRoleFit(assessmentFrom(role.ideal, 'I', 'S'), role);
    expect(fit.score).toBe(100);
    expect(fit.level).toBe('alta');
    expect(fit.cautionTraits).toHaveLength(0);
    expect(fit.matchedTraits).toHaveLength(role.traits.length);
  });

  it('perfil idêntico sem primário preferido fica em 100 - sem bônus', () => {
    const role = ROLE_BY_ID.operador_recepcao;
    // primário S está em preferredPrimary; usa D que não está em nenhuma lista.
    const fit = computeRoleFit(assessmentFrom(role.ideal, 'D'), role);
    expect(fit.score).toBe(100);
  });

  it('bônus de primário preferido soma PREFERRED_BONUS antes do teto', () => {
    const role = ROLE_BY_ID.estagiario;
    const vector = { D: 10, I: 30, S: 30, C: 30 }; // dist = 20 → base 90
    const semBonus = computeRoleFit(assessmentFrom(vector, 'C'), role);
    const comBonus = computeRoleFit(assessmentFrom(vector, 'S'), role);
    expect(semBonus.score).toBe(90);
    expect(comBonus.score).toBe(90 + PREFERRED_BONUS);
  });

  it('perfil D puro tem baixa compatibilidade com Profissional PJ', () => {
    const role = ROLE_BY_ID.profissional_pj;
    const fit = computeRoleFit(assessmentFrom({ D: 70, I: 10, S: 10, C: 10 }, 'D'), role);
    expect(fit.level).toBe('baixa');
    expect(fit.score).toBeLessThan(50);
    expect(fit.notes.some((n) => n.includes('atenção'))).toBe(true);
  });

  it('primário de atenção limita o score ao teto mesmo com distribuição boa', () => {
    const role = ROLE_BY_ID.profissional_pj;
    const fit = computeRoleFit(assessmentFrom(role.ideal, 'D'), role);
    expect(fit.score).toBe(CAUTION_CAP);
    expect(fit.level).toBe('media');
  });

  it('separa características atendidas das de atenção pelo fator', () => {
    const role = ROLE_BY_ID.operador_recepcao;
    // I muito baixo → tudo que depende de I vira atenção.
    const fit = computeRoleFit(assessmentFrom({ D: 30, I: 5, S: 40, C: 25 }, 'S'), role);
    const needsI = role.traits.filter((t) => t.factors.includes('I'));
    for (const t of needsI) expect(fit.cautionTraits).toContain(t);
    expect(fit.matchedTraits.some((t) => t.factors.includes('S') && !t.factors.includes('I'))).toBe(true);
  });

  it('retorna null sem avaliação ou sem função', () => {
    expect(computeRoleFit(null, ROLE_PROFILES[0])).toBeNull();
    expect(computeRoleFit(assessmentFrom({ D: 25, I: 25, S: 25, C: 25 }, 'D'), null)).toBeNull();
  });
});

describe('bestRoleFor', () => {
  it('aponta Recepção para um perfil I/S, PJ para um perfil S/C e Administrativo para um perfil C/D', () => {
    const recepcao = bestRoleFor(assessmentFrom({ D: 20, I: 42, S: 26, C: 12 }, 'I', 'S'));
    expect(recepcao.role.id).toBe('operador_recepcao');

    const pj = bestRoleFor(assessmentFrom({ D: 8, I: 20, S: 42, C: 30 }, 'S', 'C'));
    expect(pj.role.id).toBe('profissional_pj');

    const admin = bestRoleFor(assessmentFrom({ D: 26, I: 14, S: 24, C: 36 }, 'C', 'D'));
    expect(admin.role.id).toBe('administrativo');
  });

  it('retorna null sem avaliação', () => {
    expect(bestRoleFor(null)).toBeNull();
  });
});
