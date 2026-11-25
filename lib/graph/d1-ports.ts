// Production implementation of IncidentPorts: D1 (Drizzle), R2 and the Claude API.
import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, asc, eq, or } from "drizzle-orm";

import { carriers, decisions, deliveries, driverReports, drivers, incidents, insurancePolicies, messages, routes } from "@/db/schema";
import { callModel, markSchemaResult } from "@/lib/ai/call-model";
import { EXTRACTION_SYSTEM, extractionContent } from "@/lib/ai/extraction";
import { ExtractionSchema, minConfidence } from "@/lib/ai/extraction-schema";
import { getDb } from "@/lib/db";
import { ibgeCode } from "@/lib/normalization/ibge";
import { normalizeName, onlyDigits } from "@/lib/normalization/text";
import { DEFAULT_EXTRACTION_MODEL } from "@/lib/rules/config";
import { getBucket } from "@/lib/storage";

import { createCase, patchCase } from "./case-mirror";
import type { IncidentPorts } from "./ports";
import type { ReportMessage } from "./state";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function toBase64(bytes: ArrayBuffer): string {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function extractionModel() {
  const { env } = await getCloudflareContext({ async: true });
  return (env as unknown as Record<string, string | undefined>).EXTRACTION_MODEL || DEFAULT_EXTRACTION_MODEL;
}

export const d1Ports: IncidentPorts = {
  async loadReport(reportId) {
    const db = await getDb();
    const [report] = await db.select().from(driverReports).where(eq(driverReports.id, reportId));
    if (!report) throw new Error(`relato ${reportId} não encontrado`);
    const rows = await db.select().from(messages).where(eq(messages.reportId, reportId)).orderBy(asc(messages.receivedAt), asc(messages.id));
    const list: ReportMessage[] = rows.map((m) => ({
      id: m.id,
      kind: m.kind,
      text: m.text,
      mediaKey: m.mediaKey,
      mediaSha256: m.mediaSha256,
      receivedAt: m.receivedAt,
      transcript: m.transcript,
      transcriptStatus: m.transcriptStatus,
    }));
    return { phone: report.phone, openedAt: report.openedAt, messages: list };
  },

  async loadImages(list) {
    const bucket = await getBucket();
    const images = await Promise.all(
      list
        .filter((m) => m.kind === "image" && m.mediaKey)
        .map(async (m) => {
          const obj = await bucket.get(m.mediaKey!);
          const mediaType = obj?.httpMetadata?.contentType ?? "";
          if (!obj || !IMAGE_TYPES.has(mediaType)) return null;
          return { mediaType, base64: toBase64(await obj.arrayBuffer()) };
        }),
    );
    return images.filter((i): i is { mediaType: string; base64: string } => i !== null);
  },

  async extract(request) {
    return callModel({
      reportId: request.reportId,
      node: "extract_multimodal",
      attempt: request.attempt,
      model: await extractionModel(),
      schema: ExtractionSchema,
      system: EXTRACTION_SYSTEM,
      content: extractionContent(request),
    });
  },

  recordSchemaResult: markSchemaResult,

  async normalize(extraction, phone) {
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

    const [driver] = await db.select({ id: drivers.id }).from(drivers).where(eq(drivers.phone, onlyDigits(phone)));
    return { carrierId, routeId, driverId: driver?.id ?? null };
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
      // Already masked by mask_pii; the original stays in `casos` / messages as evidence.
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
          threadId: s.reportId,
          source: s.source ? "ezworker" : "claude",
          reportId: s.source ? null : s.reportId,
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

  async saveDecisions(reportId, incidentId, list) {
    if (!list.length) return;
    const db = await getDb();
    const rows = list.map((d) => ({ reportId, incidentId, node: d.node, rule: d.rule, input: d.input, output: d.output, reason: d.reason, at: d.at }));
    // D1 accepts at most 100 bound parameters per statement: 8 columns × 10 rows.
    const chunks = Array.from({ length: Math.ceil(rows.length / 10) }, (_, i) => rows.slice(i * 10, i * 10 + 10));
    await db.batch([
      db.delete(decisions).where(eq(decisions.reportId, reportId)),
      ...chunks.map((chunk) => db.insert(decisions).values(chunk)),
    ]);
  },

  async setReportStatus(reportId, status) {
    const db = await getDb();
    await db.update(driverReports).set({ status }).where(eq(driverReports.id, reportId));
  },
};
