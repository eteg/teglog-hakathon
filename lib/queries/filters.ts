// Filters shared by every KPI endpoint (F1): route, carrier, driver, hour, period and type.
import { type SQL, sql } from "drizzle-orm";
import { z } from "zod";

import { INCIDENT_TYPES } from "@/db/schema";

export const KpiFiltersSchema = z.object({
  route: z.coerce.number().int().positive().optional(),
  carrier: z.coerce.number().int().positive().optional(),
  driver: z.coerce.number().int().positive().optional(),
  hour: z.coerce.number().int().min(0).max(23).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  type: z.enum(INCIDENT_TYPES).optional(),
});
export type KpiFilters = z.infer<typeof KpiFiltersSchema>;

export const DIMENSIONS = ["route", "carrier", "driver", "hour"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** Upper bound of the period is inclusive for the user ("até 30/11"). */
const nextDay = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Two filtered sets with the same columns (route_id, carrier_id, driver_id, hour, at):
 *  - dl: deliveries, the denominator;
 *  - ic: incidents, with their own normalized keys (falling back to the delivery's).
 */
export function filteredSets(f: KpiFilters): SQL {
  const common = (alias: "dl" | "ic") => {
    const parts: SQL[] = [];
    if (f.route) parts.push(sql`and ${sql.raw(alias)}.route_id = ${f.route}`);
    if (f.carrier) parts.push(sql`and ${sql.raw(alias)}.carrier_id = ${f.carrier}`);
    if (f.driver) parts.push(sql`and ${sql.raw(alias)}.driver_id = ${f.driver}`);
    if (f.hour !== undefined) parts.push(sql`and ${sql.raw(alias)}.hour = ${f.hour}`);
    if (f.from) parts.push(sql`and ${sql.raw(alias)}.at >= ${f.from}`);
    if (f.to) parts.push(sql`and ${sql.raw(alias)}.at < ${nextDay(f.to)}`);
    return sql.join(parts, sql` `);
  };
  const type = f.type ? sql`and ic.type = ${f.type}` : sql``;
  return sql`
    dl_all as (
      select d.id, d.route_id, d.carrier_id, d.driver_id, d.invoice_value, d.insurance_cost,
             coalesce(d.delivered_at, d.departed_at) as at,
             cast(strftime('%H', coalesce(d.delivered_at, d.departed_at)) as integer) as hour
      from deliveries d
    ),
    dl as (select * from dl_all dl where 1 = 1 ${common("dl")}),
    ic_all as (
      select i.id, i.type, coalesce(i.cost, 0) as cost, i.occurred_at as at,
             coalesce(i.route_id, d.route_id) as route_id,
             coalesce(i.carrier_id, d.carrier_id) as carrier_id,
             coalesce(i.driver_id, d.driver_id) as driver_id,
             cast(strftime('%H', i.occurred_at) as integer) as hour
      from incidents i left join deliveries d on d.id = i.delivery_id
    ),
    ic as (select * from ic_all ic where 1 = 1 ${common("ic")} ${type})`;
}

export const LABEL: Record<Dimension, string> = {
  route: "(select name from routes where id = k.key)",
  carrier: "(select legal_name from carriers where id = k.key)",
  driver: "(select name from drivers where id = k.key)",
  hour: "printf('%02dh', k.key)",
};

export const KEY: Record<Dimension, string> = { route: "route_id", carrier: "carrier_id", driver: "driver_id", hour: "hour" };
