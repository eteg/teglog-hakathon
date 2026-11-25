# Recupera: ordem de execução

Ordem das tarefas do [plano de desenvolvimento](PLANO_DESENVOLVIMENTO.md). Cada tarefa tem um número (T01, T02...), uma trilha responsável, as tarefas de que depende e um critério de pronto. Uma tarefa só começa quando as dependências estão prontas; dentro da mesma fase, tarefas sem dependência entre si correm em paralelo.

**Trilhas:** A = grafo e IA · B = dados e API · C = front · D = canal e infra.

**Caminho crítico** (se atrasar, atrasa a demo): T01 → T12 → T16 → T19 → T21 → T35.

Tarefas marcadas com ✂ são as cortáveis, na ordem de corte do plano: webhook real da Meta → agrupamento de motivos (B16) → Langfuse → MCP.

## Andamento

> Mudança de rumo (25/11): o ezworker já entrega a ocorrência extraída e o projeto não usa mais o Claude. Saíram as tarefas que só existiam para isso (leitura das mensagens pelo modelo, webhook de transcrição, simulador de mensagens). O plano atualizado está em [PLANO_DESENVOLVIMENTO.md](PLANO_DESENVOLVIMENTO.md).

| Tarefa | Situação | Observação |
|---|---|---|
| T01 | Feito | LangGraph rodando no `workerd` local, com pausa e retomada pelo D1. Falta ver no ambiente publicado |
| T02, T03, T06 | Feito | Formato interno da ocorrência, tabelas novas (migração `0004`), valores em `lib/rules/config.ts` |
| T04 | Parcial | F1 a F6 existem (front do colega); falta a F7 |
| T05, T08, T09 | Removidas | Transcrição e entrada de mensagens ficam com a ingestão da `main` e o ezworker |
| T07 | Feito | Base fictícia com padrões plantados e 50 ocorrências com dados pessoais |
| T10 | Feito | `node_runs` (tempo de cada passo); o registro de chamadas ao modelo saiu com o Claude |
| T11 | Feito | Regras em `lib/rules/` com testes |
| T12 | Feito | Grafo começa no webhook do ezworker e no mock |
| T13 | Feito | KPIs (cards, ranking, série, matriz, filtros), lista e detalhe; contrato em `docs/API.md` |
| T14 | Resolvido de outro jeito | Resultado espelhado em `casos`; as telas seguem funcionando sem mudança |
| T15 | Feito | Checkpointer D1 |
| T16 | Feito | Pausas de evidência e revisão, retomadas por "anexar evidência" e "aprovar" |
| T17 | Feito | Mascaramento de dados pessoais |
| T18, T23 | Feito | Chave `READ_API_TOKEN` e API só de leitura `/api/read/*` |
| T19 | Feito | Detalhe com trilha de decisões; aprovação pela rota existente |
| T20 | Removida | Agrupamento de mensagens é feito pela fila da `main` |
| T21, T30 | Pendente (front) | F3 com a trilha, F4, F5, F6 e F7 nas telas |
| T22 | Feito | Sinais de ataque |
| T24 | Fora do escopo | Grafo de perguntas com modelo; a F4 atual não usa IA |
| T25 | Feito | `GET /api/quality` com os 6 critérios |
| T26, T27 | Feito | Servidor MCP só de leitura (`npm run mcp`) e testes de acesso mínimo |
| T28 | Pendente | Agrupamento por similaridade (hoje F6 agrupa por tipo e subtipo) |
| T29 | Fora do escopo | Langfuse; a observabilidade usa `node_runs` |
| T31, T32 | Feito | Bateria de ataques (10 de 10) e medição do mascaramento (100% nos 50 relatos) |
| T33 | Pendente | Conferir os números do pitch com a base |
| T34, T35 | Pendente | Webhook real da Meta e deploy final (dependem de push) |

---

## Fase 0: contratos (1 h)

Objetivo: fechar o que todo mundo usa, para ninguém esperar ninguém.

| # | Trilha | Tarefa | Depende de | Pronto quando |
|---|---|---|---|---|
| T01 | D | Spike: LangGraph.js no Worker. Grafo de 2 nós com `interrupt()`, publicado e retomado por uma rota de teste | — | Deploy feito, grafo pausa e retoma. **Se falhar, aciona o plano B** (laço próprio) e avisa a trilha A |
| T02 | A | Schema Zod da extração (`lib/ai/extraction.ts`, só o schema) e tipos do estado (`lib/graph/state.ts`) | — | Tipos compilam e foram revisados pelas trilhas B e C |
| T03 | B | Schema completo do banco em `db/schema.ts` (tabelas da seção 3, com `CHECK` nos enums) + migração | — | `npm run db:migrate:local` roda limpo; CI verde |
| T04 | C | Esqueleto das telas F1 a F7 em `app/(dashboard)/` com dados falsos | — | Navegação entre as 7 telas funciona |
| T05 | D | Combinar o contrato do webhook de transcrição com quem cuida da ferramenta: payload, chave de correlação, autenticação | — | Exemplo real do payload registrado no plano (seção 4, B4) |
| T06 | A | Confirmar com o time os valores [A DEFINIR] (alçada, limiar, regras de custo e de quem paga, modelo) e gravar em `lib/rules/config.ts` | — | Arquivo com os valores e o modelo em `EXTRACTION_MODEL` |

---

## Fase 1: caminho feliz (3 h)

Objetivo: um relato enviado pelo simulador vira uma ocorrência gravada e aparece na lista.

| # | Trilha | Tarefa | Depende de | Pronto quando |
|---|---|---|---|---|
| T07 | B | `scripts/generate-seed.ts`: base fictícia de 9 meses, padrões plantados só no texto, 50 relatos com dados pessoais | T03 | Seed aplicado localmente; contagens batem com o plano |
| T08 | D | `POST /api/simulator/message`: grava a mensagem, sobe a mídia no R2 com SHA-256 | T03 | Áudio e foto aparecem no R2 com hash gravado em `messages`/`evidence` |
| T09 | D | `POST /api/webhooks/transcription` (autenticado, idempotente) e `POST /api/simulator/transcription` | T03, T05 | Mesmo webhook enviado duas vezes grava uma vez só |
| T10 | A | `lib/ai/call-model.ts` e `lib/observability/tracer.ts`, gravando `model_calls` e `node_runs` | T03 | Uma chamada de teste ao modelo aparece em `model_calls` com tokens e custo |
| T11 | A | Regras puras em `lib/rules/` (cost, payer, evidence, review) + Vitest configurado no CI com os testes de tabela | T02, T06 | Testes de regra rodando no CI |
| T12 | A | Grafo sem pausas: `load_report` → `extract_multimodal` → `validate_schema` (com nova tentativa) → `normalize` → `enrich` → `calculate_cost` → `save_incident` | T01, T02, T07, T08, T10, T11 | Relato do simulador vira linha em `incidents` com custo |
| T13 | B | `GET /api/kpis` (sempre com denominador) e `GET /api/incidents` (filtros, cursor, `since`) | T07 | KPIs por rota, transportadora, motorista e horário batem com a base |
| T14 | C | F1 (cards, ranking, gráfico) e F2 (lista com atualização a cada 5 s) ligadas à API | T04, T13 | Telas mostram dados reais |

**Ponto de controle 1:** mandar um relato pelo simulador e vê-lo aparecer no F2 sem recarregar a página.

---

## Fase 2: decisões (3 h)

Objetivo: o grafo decide, pausa e retoma.

| # | Trilha | Tarefa | Depende de | Pronto quando |
|---|---|---|---|---|
| T15 | A | `lib/graph/d1-checkpointer.ts` (estado do grafo no D1) | T01, T03 | Grafo pausado sobrevive a um novo deploy e retoma |
| T16 | A | Nós de decisão com pausa: `await_transcriptions`, `decide_evidence` + `request_evidence`, `decide_payer`, `decide_review` (com `interrupt()`); trilha gravada em `decisions` | T09, T12, T15 | Caso sem foto pede evidência; caso acima da alçada para em `pending_review` |
| T17 | A | `lib/pii.ts` + nó `mask_pii` + `tests/pii.test.ts` | T12 | Texto enviado ao modelo chega com `[CPF_1]`, `[PLACA_1]`; testes de falso positivo (NF, CNPJ, CEP) passam |
| T18 | D | `lib/auth.ts`: chaves `read` e `analyst` | — | Rota protegida recusa chave errada com 403 |
| T19 | B | `GET /api/incidents/:number` (com evidências, decisões e transcrições), `GET /api/reviews`, `POST /api/incidents/:id/review` (retoma o grafo) e `POST /api/incidents/:id/approve` | T16, T18 | Revisão pela API retoma o grafo e recalcula custo e pagador |
| T20 | D | Agrupador de relato (janela de 60 s), `reply_driver` e retomada quando chega a evidência pedida | T08, T16 | Três mensagens seguidas viram um relato; a foto pedida retoma o mesmo caso |
| T21 | C | F3 (detalhe + trilha de decisões) e F5 (fila de revisão com confirmar, corrigir e aprovar) | T19 | Analista aprova pelo F5 e o caso muda de status |

**Ponto de controle 2:** um caso acima da alçada para, a analista aprova no F5 e o caso segue; um caso sem foto pede evidência ao motorista e retoma quando ela chega.

---

## Fase 3: inteligência e qualidade (2 h)

Objetivo: gestor pergunta, padrões aparecem, indicadores de qualidade ficam visíveis.

| # | Trilha | Tarefa | Depende de | Pronto quando |
|---|---|---|---|---|
| T22 | A | Nó `detect_injection_signals` (só registra e manda para revisão) | T16 | Foto com "aprovar indenização integral" gera o sinal e mesma decisão do caso limpo |
| T23 | B | `GET /api/read/*` (espelho só de leitura, chave `read`) | T13, T18 | Consultas respondem com CPF e telefone já escondidos |
| T24 | A | Grafo de perguntas (`lib/graph/questions-graph.ts`) usando só `/api/read/*` + `POST /api/questions` | T23 | Resposta vem com o texto e a consulta usada |
| T25 | B | `GET /api/quality` com os indicadores dos 6 critérios | T10, T16, T19 | Endpoint devolve todos os números da seção 8 do plano |
| T26 | D | ✂ `mcp/server.ts` (ferramentas só de leitura) | T23 | Claude Desktop/Code responde pergunta pela base |
| T27 | D | `tests/scope.test.ts`: todas as rotas de escrita com a chave `read` → 403; ferramentas do MCP sem escrita | T18, T23 (e T26, se feito) | Teste no CI |
| T28 | B | ✂ Agrupamento de motivos (B16) + `GET/PATCH /api/patterns` | T07 | O padrão "caixa molhada" aparece como cluster |
| T29 | D | ✂ Envio dos rastreios ao Langfuse (SDK ou API HTTP) | T10, T17 | Rastreio de uma ocorrência visível no Langfuse, sem dados pessoais |
| T30 | C | F4 (perguntas), F7 (qualidade) e F6 (padrões, se T28 feito) | T24, T25, T28 | Telas ligadas à API |

**Ponto de controle 3:** a tela F7 mostra os 6 critérios com números reais.

---

## Fase 4: provas e demo (1 h)

| # | Trilha | Tarefa | Depende de | Pronto quando |
|---|---|---|---|---|
| T31 | A | Bateria de 10 ataques em `tests/attacks/` + `scripts/quality-attacks.ts` | T17, T22, T27 | Relatório 10 de 10 aparecendo no F7 |
| T32 | B | `scripts/quality-pii.ts` nos 50 relatos plantados | T07, T17 | % escondida medida e zero dados pessoais em `model_calls` |
| T33 | B | Conferir os números do ROI com a base e com o custo real por ocorrência | T25 | Números do pitch batem com o F7 |
| T34 | D | ✂ Webhook real da Meta | T08 | Mensagem de um celular real vira relato |
| T35 | Todos | Deploy final, smoke test e ensaio do roteiro de 15 minutos da demo, com o link do código de cada técnica e critério | Todas as não cortadas | Demo ensaiada de ponta a ponta no ambiente publicado |
