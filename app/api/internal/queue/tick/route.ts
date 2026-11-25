import { getCloudflareContext } from "@opennextjs/cloudflare";
import { tick } from "@/lib/queue/dispatch";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.INTERNAL_SECRET || request.headers.get("x-internal-secret") !== env.INTERNAL_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  await tick("cron");
  return Response.json({ status: "ok" });
}
