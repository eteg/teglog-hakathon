// IBGE municipality codes for the cities the demo base uses (B6).
// A production version would load the full IBGE table (5,570 municipalities).
import { normalizeName } from "./text";

const CODES: Record<string, string> = {
  "sao paulo/sp": "3550308",
  "curitiba/pr": "4106902",
  "rio de janeiro/rj": "3304557",
  "belo horizonte/mg": "3106200",
  "porto alegre/rs": "4314902",
  "florianopolis/sc": "4205407",
  "salvador/ba": "2927408",
  "brasilia/df": "5300108",
  "campinas/sp": "3509502",
  "goiania/go": "5208707",
  "joinville/sc": "4209102",
};

const BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(CODES).map(([key, code]) => [key.split("/")[0], code]),
);

export function ibgeCode(city: string | null, state: string | null): string | null {
  if (!city) return null;
  const name = normalizeName(city);
  if (state) return CODES[`${name}/${normalizeName(state)}`] ?? null;
  return BY_NAME[name] ?? null;
}
