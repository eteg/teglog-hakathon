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

# Portal de ocorrências (Recupera)

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
