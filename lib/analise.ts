import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CATALOGO_MOCK_IA, escolherMock } from "@/lib/mock-ia-catalogo";

export const tiposAnalise = ["image", "text", "audio"] as const;
export type TipoAnalise = (typeof tiposAnalise)[number];

export async function enviarParaAnalise(
  tipo: TipoAnalise,
  payload: { from_phone: string },
): Promise<{ status: number; corpo: unknown }> {
  const { env } = await getCloudflareContext({ async: true });
  const urls = { image: env.ANALYSIS_IMAGE_URL, text: env.ANALYSIS_TEXT_URL, audio: env.ANALYSIS_AUDIO_URL };

  const url = urls[tipo];
  if (!url) {
    console.log("[analise] simulado", tipo, payload);
    return { status: 200, corpo: CATALOGO_MOCK_IA[tipo][escolherMock(tipo, payload.from_phone)] };
  }

  const resposta = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: resposta.status, corpo: await resposta.json().catch(() => null) };
}
