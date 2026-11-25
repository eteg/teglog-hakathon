// Personal data masking (B17, quality criterion 8.6). Presidio only runs in Python,
// so Brazilian recognizers are implemented here. CNPJ is not masked: it identifies a company.
export type PiiKind = "CPF" | "TELEFONE" | "PLACA" | "EMAIL";
export type PiiMap = Record<string, string>;

function validCpf(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const nums = d.split("").map(Number);
  const dv = (len: number) => {
    const r = (nums.slice(0, len).reduce((s, n, i) => s + n * (len + 1 - i), 0) * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === nums[9] && dv(10) === nums[10];
}

// Order matters: e-mail first (contains digits), CPF before phone (both can be 11 digits).
const RECOGNIZERS: { kind: PiiKind; pattern: RegExp; accept?: (match: string) => boolean }[] = [
  { kind: "EMAIL", pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  { kind: "CPF", pattern: /(?<![\d./])\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?![\d/])/g, accept: validCpf },
  { kind: "TELEFONE", pattern: /(?<![\d.\/-])(?:\+?55[\s-]?)?\(?[1-9]\d\)?[\s-]?9?\d{4}[\s-]?\d{4}(?![\d\/-])/g },
  { kind: "PLACA", pattern: /\b[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/gi },
];

/** Replaces personal data with stable placeholders ([CPF_1], [PLACA_1]...). Reuses an existing map. */
export function maskPii(text: string, map: PiiMap = {}): { masked: string; map: PiiMap } {
  const byValue = new Map(Object.entries(map).map(([placeholder, value]) => [value, placeholder]));
  const counters: Record<PiiKind, number> = { CPF: 0, TELEFONE: 0, PLACA: 0, EMAIL: 0 };
  for (const placeholder of Object.keys(map)) {
    const m = placeholder.match(/^\[(\w+)_(\d+)\]$/);
    if (m && m[1] in counters) counters[m[1] as PiiKind] = Math.max(counters[m[1] as PiiKind], Number(m[2]));
  }

  let masked = text;
  for (const r of RECOGNIZERS) {
    masked = masked.replace(r.pattern, (match) => {
      if (r.accept && !r.accept(match)) return match;
      let placeholder = byValue.get(match);
      if (!placeholder) {
        placeholder = `[${r.kind}_${++counters[r.kind]}]`;
        byValue.set(match, placeholder);
      }
      return placeholder;
    });
  }
  return { masked, map: Object.fromEntries([...byValue].map(([value, placeholder]) => [placeholder, value])) };
}

export function unmaskPii(text: string, map: PiiMap): string {
  return Object.entries(map).reduce((t, [placeholder, value]) => t.split(placeholder).join(value), text);
}

/** True when the text still contains something that looks like personal data (used by quality:pii). */
export function containsPii(text: string): boolean {
  return maskPii(text).masked !== text;
}
