# Metodologia de Contratação e Pagamento — Prestadores PJ
### Instituto Comportamental Faça Amigos / Núcleo de Desenvolvimento Humano (Grupo IB)

> **Documento de direcionamento.** Descreve a metodologia adotada e reproduz, na íntegra, o contrato-quadro PJ–PJ e a Ordem de Serviço acessória. O texto das cláusulas é **fixo e já validado** — só podem ser substituídos os campos entre chaves duplas `{{ASSIM}}`.

---

## 1. Resumo da metodologia

### 1.1. Contratação

| Item | Definição |
|---|---|
| Natureza jurídica | Prestação de serviços **entre pessoas jurídicas** (PJ–PJ), regida pelos arts. 593 e ss. do Código Civil e pelo art. 442-B da CLT. Legislação trabalhista expressamente afastada. |
| Instrumento principal | **Contrato-quadro**, assinado uma vez por prestador, com vigência de 12 meses renovável. |
| Instrumento acessório | **Ordem de Serviço (OS) / Termo de Atendimento**, emitido **uma por paciente**, numerado sequencialmente, vinculado à Cláusula 5ª-A do contrato-quadro e dependente de aceite da CONTRATADA. |
| Agenda | Definida pela própria CONTRATADA no **Termo de Disponibilidade Voluntária (Anexo I)**, revisável a qualquer tempo. Não há jornada, escala, carga horária mínima, banco de horas ou sobreaviso. |
| Recusa | A CONTRATADA pode recusar qualquer agendamento, módulo ou paciente, **sem justificativa e sem penalidade**. |
| Substituição | A CONTRATADA pode indicar preposto habilitado (Anexo II) — **não há pessoalidade**; o preposto é remunerado por ela. |
| Exclusividade | **Inexistente.** A CONTRATADA pode atender outros tomadores, inclusive concorrentes. |
| Due diligence | Anexo II: CNPJ ativo, registro de conselho regular, comprovação de não dependência econômica exclusiva. |

### 1.2. Pagamento — preço unitário por Módulo Assistencial entregue

A fórmula é:

```
Honorários da competência = {{VALOR_MODULO}} × nº de Módulos Assistenciais efetivamente entregues no mês
```

**Módulo Assistencial** é a *unidade de serviço*, composta cumulativa e indissociavelmente por:

1. os atendimentos alocados no **período matutino ou vespertino** de um mesmo dia, até `{{ATENDIMENTOS_POR_MODULO}}` atendimentos;
2. o **registro em prontuário** de cada atendimento realizado;
3. a **entrega e o protocolo da documentação técnica** do módulo (evolução terapêutica e demais documentos do plano terapêutico ou da operadora), em até `{{PRAZO_DOC_DIAS}}` dias.

Regras de apuração que o sistema deve implementar:

- Corte matutino/vespertino às **12h**; um mesmo dia pode gerar **dois módulos**.
- **Não entrega ⇒ nada devido.** Atendimentos entregues **sem** a documentação (item 3): o preço fica **suspenso** até o protocolo.
- **Sem componente fixo**: não há mensalidade, mínimo garantido, piso, nem verba por disponibilidade, permanência, comparecimento, deslocamento ou espera.
- **Invariável ao tempo**: sem acréscimo por permanência excedente, hora adicional ou adicional noturno; sem desconto por atraso ou saída antecipada.
- **No-show** com aviso < 24h que esvazie integralmente um módulo já aceito: compensação de `{{PERCENTUAL_NOSHOW}}` do preço unitário, a título de **indenização civil por perda de oportunidade de agenda**.
- Pagamento em até `{{PRAZO_PAGAMENTO_DIAS}}` dias da **NFS-e**, exclusivamente em conta da **pessoa jurídica** — vedado pagamento em conta de pessoa física.
- Reajuste **somente por termo aditivo**; nunca por data-base, dissídio ou convenção coletiva.
- Registros eletrônicos (quiosque, PIN, app) são **conferência fiscal para emissão de NFS-e**, de preenchimento voluntário — **não são controle de ponto** (art. 74 da CLT) e não geram desconto, falta ou consequência disciplinar.

### 1.3. Vocabulário obrigatório

Vale para telas, relatórios, CSV, contratos e comunicação interna.

| Usar | Nunca usar |
|---|---|
| Módulo Assistencial | turno, plantão |
| módulos entregues | jornada, escala, carga horária |
| honorários | salário, gratificação |
| registro de execução | ponto, frequência |

*(Nos nomes internos de campos do código, `shift*` é mantido por compatibilidade.)*

---

## 2. Contrato-quadro PJ–PJ

> **INSTITUTO COMPORTAMENTAL FAÇA AMIGOS**
> Núcleo de Desenvolvimento Humano

### CONTRATO DE PRESTAÇÃO DE SERVIÇOS PROFISSIONAIS ENTRE PESSOAS JURÍDICAS
*(Contrato-quadro PJ–PJ — preço por Módulo Assistencial)*

**CONTRATANTE:** `{{CONTRATANTE_RAZAO_SOCIAL}}`, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº `{{CONTRATANTE_CNPJ}}`, com sede em `{{CONTRATANTE_ENDERECO}}`, neste ato representada na forma de seu contrato/estatuto social por `{{CONTRATANTE_REPRESENTANTE_NOME}}`, doravante denominada simplesmente CONTRATANTE.

**CONTRATADA:** `{{CONTRATADA_RAZAO_SOCIAL}}`, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº `{{CONTRATADA_CNPJ}}`, com sede em `{{CONTRATADA_ENDERECO}}`, neste ato representada por seu(sua) sócio(a)/titular `{{PROFISSIONAL_NOME}}`, portador(a) do registro profissional nº `{{PROFISSIONAL_REGISTRO_CONSELHO}}`, doravante denominada simplesmente CONTRATADA.

CONTRATANTE e CONTRATADA, quando referidas em conjunto, doravante "Partes", têm entre si justo e contratado o presente instrumento, que se regerá pelas cláusulas seguintes e pela legislação civil e empresarial aplicável, notadamente os artigos 593 e seguintes do Código Civil e o artigo 442-B da CLT, ficando expressamente afastada a aplicação da legislação trabalhista.

#### CLÁUSULA 1ª — DO OBJETO

**1.1.** O presente contrato tem por objeto a prestação, pela CONTRATADA à CONTRATANTE, de serviços técnico-especializados de atendimento em `{{ESPECIALIDADE_SERVICO}}`, a serem executados com plena autonomia técnica e operacional, em favor dos pacientes/famílias atendidos pela estrutura da CONTRATANTE.

**1.2.** A prestação de serviços ora contratada não envolve, em nenhuma hipótese, relação de emprego, cargo, função, jornada de trabalho ou subordinação hierárquica, aplicando-se a este contrato o regime jurídico previsto nos artigos 593 e seguintes do Código Civil e no artigo 442-B da CLT.

**1.3.** Os serviços são contratados e remunerados por unidade de serviço concluída — o "Módulo Assistencial" definido na Cláusula 6ª —, na forma dos artigos 593, 594 e 614 do Código Civil, que admitem expressamente a fixação de preço por partes ou medições da obra ou do serviço prestado.

#### CLÁUSULA 2ª — DA NATUREZA AUTÔNOMA DA RELAÇÃO E AUSÊNCIA DE SUBORDINAÇÃO

**2.1.** A CONTRATADA presta os serviços por meio de profissional legalmente habilitado, com plena liberdade técnica para definir a abordagem clínica aplicável a cada caso, observadas as diretrizes éticas do respectivo conselho profissional e os protocolos mínimos de segurança do paciente adotados pela CONTRATANTE, os quais constituem exigência técnica e sanitária inerente à natureza do serviço, e não subordinação.

**2.2.** A CONTRATANTE não exerce, e se obriga a não exercer, poder diretivo, disciplinar ou hierárquico sobre a CONTRATADA ou sobre o profissional por ela indicado, não se aplicando a este contrato advertências, suspensões, avaliação de desempenho de natureza trabalhista, controle de ponto/jornada ou qualquer outro mecanismo próprio de relação empregatícia.

**2.3.** Eventuais reuniões de alinhamento técnico, supervisão clínica multiprofissional ou discussão de caso têm natureza estritamente técnico-assistencial, exigida por normas éticas e sanitárias aplicáveis ao atendimento em saúde, não configurando subordinação jurídica para os fins do art. 3º da CLT.

#### CLÁUSULA 3ª — DA NÃO EXCLUSIVIDADE

**3.1.** A prestação de serviços ora avençada não é exclusiva, sendo livre à CONTRATADA prestar serviços a quaisquer outras pessoas físicas ou jurídicas, inclusive concorrentes da CONTRATANTE, resguardado o dever de confidencialidade da Cláusula 9ª.

**3.2.** O fato de a CONTRATADA, por escolha própria, disponibilizar agenda em todos os dias da semana à CONTRATANTE, nos termos do Anexo I, não implica exclusividade nem obrigatoriedade de manutenção dessa disponibilidade, podendo ser livremente reduzida ou reconfigurada pela CONTRATADA mediante comunicação prévia de 7 (sete) dias corridos, sem qualquer penalidade.

#### CLÁUSULA 4ª — DA FACULDADE DE SUBSTITUIÇÃO

**4.1.** A CONTRATADA poderá, a seu critério, indicar outro profissional legalmente habilitado e tecnicamente apto para executar, total ou parcialmente, os serviços objeto deste contrato, desde que o substituto atenda aos requisitos mínimos do Anexo II, comunicando a CONTRATANTE previamente apenas para fins de continuidade do cuidado ao paciente e de conformidade regulatória, o que não caracteriza autorização prévia de natureza hierárquica.

**4.2.** O Módulo Assistencial executado por profissional substituto indicado pela CONTRATADA é devido à CONTRATADA nos mesmos termos da Cláusula 6ª, cabendo exclusivamente a ela a remuneração do substituto, o que evidencia a ausência de pessoalidade na execução deste contrato.

#### CLÁUSULA 5ª — DA AGENDA E DISPONIBILIDADE

**5.1.** A CONTRATADA informará à CONTRATANTE, por meio do Termo de Disponibilidade Voluntária (Anexo I), os dias e intervalos de horário em que voluntariamente aceita receber agendamentos, documento revisável a qualquer tempo por iniciativa da CONTRATADA.

**5.2.** A CONTRATANTE poderá oferecer agendamentos dentro da disponibilidade informada, sendo assegurado à CONTRATADA o direito de recusar, sem necessidade de justificativa e sem qualquer penalidade, qualquer agendamento específico ou Módulo Assistencial específico.

**5.3.** Não há, para nenhum efeito deste contrato, jornada de trabalho, escala, carga horária mínima, banco de horas, regime de sobreaviso ou obrigação de permanência física nas dependências da CONTRATANTE fora dos Módulos Assistenciais voluntariamente aceitos pela CONTRATADA.

**5.4.** A não aceitação de Módulos Assistenciais oferecidos, em qualquer quantidade e por qualquer período, não gera para a CONTRATADA penalidade, desconto, advertência, redução de preço unitário, perda de prioridade na oferta futura ou qualquer outra consequência desfavorável.

#### CLÁUSULA 5ª-A — DAS ORDENS DE SERVIÇO

**5-A.1.** Cada atendimento a paciente específico, pelo prazo estimado necessário ao respectivo plano terapêutico, será formalizado por meio de "Ordem de Serviço" (OS) ou "Termo de Atendimento" (documento próprio, acessório a este contrato-quadro), que especificará: identificação do paciente, especialidade/serviço, data de início prevista, duração estimada, frequência estimada de atendimentos e o Módulo Assistencial ao qual se vincula — sem prejuízo do disposto nos itens 5.1 a 5.4 quanto à ausência de jornada e à faculdade de recusa.

**5-A.2.** A emissão de cada Ordem de Serviço depende de aceitação expressa da CONTRATADA, que poderá recusar, sem necessidade de justificativa, o atendimento a determinado paciente, ou solicitar o encerramento antecipado de uma Ordem de Serviço já aceita mediante aviso com antecedência mínima de 15 (quinze) dias, sem prejuízo do direito de substituição previsto na Cláusula 4ª.

**5-A.3.** O prazo estimado de duração informado na Ordem de Serviço tem natureza de estimativa clínica, não configurando promessa de trabalho contínuo, nem gerando, por si só, direito a renovação automática ou expectativa de manutenção da relação além do período nela indicado.

**5-A.4.** O encerramento de uma Ordem de Serviço não implica, por si só, rescisão deste contrato-quadro, tampouco gera qualquer verba de natureza rescisória trabalhista.

**5-A.5.** A sucessão de diversas Ordens de Serviço ao longo do tempo, ainda que envolvendo o mesmo profissional, não descaracteriza a natureza autônoma da prestação de serviços, nos termos do art. 442-B da CLT, desde que mantidas as condições de não exclusividade, ausência de subordinação e possibilidade de recusa previstas neste contrato.

#### CLÁUSULA 6ª — DOS HONORÁRIOS (PREÇO UNITÁRIO POR MÓDULO ASSISTENCIAL EFETIVAMENTE ENTREGUE)

**6.1. Definição da unidade de serviço.** Para os fins exclusivos deste contrato, denomina-se "Módulo Assistencial" a UNIDADE DE SERVIÇO composta, cumulativa e indissociavelmente, por: (i) a realização dos atendimentos alocados à CONTRATADA no período matutino ou no período vespertino de um mesmo dia, até o limite de `{{ATENDIMENTOS_POR_MODULO}}` atendimentos por módulo; (ii) o registro em prontuário de cada atendimento efetivamente realizado; e (iii) a entrega e o protocolo da documentação técnica correspondente ao módulo — evolução terapêutica e demais documentos exigidos pelo plano terapêutico do paciente ou pela operadora de saúde —, no prazo de `{{PRAZO_DOC_DIAS}}` dias.

**6.2. Natureza da unidade.** O Módulo Assistencial é unidade de MEDIÇÃO DO SERVIÇO ENTREGUE, e não unidade de tempo colocado à disposição da CONTRATANTE. Não se confunde, para nenhum efeito, com turno, jornada, escala, plantão de disponibilidade ou período de sobreaviso, e sua adoção como critério de preço decorre exclusivamente da conveniência de medição do serviço, na forma dos arts. 594 e 614 do Código Civil.

**6.3. Preço.** A CONTRATANTE pagará à CONTRATADA o preço unitário, certo e fechado de R$ `{{VALOR_MODULO}}` por Módulo Assistencial efetivamente entregue, apurando-se ao final de cada competência mensal o valor devido pela simples multiplicação do preço unitário pelo número de Módulos Assistenciais entregues no período.

**6.4. Invariabilidade em relação ao tempo.** O preço unitário é invariável em função do tempo de permanência da CONTRATADA ou de seu preposto nas dependências da CONTRATANTE: não há acréscimo por permanência excedente, hora adicional, adicional noturno ou intervalo remunerado, nem desconto por permanência inferior, atraso ou saída antecipada, desde que entregue a unidade de serviço definida no item 6.1.

**6.5. Ausência de componente fixo e de garantia de volume.** Não há remuneração fixa, mensal, mínima garantida, piso, nem qualquer verba devida por mera disponibilidade, permanência, comparecimento, deslocamento ou tempo de espera. A CONTRATANTE não se obriga a ofertar qualquer número mínimo de Módulos Assistenciais, e a CONTRATADA não se obriga a aceitá-los, inexistindo expectativa legítima de volume, de continuidade ou de renda mensal, o que evidencia a assunção do risco da atividade pela CONTRATADA e a ausência de alteridade.

**6.6. Não entrega e entrega parcial.** Nada é devido pelo Módulo Assistencial não entregue. Entregues os atendimentos sem a documentação técnica do item 6.1 (iii), o preço do módulo torna-se exigível apenas após o protocolo da documentação, ficando suspenso o respectivo pagamento. O risco pela não realização de atendimentos não agendados ou cancelados por causa não imputável à CONTRATANTE é da CONTRATADA, ressalvado o item 6.7.

**6.7. Esvaziamento do módulo por falta de paciente.** Caso a falta de paciente (no-show) com aviso inferior a 24 (vinte e quatro) horas esvazie integralmente um Módulo Assistencial já aceito, poderá ser devida à CONTRATADA compensação de `{{PERCENTUAL_NOSHOW}}` do preço unitário do módulo, a título de indenização civil por perda de oportunidade de agenda — e não como remuneração por disponibilidade, presença ou tempo à disposição.

**6.8. Vedação de leitura trabalhista da métrica.** A adoção do Módulo Assistencial como unidade de preço não institui, não presume e não autoriza a aplicação, entre as Partes, de jornada de trabalho, controle de horário, regime de escala, banco de horas, hora extra, adicional noturno, intervalo intrajornada remunerado, descanso semanal remunerado ou qualquer outra figura da legislação trabalhista, obrigando-se as Partes a não utilizar tais conceitos, nomenclaturas ou rotinas na execução deste contrato.

**6.9. Registro de execução para fins fiscais.** Os registros eletrônicos de início e término de execução dos Módulos Assistenciais, inclusive os efetuados por quiosque, PIN, aplicativo ou sistema da CONTRATANTE, têm finalidade exclusivamente fiscal e de conferência das entregas para emissão da NFS-e, são de preenchimento voluntário pela CONTRATADA e NÃO constituem controle de ponto ou de jornada nos termos do art. 74 da CLT. Tais registros não geram consequência disciplinar de qualquer natureza e não são utilizados para apurar atrasos, faltas, compensações, descontos ou horas extras.

**6.10. Pagamento.** O pagamento será efetuado em até `{{PRAZO_PAGAMENTO_DIAS}}` dias contados da apresentação, pela CONTRATADA, de Nota Fiscal de Serviços Eletrônica (NFS-e) correspondente aos Módulos Assistenciais entregues no período, mediante depósito ou transferência bancária exclusivamente em conta de titularidade da pessoa jurídica CONTRATADA, sendo vedado o pagamento em conta de pessoa física.

**6.11. Revisão de preço.** O preço unitário do item 6.3 poderá ser revisto por acordo entre as Partes mediante termo aditivo, não se aplicando reajuste automático por data-base, dissídio coletivo, convenção coletiva ou qualquer índice de natureza trabalhista.

#### CLÁUSULA 7ª — DOS TRIBUTOS, ENCARGOS E OBRIGAÇÕES ACESSÓRIAS

**7.1.** A CONTRATADA é integral e exclusivamente responsável pelo recolhimento de todos os tributos, contribuições previdenciárias e encargos incidentes sobre os valores recebidos em razão deste contrato, inexistindo responsabilidade solidária ou subsidiária da CONTRATANTE, ressalvadas as hipóteses legais de retenção obrigatória na fonte.

**7.2.** A CONTRATADA declara estar regularmente constituída e inscrita no regime tributário `{{REGIME_TRIBUTARIO_CONTRATADA}}`, comprometendo-se a manter essa regularidade durante toda a vigência contratual e a comunicar imediatamente a CONTRATANTE qualquer alteração de seu enquadramento societário ou tributário.

#### CLÁUSULA 8ª — DA RESPONSABILIDADE TÉCNICA, ÉTICA E PROFISSIONAL

**8.1.** O(a) profissional executor dos serviços deverá manter registro ativo e regular perante o respectivo conselho de classe, sendo pessoal e exclusivamente responsável, nos termos do código de ética da categoria, pelos atos técnicos praticados no atendimento.

**8.2.** A CONTRATANTE poderá exigir, como condição de contratação, a comprovação de seguro de responsabilidade civil profissional em nome da CONTRATADA ou do profissional executor.

**8.3.** A CONTRATADA responde civilmente perante a CONTRATANTE e terceiros por danos decorrentes de erro técnico, negligência, imprudência ou imperícia no exercício de sua atividade.

#### CLÁUSULA 9ª — DA CONFIDENCIALIDADE E DA PROTEÇÃO DE DADOS (LGPD)

**9.1.** A CONTRATADA obriga-se a manter sigilo absoluto sobre dados de pacientes, prontuários e informações clínicas, comerciais e estratégicas da CONTRATANTE a que tiver acesso, tratando-os como dados sensíveis nos termos da Lei nº 13.709/2018 (LGPD), sob pena de responsabilização civil, administrativa e, se cabível, criminal.

**9.2.** As obrigações desta cláusula subsistem por prazo indeterminado após o término deste contrato, independentemente do motivo da extinção.

#### CLÁUSULA 10ª — DA PROPRIEDADE INTELECTUAL

**10.1.** Protocolos clínicos, materiais didáticos, marca, identidade visual, sistemas de prontuário e demais ativos de titularidade da CONTRATANTE permanecem de sua exclusiva propriedade, sendo cedidos à CONTRATADA em regime de mero uso, pelo prazo e para os fins deste contrato.

#### CLÁUSULA 11ª — DO USO DE INSTALAÇÕES E EQUIPAMENTOS

**11.1.** Quando a prestação dos serviços ocorrer nas dependências físicas da CONTRATANTE, tal uso se dá a título de cessão de uso vinculada à execução do serviço contratado, não gerando presunção de subordinação, cabendo à CONTRATADA, sempre que possível e compatível com a atividade, utilizar seus próprios materiais e instrumentos de trabalho.

**11.2.** A utilização das dependências da CONTRATANTE limita-se ao necessário à execução dos Módulos Assistenciais aceitos, não sendo exigida da CONTRATADA presença, permanência ou disponibilidade fora desses módulos, tampouco justificativa por sua ausência das dependências em qualquer outro momento.

#### CLÁUSULA 12ª — DA NATUREZA JURÍDICA, DA VEDAÇÃO EXPRESSA AO RECONHECIMENTO DE VÍNCULO E DO PROTOCOLO OPERACIONAL

**12.1.** As Partes declaram, para todos os fins de direito, que a relação jurídica estabelecida por este instrumento é de natureza exclusivamente civil-empresarial — prestação de serviços entre pessoas jurídicas —, nos termos do art. 442-B da CLT e dos arts. 593 e seguintes do Código Civil, não se caracterizando relação de emprego por ausência dos requisitos do art. 3º da CLT.

**12.2.** Esta cláusula não tem, por si só, o condão de afastar eventual reconhecimento judicial de vínculo empregatício caso a execução real do contrato, no dia a dia, contrarie o quanto aqui pactuado — cabendo às Partes, e sobretudo à CONTRATANTE, adotar práticas operacionais consistentes com a autonomia aqui descrita como condição de eficácia desta cláusula.

**12.3. PROTOCOLO OPERACIONAL.** Como condição de eficácia da autonomia pactuada, e considerando que o preço é medido por Módulo Assistencial, a CONTRATANTE obriga-se, na execução cotidiana, a **NÃO**:

- **a)** tratar o Módulo Assistencial como turno, escala ou jornada, nem exigir "cumprimento de horário", permanência mínima ou justificativa de saída;
- **b)** aplicar advertência, suspensão, desconto, multa ou qualquer sanção pela não aceitação, pela ausência ou pelo atraso da CONTRATADA em módulo não iniciado;
- **c)** utilizar os registros do item 6.9 como espelho de ponto, folha de frequência, base de desconto, banco de horas ou instrumento de avaliação disciplinar;
- **d)** incluir a CONTRATADA em organograma, hierarquia funcional, cargo, "equipe fixa", programa de metas individuais de natureza trabalhista, avaliação de desempenho celetista ou plano de carreira;
- **e)** subordinar a CONTRATADA a chefia imediata, exigir pedido de "folga", "férias", "atestado" ou autorização prévia para ausência, ou fornecer benefícios típicos de emprego (vale-transporte, vale-refeição, plano de saúde como contraprestação, 13º, adicional, participação em lucros);
- **f)** impedir ou desestimular a prestação de serviços a outros tomadores, nem exigir dedicação exclusiva de fato;
- **g)** recusar, sem justificativa técnica ou regulatória, a substituição por preposto habilitado indicado pela CONTRATADA na forma da Cláusula 4ª;
- **h)** emitir comunicações internas, mensagens ou documentos que tratem a CONTRATADA como empregado(a), colaborador(a) subordinado(a) ou integrante de quadro funcional.

**12.4.** O descumprimento reiterado do Protocolo Operacional pela CONTRATANTE, além de comprometer a eficácia deste contrato, autoriza a CONTRATADA a exigir sua imediata correção, sem prejuízo da denúncia do contrato na forma da Cláusula 13ª.

#### CLÁUSULA 13ª — DO PRAZO E DA RESCISÃO

**13.1.** Este contrato vigora pelo prazo de 12 (doze) meses, contados de `{{DATA_INICIO_VIGENCIA}}`, renovável automaticamente por iguais períodos, salvo manifestação em contrário de qualquer das Partes com antecedência mínima de 30 (trinta) dias do término da vigência.

**13.2.** Qualquer das Partes poderá denunciar este contrato, sem necessidade de justificativa e sem multa, mediante aviso prévio por escrito de 30 (trinta) dias.

**13.3.** O contrato poderá ser rescindido de pleno direito, independentemente de aviso prévio, em caso de descumprimento de obrigação essencial — inclusive das cláusulas de sigilo, ética profissional ou das declarações do Anexo II — ou de suspensão/cassação do registro profissional do executor dos serviços.

**13.4.** Não haverá, em nenhuma hipótese, incidência de verbas rescisórias de natureza trabalhista (aviso prévio indenizado nos moldes celetistas, 13º salário, férias, FGTS, multa de 40% do FGTS), por não se tratar de relação de emprego.

#### CLÁUSULA 14ª — DAS DECLARAÇÕES E DA DOCUMENTAÇÃO (DUE DILIGENCE)

**14.1.** A CONTRATADA declara e comprova, mediante os documentos do Anexo II, que: (i) está regularmente constituída como pessoa jurídica, com CNPJ ativo; (ii) o profissional executor possui registro profissional regular; (iii) pode prestar serviços a outros tomadores, não dependendo economicamente de forma exclusiva da CONTRATANTE; (iv) tem plena ciência da natureza autônoma desta contratação.

**14.2.** A CONTRATADA declara, ainda, que compreende e aceita o critério de preço por Módulo Assistencial da Cláusula 6ª, ciente de que: (i) o preço remunera a entrega da unidade de serviço, e não o tempo à disposição; (ii) não há valor mensal mínimo garantido; e (iii) a quantidade de módulos varia conforme a demanda e conforme a própria disponibilidade que ela, voluntariamente, informar.

#### CLÁUSULA 15ª — DO FORO

**15.1.** As Partes elegem o foro central da comarca de Belém, Estado do Pará, com renúncia a qualquer outro, por mais privilegiado que seja, para dirimir controvérsias oriundas deste contrato, observado seu caráter cível.

E, por estarem assim justas e contratadas, as Partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.

Belém/PA, `{{DATA_ASSINATURA}}`

```
_________________________________________________
{{CONTRATANTE_RAZAO_SOCIAL}} — CONTRATANTE

_________________________________________________
{{CONTRATADA_RAZAO_SOCIAL}} — CONTRATADA

Testemunha 1: _______________________________  CPF: ______________
Testemunha 2: _______________________________  CPF: ______________
```

---

## 3. Ordem de Serviço / Termo de Atendimento (acessório — Cláusula 5ª-A)

> **INSTITUTO COMPORTAMENTAL FAÇA AMIGOS**
> Núcleo de Desenvolvimento Humano

### ORDEM DE SERVIÇO / TERMO DE ATENDIMENTO
*Documento acessório ao Contrato de Prestação de Serviços PJ–PJ — Cláusula 5ª-A*

Emitida a cada novo paciente atribuído a um profissional. Cada Ordem de Serviço é um documento à parte (uma por paciente/atendimento), numerada sequencialmente, e depende de aceite da CONTRATADA para produzir efeitos.

| Campo | Preenchimento |
|---|---|
| Ordem de Serviço nº | `{{OS_NUMERO}}` / vinculada ao Contrato nº `{{CONTRATO_NUMERO}}` de `{{CONTRATO_DATA}}` |
| CONTRATANTE | `{{CONTRATANTE_RAZAO_SOCIAL}}` |
| CONTRATADA | `{{CONTRATADA_RAZAO_SOCIAL}}` |
| Profissional executor indicado | `{{PROFISSIONAL_NOME}}` / `{{PROFISSIONAL_REGISTRO_CONSELHO}}` |
| Paciente / código interno do paciente | `{{PACIENTE_CODIGO}}` |
| Serviço / especialidade | `{{ESPECIALIDADE_SERVICO}}` |
| Data de início prevista | `{{DATA_INICIO_PREVISTA}}` |
| Duração estimada | `{{DURACAO_ESTIMADA}}` (estimativa clínica, não obrigação de prazo) |
| Frequência estimada | `{{FREQUENCIA_ESTIMADA}}` |
| Módulo(s) Assistencial(is) vinculado(s) | `{{MODULOS_VINCULADOS}}` |
| Composição do Módulo Assistencial | até `{{ATENDIMENTOS_POR_MODULO}}` atendimentos + registro em prontuário + documentação técnica protocolada (Cláusula 6ª, item 6.1, do contrato-quadro) |
| Preço por Módulo Assistencial entregue | `{{VALOR_MODULO}}` |
| Local de execução | `{{LOCAL_EXECUCAO}}` |

**Termo de aceite:** "Declaro ter recebido e aceitado voluntariamente esta Ordem de Serviço, ciente de que posso recusá-la, no todo ou em parte, ou solicitar seu encerramento antecipado a qualquer tempo, nos termos da Cláusula 5ª-A do contrato-quadro, sem necessidade de justificativa e sem qualquer penalidade. Declaro, ainda, estar ciente de que o preço acima remunera a entrega do Módulo Assistencial — atendimentos realizados, registrados em prontuário e documentados tecnicamente — e não tempo de permanência ou disponibilidade, não havendo valor mínimo mensal garantido nem obrigação de aceitar qualquer quantidade de módulos."

```
Data: ____/____/______        Assinatura da CONTRATADA: ___________________________________
Data: ____/____/______        Assinatura da CONTRATANTE: __________________________________
```

---

## 4. Variáveis de preenchimento

### 4.1. Contrato-quadro

| Variável | Descrição |
|---|---|
| `{{CONTRATANTE_RAZAO_SOCIAL}}` | razão social da clínica contratante |
| `{{CONTRATANTE_CNPJ}}` | — |
| `{{CONTRATANTE_ENDERECO}}` | — |
| `{{CONTRATANTE_REPRESENTANTE_NOME}}` | representante legal da contratante |
| `{{CONTRATADA_RAZAO_SOCIAL}}` | razão social da PJ do profissional |
| `{{CONTRATADA_CNPJ}}` | — |
| `{{CONTRATADA_ENDERECO}}` | — |
| `{{PROFISSIONAL_NOME}}` | sócio(a)/titular executor(a) do serviço |
| `{{PROFISSIONAL_REGISTRO_CONSELHO}}` | ex.: "CRP 09/12345", "CREFONO 4-98765" |
| `{{ESPECIALIDADE_SERVICO}}` | ex.: "Psicologia — Análise do Comportamento Aplicada (ABA)" |
| `{{VALOR_MODULO}}` | R$ por Módulo Assistencial efetivamente entregue |
| `{{ATENDIMENTOS_POR_MODULO}}` | nº de atendimentos que compõem um módulo |
| `{{PRAZO_DOC_DIAS}}` | prazo, em dias, para entrega da documentação técnica |
| `{{PERCENTUAL_NOSHOW}}` | % de compensação por esvaziamento do módulo (ou "não aplicável") |
| `{{PRAZO_PAGAMENTO_DIAS}}` | prazo em dias para pagamento após emissão da NFS-e |
| `{{REGIME_TRIBUTARIO_CONTRATADA}}` | ex.: "Simples Nacional" |
| `{{DATA_INICIO_VIGENCIA}}` | início do contrato |
| `{{DATA_ASSINATURA}}` | data da assinatura (bloco final) |

### 4.2. Ordem de Serviço

`{{OS_NUMERO}}`, `{{CONTRATO_NUMERO}}`, `{{CONTRATO_DATA}}`, `{{CONTRATANTE_RAZAO_SOCIAL}}`, `{{CONTRATADA_RAZAO_SOCIAL}}`, `{{PROFISSIONAL_NOME}}`, `{{PROFISSIONAL_REGISTRO_CONSELHO}}`, `{{PACIENTE_CODIGO}}`, `{{ESPECIALIDADE_SERVICO}}`, `{{DATA_INICIO_PREVISTA}}`, `{{DURACAO_ESTIMADA}}`, `{{FREQUENCIA_ESTIMADA}}`, `{{MODULOS_VINCULADOS}}`, `{{VALOR_MODULO}}` (opcional — se ausente, escrever "conforme Cláusula 6ª do contrato-quadro"), `{{ATENDIMENTOS_POR_MODULO}}` (opcional), `{{LOCAL_EXECUCAO}}`.

---

## 5. Regras para o sistema que gerar estes documentos

1. Substituir **apenas** o que está entre `{{ }}`. Todo o restante é texto fixo e validado — não reescrever, resumir, reordenar, acrescentar nem remover cláusulas, títulos ou frases.
2. Dado ausente ⇒ escrever `[PENDENTE: <nome da variável>]` no lugar e listar todos ao final, em uma seção **"⚠ CAMPOS PENDENTES"**. Nunca inventar paciente, valor ou data.
3. **Nunca** enfraquecer as cláusulas de proteção — **2ª, 3ª, 5ª, 5ª-A, 6ª e 12ª** (autonomia, não exclusividade, ausência de subordinação, preço por módulo entregue, vedação de vínculo).
4. Entrada que contradiga o modelo — "pagar por hora", "pagar por turno de presença", "pagar sem atendimento realizado", "mínimo mensal garantido", "exclusividade", "horário fixo", "descontar atrasos", "controlar ponto" — **não deve ser aplicada**: gerar o documento normalmente e registrar o conflito em "⚠ CAMPOS PENDENTES" para revisão humana.
5. Termos vedados na saída ("turno", "jornada", "escala", "plantão", "carga horária") devem ser convertidos para "Módulo Assistencial" e o ajuste registrado em "⚠ CAMPOS PENDENTES".
6. Numerar as Ordens de Serviço sequencialmente por profissional; nunca repetir número já emitido para o mesmo contrato.
7. Usar o **código interno** do paciente sempre que disponível, evitando expor nome completo fora do prontuário.
8. Toda saída deve terminar lembrando que: **(a)** a minuta precisa de revisão por advogado(a) trabalhista antes de qualquer assinatura, especialmente enquanto o **Tema 1389 do STF (pejotização)** seguir pendente; e **(b)** a eficácia da blindagem depende da execução real do contrato — reproduzir o **Protocolo Operacional da Cláusula 12.3** como checklist de conduta da CONTRATANTE.

---

> ⚠️ **Aviso.** Esta minuta e a metodologia aqui descrita devem ser revisadas por advogado(a) trabalhista antes de qualquer assinatura, especialmente enquanto o Tema 1389 do STF (pejotização) seguir pendente de decisão final. A blindagem contratual só é eficaz se a execução cotidiana do contrato observar integralmente o Protocolo Operacional da Cláusula 12.3.
