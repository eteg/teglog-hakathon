// Lista de ocorrências com filtros e paginação (contrato F2).
// GET /api/ocorrencias?q=&tipo=&status=&transportadora=&motorista=&rota=&situacao=&ordenar=&direcao=asc|desc&page=1&pageSize=10
import { listarPagina } from "@/lib/store";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const texto = (k: string) => sp.get(k) || undefined;
  const numero = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);
  const pagina = await listarPagina({
    q: texto("q"),
    tipo: texto("tipo"),
    status: texto("status"),
    transportadora: texto("transportadora"),
    motorista: texto("motorista"),
    rota: texto("rota"),
    situacao: texto("situacao"),
    ordenar: texto("ordenar"),
    direcao: sp.get("direcao") === "desc" ? "desc" : "asc",
    page: numero("page"),
    pageSize: numero("pageSize"),
  });
  return Response.json(pagina, { headers: { "cache-control": "no-store" } });
}
