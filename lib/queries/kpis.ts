// KPI queries for F1. Every rate is divided by the delivery volume, so a carrier or route
// that runs more does not look worse just because it runs more.
import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";

import { type Dimension, KEY, type KpiFilters, LABEL, filteredSets } from "./filters";

const r2 = (v: number) => Math.round(v * 100) / 100;

type Base = { deliveries: number; incidents: number; cost: number; insurance_cost: number; invoice_value: number };

function rates(b: Base) {
  return {
    deliveries: b.deliveries,
    incidents: b.incidents,
    incidentsPer1000: b.deliveries ? Math.round((b.incidents / b.deliveries) * 10_000) / 10 : 0,
    cost: r2(b.cost),
    costPerDelivery: b.deliveries ? r2(b.cost / b.deliveries) : 0,
    insuranceCost: r2(b.insurance_cost),
    /** Incident cost ÷ value transported. */
    lossRatio: b.invoice_value ? Math.round((b.cost / b.invoice_value) * 100_000) / 100_000 : 0,
    /** Incident cost + insurance paid on the freight. */
    totalRiskCost: r2(b.cost + b.insurance_cost),
  };
}

export type KpiRow = { key: string; label: string } & ReturnType<typeof rates>;

/** Ranking by a dimension (route, carrier, driver, hour), sorted by cost. */
export async function kpiRanking(dimension: Dimension, f: KpiFilters): Promise<KpiRow[]> {
  const key = sql.raw(KEY[dimension]);
  const db = await getDb();
  const rows = await db.all<Base & { key: number; label: string | null }>(sql`
    with ${filteredSets(f)},
    d as (select ${key} as key, count(*) as deliveries, sum(invoice_value) as invoice_value, sum(insurance_cost) as insurance_cost from dl group by 1),
    i as (select ${key} as key, count(*) as incidents, sum(cost) as cost from ic group by 1),
    k as (select key from d union select key from i where key is not null)
    select k.key, ${sql.raw(LABEL[dimension])} as label,
           coalesce(d.deliveries, 0) as deliveries, coalesce(i.incidents, 0) as incidents,
           coalesce(i.cost, 0) as cost, coalesce(d.insurance_cost, 0) as insurance_cost, coalesce(d.invoice_value, 0) as invoice_value
    from k left join d on d.key = k.key left join i on i.key = k.key
    where k.key is not null
    order by cost desc`);
  return rows.map((r) => ({ key: String(r.key), label: r.label ?? String(r.key), ...rates(r) }));
}

/** The four F1 cards plus totals, over the filtered set. */
export async function kpiSummary(f: KpiFilters) {
  const db = await getDb();
  const [totals] = await db.all<Base>(sql`
    with ${filteredSets(f)}
    select (select count(*) from dl) as deliveries, (select count(*) from ic) as incidents,
           (select coalesce(sum(cost), 0) from ic) as cost,
           (select coalesce(sum(insurance_cost), 0) from dl) as insurance_cost,
           (select coalesce(sum(invoice_value), 0) from dl) as invoice_value`);
  const byRoute = await kpiRanking("route", f);
  const worst = byRoute[0] ?? null;
  return {
    ...rates(totals),
    /** Card "custo por rota": the route that concentrates the loss. */
    topRoute: worst ? { key: worst.key, label: worst.label, cost: worst.cost, costPerDelivery: worst.costPerDelivery } : null,
    routesWithIncidents: byRoute.filter((r) => r.incidents > 0).length,
  };
}

/** Cost or rate over time for the top N keys of a dimension (F1 chart). */
export async function kpiTimeseries(
  dimension: Dimension,
  f: KpiFilters,
  options: { granularity: "week" | "month"; metric: "cost" | "incidentsPer1000" | "costPerDelivery"; top: number },
) {
  const key = sql.raw(KEY[dimension]);
  const period = sql.raw(options.granularity === "month" ? "strftime('%Y-%m', at)" : "strftime('%Y-W%W', at)");
  const db = await getDb();
  const rows = await db.all<{ period: string; key: number; deliveries: number; incidents: number; cost: number }>(sql`
    with ${filteredSets(f)},
    d as (select ${period} as period, ${key} as key, count(*) as deliveries from dl group by 1, 2),
    i as (select ${period} as period, ${key} as key, count(*) as incidents, sum(cost) as cost from ic group by 1, 2)
    select d.period, d.key, d.deliveries, coalesce(i.incidents, 0) as incidents, coalesce(i.cost, 0) as cost
    from d left join i on i.period = d.period and i.key = d.key
    where d.key is not null
    order by d.period`);

  const ranking = await kpiRanking(dimension, f);
  const top = ranking.slice(0, options.top);
  const periods = [...new Set(rows.map((r) => r.period))].sort();
  const value = (r?: { deliveries: number; incidents: number; cost: number }) => {
    if (!r) return 0;
    if (options.metric === "cost") return r2(r.cost);
    if (options.metric === "costPerDelivery") return r.deliveries ? r2(r.cost / r.deliveries) : 0;
    return r.deliveries ? Math.round((r.incidents / r.deliveries) * 10_000) / 10 : 0;
  };
  return {
    metric: options.metric,
    granularity: options.granularity,
    periods,
    series: top.map((t) => ({
      key: t.key,
      label: t.label,
      values: periods.map((p) => value(rows.find((r) => r.period === p && String(r.key) === t.key))),
    })),
  };
}

/** Rows × columns grid (e.g. route × carrier) with incidents per 1,000 deliveries and cost. */
export async function kpiMatrix(rowsDim: Dimension, colsDim: Dimension, f: KpiFilters) {
  const rk = sql.raw(KEY[rowsDim]);
  const ck = sql.raw(KEY[colsDim]);
  const db = await getDb();
  const cells = await db.all<{ row: number; col: number; deliveries: number; incidents: number; cost: number }>(sql`
    with ${filteredSets(f)},
    d as (select ${rk} as row, ${ck} as col, count(*) as deliveries from dl group by 1, 2),
    i as (select ${rk} as row, ${ck} as col, count(*) as incidents, sum(cost) as cost from ic group by 1, 2)
    select d.row, d.col, d.deliveries, coalesce(i.incidents, 0) as incidents, coalesce(i.cost, 0) as cost
    from d left join i on i.row = d.row and i.col = d.col
    where d.row is not null and d.col is not null`);
  const [rowLabels, colLabels] = await Promise.all([kpiRanking(rowsDim, f), kpiRanking(colsDim, f)]);
  return {
    rows: rowLabels.map((r) => ({ key: r.key, label: r.label })),
    columns: colLabels.map((c) => ({ key: c.key, label: c.label })),
    cells: cells.map((c) => ({
      row: String(c.row),
      col: String(c.col),
      deliveries: c.deliveries,
      incidents: c.incidents,
      incidentsPer1000: c.deliveries ? Math.round((c.incidents / c.deliveries) * 10_000) / 10 : 0,
      cost: r2(c.cost),
    })),
  };
}

/** Options for the F1 filter dropdowns. */
export async function kpiFilterOptions() {
  const db = await getDb();
  const [routes, carriers, drivers] = await Promise.all([
    db.all<{ id: number; name: string }>(sql`select id, name from routes order by name`),
    db.all<{ id: number; name: string }>(sql`select id, legal_name as name from carriers order by legal_name`),
    db.all<{ id: number; name: string }>(sql`select id, name from drivers order by name`),
  ]);
  const [range] = await db.all<{ from: string | null; to: string | null }>(
    sql`select min(substr(coalesce(delivered_at, departed_at), 1, 10)) as "from", max(substr(coalesce(delivered_at, departed_at), 1, 10)) as "to" from deliveries`,
  );
  return { routes, carriers, drivers, hours: Array.from({ length: 24 }, (_, h) => h), period: range };
}
