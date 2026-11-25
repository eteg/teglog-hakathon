// Bridges the actions of the existing screens (approve, attach evidence) to the paused graph.
import "server-only";

import { ezworkerToExtraction } from "@/lib/ai/ezworker-adapter";
import { obter } from "@/lib/store";

import { resumeIncident, threadOfCase } from "./run";

/** Approve on F5/F3: resume the review pause with the case fields as the analyst left them. */
export async function resumeReviewFromCase(caseId: string, reviewer: string) {
  const threadId = await threadOfCase(caseId);
  const caso = await obter(caseId);
  if (!threadId || !caso) return null;
  const current = ezworkerToExtraction(caso);
  // Only the fields an analyst can correct on F5 (lib/regras CAMPOS_REVISAVEIS).
  const fields = {
    type: current.type,
    invoice_number: current.invoice_number,
    carrier_name: current.carrier_name,
    product: current.product,
    origin_city: current.origin_city,
    origin_state: current.origin_state,
    destination_city: current.destination_city,
    destination_state: current.destination_state,
  };
  return safely(caseId, () => resumeIncident(threadId, "await_review", { action: "correct", reviewer, fields }));
}

/** Evidence attached on F3 and nothing missing: resume the evidence pause. */
export async function resumeEvidenceFromCase(caseId: string) {
  const threadId = await threadOfCase(caseId);
  if (!threadId) return null;
  return safely(caseId, () => resumeIncident(threadId, "await_evidence", { action: "evidence_received", stillMissing: [] }));
}

/** A graph failure is logged but never blocks the analyst's action on the screen. */
async function safely<T>(caseId: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.error("[graph] resume failed", { caseId, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
