# Reporta

Next.js 16 rodando em **Cloudflare Workers** (via [OpenNext](https://opennext.js.org/cloudflare)) com banco **Cloudflare D1** (SQLite) acessado por **Drizzle ORM** e arquivos no **Cloudflare R2**.

## Ambientes

Um único ambiente na Cloudflare (Worker `reporta`, D1 `reporta`, bucket R2 `reporta`), publicado a cada push na `main`. Localmente D1 e R2 são emulados (miniflare, em `.wrangler/`). Tudo é definido em [wrangler.jsonc](wrangler.jsonc); os bindings são `DB` (banco) e `BUCKET` (arquivos).

## Desenvolvimento local

```bash
npm install
npm run db:migrate:local   # cria as tabelas no D1 local
npm run dev                # http://localhost:3000  (health: /api/health)
npm run preview            # build real do Worker rodando no workerd local
```

## Banco de dados (D1 + Drizzle)

- Schema: [db/schema.ts](db/schema.ts)
- Client: `getDb()` em [lib/db.ts](lib/db.ts) (apenas server-side)
- Migrações SQL: [db/migrations/](db/migrations/)

Fluxo para alterar o banco:

```bash
# 1. edite db/schema.ts
npm run db:generate        # gera o SQL em db/migrations
npm run db:migrate:local   # aplica localmente
# 2. commite db/schema.ts + db/migrations — o CI falha se esquecer
```

As migrações remotas são aplicadas automaticamente pelo deploy. Manualmente: `npm run db:migrate:remote`.

Exemplo de uso:

```ts
import { getDb } from "@/lib/db";
import { reports } from "@/db/schema";

const db = await getDb();
const rows = await db.select().from(reports);
```

## Arquivos (R2)

- Client: `getBucket()` em [lib/storage.ts](lib/storage.ts) (apenas server-side)
- Upload: `POST /api/files` (multipart, campo `file`, até 10 MB) → `{ key, url }`
- Download: `GET /api/files/<key>`

```bash
curl -F file=@foto.jpg http://localhost:3000/api/files
```

```ts
import { getBucket } from "@/lib/storage";

const bucket = await getBucket();
await bucket.put("uploads/a.txt", "conteúdo");
const obj = await bucket.get("uploads/a.txt");
```

Guarde a `key` no D1 (ex.: coluna `attachment_key` em `reports`) para vincular o arquivo ao registro.

Após mudar bindings/vars no `wrangler.jsonc`, rode `npm run cf-typegen` para atualizar [cloudflare-env.d.ts](cloudflare-env.d.ts).

## CI/CD (GitHub Actions)

- **[CI](.github/workflows/ci.yml)** — em PRs para `main`: lint, typecheck, verifica se as migrações estão em sincronia com o schema, aplica as migrações num D1 limpo e faz o build do Worker.
- **[Deploy](.github/workflows/deploy.yml)** — push em `main` (ou *Run workflow* manual): lint/typecheck → build → migrações D1 remotas → deploy → smoke test em `/api/health`.

## Setup inicial (uma vez)

1. **Criar o banco D1** (precisa de `npx wrangler login`):
   ```bash
   npx wrangler d1 create reporta
   ```
   Copie o `database_id` para o `wrangler.jsonc` (no lugar de `REPLACE_WITH_D1_ID`) e commite.

2. **Criar o bucket R2** (habilite o R2 antes em *Dashboard → R2 Object Storage*):
   ```bash
   npx wrangler r2 bucket create reporta
   ```

3. **Criar um API token** na Cloudflare (*My Profile → API Tokens → Create Token*, template **Edit Cloudflare Workers** + permissões **Account → D1 → Edit** e **Account → Workers R2 Storage → Edit**).

4. **No GitHub** (*Settings → Secrets and variables → Actions*):
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
   - Variable opcional `APP_URL` (ex.: `https://reporta.<subdominio>.workers.dev`) para habilitar o smoke test.

## Observações

- Cache: [open-next.config.ts](open-next.config.ts) usa o cache de static assets (serve o que foi pré-renderizado, sem revalidação). Se precisar de ISR/`revalidate`, troque por R2 ou KV ([docs](https://opennext.js.org/cloudflare/caching)).
- Segredos locais: copie `.dev.vars.example` para `.dev.vars`. Remotos: `npx wrangler secret put NOME`.
- Se o `next dev` reclamar de módulos de fonte após um `npm run preview`, apague `.next/`.

---

# Portal de ocorrências (teglog)

Portal onde o **cliente da transportadora** acompanha as ocorrências da carga dele.

## Fluxo

```
motorista/transportadora ──áudio/foto/texto──▶ ezworker (/ezworker/audio | /image | /text)
                                                   │  JSON da ocorrência
                                                   ▼
                              POST /api/webhook/ezworker  (este app)
                                                   │  regras de cobertura + prazo + devolutiva
                                                   ▼
                              D1 (tabela casos) ─▶ fila (atualiza a cada 5 s) ─▶ página do caso ─▶ resposta do cliente
```

## Rodar

```bash
npm install
npm run db:migrate:local   # cria as tabelas no D1 local
npm run dev                # http://localhost:3000
```

Sem `CLOUDFLARE_API_TOKEN`, o `next dev` usa D1 e R2 emulados (bindings `"remote": true` ficam desligados; ver `next.config.ts`).

Na fila, o botão **Simular webhook (demo)** injeta uma ocorrência no formato do ezworker.

## Contrato do webhook

`POST /api/webhook/ezworker` com JSON (direto ou embrulhado em `{ "data": ... }`).
Header opcional `x-webhook-secret` quando `EZWORKER_WEBHOOK_SECRET` estiver definido.

```json
{
  "canal": "image",                       // audio | image | video | text
  "tipo": "avaria",                       // avaria | recusa | reentrega | extravio | atraso | acidente
  "subtipo": "embalagem_violada",
  "gravidade": "alta",                    // baixa | media | alta
  "nf": "000123456",
  "transportadora": "Transportadora Beta",
  "produto": "eletrônico",
  "volumes_afetados": 2,
  "resumo": "Duas caixas de TV com embalagem rasgada",
  "transcricao": "texto do áudio, se houver",
  "evidencias": [{ "tipo": "foto_avaria", "legivel": true, "url": "https://..." }],
  "faltando": ["foto da etiqueta"],
  "confianca": { "tipo": 0.94, "nf": 0.71 },
  "instrucoes_ignoradas": ["aprovar indenização integral"],
  "contexto": {
    "valor_nf": 18450,
    "apolice": { "franquia": 2000, "cobre_descarga": false },
    "rota": "São Paulo → Manaus",
    "cliente": "Loja Eletro Norte",
    "prazo_prometido": "2026-11-28",
    "prazo_protesto": "2026-12-05"
  }
}
```

Obrigatórios: `canal`, `tipo`, `subtipo`. Resposta `201 { id, status, pagador }` ou `422` com os erros de schema.

### Mídias das evidências (R2)

Cada item de `evidencias` pode trazer o arquivo de duas formas; o app copia para o R2 em
`evidencias/<caso>/<uuid>.<ext>`, calcula o SHA-256 e passa a servir por `/api/files/<key>`:

- `"url": "https://..."`: o app baixa (até 10 MB, timeout de 15 s);
- `"conteudo_base64": "...", "content_type": "image/jpeg", "nome_arquivo": "foto.jpg"`: o base64 não é gravado no D1.

Campos opcionais: `hash` (SHA-256 do ezworker; se divergir do calculado, fica registrado) e `capturada_em`.
Falha ao copiar não derruba o webhook: a evidência mantém a URL e ganha `erro_armazenamento`.
SVG/HTML são recusados (poderiam executar script servidos pelo próprio domínio).

Pela tela do caso, o cliente anexa evidências: `POST /api/ocorrencias/<id>/evidencias`
(multipart: `file`, `tipo`, `resolve` opcional com o nome da pendência que o arquivo resolve).

### Rotas do contrato front ↔ back

| Chamada | Rota |
|---|---|
| Listar ocorrências (filtros, ordenação, paginação) | `GET /api/ocorrencias?q&tipo&status&transportadora&motorista&rota&situacao&ordenar&direcao&page&pageSize` |
| Buscar uma ocorrência | `GET /api/ocorrencias/<id>` |
| Ações (aprovar, responder, encerrar, confirmar/corrigir campo) | `POST /api/ocorrencias/<id>` |
| Anexar evidência | `POST /api/ocorrencias/<id>/evidencias` |
| Fila de revisão | `GET /api/revisao` |
| Pergunta do gestor | `POST /api/perguntas { pergunta }` |
| Padrões emergentes / dar nome | `GET /api/padroes`, `PUT /api/padroes/<chave> { nome }` |
| Indicadores por dimensão (F1) | pendente: aguarda a integração do back |

### Mock do ezworker (até a integração real)

O botão **Simular ezworker** (tela de ocorrências) e as rotas abaixo devolvem o JSON que o
ezworker mandaria e o entregam no mesmo fluxo do webhook (schema → regras → D1/R2).
Catálogo de cenários em [lib/mock-ezworker.ts](lib/mock-ezworker.ts).

| Rota | O que faz |
|---|---|
| `GET /api/mock/ezworker` | Lista os cenários com um exemplo do JSON de cada (bom para conferir o contrato) |
| `POST /api/mock/ezworker/<audio\|image\|video\|text>` | Multipart: `arquivo` (opcional, vai para o R2), `texto`, `cenario` (id), `entregar=false` para só ver o JSON |
| `POST /api/simular` | Sorteia um cenário e entrega |

```bash
curl -F "arquivo=@audio.ogg;type=audio/ogg" -F cenario=acidente-rota http://localhost:3000/api/mock/ezworker/audio
```

Quando o ezworker real existir, ele chama `POST /api/webhook/ezworker` e o mock pode ser removido.

## Onde está cada coisa

- `lib/types.ts`: contrato da ocorrência
- `lib/regras.ts`: regras de cobertura (quem arca), prazo do art. 754, texto da devolutiva
- `lib/store.ts`: casos no D1 (tabela `casos` em `db/schema.ts`); semeia os exemplos quando o banco está vazio
- `lib/padroes.ts`: base sintética e cálculo por mil entregas do painel
- `app/api/webhook/ezworker`: recebe o JSON do ezworker

## Design system

Segue o padrão do `mca-refactor` (shadcn new-york, base neutral, lucide):

- `components/ui/*`: primitivos shadcn copiados do mca-refactor
- `components/table`, `components/card-list`, `components/dynamic-list.tsx`: listagem responsiva (tabela no desktop, accordion abaixo do breakpoint `desktop` de 56rem), ordenação `null → asc → desc → null`
- `components/page-header.tsx`: `PageHeader` + `PageContainer`
- `components/app-layout/*`: header verde + sidebar recolhível
- Tokens de tema em `app/globals.css` (mesmos do `index.css` do mca-refactor)


## Critérios de qualidade (tela `/qualidade`)

### Login (JWT)
Login simples em `/login`, **mockado: usuário `teglog`, senha `teglog`** (se `AUTH_USUARIO`, `AUTH_SENHA` e
`JWT_SECRET` existirem no ambiente, têm prioridade). Gera um JWT HS256 guardado em cookie `httpOnly` por 8 h. O [middleware.ts](middleware.ts) manda quem
não tem token válido para `/login`; as rotas da API aceitam o JWT do cookie ou a `x-api-key`.

> Fica em `middleware.ts` (e não `proxy.ts`, o nome novo do Next 16) porque o proxy só roda em Node.js,
> experimental no Cloudflare/OpenNext; o Next orienta manter `middleware` para o runtime Edge.

Para sair do mock (recomendado antes de expor o Worker):

```bash
npx wrangler secret put JWT_SECRET     # openssl rand -hex 32
npx wrangler secret put AUTH_USUARIO
npx wrangler secret put AUTH_SENHA
```

### 4. Acesso mínimo
A API exige login (cookie JWT) ou uma chave no header `x-api-key`:

| Chave | Pode | Quem usa |
|---|---|---|
| `READ_API_KEY` | só consultar (GET e a pergunta do gestor) | assistente do gestor, integrações de leitura |
| `ANALYST_API_KEY` | consultar e alterar (aprovar, corrigir, responder, anexar, enviar arquivo) | analista, scripts internos |

Com a chave de leitura, toda rota que altera dados responde **403**; sem chave, **401**. CPF, telefone e
placa saem mascarados nas respostas para a chave de leitura. Matriz em [lib/permissoes.ts](lib/permissoes.ts).

```bash
openssl rand -hex 24   # gere as duas chaves
# local: .dev.vars (veja .dev.vars.example) · Worker: npx wrangler secret put READ_API_KEY / ANALYST_API_KEY
curl -H "x-api-key: $READ_API_KEY" http://localhost:3000/api/ocorrencias
```

### 6. Dados pessoais
CPF (com dígito verificador), telefone, placa e e-mail viram marcadores (`[CPF_1]`) antes de sair para o ezworker
([lib/fila.ts](lib/fila.ts)) e nos logs. O telefone do remetente vai como pseudônimo estável (`tel_…`).
CNPJ, NF e CEP não são escondidos. Código em [lib/pii.ts](lib/pii.ts).

### Testes
`npm test` (também roda no CI): formatos de dados pessoais, amostra de 50 relatos, matriz de acesso e
uma varredura que falha se alguma rota nova da API não verificar o acesso.
