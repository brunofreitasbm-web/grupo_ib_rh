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

    // Injeta sessão de supervisor no localStorage
    await page.addInitScript(() => {
      localStorage.setItem('adminKey', 'bruno');
      localStorage.setItem('adminLoggedIn', 'true');
      localStorage.setItem('activeAdminTab', 'banco_talentos');
    });

    await page.goto('/');

    // Se estiver na tela de login, entra como bruno
    const loginInput = page.locator('input[placeholder*="nome ou e-mail"]');
    if (await loginInput.isVisible()) {
      await loginInput.fill('bruno');
      await page.keyboard.press('Enter');
    }

    // Navega para a aba Banco de Talentos caso não esteja ativa
    const talentTabBtn = page.getByRole('button', { name: /Banco de Talentos/i }).first();
    if (await talentTabBtn.isVisible()) {
      await talentTabBtn.click();
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
    await expect(page.getByText('FaçaAmigos Parque Shopping').first()).toBeVisible();
    await expect(page.getByText('FaçaAmigos Bosque Grão-Pará').first()).toBeVisible();
  });
});
