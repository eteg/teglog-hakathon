// detect_injection_signals (B10, quality criterion 8.2): only records a signal and forces
// human review. It never changes data or blocks the report.
import type { RuleResult } from "./types";

const PATTERNS: [RegExp, string][] = [
  [/\baprov(ar|e|em|ado)\b.{0,40}\b(indeniza|pagamento|ressarc|sinistro)/i, "pede aprovação de pagamento"],
  [/\bindeniza(ç|c)(ã|a)o integral\b/i, "pede indenização integral"],
  [/\bignor(e|ar|em)\b.{0,30}\b(instru|regra|anterior|sistema)/i, "pede para ignorar instruções"],
  [/\b(sistema|system|assistente|assistant)\s*:/i, "imita mensagem do sistema"],
  [/\b(pul(e|ar)|sem)\b.{0,20}\brevis(ã|a)o\b/i, "pede para pular a revisão"],
  [/\b(pagador|payer)\s*[=:]/i, "tenta definir quem paga"],
  [/\b(drop|delete|insert|update)\s+(table|from|into)\b|;\s*--/i, "contém comando de banco de dados"],
];

export function detectInjectionSignals(texts: (string | null | undefined)[], reported: string[] = []): RuleResult<string[]> {
  const found = new Set<string>(reported.map((r) => `texto marcado pela leitura: "${r.slice(0, 80)}"`));
  for (const text of texts) {
    if (!text) continue;
    for (const [pattern, label] of PATTERNS) if (pattern.test(text)) found.add(label);
  }
  const signals = [...found];
  return signals.length
    ? {
        result: signals,
        rule: "INJECTION_SIGNAL",
        reason: `O relato tem texto com cara de instrução (${signals.join("; ")}). Tratado como dado; caso vai para revisão.`,
      }
    : { result: [], rule: "NO_INJECTION_SIGNAL", reason: "Nenhum texto com cara de instrução." };
}
