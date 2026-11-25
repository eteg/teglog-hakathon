import { MemorySaver } from "@langchain/langgraph";
import { describe, expect, it } from "vitest";

import { buildIncidentGraph } from "@/lib/graph/incident-graph";
import type { IncidentPorts } from "@/lib/graph/ports";
import type { IncidentStateType } from "@/lib/graph/state";
import { delivery, extraction } from "../fixtures";

function fakePorts(answers: (string | null)[]) {
  const calls = { extract: 0, saved: null as IncidentStateType | null, schema: [] as boolean[], prompts: [] as string[][] };
  const ports: IncidentPorts = {
    loadReport: async () => ({
      phone: "5511988887777",
      openedAt: "2026-11-20T14:15:00.000Z",
      messages: [
        { id: 1, kind: "text", text: "Duas caixas de TV molhadas", mediaKey: null, mediaSha256: null, receivedAt: "2026-11-20T14:11:00.000Z", transcript: null, transcriptStatus: null },
      ],
    }),
    loadImages: async () => [],
    extract: async (req) => {
      calls.prompts.push(req.previousErrors);
      const rawText = answers[calls.extract++] ?? null;
      return { rawText, error: rawText === null ? "api 500" : null, callId: calls.extract };
    },
    recordSchemaResult: async (_id, valid) => void calls.schema.push(valid),
    normalize: async () => ({ carrierId: 2, routeId: 1, driverId: 7 }),
    findDelivery: async () => delivery(),
    saveIncident: async (s) => {
      calls.saved = s;
      return 99;
    },
    saveDecisions: async () => {},
    setReportStatus: async () => {},
  };
  return { ports, calls };
}

const valid = JSON.stringify(extraction());
const run = (ports: IncidentPorts) =>
  buildIncidentGraph(ports, new MemorySaver()).invoke({ reportId: "r1" }, { configurable: { thread_id: "r1" } });

describe("incident graph — happy path", () => {
  it("valid extraction on the first attempt is costed, assigned a payer and saved", async () => {
    const { ports, calls } = fakePorts([valid]);
    const out = await run(ports);
    expect(out.status).toBe("registered");
    expect(out.incidentId).toBe(99);
    expect(out.cost?.cost).toBe(4_160);
    expect(out.payer?.payer).toBe("insurer");
    expect(calls.schema).toEqual([true]);
    expect(out.decisions.map((d) => d.node)).toEqual(["validate_schema", "calculate_cost", "decide_payer"]);
  });

  it("invalid JSON is retried with the errors in the prompt, then saved", async () => {
    const { ports, calls } = fakePorts([JSON.stringify({ type: "robbery" }), valid]);
    const out = await run(ports);
    expect(out.status).toBe("registered");
    expect(calls.schema).toEqual([false, true]);
    expect(calls.prompts[1].length).toBeGreaterThan(0);
    expect(out.decisions[0].rule).toBe("SCHEMA_RETRY");
  });

  it("two invalid answers never reach the database", async () => {
    const { ports, calls } = fakePorts(["not json", JSON.stringify({ type: "damage" })]);
    const out = await run(ports);
    expect(out.status).toBe("pending_review");
    expect(calls.saved).toBeNull();
    expect(out.decisions.at(-1)?.rule).toBe("SCHEMA_FAILED");
  });
});
