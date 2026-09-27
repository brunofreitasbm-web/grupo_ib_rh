# Módulo Freelance (Trabalhos Pontuais) — HUB FaçaAmigos

Quarta categoria de contratação do hub de RH, ao lado de **Estagiários** (Lei
nº 11.788/2008), **Profissionais PJ** (arts. 593 e ss. do Código Civil / art.
442-B da CLT) e **Funcionários CLT**. Cobre demanda pontual, delimitável em
escopo e prazo, que não justifica nem estágio, nem CNPJ, nem carteira
assinada — ex.: recreação de um evento específico, uma oficina, uma palestra,
um laudo técnico, cobertura de pico sazonal.

Este documento é a fundamentação jurídica e fiscal por trás do código em
[`src/config/freelanceConstants.js`](src/config/freelanceConstants.js) e
[`src/utils/freelanceCalculations.js`](src/utils/freelanceCalculations.js).
**Não substitui revisão por advogado e contador antes de uso em produção** —
é o texto que orienta o comportamento do sistema, não uma peça jurídica.

## 1. Enquadramento adotado

**Freelance = trabalhador autônomo pessoa física, contratado por escopo
(obra/serviço certo e determinado), por preço e prazo fechados, sem
habitualidade, subordinação, pessoalidade nem exclusividade.**

Base legal:

- **CC, arts. 593–609** — prestação de serviço em geral (natureza civil,
  preço, prazo).
- **CC, arts. 610–626** — empreitada, quando o objeto é uma obra/resultado
  certo (ex.: um laudo, um material de campanha).
- **CLT, art. 3º** — os quatro elementos do vínculo empregatício:
  pessoalidade, habitualidade, subordinação e onerosidade. A ausência de
  qualquer um já afasta o vínculo; o desenho do módulo ataca os quatro ao
  mesmo tempo.
- **CLT, art. 442-B** — autônomo contratado com observância das formalidades
  legais não é empregado, "qualquer que seja o tipo de contratação".
- **CLT, art. 9º** — nulidade de atos que visem desvirtuar a aplicação da lei
  trabalhista (o motivo pelo qual a *prática* importa tanto quanto o papel).
- **CLT, arts. 443, §3º e 452-A** — trabalho intermitente: é a alternativa
  correta quando a demanda é recorrente **e** exige subordinação, e não uma
  sequência de OS de Freelance.

### Por que não "autônomo com CNPJ" (PJ)?

O módulo Profissionais PJ já existe para prestadores com CNPJ. Exigir CNPJ do
freelancer excluiria a maior parte do Banco de Talentos (que capta pessoas
físicas) e aproximaria demais a contratação do risco de **pejotização**, hoje
sob julgamento no **STF, Tema 1389 (ARE 1.532.603)** — mérito ainda pendente
em setembro/2026, com suspensão nacional parcialmente levantada em
1ª/2ª instância. Para trabalho verdadeiramente pontual, o enquadramento de
autônomo pessoa física (RPA) é o mais aderente e o mais simples de operar.

## 2. Por que o módulo não tem quiosque, PIN, ponto nem biometria

Diferente de Profissionais PJ e Funcionários CLT, o Freelance não oferece
nenhum artefato de controle de presença. Isso é desenho, não lacuna: escala,
PIN, ponto e biometria são exatamente os elementos que uma reclamatória usa
para provar subordinação e habitualidade. O controle aqui é de **entrega**
(aceite do escopo declarado na Ordem de Serviço), nunca de **tempo**.

## 3. A Ordem de Serviço (OS) como unidade de contratação

Cada trabalho é uma **OS própria** — nunca um cadastro guarda-chuva de prazo
indeterminado. O fluxo de status é linear e nunca pula etapa:

```
rascunho → proposta → aceita → entregue → aceito → pago
                                              └── cancelada (a qualquer momento antes de "pago")
```

Cada transição grava um timestamp (`proposed_at`, `accepted_at`,
`delivered_at`, `payment_accepted_at`, `paid_at`) — é esse rastro documental
que evidencia, em caso de disputa, que houve aceite de escopo e aceite de
entrega distintos e específicos por trabalho, e não uma relação continuada.

Três documentos são gerados por OS (`src/utils/freelanceDocuments.js`):

1. **Contrato de Prestação de Serviço Autônomo por Escopo** — assinado antes
   da execução.
2. **Ordem de Serviço** — ficha de escopo/prazo/preço, anexo do contrato.
3. **RPA (Recibo de Pagamento a Autônomo)** — emitido após aceite da entrega,
   com as retenções discriminadas.

## 4. Blindagem: risco de habitualidade

Não existe número legal de "quantas vezes" um autônomo pode ser contratado
sem virar empregado — a Justiça do Trabalho analisa o caso concreto (CLT,
art. 3º). Os limites em `FREELANCE_RISK_LIMITS` são **política interna
conservadora**, para que o sistema alerte antes de o padrão de contratação
virar prova contra a própria empresa:

| Limite | Valor padrão | Efeito no sistema |
|---|---|---|
| Trabalhos/mês por freelancer | 4 | Nível "atenção"/"crítico" |
| Meses consecutivos com trabalho | 3 | idem |
| Trabalhos em 12 meses | 12 | idem |
| Valor pago em 12 meses | R$ 30.000 | idem (indício de dependência econômica) |

**Decisão de produto (2026-09-27): o sistema apenas ALERTA, nunca bloqueia** a
emissão de uma nova OS. O alerta aparece na criação da OS, na listagem de
Trabalhos e no painel de Conformidade (`assessHabitualityRisk` em
`src/utils/freelanceCalculations.js`). Cabe ao RH decidir se migra o vínculo
(CLT, intermitente ou PJ) quando o padrão se repete.

As **regras de conduta** (`FREELANCE_CONDUCT_RULES`) cobrem o que a política
de risco não alcança: mesmo dentro dos limites, contrato impecável e prática
subordinada juntos ainda geram vínculo reconhecido. Ver o painel de
Conformidade no app para a lista completa (não integrar o freelancer a
escala/grupo de expediente, não exigir ponto, não aplicar disciplina, permitir
substituição e recusa, não exigir exclusividade etc.).

## 5. Rotina fiscal e previdenciária (competência 2026)

Pagamento a autônomo pessoa física por empresa gera, por trabalho:

- **INSS retido do prestador**: 11% sobre o valor do serviço, limitado a 11%
  do teto previdenciário (Lei nº 8.212/1991, art. 30, §4º). Teto 2026:
  R$ 8.475,55 → retenção máxima R$ 932,31/competência **por prestador**
  (`computeInssWithheld` soma bases pagas na mesma competência quando
  informado `otherBaseInMonth`).
- **INSS patronal**: 20% sobre o valor pago ao contribuinte individual (Lei
  nº 8.212/1991, art. 22, III) — **custo da empresa**, nunca descontado do
  freelancer (`computeInssEmployerCost`).
- **IRRF**: tabela progressiva mensal 2026, com o **redutor legal** da Lei
  nº 15.270/2025 — isenção total até R$ 5.000 de rendimento tributável
  mensal, redução decrescente até R$ 7.350 (`computeIrrf`).
- **ISS**: conforme a Lei Complementar nº 116/2003 e a legislação do
  município de Belém/PA — alíquota e obrigatoriedade de retenção variam com o
  item de serviço; o sistema só aplica quando a OS marcar `issWithheld`.
- **eSocial**: S-2300 (início, categoria 701 — contribuinte individual),
  S-1200 (remuneração da competência) e, quando cessar a relação, S-2399. Ver
  checklist completo em `FREELANCE_FISCAL_CHECKLIST`.

Todos os parâmetros (teto, alíquotas, tabela do IRRF) estão isolados em
`src/config/freelanceConstants.js` e devem ser revisados a cada virada de
competência — são referência de cálculo para RPA e minutas, **não** dispensam
conferência da contabilidade.

## 6. Entrada pelo Banco de Talentos

Um candidato do Banco de Talentos pode ser convertido diretamente em
freelancer (ação "Cadastrar como Freelancer" no menu de ações da linha do
candidato, em `CandidateActionsMenu`/`BancoTalentosTab`). A conversão só cria
o cadastro básico (nome, contato, unidade, área de atuação, e o vínculo com o
`candidate_id` de origem); CPF, endereço, dados bancários e a **Declaração de
Autonomia** precisam ser completados na aba Freelancers antes de emitir a
primeira Ordem de Serviço — o formulário de cadastro bloqueia a gravação sem
o aceite da declaração.

## 7. Schema e permissões

- Tabelas: `public.freelancers`, `public.freelance_jobs`,
  `public.freelance_job_documents` — ver
  [`supabase/migrations/20260927100000_freelance_module.sql`](supabase/migrations/20260927100000_freelance_module.sql).
  RLS: só supervisor da unidade (reaproveita `jwt_is_supervisor_for_unit`);
  sem role de quiosque, porque o módulo não tem conta compartilhada de
  tablet.
- Flag de branding: `BRANDING.showFreelanceModule` (ligado no Grupo IB,
  desligado na Porto Terapia) — ver `src/config/branding.js`.
- Permissões finas: grupo `freelance` em `src/config/permissions.js`
  (`freelance.ver`, `.editar`, `.os`, `.contrato`, `.conformidade`).

## 8. Revisão pendente

Este módulo nasceu de uma decisão de produto documentada em
2026-09-27 (autônomo PF por escopo/RPA; alerta em vez de bloqueio de risco;
entrega completa: schema + 3 abas + minutas + cálculos + testes). Itens que
**precisam** de validação externa antes de uso real:

- Confirmar com a contabilidade a alíquota de ISS e a obrigatoriedade de
  retenção para cada natureza de serviço em Belém/PA.
- Revisão jurídica das minutas de contrato, OS e RPA antes da primeira
  assinatura.
- Acompanhar o desfecho do STF, Tema 1389 — se o mérito trouxer critérios
  objetivos novos para distinguir autonomia de subordinação, os limites de
  `FREELANCE_RISK_LIMITS` e as regras de conduta devem ser revisados.
