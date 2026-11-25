// Quality criteria (F7): schema, attacks, human review, minimum access, observability, personal data.
import { noStore } from "@/lib/queries/params";
import { qualityReport } from "@/lib/quality/report";
import { exigir } from "@/lib/acesso";

export async function GET(request: Request) {
  const negado = await exigir(request, "ler");
  if (negado) return negado;
  return Response.json(await qualityReport(), noStore);
}
