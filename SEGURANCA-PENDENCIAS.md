# Segurança: pendências da auditoria de 2026-11-10

Lista do que **não** foi resolvido pela Onda 1 neste repositório. Nenhum valor de
segredo aparece aqui, só onde está e o que fazer. Apague cada item ao concluir.

## Ações do dono (não dependem de código)

- [ ] Fazer deploy de `notify-professional-nfse`, `intern-course-stats` e `therapist-directory`.
- [ ] Trocar as senhas de seed (`admin321`) se ainda valerem em produção.
- [ ] Conferir se a migration `20261006120000_self_registration_documents_validate_mime.sql` está aplicada (o arquivo diz "NAO aplicada automaticamente").

## Onda 2 (muda comportamento, aprovar item a item)

- [ ] **Dependências com aviso que pede upgrade de versão maior** (`npm audit --omit=dev`): `node-fetch` (alto), `react-router`, `esbuild`, `glob`, `minimatch`, `deepmerge`. `npm audit fix` sem `--force` já foi aplicado; o resto exige `--force` e reteste. Depois, tirar o `continue-on-error` do audit no CI.
- [ ] **Senha das contas de quiosque no bundle** (`src/App.jsx:1423,1459,1490`; e-mails em `src/config/branding.js`). Qualquer pessoa entra como `professional_unit` e lê CPF, RG, banco, conta e PIX dos prestadores. Substituir por pareamento de dispositivo (o padrão `vitrine_pairing_*` já existe no banco) e trocar as senhas.
- [ ] Enquanto isso: tirar as colunas bancárias do que `professional_unit` enxerga (view com colunas mínimas).
- [ ] Comparação biométrica no navegador (`EmployeeKiosk.jsx:204`): mover para o servidor.
- [ ] `intern_course_stats` e `workspaces` com leitura `using (true)` para qualquer autenticado.
- [ ] CORS `*` nas edge functions; `error.message` nas respostas; `public/debug-error-overlay.js` em produção.
- [ ] `get_public_interns_basic(null)` lista estagiários ativos para anônimos.
- [ ] Captcha no autocadastro e no DISC público.
- [ ] Corrigir os 2 testes que falham na `main` (`FinanceiroTabHooks`, `cltCalculations > nightMinutes`) e tirar o `continue-on-error` do CI.
- [ ] O repo diverge do banco: a fonte oficial das migrations é `rh_grupoib_porto`. Reconciliar.
