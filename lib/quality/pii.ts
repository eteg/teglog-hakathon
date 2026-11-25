// Masking measurement (quality criterion 8.6). Pure: tests, scripts and /api/quality use it.
import { containsPii, maskPii } from "@/lib/pii";

export function measureMasking(samples: string[]) {
  let items = 0;
  let fullyMasked = 0;
  for (const text of samples) {
    const { masked, map } = maskPii(text);
    items += Object.keys(map).length;
    if (Object.keys(map).length > 0 && !containsPii(masked)) fullyMasked += 1;
  }
  return {
    samples: samples.length,
    itemsMasked: items,
    samplesFullyMasked: fullyMasked,
    maskedShare: samples.length ? Math.round((fullyMasked / samples.length) * 1000) / 1000 : 0,
  };
}

/** Texts that should never carry personal data (stored output, traces). Returns how many still do. */
export function countLeaks(texts: (string | null | undefined)[]): number {
  return texts.filter((t) => t && containsPii(t)).length;
}
