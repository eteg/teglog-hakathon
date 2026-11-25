// Mirrors the graph result into `casos`, the table the first version of the screens reads
// (F2, F3, F5). The graph decides; this only translates its result to the old contract.
import "server-only";

import { eq } from "drizzle-orm";

import { casos } from "@/db/schema";
import { getDb } from "@/lib/db";
import { obter, receber } from "@/lib/store";
import type { Caso, OcorrenciaEzworker, Pagador, StatusCaso } from "@/lib/types";

import type { IncidentStateType, Payer } from "./state";

const PAYER_PT: Record<Payer, Pagador> = {
  insurer: "seguradora",
  carrier: "transportadora",
  shipper: "embarcador",
  absorbed: "absorver",
};

/** Statuses the graph may set; anything a person set afterwards (aprovado, encerrado...) is kept. */
const GRAPH_STATUSES: StatusCaso[] = ["novo", "aguardando_evidencia", "aguardando_aprovacao"];

function caseStatus(s: IncidentStateType): StatusCaso {
  if (s.status === "awaiting_evidence") return "aguardando_evidencia";
  if (s.status === "pending_review" || s.status === "awaiting_authorization") return "aguardando_aprovacao";
  if (s.status === "authorized") return "aprovado";
  return "novo";
}

const STATUS_TITLE: Partial<Record<NonNullable<IncidentStateType["status"]>, string>> = {
  awaiting_evidence: "aguarda evidência",
  pending_review: "aguarda revisão",
  awaiting_authorization: "aguarda autorização da cobrança",
  authorized: "cobrança autorizada",
  not_authorized: "cobrança não autorizada",
};

/** Creates the case through the existing intake (copies evidence to R2, numbers it OC-xxxx). */
export async function createCase(source: OcorrenciaEzworker): Promise<string> {
  const caso = await receber(source);
  return caso.id;
}

export async function patchCase(caseId: string, s: IncidentStateType): Promise<void> {
  const caso = await obter(caseId);
  if (!caso) return;
  const payerDecision = [...s.decisions].reverse().find((d) => d.node === "decide_payer");
  const cost = s.cost?.cost ?? caso.contexto?.custo_ocorrencia ?? 0;
  const deductible = s.delivery?.policy?.deductible ?? 0;
  const pagador = s.payer ? PAYER_PT[s.payer.payer] : caso.decisao.pagador;

  const next: Caso = {
    ...caso,
    faltando: s.missingEvidence,
    decisao: {
      ...caso.decisao,
      pagador,
      motivo: payerDecision?.reason ?? caso.decisao.motivo,
      // The screen shows "Aprovar tratativa" when this is true: data review or charge authorization.
      requer_aprovacao: s.status === "pending_review" || s.status === "awaiting_authorization",
      motivo_aprovacao: s.reviewReasons.length ? s.reviewReasons.join("; ") : undefined,
    },
    contexto: {
      ...caso.contexto,
      custo_ocorrencia: cost,
      custo_seguro: pagador === "seguradora" ? Math.max(0, cost - deductible) : 0,
      prazo_protesto: s.payer?.claimDeadline ?? caso.contexto?.prazo_protesto,
    },
    status: GRAPH_STATUSES.includes(caso.status) ? caseStatus(s) : caso.status,
    timeline: [
      ...caso.timeline,
      {
        em: new Date().toISOString(),
        titulo: `Grafo de decisão: ${(s.status && STATUS_TITLE[s.status]) ?? "registrado"}`,
        detalhe:
          s.billingAuthorization
            ? `${s.billingAuthorization.decision === "authorized" ? "Autorizada" : "Não autorizada"} por ${s.billingAuthorization.by}${s.billingAuthorization.reason ? `: ${s.billingAuthorization.reason}` : ""}`
            : payerDecision?.reason,
      },
    ],
  };

  const db = await getDb();
  await db.update(casos).set({ status: next.status, dados: next }).where(eq(casos.id, caseId));
}
