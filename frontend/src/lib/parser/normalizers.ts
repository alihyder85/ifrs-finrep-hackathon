/**
 * Pure value normalization functions for Excel cell parsing.
 * All functions are side-effect free and unit-testable in isolation.
 */

/**
 * Parses a raw cell value into a number.
 *
 * Handles:
 *   - Plain numbers:         1234, 1,234, 1234.56
 *   - Negative numbers:      -496, -1,234
 *   - Bracketed negatives:   (496), (1,234), (1,234.56)
 *   - Empty/null/undefined → null
 */
export function parseNumericValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;

  // Excel may give us a real number directly
  if (typeof raw === "number") {
    return isFinite(raw) ? raw : null;
  }

  const str = String(raw).trim();
  if (!str) return null;

  // Bracketed negative: (496) or (1,234) or (1,234.56)
  const bracketMatch = str.match(/^\(([0-9,]+(?:\.[0-9]+)?)\)$/);
  if (bracketMatch) {
    const n = parseFloat(bracketMatch[1].replace(/,/g, ""));
    return isNaN(n) ? null : -n;
  }

  // Plain number with optional commas and sign
  const cleaned = str.replace(/,/g, "").replace(/\s/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) || !isFinite(n) ? null : n;
}

/**
 * Parses a variance-percent cell value into a plain number (not a fraction).
 *
 * Examples:
 *   "(70%)"  → -70
 *   "25%"    → 25
 *   "(5.3%)" → -5.3
 *   0.25     → 25    (Excel stores percentages as decimals like 0.25)
 *   "N/M"    → null  (not meaningful / divide-by-zero)
 */
export function parsePercentValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;

  // Excel stores percentage cells as decimals (e.g., 0.25 for 25%)
  if (typeof raw === "number") {
    if (!isFinite(raw)) return null;
    // Heuristic: if the absolute value is <= 10, assume it's already a decimal fraction
    return Math.abs(raw) <= 10 ? raw * 100 : raw;
  }

  const str = String(raw).trim();
  if (!str) return null;

  // Not meaningful / not applicable
  if (/^(n\/m|n\/a|-+|—|>100%|<-?100%)$/i.test(str)) return null;

  // Bracketed percent: (70%) or (5.3%)
  const bracketMatch = str.match(/^\(([0-9,]+(?:\.[0-9]+)?)%\)$/);
  if (bracketMatch) {
    const n = parseFloat(bracketMatch[1].replace(/,/g, ""));
    return isNaN(n) ? null : -n;
  }

  // Plain percent: 25% or -25%
  const percentMatch = str.match(/^(-?[0-9,]+(?:\.[0-9]+)?)%$/);
  if (percentMatch) {
    const n = parseFloat(percentMatch[1].replace(/,/g, ""));
    return isNaN(n) ? null : n;
  }

  // Fallback: treat as plain number
  return parseNumericValue(raw);
}

/**
 * Converts any cell value to a trimmed string for raw-text storage.
 * Returns null for empty/null/undefined cells.
 */
export function normalizeRawText(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  return str === "" ? null : str;
}

/**
 * Returns true if a raw cell value looks like it contains a numeric financial
 * value (plain number, bracketed negative, or percentage).
 * Used during column-type detection.
 */
export function isNumericLike(val: unknown): boolean {
  if (val === null || val === undefined || val === "") return false;
  if (typeof val === "number") return isFinite(val);

  const s = String(val).trim();
  if (!s) return false;

  // Bracketed negative
  if (/^\([0-9,]+(?:\.[0-9]+)?\)$/.test(s)) return true;
  // Percent (bracketed or plain)
  if (/^(\([0-9,.]+%\)|[0-9,.]+%)$/.test(s)) return true;
  // N/M, N/A (common in variance % columns)
  if (/^(N\/M|N\/A)$/i.test(s)) return true;

  const cleaned = s.replace(/,/g, "");
  const n = parseFloat(cleaned);
  return !isNaN(n) && isFinite(n);
}

/**
 * Returns true if a raw cell value looks like a percent-format value.
 * Used to distinguish the variance-% column from other numeric columns.
 */
export function isPercentLike(val: unknown): boolean {
  if (val === null || val === undefined || val === "") return false;
  if (typeof val === "number") return Math.abs(val) <= 10; // Excel decimal fraction heuristic

  const s = String(val).trim();
  return /^(\([0-9,.]+%\)|[0-9,.]+%|N\/M|N\/A)$/i.test(s);
}