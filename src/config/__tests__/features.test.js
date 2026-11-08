import { describe, it, expect } from 'vitest';
import { WORKSPACES, BRANDING } from '../branding';
import { INTERNS_DASHBOARD_ENABLED, INTERNS_HOME_TAB, guardInternsTab } from '../features';

describe('showInternsDashboard', () => {
  it('Grupo IB nunca pode exibir o dashboard de estagiários (de outro workspace)', () => {
    expect(WORKSPACES.grupoib.showInternsDashboard).toBe(false);
  });

  it('nenhum workspace com id grupoib liga a flag', () => {
    for (const ws of Object.values(WORKSPACES)) {
      if (ws.id === 'grupoib') expect(ws.showInternsDashboard).not.toBe(true);
    }
  });

  it('no build atual, a flag desligada leva a aba inicial para fora do dashboard', () => {
    if (BRANDING.id === 'grupoib') {
      expect(INTERNS_DASHBOARD_ENABLED).toBe(false);
      expect(INTERNS_HOME_TAB).not.toBe('dashboard');
      expect(guardInternsTab('dashboard')).toBe(INTERNS_HOME_TAB);
    }
    expect(guardInternsTab('estagiarios')).toBe('estagiarios');
  });
});
