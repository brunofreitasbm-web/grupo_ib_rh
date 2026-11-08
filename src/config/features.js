import { BRANDING } from './branding';

// Ponto ÚNICO de leitura da flag showInternsDashboard (ver branding.js).
// Quando desligada (Grupo IB), o dashboard de estagiários não aparece na
// navegação, não é importado/montado (portanto não faz nenhuma query em
// interns/units/records) e nenhuma rota/estado/localStorage consegue abri-lo.
// Padrão: ligada, para não alterar sites que não declaram a flag (Porto Terapia).
export const INTERNS_DASHBOARD_ENABLED = BRANDING.showInternsDashboard !== false;

// Aba inicial do módulo Estagiários.
export const INTERNS_HOME_TAB = INTERNS_DASHBOARD_ENABLED ? 'dashboard' : 'estagiarios';

// Troca 'dashboard' pela aba inicial quando o dashboard está desligado.
export const guardInternsTab = (tab) =>
  (!INTERNS_DASHBOARD_ENABLED && tab === 'dashboard' ? INTERNS_HOME_TAB : tab);

// Ponto ÚNICO de leitura da flag showAllUnitsOption (ver branding.js). Desligada
// no Grupo IB: o seletor de unidade não oferece "Todas as unidades".
export const ALL_UNITS_OPTION_ENABLED = BRANDING.showAllUnitsOption !== false;
