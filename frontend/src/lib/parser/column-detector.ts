/**
 * Column detection for FINREP / financial statement Excel sheets.
 *
 * Strategy:
 *   1. Source-code column  — highest density of cells matching /^P[A-Z0-9]{4,7}$/
 *   2. Label column        — first text-heavy column that is not the source-code column
 *   3. Numeric columns     — columns after the label with > 40% numeric-like cells
 *   4. Variance-% column   — numeric column with highest proportion of %-format cells
 *   5. Reference-tag column — rightmost column with ref-tag patterns (A1, C1.1, …)
 */

import { isNumericLike, isPercentLike } from "./normalizers";

export interface ColumnMapping {
  sourceCodeCol: number;
  labelCol: number;
  currentValueCol: number;
  priorValueCol: number | null;
  varianceValueCol: number | null;
  variancePercentCol: number | null;
  referenceTagCol: number | null;
}

export interface ColumnDetectionResult {
  mapping: ColumnMapping;
  warnings: string[];
}

/** Source system row codes: P110100, PE00000, PG81112, etc. */
const SOURCE_CODE_RE = /^P[A-Z0-9]{4,7}$/;

/** Reference tags: A1, B1, C1.1, M1.8, D1, etc. */
const REFERENCE_TAG_RE = /^[A-Z]\d+(\.\d+)?$/;

function nonEmpty(col: unknown[]): unknown[] {
  return col.filter((v) => v !== null && v !== undefined && v !== "");
}

function countIf(col: unknown[], pred: (v: unknown) => boolean): number {
  return col.filter(pred).length;
}

/**
 * Detects column positions from a raw sheet represented as an array of arrays.
 * Pass the full sheet (including any header rows); the detector samples all rows.
 */
export function detectColumns(rows: unknown[][]): ColumnDetectionResult {
  const warnings: string[] = [];

  if (rows.length === 0) throw new Error("Sheet is empty");

  const colCount = Math.max(...rows.map((r) => r.length), 0);
  if (colCount < 2) throw new Error("Sheet has too few columns to parse");

  // Build per-column arrays for analysis
  const cols: unknown[][] = Array.from({ length: colCount }, (_, c) =>
    rows.map((r) => r[c] ?? null)
  );

  // ── 1. Source-code column ────────────────────────────────────────────────
  const sourceScores = cols.map((col) =>
    countIf(nonEmpty(col), (v) => SOURCE_CODE_RE.test(String(v).trim()))
  );
  const maxSourceScore = Math.max(...sourceScores);

  let sourceCodeCol: number;
  if (maxSourceScore > 0) {
    sourceCodeCol = sourceScores.indexOf(maxSourceScore);
  } else {
    warnings.push(
      "Could not detect source-code column via pattern; defaulting to column 0"
    );
    sourceCodeCol = 0;
  }

  // ── 2. Label column ──────────────────────────────────────────────────────
  // First column (left-to-right) that has > 30 % non-numeric text cells
  // and is not the source-code column.
  let labelCol = -1;
  for (let c = 0; c < colCount; c++) {
    if (c === sourceCodeCol) continue;
    const ne = nonEmpty(cols[c]);
    if (ne.length < 2) continue;

    const textCount = ne.filter((v) => {
      if (typeof v === "number") return false;
      const s = String(v).trim();
      if (!s) return false;
      if (SOURCE_CODE_RE.test(s)) return false;
      if (REFERENCE_TAG_RE.test(s)) return false;
      if (isNumericLike(v)) return false;
      return true;
    }).length;

    if (textCount / ne.length > 0.3 && textCount >= 2) {
      labelCol = c;
      break;
    }
  }

  if (labelCol === -1) {
    labelCol = sourceCodeCol === 0 ? 1 : 0;
    warnings.push(
      `Could not detect label column; defaulting to column ${labelCol}`
    );
  }

  // ── 3. Numeric columns ───────────────────────────────────────────────────
  // Scan columns to the right of both sourceCodeCol and labelCol.
  const scanFrom = Math.max(sourceCodeCol, labelCol) + 1;
  const numericCols: number[] = [];

  for (let c = scanFrom; c < colCount; c++) {
    const ne = nonEmpty(cols[c]);
    if (ne.length < 2) continue;
    const numCount = countIf(ne, isNumericLike);
    if (numCount / ne.length > 0.4) {
      numericCols.push(c);
    }
  }

  // ── 4. Variance-% column ─────────────────────────────────────────────────
  // Among numeric columns, the one with the highest proportion of %-format cells.
  let variancePercentCol: number | null = null;
  let bestPercentRatio = 0;

  for (const c of numericCols) {
    const ne = nonEmpty(cols[c]);
    if (ne.length === 0) continue;
    const pctCount = countIf(ne, isPercentLike);
    const ratio = pctCount / ne.length;
    if (ratio > 0.3 && ratio > bestPercentRatio) {
      bestPercentRatio = ratio;
      variancePercentCol = c;
    }
  }

  // Ordered numeric columns (excluding the percent column)
  const valueNumericCols = numericCols.filter((c) => c !== variancePercentCol);

  const currentValueCol = valueNumericCols[0] ?? -1;
  const priorValueCol = valueNumericCols[1] ?? null;
  const varianceValueCol = valueNumericCols[2] ?? null;

  if (currentValueCol === -1) {
    throw new Error(
      "Could not detect any numeric value column in the sheet. " +
        "Ensure the file contains numeric financial data."
    );
  }

  if (priorValueCol === null) {
    warnings.push("Could not detect prior-period value column");
  }

  // ── 5. Reference-tag column ──────────────────────────────────────────────
  // Rightmost column (not already classified) where >= 1 cell matches the
  // reference-tag pattern and the hit-rate is > 10 %.
  let referenceTagCol: number | null = null;
  const classifiedCols = new Set([
    sourceCodeCol,
    labelCol,
    currentValueCol,
    ...(priorValueCol !== null ? [priorValueCol] : []),
    ...(varianceValueCol !== null ? [varianceValueCol] : []),
    ...(variancePercentCol !== null ? [variancePercentCol] : []),
  ]);

  for (let c = colCount - 1; c > labelCol; c--) {
    if (classifiedCols.has(c)) continue;
    const ne = nonEmpty(cols[c]);
    if (ne.length === 0) continue;
    const refCount = countIf(ne, (v) =>
      REFERENCE_TAG_RE.test(String(v).trim())
    );
    if (refCount >= 1 && refCount / ne.length > 0.1) {
      referenceTagCol = c;
      break;
    }
  }

  return {
    mapping: {
      sourceCodeCol,
      labelCol,
      currentValueCol,
      priorValueCol,
      varianceValueCol,
      variancePercentCol,
      referenceTagCol,
    },
    warnings,
  };
}