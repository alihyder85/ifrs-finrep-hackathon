/**
 * Shared Excel workbook construction logic.
 * Used by both single-report export and consolidation export routes.
 */

import * as XLSX from "xlsx";

export type ExportFilter = "all" | "referenced" | "commented";

export interface ExportRow {
  rowIndex: number;
  sourceCode: string;
  label: string;
  section: string | null;
  displayType: string | null;
  currentValue: number | null;
  priorValue: number | null;
  varianceValue: number | null;
  variancePercent: number | null;
  referenceTag: string | null;
  commentaryText: string | null;
  commentarySource: string | null;
  // Only used in consolidated sheet
  countries?: string | null;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtNumber(val: number | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return val < 0 ? `(${formatted})` : formatted;
}

function fmtPercent(val: number | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  const abs = Math.abs(val).toFixed(1) + "%";
  return val < 0 ? `(${abs})` : abs;
}

// ─── Column widths ────────────────────────────────────────────────────────────

function autoColWidth(values: (string | null | undefined)[], min = 12, max = 60): number {
  const maxLen = values.reduce((acc, v) => {
    return v ? Math.max(acc, v.length) : acc;
  }, min);
  return Math.min(Math.max(maxLen + 2, min), max);
}

// ─── Sheet builder ────────────────────────────────────────────────────────────

interface SheetOptions {
  includeCountriesColumn?: boolean;
}

export function buildReviewSheet(
  rows: ExportRow[],
  options: SheetOptions = {}
): XLSX.WorkSheet {
  const { includeCountriesColumn = false } = options;

  const headers = [
    "Row #",
    "Source Code",
    ...(includeCountriesColumn ? ["Countries"] : []),
    "Label",
    "Section",
    "Current Period",
    "Prior Period",
    "Variance",
    "Variance %",
    "Reference",
    "Commentary",
    "Commentary Source",
  ];

  const dataRows = rows.map((r) => {
    const base = [
      r.rowIndex,
      r.sourceCode,
      ...(includeCountriesColumn ? [r.countries ?? ""] : []),
      r.label,
      r.section ?? "",
      fmtNumber(r.currentValue) ?? "",
      fmtNumber(r.priorValue) ?? "",
      fmtNumber(r.varianceValue) ?? "",
      fmtPercent(r.variancePercent) ?? "",
      r.referenceTag ?? "",
      r.commentaryText ?? "",
      r.commentarySource ?? "",
    ];
    return base;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  // ── Bold header row ────────────────────────────────────────────────────────
  const headerRange = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = { font: { bold: true } };
  }

  // ── Bold subtotal / total / header display rows ────────────────────────────
  rows.forEach((r, i) => {
    const rowNum = i + 1; // +1 for header row
    if (r.displayType === "header" || r.displayType === "subtotal" || r.displayType === "total") {
      const colCount = headers.length;
      for (let c = 0; c < colCount; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: rowNum, c });
        if (!ws[cellRef]) continue;
        ws[cellRef].s = { font: { bold: true } };
      }
    }
  });

  // ── Freeze header row ─────────────────────────────────────────────────────
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  // ── Column widths ─────────────────────────────────────────────────────────
  const colValues: string[][] = headers.map((h, ci) => [
    h,
    ...dataRows.map((r) => String(r[ci] ?? "")),
  ]);
  ws["!cols"] = colValues.map((vals) => ({
    wch: autoColWidth(vals),
  }));

  return ws;
}

/**
 * Build a sheet that matches the input country-file format:
 * Source Code | Label | Current Period | Prior Period | Variance | Variance %
 *
 * Commentaries are appended at the bottom in Layout B block format:
 *   <referenceTag> | <row label>
 *                  | • Commentary line 1
 *                  | • Commentary line 2
 *
 * No Row #, Countries, or Reference column in the grid.
 */
export function buildInputFormatSheet(rows: ExportRow[]): XLSX.WorkSheet {
  const NUM_COLS = 6;

  const headers = [
    "Source Code",
    "Label",
    "Current Period",
    "Prior Period",
    "Variance",
    "Variance %",
  ];

  const dataRows: (string | number | null)[][] = rows.map((r) => [
    r.sourceCode || "",
    r.label,
    fmtNumber(r.currentValue) ?? "",
    fmtNumber(r.priorValue) ?? "",
    fmtNumber(r.varianceValue) ?? "",
    fmtPercent(r.variancePercent) ?? "",
  ]);

  // ── Build commentary section (Layout B) ──────────────────────────────────
  const commentaryRows: (string | number | null)[][] = [];

  const rowsWithCommentary = rows.filter(
    (r) => r.referenceTag && r.commentaryText
  );

  if (rowsWithCommentary.length > 0) {
    // Blank separator row
    commentaryRows.push(Array(NUM_COLS).fill(""));

    for (const r of rowsWithCommentary) {
      // Section header: referenceTag in source-code column, label in label column
      commentaryRows.push([r.referenceTag!, r.label, "", "", "", ""]);

      // Commentary text split into bullet lines
      const lines = (r.commentaryText ?? "")
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      for (const line of lines) {
        const bullet = line.startsWith("•") || line.startsWith("-") ? line : `• ${line}`;
        commentaryRows.push(["", bullet, "", "", "", ""]);
      }
    }
  }

  const allRows = [headers, ...dataRows, ...commentaryRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // ── Bold header row ────────────────────────────────────────────────────────
  for (let c = 0; c < NUM_COLS; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = { font: { bold: true } };
  }

  // ── Bold structural rows (header/subtotal/total displayType) ──────────────
  rows.forEach((r, i) => {
    const rowNum = i + 1;
    if (r.displayType === "header" || r.displayType === "subtotal" || r.displayType === "total") {
      for (let c = 0; c < NUM_COLS; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: rowNum, c });
        if (!ws[cellRef]) continue;
        ws[cellRef].s = { font: { bold: true } };
      }
    }
  });

  // ── Freeze header row ─────────────────────────────────────────────────────
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  // ── Column widths ─────────────────────────────────────────────────────────
  const colValues: string[][] = headers.map((h, ci) => [
    h,
    ...allRows.slice(1).map((r) => String(r[ci] ?? "")),
  ]);
  ws["!cols"] = colValues.map((vals) => ({ wch: autoColWidth(vals) }));

  return ws;
}

// ─── Workbook helpers ─────────────────────────────────────────────────────────

export function createWorkbook(): XLSX.WorkBook {
  return XLSX.utils.book_new();
}

export function addSheet(wb: XLSX.WorkBook, ws: XLSX.WorkSheet, name: string): void {
  // Excel sheet names: max 31 chars, strip invalid chars
  const safeName = name.replace(/[:\\\/\?\*\[\]]/g, "_").slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeName);
}

export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ─── Commentary resolution ────────────────────────────────────────────────────

export type ResolvedCommentarySource = "USER" | "AI_ACCEPTED" | "AI_EDITED";

export interface CommentaryResolutionInput {
  commentaryText: string | null;
  refinement: {
    aiRefinedCommentary: string | null;
    refinementStatus: string;
  } | null;
}

/**
 * Resolve the final commentary text and source label for export.
 * Accepted/edited AI refinements take precedence over raw user text.
 */
export function resolveCommentary(input: CommentaryResolutionInput): {
  text: string | null;
  source: ResolvedCommentarySource | null;
} {
  if (input.refinement) {
    const { refinementStatus, aiRefinedCommentary } = input.refinement;
    if (refinementStatus === "ACCEPTED" && aiRefinedCommentary) {
      return { text: aiRefinedCommentary, source: "AI_ACCEPTED" };
    }
    if (refinementStatus === "EDITED_AND_ACCEPTED" && aiRefinedCommentary) {
      return { text: aiRefinedCommentary, source: "AI_EDITED" };
    }
  }
  if (input.commentaryText) {
    return { text: input.commentaryText, source: "USER" };
  }
  return { text: null, source: null };
}