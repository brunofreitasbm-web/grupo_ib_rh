import { describe, it, expect } from 'vitest';
import { isHiddenUnitForWorkspace } from '../workspaceUnits';

describe('isHiddenUnitForWorkspace', () => {
  it('oculta Antônio Barreto e Generalíssimo no Grupo IB (por id ou nome)', () => {
    expect(isHiddenUnitForWorkspace('antonio-barreto', '', 'grupoib')).toBe(true);
    expect(isHiddenUnitForWorkspace('x', 'Generalíssimo', 'grupoib')).toBe(true);
    expect(isHiddenUnitForWorkspace('x', 'Antônio Barreto', 'grupoib')).toBe(true);
  });
  it('não oculta unidades do Grupo IB', () => {
    expect(isHiddenUnitForWorkspace('faca-amigos-parque-shopping', 'FaçaAmigos Parque Shopping', 'grupoib')).toBe(false);
  });
  it('não mexe em outros workspaces', () => {
    expect(isHiddenUnitForWorkspace('antonio-barreto', '', 'porto-terapia')).toBe(false);
  });
});
