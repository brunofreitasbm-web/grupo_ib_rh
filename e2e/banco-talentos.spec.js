import { test, expect } from '@playwright/test';

test.describe('Banco de Talentos - Separação por Unidade', () => {
  test('deve renderizar filtros e visão de candidaturas por unidade', async ({ page }) => {
    // Mock das chamadas de autenticação e dados do banco de talentos
    await page.route('**/functions/v1/fetch-talent-bank*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 2,
          candidates: [
            {
              id: 'cand-1',
              full_name: 'Mariana Silva',
              email: 'mariana.silva@exemplo.com',
              phone: '91988881111',
              course: 'Psicologia',
              desired_area: 'Psicologia / Aplicador(a) ABA',
              opportunity_type: 'ESTAGIO',
              preferred_unit: 'PARQUE_SHOPPING',
              status: 'NOVO',
              created_at_ms: Date.now() - 3600000,
            },
            {
              id: 'cand-2',
              full_name: 'Carlos Oliveira',
              email: 'carlos.oliveira@exemplo.com',
              phone: '91988882222',
              course: 'Terapia Ocupacional',
              desired_area: 'Terapia Ocupacional',
              opportunity_type: 'PJ',
              preferred_unit: 'BOSQUE_GRAO_PARA',
              status: 'LIDO',
              created_at_ms: Date.now() - 7200000,
            }
          ]
        }),
      });
    });

    await page.route('**/rest/v1/talent_candidates_meta*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/talent_disc_tokens*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/talent_disc_assessments*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/talent_basket_assignments*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/freelancers*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // Mock de sessão do Supabase Auth para entrar como supervisor
    await page.route('**/auth/v1/user*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-supervisor-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'bruno@portoterapia.com',
          user_metadata: { role: 'supervisor', name: 'Bruno' },
          app_metadata: { role: 'supervisor', provider: 'email' },
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/auth/v1/token*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-jwt-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'fake-refresh-token',
          user: {
            id: 'user-supervisor-id',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'bruno@portoterapia.com',
            user_metadata: { role: 'supervisor', name: 'Bruno' },
            app_metadata: { role: 'supervisor', provider: 'email' },
          },
        }),
      });
    });

    // Injeta sessão de supervisor no localStorage
    await page.addInitScript(() => {
      const mockSession = {
        access_token: 'fake-jwt-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'fake-refresh-token',
        user: {
          id: 'user-supervisor-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'bruno@portoterapia.com',
          user_metadata: { role: 'supervisor', name: 'Bruno' },
          app_metadata: { role: 'supervisor', provider: 'email' },
        },
      };
      localStorage.setItem('adminKey', 'bruno');
      localStorage.setItem('adminLoggedIn', 'true');
      localStorage.setItem('admin_nav_user-supervisor-id', JSON.stringify({ module: 'interns', tab: 'banco_talentos' }));
      // Chave de sessão do Supabase no storage
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.endsWith('-auth-token')) localStorage.setItem(k, JSON.stringify(mockSession));
      }
      localStorage.setItem('sb-vththexblpxwocbowhsv-auth-token', JSON.stringify(mockSession));
    });

    await page.goto('/');

    // Se estiver na tela de seleção inicial ("Quem está acessando?"), entra em Acesso Administrativo
    const adminBtn = page.getByRole('button', { name: /Acesso Administrativo/i });
    if (await adminBtn.isVisible()) {
      await adminBtn.click();
      const pwdInput = page.locator('input[type="password"]');
      if (await pwdInput.isVisible()) {
        await pwdInput.fill('estagio123');
        await page.keyboard.press('Enter');
      }
    }

    // 1. Verifica coluna 'Unidade Pretendida' no cabeçalho da tabela
    await expect(page.locator('th', { hasText: 'Unidade Pretendida' })).toBeVisible();

    // 2. Verifica a barra de filtro de unidade com botão 'Parque Shopping'
    const parqueBtn = page.locator('button', { hasText: 'Parque Shopping' }).first();
    await expect(parqueBtn).toBeVisible();

    // 3. Testa a sub-aba 'Candidaturas por Unidade'
    const unitSubTabBtn = page.getByRole('button', { name: /Candidaturas por Unidade/i });
    await expect(unitSubTabBtn).toBeVisible();
    await unitSubTabBtn.click();

    // 4. Verifica a distribuição por unidade
    await expect(page.getByText('Distribuição de Candidaturas por Unidade')).toBeVisible();
    await expect(page.locator('h4', { hasText: 'FaçaAmigos Parque Shopping' })).toBeVisible();
    await expect(page.locator('h4', { hasText: 'FaçaAmigos Bosque Grão-Pará' })).toBeVisible();
  });
});
