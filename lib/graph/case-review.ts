// Bridges the actions of the existing screens (approve, attach evidence) to the paused graph.
import "server-only";

import { ezworkerToExtraction } from "@/lib/ai/ezworker-adapter";
import { obter } from "@/lib/store";

import { pausedAt, resumeIncident, threadOfCase } from "./run";

/**
 * "Aprovar tratativa" on the current screens. One click, two meanings depending on where the graph
 * waits: at the data review it confirms the fields as the analyst left them AND authorizes the
 * charge; at the charge authorization it authorizes it. Either way a person is on record.
 */
export async function approveFromCase(caseId: string, reviewer: string) {
  const threadId = await threadOfCase(caseId);
  if (!threadId) return null;
  const at = await pausedAt(threadId);
  if (at === "await_authorization") {
    return safely(caseId, () => resumeIncident(threadId, "await_authorization", { action: "authorize", reviewer }));
  }
  if (at !== "await_review") return null;
  const caso = await obter(caseId);
  if (!caso) return null;
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
  return safely(caseId, () => resumeIncident(threadId, "await_review", { action: "correct", reviewer, fields, authorizeBilling: true }));
}

/** Authorize or decline the charge explicitly (API; the screens only have "approve" today). */
export async function decideChargeFromCase(caseId: string, decision: "authorize" | "decline", reviewer: string, reason?: string) {
  const threadId = await threadOfCase(caseId);
  if (!threadId || (await pausedAt(threadId)) !== "await_authorization") return null;
  return resumeIncident(threadId, "await_authorization", { action: decision, reviewer, reason });
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
