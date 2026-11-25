// Demo and tests: same contract as the WhatsApp webhook, without Meta.
// multipart/form-data: phone (required), text, file (optional), close=1 to send the report.
import { runIncidentGraph } from "@/lib/graph/run";
import { closeReport, receiveMessage } from "@/lib/reports/intake";

export async function POST(request: Request) {
  const form = await request.formData();
  const phone = String(form.get("phone") ?? "").replace(/\D/g, "");
  if (phone.length < 10) return Response.json({ error: "phone obrigatório" }, { status: 400 });

  const file = form.get("file");
  const text = form.get("text");
  if (!(file instanceof File) && !text) {
    return Response.json({ error: "envie text ou file" }, { status: 400 });
  }

  try {
    const result = await receiveMessage({
      phone,
      text: typeof text === "string" ? text : null,
      media:
        file instanceof File
          ? { bytes: await file.arrayBuffer(), contentType: file.type || "application/octet-stream", fileName: file.name }
          : null,
      externalId: typeof form.get("external_id") === "string" ? String(form.get("external_id")) : null,
    });
    if (form.get("close") !== "1") return Response.json(result, { status: 201 });

    // Closing the report starts the incident graph (synchronous in the simulator; see plan, risk 2).
    await closeReport(result.reportId);
    const run = await runIncidentGraph(result.reportId);
    return Response.json({ ...result, graph: { status: run.state.status, incidentId: run.state.incidentId, paused: run.paused, next: run.next } }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
