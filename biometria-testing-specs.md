# Especificações de Testes de Front-End — Biometria Facial

Este documento define especificamente os cenários de teste, fluxos e automação para o módulo de **Biometria Facial (Controle de Reconhecimento)** do sistema **Controle de Estagiário (Porto Terapia)**.

O objetivo deste módulo é permitir que o supervisor compare visualmente a foto inicial 3x4 anexada pelo estagiário no seu cadastro com a foto capturada em tempo real pela webcam no momento de registrar a entrada ou saída (ponto diário).

---

## 1. Cenários de Teste (Manual / Funcional)

### BIO-01: Registro de Ponto com Biometria e Validação Visual do Supervisor
* **Objetivo**: Garantir que o estagiário consiga registrar o ponto sob validação da biometria facial (dentro do raio de 100m) e que o supervisor consiga validar as fotos no painel.
* **Passos (Estagiário)**:
  1. Acessar a página inicial do sistema.
  2. Clicar no botão **"Estagiários - Antônio Barreto"**.
  3. Preencher o usuário (`estagiario`) e a senha (`estagio123`).
  4. Clicar em **"Entrar"**.
  5. Simular a localização do navegador dentro do raio permitido (<100m da Unidade Antônio Barreto).
  6. Selecionar o estagiário na lista (caso seja login de unidade) e clicar em **"Registrar Entrada"** (a câmera será ativada para capturar a foto biométrica diária).
  7. Confirmar o registro do ponto.
* **Passos (Supervisor)**:
  1. Acessar o sistema, selecionar a opção **"Supervisor Geral"**.
  2. Logar com o e-mail `supervisor@portoterapia.com` e a senha `admin123`.
  3. Acessar a aba **"Frequência"** no painel administrativo.
  4. Clicar sobre a foto do ponto registrado pelo estagiário para abrir a comparação.
* **Resultado Esperado**:
  - O modal de **"Biometria de Reconhecimento"** deve ser aberto exibindo a foto 3x4 de cadastro (inicial) lado a lado com a foto do ponto capturada no dia, confirmando a correspondência.

---

## 2. Automação com Playwright (E2E)

Abaixo está o script completo recomendado para validar esta integração em ambiente de testes de ponta a ponta (`tests/biometria.spec.js`):

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Módulo de Biometria Facial - Comparação de Fotos', () => {

  test('Deve permitir login em Antônio Barreto, bater ponto na cerca virtual e comparar biometria no painel', async ({ page, context }) => {
    // ---- FASE 1: REGISTRO DO PONTO PELO ESTAGIÁRIO ----
    
    // 1. Configura a geolocalização simulando estar dentro da clínica Antônio Barreto
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -1.44247, longitude: -48.46999 });

    await page.goto('http://localhost:5173');

    // 2. Clica no botão "Estagiários - Antônio Barreto"
    await page.click('h4:has-text("Estagiários - Antônio Barreto")');

    // 3. Efetua o login como estagiário
    await page.fill('#username', 'estagiario');
    await page.fill('#password', 'estagio123');
    await page.click('button:has-text("Entrar")');

    // 4. Efetua a batida de ponto diária (com ativação de câmera e GPS)
    // (Nota: em ambientes CI a câmera pode ser mockada usando flags de inicialização do navegador)
    await page.click('button:has-text("Registrar Entrada")');
    await expect(page.locator('.text-success')).toBeVisible();

    // ---- FASE 2: COMPARAÇÃO VISUAL PELO SUPERVISOR ----

    // 5. Desloga e entra como Supervisor Geral
    await page.click('button:has-text("Sair")');
    await page.click('button:has-text("Supervisor Geral")');
    await page.fill('#username', 'supervisor@portoterapia.com');
    await page.fill('#password', 'admin123');
    await page.click('button:has-text("Entrar")');

    // 6. Navega até a aba de Frequência
    await page.click('button:has-text("Frequência")');

    // 7. Abre a foto do ponto recém batido no histórico
    await page.click('img[title*="biometria"], button:has-text("Ver Foto")');

    // 8. Valida o modal de comparação visual
    await expect(page.locator('text=Biometria de Reconhecimento')).toBeVisible();
    await expect(page.locator('text=Foto do Cadastro (Inicial 3x4)')).toBeVisible();
    await expect(page.locator('text=Biometria do Ponto (Registro)')).toBeVisible();

    // Verifica que as tags de imagem para ambos estão visíveis no DOM
    await expect(page.locator('img[alt*="Cadastro de"]')).toBeVisible();
    await expect(page.locator('img[alt*="Reconhecimento Facial"]')).toBeVisible();
  });

});
```
