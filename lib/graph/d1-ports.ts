// Production implementation of IncidentPorts: D1 (Drizzle).
import "server-only";

import { and, eq, or } from "drizzle-orm";

import { carriers, decisions, deliveries, drivers, incidents, insurancePolicies, routes } from "@/db/schema";
import { minConfidence } from "@/lib/ai/extraction-schema";
import { getDb } from "@/lib/db";
import { ibgeCode } from "@/lib/normalization/ibge";
import { normalizeName, onlyDigits } from "@/lib/normalization/text";

import { createCase, patchCase } from "./case-mirror";
import type { IncidentPorts } from "./ports";

export const d1Ports: IncidentPorts = {
  async normalize(extraction) {
    const db = await getDb();

    let carrierId: number | null = null;
    const cnpj = extraction.carrier_cnpj ? onlyDigits(extraction.carrier_cnpj) : "";
    if (cnpj) {
      const [byCnpj] = await db.select({ id: carriers.id }).from(carriers).where(eq(carriers.cnpj, cnpj));
      carrierId = byCnpj?.id ?? null;
    }
    if (!carrierId && extraction.carrier_name) {
      const wanted = normalizeName(extraction.carrier_name);
      const all = await db.select().from(carriers);
      carrierId =
        all.find((c) => normalizeName(c.legalName) === wanted || c.aliases.some((a) => normalizeName(a) === wanted))?.id ??
        all.find((c) => normalizeName(c.legalName).includes(wanted) || wanted.includes(normalizeName(c.legalName)))?.id ??
        null;
    }

    let routeId: number | null = null;
    const origin = ibgeCode(extraction.origin_city, extraction.origin_state);
    const destination = ibgeCode(extraction.destination_city, extraction.destination_state);
    if (origin && destination) {
      const [route] = await db
        .select({ id: routes.id })
        .from(routes)
        .where(and(eq(routes.originIbge, origin), eq(routes.destinationIbge, destination)));
      routeId = route?.id ?? null;
    }

    // The driver comes from the delivery when the invoice is found (enrich); ezworker sends only a name.
    let driverId: number | null = null;
    const name = extraction.driver_name ? normalizeName(extraction.driver_name) : "";
    if (name) {
      const all = await db.select({ id: drivers.id, name: drivers.name }).from(drivers);
      driverId = all.find((d) => normalizeName(d.name) === name)?.id ?? null;
    }
    return { carrierId, routeId, driverId };
  },

  async findDelivery(extraction) {
    const keys = [
      extraction.nfe_key ? eq(deliveries.nfeKey, onlyDigits(extraction.nfe_key)) : null,
      extraction.invoice_number ? eq(deliveries.invoiceNumber, onlyDigits(extraction.invoice_number).padStart(9, "0")) : null,
    ].filter((k) => k !== null);
    if (!keys.length) return null;

    const db = await getDb();
    const [row] = await db
      .select({ d: deliveries, p: insurancePolicies })
      .from(deliveries)
      .leftJoin(insurancePolicies, eq(insurancePolicies.carrierId, deliveries.carrierId))
      .where(or(...keys))
      .limit(1);
    if (!row) return null;
    return {
      deliveryId: row.d.id,
      source: "delivery_base" as const,
      invoiceNumber: row.d.invoiceNumber,
      invoiceValue: row.d.invoiceValue,
      volumes: row.d.volumes,
      freightCost: row.d.freightCost,
      insuranceCost: row.d.insuranceCost,
      deliveredAt: row.d.deliveredAt,
      policy: row.p ? { deductible: row.p.deductible, coversLoadingUnloading: row.p.coversLoadingUnloading } : null,
    };
  },

  async saveIncident(s) {
    const db = await getDb();
    const e = s.extraction!;
    const caseId = s.caseId ?? (s.source ? await createCase(s.source) : null);
    const values = {
      deliveryId: s.delivery?.deliveryId ?? null,
      routeId: s.entities?.routeId ?? null,
      carrierId: s.entities?.carrierId ?? null,
      driverId: s.entities?.driverId ?? null,
      type: e.type,
      // Already masked by mask_pii; the original stays in `casos` as evidence.
      reasonText: e.reason_text,
      cost: s.cost?.cost ?? null,
      costEstimated: s.cost?.estimated ?? true,
      insuranceCost: s.cost?.insuranceCost ?? null,
      payer: s.payer?.payer ?? null,
      claimDeadline: s.payer?.claimDeadline ?? null,
      confidence: minConfidence(e),
      status: s.status ?? "registered",
    };

    let incidentId = s.incidentId;
    if (incidentId) {
      await db.update(incidents).set(values).where(eq(incidents.id, incidentId));
    } else {
      const [row] = await db
        .insert(incidents)
        .values({
          ...values,
          number: caseId ?? `TMP-${crypto.randomUUID()}`,
          threadId: s.threadId,
          source: "ezworker",
          occurredAt: e.occurred_at ?? s.reportedAt,
        })
        .returning({ id: incidents.id });
      incidentId = row.id;
      if (!caseId) {
        const number = `OC-${new Date().getUTCFullYear()}-${String(row.id).padStart(6, "0")}`;
        await db.update(incidents).set({ number }).where(eq(incidents.id, row.id));
      }
    }

    if (caseId) await patchCase(caseId, s);
    return { incidentId, caseId };
  },

  async saveDecisions(threadId, incidentId, list) {
    if (!list.length) return;
    const db = await getDb();
    const rows = list.map((d) => ({ threadId, incidentId, node: d.node, rule: d.rule, input: d.input, output: d.output, reason: d.reason, at: d.at }));
    // D1 accepts at most 100 bound parameters per statement: 8 columns × 10 rows.
    const chunks = Array.from({ length: Math.ceil(rows.length / 10) }, (_, i) => rows.slice(i * 10, i * 10 + 10));
    await db.batch([db.delete(decisions).where(eq(decisions.threadId, threadId)), ...chunks.map((chunk) => db.insert(decisions).values(chunk))]);
  },
};
