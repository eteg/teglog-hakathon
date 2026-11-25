// Quality criteria (F7): schema, attacks, human review, minimum access, observability, personal data.
import { noStore } from "@/lib/queries/params";
import { qualityReport } from "@/lib/quality/report";

export async function GET() {
  return Response.json(await qualityReport(), noStore);
}
