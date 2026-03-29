/**
 * Main Excel parser for FINREP financial statement workbooks.
 *
 * Entry point: parseWorkbook(buffer)
 *
 * Returns structured ParsedRow records ready to insert into the database,
 * plus any diagnostic warnings.
 */

import * as XLSX from "xlsx";
import type { DisplayType } from "@/types";
import { detectColumns } from "./column-detector";
import {
  parseNumericValue,
  parsePercentValue,
  normalizeRawText,
} from "./normalizers";

export interface ParsedRow {
  rowIndex: number;

  // Source lineage
  sourceCode: string; // empty string for non-detail rows
  label: string; // empty string for blank rows

  // Classification
  section: string | null;
  displayType: DisplayType;

  // Normalized numeric values
  currentValue: number | null;
  priorValue: number | null;
  varianceValue: number | null;
  variancePercent: number | null;

  // Reference tag (optional)
  referenceTag: string | null;

  // Raw cell text for audit fidelity
  rawCurrentText: string | null;
  rawPriorText: string | null;
  rawVarianceText: string | null;
  rawVariancePercentText: string | null;
  rawReferenceText: string | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  sheetName: string;
  warnings: string[];
}

const SOURCE_CODE_RE = /^P[A-Z0-9]{4,7}$/;
const REFERENCE_TAG_RE = /^[A-Z]\d+(\.\d+)?$/;

/** Returns true if every cell in the row is null / undefined / empty string. */
function isBlankRow(row: unknown[]): boolean {
  return row.every((v) => v === null || v === undefined || v === "");
}

/** Classifies a row that has no source code. */
function classifyNonDetailRow(
  label: string,
  hasAnyNumeric: boolean
): DisplayType {
  const lc = label.toLowerCase();
  if (!label) return "blank";
  if (/\btotal\b/.test(lc)) return hasAnyNumeric ? "total" : "header";
  if (/\bsub.?total\b/.test(lc)) return "subtotal";
  return "header";
}

/**
 * Parses an Excel workbook buffer and returns structured financial rows.
 *
 * The parser:
 *  1. Reads the first sheet (or the sheet with the most rows, as a heuristic).
 *  2. Detects column positions using column-detector heuristics.
 *  3. Iterates every row, extracts and normalizes values.
 *  4. Classifies each row (detail / header / subtotal / total / blank).
 *  5. Tracks "section" context from header rows.
 *  6. Preserves raw cell text alongside normalized values.
 */
export function parseWorkbook(buffer: Buffer): ParseResult {
  const warnings: string[] = [];

  // ── Read workbook ─────────────────────────────────────────────────────────
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false, // keep dates as numbers; we don't need them here
      cellNF: false,
      cellText: true, // populate .w (formatted text) alongside .v (value)
    });
  } catch (err) {
    throw new Error(`Failed to read workbook: ${(err as Error).message}`);
  }

  if (wb.SheetNames.length === 0) {
    throw new Error("Workbook contains no sheets");
  }

  // Prefer the sheet with the most rows (likely the statement sheet)
  let sheetName = wb.SheetNames[0];
  if (wb.SheetNames.length > 1) {
    let maxRows = 0;
    for (const name of wb.SheetNames) {
      const ref = wb.Sheets[name]["!ref"];
      if (!ref) continue;
      const range = XLSX.utils.decode_range(ref);
      const rowCount = range.e.r - range.s.r + 1;
      if (rowCount > maxRows) {
        maxRows = rowCount;
        sheetName = name;
      }
    }
    if (sheetName !== wb.SheetNames[0]) {
      warnings.push(`Using sheet "${sheetName}" (most rows)`);
    }
  }

  const sheet = wb.Sheets[sheetName];

  // Get raw values as array-of-arrays; missing cells become null via defval
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: true,
  });

  if (rawRows.length === 0) {
    throw new Error(`Sheet "${sheetName}" is empty`);
  }

  // Also get formatted-text rows so we can store the raw display string
  const textRows: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: true,
    raw: false, // use formatted text (.w)
  });

  const cellAt = (rowIdx: number, colIdx: number): unknown =>
    rawRows[rowIdx]?.[colIdx] ?? null;

  const textAt = (rowIdx: number, colIdx: number): string | null => {
    const v = textRows[rowIdx]?.[colIdx];
    return v && v.trim() ? v.trim() : null;
  };

  // ── Detect columns ────────────────────────────────────────────────────────
  const { mapping, warnings: detectorWarnings } = detectColumns(rawRows);
  warnings.push(...detectorWarnings);

  const {
    sourceCodeCol,
    labelCol,
    currentValueCol,
    priorValueCol,
    varianceValueCol,
    variancePercentCol,
    referenceTagCol,
  } = mapping;

  // ── Process rows ──────────────────────────────────────────────────────────
  const parsedRows: ParsedRow[] = [];
  let currentSection: string | null = null;
  let rowIndex = 0;

  for (let r = 0; r < rawRows.length; r++) {
    const raw = rawRows[r];

    // ── Blank row ────────────────────────────────────────────────────────
    if (isBlankRow(raw)) {
      parsedRows.push({
        rowIndex: rowIndex++,
        sourceCode: "",
        label: "",
        section: currentSection,
        displayType: "blank",
        currentValue: null,
        priorValue: null,
        varianceValue: null,
        variancePercent: null,
        referenceTag: null,
        rawCurrentText: null,
        rawPriorText: null,
        rawVarianceText: null,
        rawVariancePercentText: null,
        rawReferenceText: null,
      });
      continue;
    }

    // ── Extract cell values ───────────────────────────────────────────────
    const sourceCodeRaw = normalizeRawText(cellAt(r, sourceCodeCol));
    const labelRaw = normalizeRawText(cellAt(r, labelCol)) ?? "";

    const currentRaw = cellAt(r, currentValueCol);
    const priorRaw = priorValueCol !== null ? cellAt(r, priorValueCol) : null;
    const varianceRaw =
      varianceValueCol !== null ? cellAt(r, varianceValueCol) : null;
    const variancePctRaw =
      variancePercentCol !== null ? cellAt(r, variancePercentCol) : null;
    const referenceRaw =
      referenceTagCol !== null ? cellAt(r, referenceTagCol) : null;

    // ── Determine display type ────────────────────────────────────────────
    const isDetailSource =
      sourceCodeRaw !== null && SOURCE_CODE_RE.test(sourceCodeRaw);

    const currentValue = parseNumericValue(currentRaw);
    const priorValue = parseNumericValue(priorRaw);
    const varianceValue = parseNumericValue(varianceRaw);
    const variancePercent = parsePercentValue(variancePctRaw);

    const hasAnyNumeric =
      currentValue !== null ||
      priorValue !== null ||
      varianceValue !== null;

    let displayType: DisplayType;
    if (isDetailSource) {
      displayType = "detail";
    } else {
      displayType = classifyNonDetailRow(labelRaw, hasAnyNumeric);
    }

    // ── Section tracking ──────────────────────────────────────────────────
    if (displayType === "header" && labelRaw) {
      currentSection = labelRaw;
    }

    // ── Reference tag ─────────────────────────────────────────────────────
    let referenceTag: string | null = null;
    if (referenceRaw !== null) {
      const refStr = normalizeRawText(referenceRaw);
      if (refStr && REFERENCE_TAG_RE.test(refStr)) {
        referenceTag = refStr;
      }
    }

    parsedRows.push({
      rowIndex: rowIndex++,
      sourceCode: isDetailSource ? sourceCodeRaw! : "",
      label: labelRaw,
      section: displayType === "detail" ? currentSection : null,
      displayType,
      currentValue,
      priorValue,
      varianceValue,
      variancePercent,
      referenceTag,
      rawCurrentText: textAt(r, currentValueCol),
      rawPriorText:
        priorValueCol !== null ? textAt(r, priorValueCol) : null,
      rawVarianceText:
        varianceValueCol !== null ? textAt(r, varianceValueCol) : null,
      rawVariancePercentText:
        variancePercentCol !== null ? textAt(r, variancePercentCol) : null,
      rawReferenceText:
        referenceTagCol !== null ? textAt(r, referenceTagCol) : null,
    });
  }

  // Filter out leading/trailing blank rows
  const firstNonBlank = parsedRows.findIndex((r) => r.displayType !== "blank");
  const lastNonBlank = [...parsedRows]
    .reverse()
    .findIndex((r) => r.displayType !== "blank");

  const trimmed =
    firstNonBlank === -1
      ? []
      : parsedRows.slice(
          firstNonBlank,
          parsedRows.length - (lastNonBlank === -1 ? 0 : lastNonBlank)
        );

  // Re-index after trimming
  trimmed.forEach((row, i) => {
    row.rowIndex = i;
  });

  if (trimmed.length === 0) {
    throw new Error("No parseable rows found in the sheet");
  }

  const detailCount = trimmed.filter((r) => r.displayType === "detail").length;
  if (detailCount === 0) {
    warnings.push(
      "No rows with recognised source codes were found. " +
        "The sheet may have a non-standard layout."
    );
  }

  return { rows: trimmed, sheetName, warnings };
}