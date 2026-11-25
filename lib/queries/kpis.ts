// KPIs always divided by the delivery volume (B12): a carrier that runs more
// must not look worse just because it runs more.
import "server-only";

import { sql } from "drizzle-orm";

import { INCIDENT_TYPES } from "@/db/schema";
import { getDb } from "@/lib/db";

export const DIMENSIONS = {
  route: { key: "r.id", label: "r.name" },
  carrier: { key: "c.id", label: "c.legal_name" },
  driver: { key: "dr.id", label: "dr.name" },
  hour: { key: "cast(strftime('%H', d.delivered_at) as integer)", label: "printf('%02dh', cast(strftime('%H', d.delivered_at) as integer))" },
} as const;
export type Dimension = keyof typeof DIMENSIONS;

export type KpiFilters = { dimension: Dimension; from?: string; to?: string; type?: (typeof INCIDENT_TYPES)[number] };

export type KpiRow = {
  key: string;
  label: string;
  deliveries: number;
  incidents: number;
  incidentsPer1000: number;
  cost: number;
  costPerDelivery: number;
  insuranceCost: number;
  /** Incident cost ÷ value transported. */
  lossRatio: number;
};

export async function kpis(f: KpiFilters): Promise<{ rows: KpiRow[]; total: Omit<KpiRow, "key" | "label"> }> {
  const dim = DIMENSIONS[f.dimension];
  const db = await getDb();
  const typeFilter = f.type ? sql`and i.type = ${f.type}` : sql``;
  const from = f.from ?? "0000";
  const to = f.to ?? "9999";

  const rows = await db.all<{
    key: string; label: string; deliveries: number; incidents: number; cost: number; insurance_cost: number; invoice_value: number;
  }>(sql`
    with inc as (
      select i.delivery_id, count(*) as n, sum(coalesce(i.cost, 0)) as cost
      from incidents i where i.delivery_id is not null ${typeFilter}
      group by i.delivery_id
    )
    select ${sql.raw(dim.key)} as key, ${sql.raw(dim.label)} as label,
           count(*) as deliveries,
           coalesce(sum(inc.n), 0) as incidents,
           coalesce(sum(inc.cost), 0) as cost,
           sum(d.insurance_cost) as insurance_cost,
           sum(d.invoice_value) as invoice_value
    from deliveries d
    join routes r on r.id = d.route_id
    join carriers c on c.id = d.carrier_id
    left join drivers dr on dr.id = d.driver_id
    left join inc on inc.delivery_id = d.id
    where d.departed_at >= ${from} and d.departed_at < ${to}
    group by 1, 2
    order by cost desc
  `);

  const shape = (r: { deliveries: number; incidents: number; cost: number; insurance_cost: number; invoice_value: number }) => ({
    deliveries: r.deliveries,
    incidents: r.incidents,
    incidentsPer1000: r.deliveries ? Math.round((r.incidents / r.deliveries) * 10_000) / 10 : 0,
    cost: Math.round(r.cost * 100) / 100,
    costPerDelivery: r.deliveries ? Math.round((r.cost / r.deliveries) * 100) / 100 : 0,
    insuranceCost: Math.round(r.insurance_cost * 100) / 100,
    lossRatio: r.invoice_value ? Math.round((r.cost / r.invoice_value) * 100_000) / 100_000 : 0,
  });

  const sum = rows.reduce(
    (a, r) => ({
      deliveries: a.deliveries + r.deliveries,
      incidents: a.incidents + r.incidents,
      cost: a.cost + r.cost,
      insurance_cost: a.insurance_cost + r.insurance_cost,
      invoice_value: a.invoice_value + r.invoice_value,
    }),
    { deliveries: 0, incidents: 0, cost: 0, insurance_cost: 0, invoice_value: 0 },
  );

  return { rows: rows.map((r) => ({ key: String(r.key), label: r.label, ...shape(r) })), total: shape(sum) };
}
