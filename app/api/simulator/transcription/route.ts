// Demo and tests: fake transcription in the same format as the webhook, without the external tool.
import { TranscriptionPayload, receiveTranscription } from "@/lib/reports/transcription";

export async function POST(request: Request) {
  const parsed = TranscriptionPayload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "payload inválido", details: parsed.error.issues }, { status: 422 });
  }
  const result = await receiveTranscription(parsed.data);
  if (!result.found) return Response.json({ error: "mensagem de áudio não encontrada" }, { status: 404 });
  return Response.json(result);
}
