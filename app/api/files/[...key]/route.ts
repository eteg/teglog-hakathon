import { getBucket } from "@/lib/storage";

/** Serve um objeto do R2 pela chave (ex.: /api/files/uploads/<uuid>.jpg). */
export async function GET(_request: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const { key } = await ctx.params;
  const bucket = await getBucket();
  const object = await bucket.get(key.join("/"));

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=3600");

  return new Response(object.body, { headers });
}
