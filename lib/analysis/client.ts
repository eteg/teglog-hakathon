import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const analysisTypes = ["image", "text", "audio"] as const;
export type AnalysisType = (typeof analysisTypes)[number];

export async function sendToAnalysis(type: AnalysisType, payload: unknown) {
  const { env } = await getCloudflareContext({ async: true });
  const urls = { image: env.ANALYSIS_IMAGE_URL, text: env.ANALYSIS_TEXT_URL, audio: env.ANALYSIS_AUDIO_URL };

  const url = urls[type];
  if (!url) {
    console.log("[analysis] simulado", type, payload);
    return { status: 200 };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: response.status };
}
