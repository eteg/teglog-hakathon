// B4: the external tool posts the transcription of an audio message here.
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { TranscriptionPayload, receiveTranscription } from "@/lib/reports/transcription";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const secret = (env as unknown as Record<string, string | undefined>).TRANSCRIPTION_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-webhook-secret") !== secret) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }

  const parsed = TranscriptionPayload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "payload inválido", details: parsed.error.issues }, { status: 422 });
  }

  const result = await receiveTranscription(parsed.data);
  if (!result.found) return Response.json({ error: "mensagem de áudio não encontrada" }, { status: 404 });
  // T16: when allAudioDone and the report is waiting, the graph is resumed here.
  return Response.json(result);
}
