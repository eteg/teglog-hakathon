/** Lowercase, no accents, single spaces: for comparing names typed in different ways. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const onlyDigits = (value: string) => value.replace(/\D/g, "");
