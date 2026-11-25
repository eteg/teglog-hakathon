// Validação mínima do payload do webhook. A IA pode errar o formato;
// aqui garantimos que só entra dado no contrato esperado.
import { localValido } from "./localizacao";
import type { Local, OcorrenciaEzworker } from "./types";

const TIPOS = ["avaria", "recusa", "reentrega", "extravio", "atraso", "acidente"];
const CANAIS = ["audio", "image", "video", "text"];
const GRAVIDADES = ["baixa", "media", "alta"];

export function validarOcorrencia(
  raw: unknown,
  localDaMensagem?: Local,
): { ok: true; dado: OcorrenciaEzworker } | { ok: false; erros: string[] } {
  // aceita o objeto direto ou embrulhado em { data } / { ocorrencia }
  const r = raw as Record<string, unknown>;
  const o = (r?.ocorrencia ?? r?.data ?? r) as Record<string, unknown>;
  const erros: string[] = [];

  if (!o || typeof o !== "object") return { ok: false, erros: ["payload não é objeto"] };
  if (!TIPOS.includes(o.tipo as string)) erros.push(`tipo inválido: ${String(o.tipo)}`);
  if (!CANAIS.includes(o.canal as string)) erros.push(`canal inválido: ${String(o.canal)}`);
  if (typeof o.subtipo !== "string") erros.push("subtipo ausente");
  const local = localDaMensagem ?? o.local;
  if (!localValido(local)) erros.push("local (latitude e longitude) ausente ou inválido");
  if (o.gravidade !== undefined && !GRAVIDADES.includes(o.gravidade as string)) erros.push("gravidade inválida");
  if (o.evidencias !== undefined && !Array.isArray(o.evidencias)) erros.push("evidencias deve ser lista");
  if (o.faltando !== undefined && !Array.isArray(o.faltando)) erros.push("faltando deve ser lista");

  if (erros.length) return { ok: false, erros };

  return {
    ok: true,
    dado: {
      ...(o as unknown as OcorrenciaEzworker),
      local: local as Local,
      gravidade: (o.gravidade as OcorrenciaEzworker["gravidade"]) ?? "media",
      evidencias: (o.evidencias as OcorrenciaEzworker["evidencias"]) ?? [],
      faltando: (o.faltando as string[]) ?? [],
      confianca: (o.confianca as Record<string, number>) ?? {},
    },
  };
}
