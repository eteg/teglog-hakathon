import "server-only";

import { and, desc, eq, gt, lt, type SQL } from "drizzle-orm";

import { carriers, deliveries, incidents, INCIDENT_STATUSES, INCIDENT_TYPES, routes } from "@/db/schema";
import { getDb } from "@/lib/db";

export type IncidentFilters = {
  status?: (typeof INCIDENT_STATUSES)[number];
  type?: (typeof INCIDENT_TYPES)[number];
  routeId?: number;
  carrierId?: number;
  /** Only incidents created after this ISO timestamp (live list polling). */
  since?: string;
  /** Pagination: incidents with id lower than this. */
  cursor?: number;
  limit?: number;
};

export async function listIncidents(f: IncidentFilters) {
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 200);
  const where: SQL[] = [];
  if (f.status) where.push(eq(incidents.status, f.status));
  if (f.type) where.push(eq(incidents.type, f.type));
  if (f.routeId) where.push(eq(deliveries.routeId, f.routeId));
  if (f.carrierId) where.push(eq(deliveries.carrierId, f.carrierId));
  if (f.since) where.push(gt(incidents.createdAt, f.since));
  if (f.cursor) where.push(lt(incidents.id, f.cursor));

  const db = await getDb();
  const rows = await db
    .select({
      id: incidents.id,
      number: incidents.number,
      type: incidents.type,
      status: incidents.status,
      reasonText: incidents.reasonText,
      cost: incidents.cost,
      insuranceCost: incidents.insuranceCost,
      payer: incidents.payer,
      claimDeadline: incidents.claimDeadline,
      confidence: incidents.confidence,
      occurredAt: incidents.occurredAt,
      createdAt: incidents.createdAt,
      invoiceNumber: deliveries.invoiceNumber,
      route: routes.name,
      carrier: carriers.legalName,
    })
    .from(incidents)
    .leftJoin(deliveries, eq(deliveries.id, incidents.deliveryId))
    .leftJoin(routes, eq(routes.id, deliveries.routeId))
    .leftJoin(carriers, eq(carriers.id, deliveries.carrierId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(incidents.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  return { data: page, nextCursor: rows.length > limit ? page.at(-1)!.id : null };
}
