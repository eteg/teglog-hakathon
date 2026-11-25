// USD per million tokens (Anthropic first-party prices, Nov 2026).
// Haiku 5.5 prices are for prompts up to 100K tokens, which covers every extraction here.
type Price = { input: number; output: number; cacheRead: number };

const PRICES: Record<string, Price> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
};

export function costUsd(
  model: string,
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null },
): number {
  const p = PRICES[model];
  if (!p) return 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  return (usage.input_tokens * p.input + usage.output_tokens * p.output + cacheRead * p.cacheRead) / 1_000_000;
}

/** Exchange rate used to show the cost in BRL (proposal: R$ 5,87 on 18/11/2026). */
export const USD_BRL = 5.87;
