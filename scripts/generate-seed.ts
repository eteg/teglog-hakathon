// T07 / B11: fictitious base for the demo.
// Usage: npm run db:seed:local   (writes db/seed/seed.sql and applies it to the local D1)
//
// - 6 carriers, 10 routes (real IBGE codes), 40 drivers, one policy per carrier
// - 9 months of deliveries (Mar–Nov 2026): the denominator for every KPI
// - ~3.5% of deliveries with an incident; cost and payer computed by lib/rules
// - Pattern 1, planted ONLY in reason_text: wet boxes on São Paulo → Curitiba with
//   Transportadora Beta on rainy days. From September on (after the "action") it fades,
//   while control routes stay the same.
// - Pattern 2: refusals concentrated in evening deliveries (18h–21h).
// - 50 incidents whose free text carries CPF, phone and plate, to measure masking (8.6).
//
// Deterministic: same seed, same file.
import { mkdirSync, writeFileSync } from "node:fs";

import type { Extraction } from "../lib/ai/extraction-schema";
import type { EnrichedDelivery } from "../lib/graph/state";
import { calculateCost } from "../lib/rules/cost";
import { decidePayer } from "../lib/rules/payer";

// ---------------------------------------------------------------------------
// Deterministic random

let seed = 20261125;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));
const digits = (n: number) => Array.from({ length: n }, () => int(0, 9)).join("");

// ---------------------------------------------------------------------------
// Documents with valid check digits

function cnpj(): string {
  const base = `${digits(8)}0001`.split("").map(Number);
  const dv = (nums: number[], weights: number[]) => {
    const r = nums.reduce((s, n, i) => s + n * weights[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, d1, d2].join("");
}

function cpf(): string {
  const base = digits(9).split("").map(Number);
  const dv = (nums: number[]) => {
    const r = (nums.reduce((s, n, i) => s + n * (nums.length + 1 - i), 0) * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  const c = [...base, d1, d2].join("");
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const plate = () =>
  rand() < 0.5
    ? `${pick([...letters])}${pick([...letters])}${pick([...letters])}${int(0, 9)}${pick([...letters])}${int(0, 9)}${int(0, 9)}`
    : `${pick([...letters])}${pick([...letters])}${pick([...letters])}-${digits(4)}`;

// ---------------------------------------------------------------------------
// Reference data

const CARRIERS = [
  "Transportadora Alfa",
  "Transportadora Beta",
  "Rápido Sul Logística",
  "TransMinas Cargas",
  "Expresso Litoral",
  "Via Norte Transportes",
].map((legalName, i) => ({ id: i + 1, legalName, cnpj: cnpj() }));
const BETA = 2;

const CITIES: Record<string, { ibge: string; name: string }> = {
  SAO: { ibge: "3550308", name: "São Paulo" },
  CWB: { ibge: "4106902", name: "Curitiba" },
  RIO: { ibge: "3304557", name: "Rio de Janeiro" },
  BHZ: { ibge: "3106200", name: "Belo Horizonte" },
  POA: { ibge: "4314902", name: "Porto Alegre" },
  FLN: { ibge: "4205407", name: "Florianópolis" },
  SSA: { ibge: "2927408", name: "Salvador" },
  BSB: { ibge: "5300108", name: "Brasília" },
  CPQ: { ibge: "3509502", name: "Campinas" },
  GYN: { ibge: "5208707", name: "Goiânia" },
  JOI: { ibge: "4209102", name: "Joinville" },
};

// [origin, destination, carriers serving it, freight per delivery]
const ROUTE_DEFS: [string, string, number[], number][] = [
  ["SAO", "CWB", [1, 2, 3], 650],
  ["SAO", "RIO", [1, 4, 5], 600],
  ["SAO", "BHZ", [1, 4], 700],
  ["CWB", "FLN", [3, 5], 450],
  ["SAO", "POA", [2, 3], 1_100],
  ["CPQ", "GYN", [4, 6], 900],
  ["RIO", "BHZ", [4, 5], 550],
  ["SAO", "SSA", [6, 1], 1_600],
  ["BHZ", "BSB", [4, 6], 800],
  ["CWB", "JOI", [2, 3], 300],
];
const ROUTES = ROUTE_DEFS.map(([o, d, carriers, freight], i) => ({
  id: i + 1,
  origin: CITIES[o],
  destination: CITIES[d],
  carriers,
  freight,
  name: `${CITIES[o].name} → ${CITIES[d].name}`,
}));
const TREATED_ROUTE = 1; // São Paulo → Curitiba

const FIRST_NAMES = ["João", "Marcos", "Ana", "Paulo", "Rafael", "Edson", "Carla", "Luiz", "Bruno", "Diego", "Sérgio", "Marta", "Rogério", "Fábio", "Tiago", "Vera", "André", "Celso", "Júlio", "Renata"];
const LAST_NAMES = ["Silva", "Souza", "Oliveira", "Lima", "Pereira", "Costa", "Rocha", "Alves", "Gomes", "Ribeiro"];
const DRIVERS = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
  phone: `5511${9}${digits(8)}`,
  cpfMasked: `***.***.***-${digits(2)}`,
  carrierId: (i % CARRIERS.length) + 1,
}));

const POLICIES = CARRIERS.map((c) => ({
  carrierId: c.id,
  policyNumber: `RCTRC-${digits(7)}`,
  deductible: pick([1_500, 2_000, 2_500, 3_000]),
  coversLoadingUnloading: rand() < 0.5,
  adValoremPct: Number(between(0.3, 1.2).toFixed(2)),
  grisPct: 0.3,
}));

const PRODUCTS = ["televisor", "geladeira", "notebook", "sofá", "colchão", "smartphone", "micro-ondas", "pneus", "material de construção", "roupas"];

// ---------------------------------------------------------------------------
// Free-text reasons (no category column: patterns live only here)

const TEXTS = {
  wet: [
    "Cheguei no cliente e {n} caixas de {p} estavam molhadas, a lona do caminhão tinha um furo.",
    "Choveu muito na serra, entrou água pela lona e as caixas de {p} ficaram úmidas.",
    "Caixa de {p} encharcada, papelão desmanchando, cliente fotografou a umidade.",
    "A carga de {p} chegou com umidade, {n} volumes com marca de água por baixo.",
    "Lona furada de novo, molhou {n} caixas de {p} na viagem.",
  ],
  damage: [
    "{n} caixas de {p} amassadas na lateral, produto com a tela trincada.",
    "Volume de {p} chegou com a embalagem rasgada e peça quebrada.",
    "Empilharam peso em cima e esmagou {n} caixas de {p}.",
    "Freada brusca, a carga de {p} correu e {n} volumes bateram na porta.",
  ],
  loss: [
    "Faltaram {n} volumes de {p} na conferência, nota fala {t}.",
    "Cliente contou e veio {n} caixas a menos de {p}.",
  ],
  refusal: [
    "Cliente recusou a entrega, disse que já tinha fechado o recebimento.",
    "Recebedor não aceitou, falou que o horário de recebimento já tinha passado.",
    "Recusado: embalagem com aparência de violada, cliente não quis assinar.",
    "Cliente não estava, portaria não autorizou o recebimento à noite.",
  ],
  redelivery: [
    "Endereço não encontrado, número não existe na rua.",
    "Ninguém para receber, vou ter que voltar amanhã.",
    "Rua bloqueada por obra, não deu para entregar.",
  ],
  discrepancy: [
    "Veio {p} de modelo diferente do que está na nota.",
    "Quantidade na nota diferente do que foi carregado, divergência de {n} itens.",
  ],
  accident: [
    "Tombamento na rodovia, carga de {p} espalhada na pista.",
    "Colisão traseira no trecho de serra, parte da carga avariada.",
  ],
} as const;

function reason(kind: keyof typeof TEXTS, product: string, affected: number, total: number) {
  return pick(TEXTS[kind]).replace("{p}", product).replace("{n}", String(affected)).replace("{t}", String(total));
}

// ---------------------------------------------------------------------------
// Generation

const START = Date.UTC(2026, 2, 1); // 1 Mar 2026
const END = Date.UTC(2026, 10, 24); // 24 Nov 2026
const ACTION_DATE = Date.UTC(2026, 8, 1); // 1 Sep 2026: protection fixed on the treated route
const DAY = 86_400_000;

const rainyDays = new Set<number>();
for (let d = START; d <= END; d += DAY) if (rand() < 0.22) rainyDays.add(d);

type Row = Record<string, string | number | boolean | null>;
const deliveries: Row[] = [];
const incidents: Row[] = [];
const sql = (v: string | number | boolean | null) =>
  v === null ? "null" : typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "1" : "0") : `'${v.replace(/'/g, "''")}'`;

let deliveryId = 0;
let incidentSeq = 0;

for (let day = START; day <= END; day += DAY) {
  const rainy = rainyDays.has(day);
  const perDay = int(45, 65);
  for (let k = 0; k < perDay; k++) {
    const route = pick(ROUTES);
    const carrierId = pick(route.carriers);
    const driver = pick(DRIVERS.filter((d) => d.carrierId === carrierId).length ? DRIVERS.filter((d) => d.carrierId === carrierId) : DRIVERS);
    const policy = POLICIES[carrierId - 1];
    const invoiceValue = Math.round(Math.exp(between(Math.log(800), Math.log(40_000))) * 100) / 100;
    const volumes = int(1, 20);
    const hour = rand() < 0.2 ? int(18, 21) : int(7, 17);
    const departed = new Date(day - DAY + int(4, 10) * 3_600_000);
    const delivered = new Date(day + hour * 3_600_000 + int(0, 59) * 60_000);
    const freightCost = Math.round(route.freight * between(0.85, 1.2) + invoiceValue * 0.01);
    const insuranceCost = Math.round(invoiceValue * ((policy.adValoremPct + policy.grisPct) / 100) * 100) / 100;
    const id = ++deliveryId;
    const invoiceNumber = String(100_000 + id).padStart(9, "0");

    deliveries.push({
      id,
      nfe_key: `35${digits(42)}`,
      invoice_number: invoiceNumber,
      invoice_value: invoiceValue,
      volumes,
      route_id: route.id,
      carrier_id: carrierId,
      driver_id: driver.id,
      departed_at: departed.toISOString(),
      delivered_at: delivered.toISOString(),
      freight_cost: freightCost,
      insurance_cost: insuranceCost,
    });

    // Incident probability and kind
    const planted = route.id === TREATED_ROUTE && carrierId === BETA && rainy;
    const plantedRate = day < ACTION_DATE ? 0.35 : 0.04;
    const evening = hour >= 18;
    let kind: keyof typeof TEXTS | null = null;
    if (planted && rand() < plantedRate) kind = "wet";
    else if (evening && rand() < 0.06) kind = "refusal";
    else if (rand() < 0.03) kind = pick(["damage", "damage", "loss", "refusal", "redelivery", "redelivery", "discrepancy", "accident"] as const);
    if (!kind) continue;

    const type: Extraction["type"] = kind === "wet" ? "damage" : kind;
    const product = pick(PRODUCTS);
    const affected = Math.max(1, Math.min(volumes, int(1, 4)));
    const extraction = {
      type,
      affected_volumes: type === "damage" || type === "loss" ? affected : null,
      total_volumes: volumes,
      discrepancy_value: type === "discrepancy" ? Math.round(invoiceValue * between(0.03, 0.2)) : null,
      damage_visible_at_delivery: true,
      packaging_inadequate: kind === "damage" && rand() < 0.15,
      during_loading_unloading: kind === "damage" && rand() < 0.2,
    };
    const enriched: EnrichedDelivery = {
      deliveryId: id,
      source: "delivery_base",
      invoiceNumber,
      invoiceValue,
      volumes,
      freightCost,
      insuranceCost,
      deliveredAt: delivered.toISOString(),
      policy: { deductible: policy.deductible, coversLoadingUnloading: policy.coversLoadingUnloading },
    };
    const cost = calculateCost(extraction, enriched).result;
    const payer = decidePayer({
      extraction,
      cost: cost.cost,
      delivery: enriched,
      reportedAt: new Date(delivered.getTime() + int(5, 60) * 60_000).toISOString(),
    }).result;

    const ageDays = (END - day) / DAY;
    const status =
      ageDays < 3
        ? pick(["registered", "registered", "pending_review"])
        : ageDays < 30
          ? pick(["registered", "billed", "billed"])
          : payer.payer === "absorbed"
            ? "lost"
            : rand() < 0.75
              ? "recovered"
              : "lost";

    incidentSeq += 1;
    incidents.push({
      number: `OC-2026-${String(incidentSeq).padStart(6, "0")}`,
      source: "seed",
      delivery_id: id,
      route_id: route.id,
      carrier_id: carrierId,
      driver_id: driver.id,
      type,
      reason_text: reason(kind, product, affected, volumes),
      cost: cost.cost,
      cost_estimated: cost.estimated,
      insurance_cost: cost.insuranceCost,
      payer: payer.payer,
      claim_deadline: payer.claimDeadline,
      confidence: Number(between(0.8, 0.99).toFixed(2)),
      status,
      occurred_at: delivered.toISOString(),
      created_at: delivered.toISOString(),
    });
  }
}

// Personal data planted in the free text (masking test, 8.6): raw, as an unmasked source would send it.
const PII_TEMPLATES = [
  "Sou o motorista, meu CPF é {cpf}, placa {plate}. Caixa amassada na entrega.",
  "Pode ligar no {phone}, estou com o caminhão {plate} parado no cliente.",
  "Motorista {cpf} relatando avaria, contato {phone}.",
  "Placa {plate}, CPF {cpf}, telefone {phone}. Cliente recusou a carga.",
  "Meu e-mail é motorista{n}@exemplo.com.br e meu telefone ({ddd}) 9{a}-{b}.",
];
const piiIncidents = incidents.slice(-50);
piiIncidents.forEach((row, i) => {
  row.reason_text = pick(PII_TEMPLATES)
    .replace("{cpf}", cpf())
    .replace("{plate}", plate())
    .replace("{phone}", `(${int(11, 99)}) 9${digits(4)}-${digits(4)}`)
    .replace("{n}", String(i + 1))
    .replace("{ddd}", String(int(11, 99)))
    .replace("{a}", digits(4))
    .replace("{b}", digits(4));
  row.number = `PII-${String(i + 1).padStart(3, "0")}`;
});

// ---------------------------------------------------------------------------
// SQL

function inserts(table: string, rows: Row[], chunk = 200): string[] {
  if (!rows.length) return [];
  const cols = Object.keys(rows[0]);
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const values = rows.slice(i, i + chunk).map((r) => `(${cols.map((c) => sql(r[c])).join(", ")})`);
    out.push(`insert into ${table} (${cols.join(", ")}) values\n${values.join(",\n")};`);
  }
  return out;
}

const statements = [
  "-- Generated by scripts/generate-seed.ts. Local database only.",
  "delete from evidence; delete from decisions; delete from reviews; delete from incident_clusters; delete from clusters;",
  "delete from incidents;",
  "delete from deliveries; delete from insurance_policies; delete from drivers; delete from routes; delete from carriers;",
  ...inserts("carriers", CARRIERS.map((c) => ({ id: c.id, cnpj: c.cnpj, legal_name: c.legalName, aliases: JSON.stringify([c.legalName.replace("Transportadora ", "Transp. ")]) }))),
  ...inserts("routes", ROUTES.map((r) => ({ id: r.id, origin_ibge: r.origin.ibge, destination_ibge: r.destination.ibge, name: r.name, corridor: null }))),
  ...inserts("drivers", DRIVERS.map((d) => ({ id: d.id, name: d.name, phone: d.phone, cpf_masked: d.cpfMasked, carrier_id: d.carrierId }))),
  ...inserts("insurance_policies", POLICIES.map((p) => ({ carrier_id: p.carrierId, policy_number: p.policyNumber, deductible: p.deductible, covers_loading_unloading: p.coversLoadingUnloading, ad_valorem_pct: p.adValoremPct, gris_pct: p.grisPct }))),
  ...inserts("deliveries", deliveries),
  ...inserts("incidents", incidents),
];

mkdirSync("db/seed", { recursive: true });
writeFileSync("db/seed/seed.sql", statements.join("\n\n") + "\n");

const wet = incidents.filter((i) => /molhad|úmid|umidade|encharcad|lona/.test(String(i.reason_text)));
console.log(
  [
    `carriers ${CARRIERS.length}, routes ${ROUTES.length}, drivers ${DRIVERS.length}`,
    `deliveries ${deliveries.length}, incidents ${incidents.length} (${((incidents.length / deliveries.length) * 100).toFixed(1)}%)`,
    `planted wet-box reports: ${wet.length}`,
    `incidents with planted PII: ${piiIncidents.length} (numbers PII-001…PII-050)`,
    "→ db/seed/seed.sql",
  ].join("\n"),
);
