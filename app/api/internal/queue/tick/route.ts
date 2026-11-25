import { getCloudflareContext } from "@opennextjs/cloudflare";
import { processarFila } from "@/lib/fila";

export async function POST(req: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.INTERNAL_SECRET || req.headers.get("x-internal-secret") !== env.INTERNAL_SECRET) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }

  await processarFila("cron");
  return Response.json({ status: "ok" });
}
