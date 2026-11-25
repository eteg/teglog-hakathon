# Recupera: API para o front

Contrato dos endpoints novos (dados do grafo e gráficos). Todos respondem JSON, sem cache. Parâmetros inválidos voltam com `400` e a lista do que está errado.

## Filtros comuns dos KPIs (F1)

Aceitos por todas as rotas `/api/kpis*`:

| Parâmetro | Tipo | Exemplo |
|---|---|---|
| `route` | id da rota | `1` |
| `carrier` | id da transportadora | `2` |
| `driver` | id do motorista | `7` |
| `hour` | 0 a 23 | `19` |
| `from`, `to` | data `AAAA-MM-DD`, `to` inclusivo | `2026-03-01` |
| `type` | `damage`, `loss`, `refusal`, `redelivery`, `discrepancy`, `accident`, `delay` | `damage` |

Toda taxa é dividida pelo volume de entregas do mesmo filtro, para quem transporta mais não parecer pior.

## F1: painel do gestor

### `GET /api/kpis/summary`
Os quatro cards.

```json
{
  "deliveries": 14644, "incidents": 646, "incidentsPer1000": 44.1,
  "cost": 1965139.35, "costPerDelivery": 134.19,
  "insuranceCost": 1739349.56, "lossRatio": 0.01347, "totalRiskCost": 3704488.91,
  "topRoute": { "key": "10", "label": "Curitiba → Joinville", "cost": 275309.41, "costPerDelivery": 191.85 },
  "routesWithIncidents": 10
}
```

| Card | Campo |
|---|---|
| Custo por rota | `topRoute` (e o ranking abaixo) |
| Custo por entrega | `costPerDelivery` |
| Índice de perda | `lossRatio` (custo das ocorrências ÷ valor transportado) |
| Custo total de risco | `totalRiskCost` (ocorrências + seguro pago no frete) |

### `GET /api/kpis?dimension=route|carrier|driver|hour`
Ranking, ordenado por custo. Cada linha: `key`, `label`, `deliveries`, `incidents`, `incidentsPer1000`, `cost`, `costPerDelivery`, `insuranceCost`, `lossRatio`, `totalRiskCost`.

### `GET /api/kpis/timeseries?dimension=route&granularity=month|week&metric=cost|incidentsPer1000|costPerDelivery&top=5`
Gráfico: as `top` chaves de maior custo, um valor por período.

```json
{ "metric": "cost", "granularity": "month", "periods": ["2026-03", "2026-04"],
  "series": [{ "key": "1", "label": "São Paulo → Curitiba", "values": [31200.5, 18400] }] }
```

### `GET /api/kpis/matrix?rows=route&cols=carrier`
Grade (ex.: rota × transportadora): `rows`, `columns` (`key`, `label`) e `cells` (`row`, `col`, `deliveries`, `incidents`, `incidentsPer1000`, `cost`). Célula sem entregas não aparece.

### `GET /api/kpis/filters`
Opções dos filtros: `routes`, `carriers`, `drivers` (`id`, `name`), `hours` e `period` (`from`, `to`) coberto pela base.

## F2: lista de ocorrências

### `GET /api/incidents?status=&type=&route=&carrier=&cursor=&limit=50`
`{ data: [...], nextCursor }`. Cada item: `id`, `number`, `type`, `status`, `reasonText` (já mascarado), `cost`, `insuranceCost`, `payer`, `claimDeadline`, `confidence`, `occurredAt`, `createdAt`, `source`, `invoiceNumber`, `route`, `carrier`.

### Atualização sozinha durante a demo
`GET /api/incidents?since=<createdAt mais recente que a tela já tem>` a cada 5 s.

## F3: detalhe

### `GET /api/incidents/:number` (ex.: `OC-1047`)
Campos da ocorrência, mais:
- `graph.decisions`: a trilha "por que o sistema decidiu isso" (`node`, `rule`, `reason`, `at`);
- `graph.pausedAt` / `graph.pausedLabel`: onde o grafo está esperando (revisão ou evidência) ou `null`;
- `graph.processingMs` e `graph.steps`: tempo de cada passo do grafo (observabilidade);
- `case`: o caso da primeira versão do app, com evidências (hash SHA-256, data), transcrição e confiança por campo.

## Ações que retomam o grafo

As telas atuais continuam usando as rotas que já existiam; o grafo foi ligado a elas:

| Ação na tela | Rota existente | O que acontece no grafo |
|---|---|---|
| Aprovar | `POST /api/ocorrencias/:id` `{ "acao": "aprovar" }` | Retoma a pausa de revisão com os campos como a analista deixou; refaz NF, custo e pagador |
| Anexar evidência | `POST /api/ocorrencias/:id/evidencias` | Quando não falta mais nada, retoma a pausa de evidência |

## Grafo

### `GET /api/graph/diagram`
O grafo em Mermaid, gerado do próprio código. Para a parte "por dentro" da demo.
