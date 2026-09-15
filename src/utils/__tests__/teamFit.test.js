import { describe, it, expect } from 'vitest';
import { teamDiscComposition, teamSynergyNote } from '../teamFit';

const member = (primary) => ({
  primary_profile: primary,
  scores: { natural: { D: 25, I: 25, S: 25, C: 25 }, adaptado: { D: 25, I: 25, S: 25, C: 25 } },
});

describe('teamDiscComposition', () => {
  it('conta 0 para equipe vazia', () => {
    const c = teamDiscComposition([]);
    expect(c.count).toBe(0);
    expect(c.avgVector).toBeNull();
    expect(c.dominantFactor).toBeNull();
  });

  it('conta perfis e aponta o dominante', () => {
    const c = teamDiscComposition([member('I'), member('I'), member('S')]);
    expect(c.count).toBe(3);
    expect(c.counts).toEqual({ D: 0, I: 2, S: 1, C: 0 });
    expect(c.dominantFactor).toBe('I');
  });

  it('ignora membros sem primary_profile', () => {
    const c = teamDiscComposition([member('I'), { primary_profile: null }]);
    expect(c.count).toBe(1);
  });
});

describe('teamSynergyNote', () => {
  it('retorna null sem avaliação', () => {
    expect(teamSynergyNote(null, teamDiscComposition([]))).toBeNull();
  });

  it('tom "empty" quando a equipe ainda não tem DISC', () => {
    const note = teamSynergyNote({ primary_profile: 'D' }, teamDiscComposition([]));
    expect(note.tone).toBe('empty');
  });

  it('tom "caution" quando o candidato reforça o perfil já majoritário', () => {
    const composition = teamDiscComposition([member('I'), member('I'), member('S')]);
    const note = teamSynergyNote({ primary_profile: 'I' }, composition);
    expect(note.tone).toBe('caution');
  });

  it('tom "positive" quando o candidato traz um perfil ausente na equipe', () => {
    const composition = teamDiscComposition([member('I'), member('I'), member('S')]);
    const note = teamSynergyNote({ primary_profile: 'C' }, composition);
    expect(note.tone).toBe('positive');
  });

  it('tom "neutral" quando o perfil já existe mas não predomina', () => {
    const composition = teamDiscComposition([member('I'), member('I'), member('S'), member('C')]);
    const note = teamSynergyNote({ primary_profile: 'S' }, composition);
    expect(note.tone).toBe('neutral');
  });
});
