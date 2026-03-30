/**
 * Main Excel parser for FINREP financial statement workbooks.
 *
 * Entry point: parseWorkbook(buffer)
 *
 * Handles TWO commentary layouts that can appear in the same sheet:
 *
 * Layout A — Inline (commentary immediately after each financial row):
 *   P110100 | Net Interest Income | 571 | ... | A1
 *            | • Fixed interest income decreased...
 *            | • Irregular deposits decreased...
 *   P120100 | Customer deposits | (84) | ...
 *
 *   Detection: after pushing a detail row with a referenceTag, subsequent
 *   text-only rows (no source code, no numeric values) are buffered as
 *   commentary for that row.
 *
 * Layout B — Block at bottom (all commentary grouped after the income statement):
 *   A1       | Net Interest Income | 571 |
 *            | • Fixed interest income decreased...
 *            | • Irregular deposits decreased...
 *   B1       | Customer deposits   | (84) |
 *            | • Interest expense decreased...
 *
 *   Detection: a row where the source-code column contains a reference-tag
 *   pattern (A1, B1, C1.1, …) instead of a P-code is treated as a commentary
 *   section header. It is NOT added to parsedRows. Subsequent text-only rows
 *   are buffered as commentary and matched to the financial row with that
 *   referenceTag in the upload route.
 *
 * Commentary rows are never added to parsedRows — they produce ParsedCommentary
 * records only, which the upload route converts to Commentary DB records.
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
  sourceCode: string;
  label: string;

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

/**
 * Commentary extracted from the sheet and associated to a financial row.
 *
 * parentRowIndex — set for Layout A (inline). The rowIndex value of the
 *   parent ParsedRow. Used for precise matching in the upload route.
 *
 * referenceTag — always set. For Layout B (block at bottom), this is the
 *   only key available; the upload route matches it against ReportRow.referenceTag.
 *
 * sourceCode — set for Layout A (copied from the parent detail row).
 *   Empty string for Layout B (resolved in the upload route after matching).
 */
export interface ParsedCommentary {
  parentRowIndex: number | null;
  sourceCode: string;
  referenceTag: string;
  commentaryText: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  commentaries: ParsedCommentary[];
  sheetName: string;
  warnings: string[];
}

const SOURCE_CODE_RE = /^P[A-Z0-9]{4,7}$/;
const REFERENCE_TAG_RE = /^[A-Z]\d+(\.\d+)?$/;

function isBlankRow(row: unknown[]): boolean {
  return row.every((v) => v === null || v === undefined || v === "");
}

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

export function parseWorkbook(buffer: Buffer): ParseResult {
  const warnings: string[] = [];

  // ── Read workbook ─────────────────────────────────────────────────────────
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
      cellNF: false,
      cellText: true,
    });
  } catch (err) {
    throw new Error(`Failed to read workbook: ${(err as Error).message}`);
  }

  if (wb.SheetNames.length === 0) {
    throw new Error("Workbook contains no sheets");
  }

  // Prefer the sheet with the most rows
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

  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: true,
  });

  if (rawRows.length === 0) {
    throw new Error(`Sheet "${sheetName}" is empty`);
  }

  const textRows: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: true,
    raw: false,
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

  // ── Commentary state ───────────────────────────────────────────────────────
  // An anchor is set either:
  //   - Layout A: when a financial detail row with a referenceTag is pushed
  //     (parentRowIndex is the index of that row in parsedRows)
  //   - Layout B: when a commentary section header is detected — a row where
  //     the source-code column holds a reference-tag pattern instead of a P-code
  //     (parentRowIndex is null; matching is done by referenceTag in upload route)
  interface CommentaryAnchor {
    referenceTag: string;
    sourceCode: string;        // empty string for Layout B
    parentRowIndex: number | null;
  }

  let commentaryAnchor: CommentaryAnchor | null = null;
  let commentaryBuffer: string[] = [];
  const parsedCommentaries: ParsedCommentary[] = [];

  function flushCommentaryBuffer(): void {
    if (commentaryAnchor && commentaryBuffer.length > 0) {
      for (const line of commentaryBuffer) {
        const text = line.trim();
        if (!text) continue;
        parsedCommentaries.push({
          parentRowIndex: commentaryAnchor.parentRowIndex,
          sourceCode: commentaryAnchor.sourceCode,
          referenceTag: commentaryAnchor.referenceTag,
          commentaryText: text,
        });
      }
    }
    commentaryBuffer = [];
  }

  // ── Process rows ──────────────────────────────────────────────────────────
  const parsedRows: ParsedRow[] = [];
  let currentSection: string | null = null;
  let rowIndex = 0;

  for (let r = 0; r < rawRows.length; r++) {
    const raw = rawRows[r];

    // ── Blank row ────────────────────────────────────────────────────────
    if (isBlankRow(raw)) {
      if (commentaryAnchor !== null) {
        // Blank rows within a commentary block are silently skipped
        continue;
      }
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

    const isDetailSource =
      sourceCodeRaw !== null && SOURCE_CODE_RE.test(sourceCodeRaw);

    // ── Layout B: commentary section header ───────────────────────────────
    // A row where the source-code column contains a reference-tag (e.g. "A1",
    // "C1.1") rather than a P-code is the start of a commentary block at the
    // bottom of the sheet.  It is consumed here and never added to parsedRows.
    const isCommentarySectionHeader =
      sourceCodeRaw !== null &&
      REFERENCE_TAG_RE.test(sourceCodeRaw) &&
      !SOURCE_CODE_RE.test(sourceCodeRaw);

    if (isCommentarySectionHeader) {
      flushCommentaryBuffer();
      commentaryAnchor = {
        referenceTag: sourceCodeRaw!,
        sourceCode: "",          // resolved against the matched ReportRow in upload
        parentRowIndex: null,    // matched by referenceTag, not by position
      };
      continue; // not a financial row — skip parsedRows
    }

    const currentValue = parseNumericValue(currentRaw);
    const priorValue = parseNumericValue(priorRaw);
    const varianceValue = parseNumericValue(varianceRaw);
    const variancePercent = parsePercentValue(variancePctRaw);

    const hasAnyNumeric =
      currentValue !== null ||
      priorValue !== null ||
      varianceValue !== null;

    // ── Layout A: inline commentary bullet row ────────────────────────────
    // While a commentary anchor is active (Layout A or B), a row with no
    // source code and no numeric values is a commentary bullet.
    if (
      commentaryAnchor !== null &&
      !isDetailSource &&
      !hasAnyNumeric &&
      labelRaw.length > 0
    ) {
      commentaryBuffer.push(labelRaw);
      continue; // not a financial row — skip parsedRows
    }

    // ── Structural row — flush any pending commentary first ───────────────
    flushCommentaryBuffer();

    // ── Determine display type ────────────────────────────────────────────
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

    // ── Push financial row ────────────────────────────────────────────────
    const thisRowIndex = rowIndex;
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
      rawPriorText: priorValueCol !== null ? textAt(r, priorValueCol) : null,
      rawVarianceText:
        varianceValueCol !== null ? textAt(r, varianceValueCol) : null,
      rawVariancePercentText:
        variancePercentCol !== null ? textAt(r, variancePercentCol) : null,
      rawReferenceText:
        referenceTagCol !== null ? textAt(r, referenceTagCol) : null,
    });

    // ── Update commentary anchor (Layout A) ───────────────────────────────
    // Set anchor when a detail row with a referenceTag is pushed.
    // Clear anchor for all other structural rows.
    if (displayType === "detail" && referenceTag !== null) {
      commentaryAnchor = {
        referenceTag,
        sourceCode: sourceCodeRaw!,
        parentRowIndex: thisRowIndex,
      };
    } else {
      commentaryAnchor = null;
    }
  }

  // Flush any commentary that trails the last row in the sheet
  flushCommentaryBuffer();

  // ── Trim leading/trailing blank rows ─────────────────────────────────────
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

  // Build original rowIndex → trimmed position map BEFORE re-indexing,
  // so Layout A commentary (which stores original parentRowIndex values)
  // can be re-mapped correctly.
  const originalToTrimmedIdx = new Map<number, number>();
  trimmed.forEach((row, i) => {
    originalToTrimmedIdx.set(row.rowIndex, i);
  });

  // Re-index
  trimmed.forEach((row, i) => {
    row.rowIndex = i;
  });

  // Re-map Layout A commentary parentRowIndex values.
  // Layout B commentaries have parentRowIndex: null — pass through unchanged.
  const remappedCommentaries = parsedCommentaries
    .map((c) => {
      if (c.parentRowIndex === null) return c; // Layout B — no re-mapping needed
      const trimmedIdx = originalToTrimmedIdx.get(c.parentRowIndex);
      if (trimmedIdx === undefined) return null; // parent was trimmed away
      return { ...c, parentRowIndex: trimmedIdx };
    })
    .filter((c): c is ParsedCommentary => c !== null);

  return { rows: trimmed, commentaries: remappedCommentaries, sheetName, warnings };
}