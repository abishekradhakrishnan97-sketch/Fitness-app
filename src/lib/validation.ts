/** Parse a numeric text input. Returns null for empty input, NaN-safe, accepts comma decimals. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type RangeCheck = { value: number | null; error: string | null };

export function checkRange(text: string, min: number, max: number, label: string, required = false): RangeCheck {
  const value = parseNumber(text);
  if (value === null) {
    return { value: null, error: text.trim() ? `${label} must be a number.` : required ? `${label} is required.` : null };
  }
  if (value < min || value > max) return { value: null, error: `${label} must be between ${min} and ${max}.` };
  return { value, error: null };
}
