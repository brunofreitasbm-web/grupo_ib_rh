import { test, expect } from '@playwright/test';

// Roda com: VITE_WORKSPACE_ID=grupoib VITE_SUPABASE_URL=https://mock.supabase.co
//           VITE_SUPABASE_ANON_KEY=x npx playwright test e2e/grupoib-sem-dashboard-estagiarios.spec.js
// Supabase 100% mockado: usuário supervisor com escopo "all" e dados que misturam
// unidades/estagiários de outro workspace com unidades do Grupo IB.
const SHOTS = process.env.SHOTS_DIR || 'test-results';
const EXTERNAL_NAMES = ['ExternoEstagiaria Alfa', 'ExternoEstagiario Beta', 'ExternoEstagiaria Gama'];

const units = [
  { id: 'clinica-a', name: 'FaçaAmigos, Centro de Terapia Comportamental', workspace_id: 'grupoib', lat: -1.4, lng: -48.4, radius_km: 1 },
  { id: 'antonio-barreto', name: 'Outro Workspace Antônio Barreto', workspace_id: 'porto-terapia', lat: -1.4, lng: -48.4, radius_km: 1 },
  { id: 'generalissimo', name: 'Outro Workspace Generalíssimo', workspace_id: 'porto-terapia', lat: -1.4, lng: -48.4, radius_km: 1 },
];
const interns = EXTERNAL_NAMES.map((name, i) => ({
  id: `porto-int-${i}`, name, course: 'Psicologia', institution: 'UFPA', unit_id: i === 2 ? 'generalissimo' : 'antonio-barreto',
  active: true, daily_hours: 6, allowance: 1000, start_date: '2026-01-01', end_date: '2026-12-31', registration_status: 'active',
}));

const supervisor = {
  id: 'sup-id', aud: 'authenticated', role: 'authenticated', email: 'supervisor@exemplo.com',
  user_metadata: { role: 'supervisor', name: 'Bruno' },
  app_metadata: { role: 'supervisor', provider: 'email', workspace_scope: ['grupoib', 'porto-terapia', 'all'] },
  created_at: new Date().toISOString(),
};
const session = { access_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: supervisor };

async function setup(page, navState, requests) {
  page.on('request', (r) => requests.push(r.url()));
  await page.route('**/auth/v1/**', (route) => {
    const u = route.request().url();
    const body = u.includes('/user') ? supervisor : session;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/rest/v1/**', (route) => {
    const u = route.request().url();
    let body = [];
    if (u.includes('/rest/v1/units')) body = units;
    else if (u.includes('/rest/v1/interns')) body = interns;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/rest/v1/rpc/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"candidates":[],"total":0}' }));
  await page.addInitScript(({ s, nav }) => {
    localStorage.setItem('sb-mock-auth-token', JSON.stringify(s));
    if (nav) localStorage.setItem('admin_nav_sup-id', JSON.stringify(nav));
  }, { s: session, nav: navState });
}

async function enterAdmin(page) {
  const adminBtn = page.getByRole('button', { name: /Acesso Administrativo/i });
  if (await adminBtn.isVisible().catch(() => false)) await adminBtn.click();
}

async function assertNoInternsDashboard(page) {
  const text = await page.locator('body').innerText();
  for (const n of EXTERNAL_NAMES) expect(text).not.toContain(n);
  expect(text).not.toMatch(/Outro Workspace/i);
  await expect(page.getByRole('button', { name: /^\s*Dashboard\s*$/ })).toHaveCount(0);
}

const cenarios = [
  { nome: 'estado inicial', url: '/', nav: null },
  { nome: 'localStorage com aba dashboard', url: '/', nav: { module: 'interns', tab: 'dashboard' } },
  { nome: 'URL com ?tab=dashboard', url: '/?tab=dashboard', nav: null },
];

for (const c of cenarios) {
  test(`Grupo IB sem dashboard de estagiarios: ${c.nome}`, async ({ page }, info) => {
    const requests = [];
    await setup(page, c.nav, requests);
    await page.goto(c.url);
    await enterAdmin(page);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}/grupoib-${info.title.replace(/\W+/g, '_').slice(-30)}.png`, fullPage: true });
    const inAdmin = await page.getByText(/Estagiários/).first().isVisible().catch(() => false);
    console.log(`[${c.nome}] painel admin visivel: ${inAdmin}`);
    await assertNoInternsDashboard(page);
    expect(requests.filter((u) => u.includes('DashboardTab'))).toEqual([]);
  });
}

const ABAS = ['Estagiários', 'Documentos', 'Frequência', 'Escala', 'Documentos Admissionais', 'Acompanhamento & Recesso', 'Abonos & Ocorrências', 'Desligamento / Rescisão', 'Alertas & Pendências'];

test('Grupo IB: filtro "Todas as unidades" nao lista estagiarios de outro workspace em nenhuma aba', async ({ page }) => {
  const requests = [];
  await setup(page, null, requests);
  await page.goto('/');
  await enterAdmin(page);
  await page.waitForTimeout(2500);
  const select = page.locator('select[title="Filtrar por unidade"]').first();
  await select.selectOption('all');
  // O seletor de unidades também não pode oferecer unidades de outro workspace.
  const opts = await select.locator('option').allInnerTexts();
  console.log('opcoes do filtro de unidade:', JSON.stringify(opts));
  expect(opts.join('|')).not.toMatch(/Outro Workspace|Barreto|Generalíssimo/i);
  const visitadas = [];
  for (const aba of ABAS) {
    const btn = page.getByRole('button', { name: aba, exact: true }).first();
    if (!(await btn.isVisible().catch(() => false))) continue;
    await btn.click();
    await page.waitForTimeout(1500);
    visitadas.push(aba);
    await assertNoInternsDashboard(page);
    if (aba === 'Estagiários') await page.screenshot({ path: `${SHOTS}/grupoib-estagiarios-todas-unidades.png`, fullPage: true });
  }
  console.log('abas visitadas:', visitadas.join(', '));
  expect(visitadas.length).toBeGreaterThan(3);
  // Busca global (Ctrl+K) tambem nao pode achar estagiario de outro workspace.
  await page.keyboard.press('Control+k');
  await page.keyboard.type('Externo');
  await page.waitForTimeout(800);
  expect(await page.locator('body').innerText()).not.toContain('ExternoEstagiari');
});
