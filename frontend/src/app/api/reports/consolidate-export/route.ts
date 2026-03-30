import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  buildInputFormatSheet,
  buildReviewSheet,
  createWorkbook,
  addSheet,
  workbookToBuffer,
  resolveCommentary,
} from "@/lib/export/excel-builder";
import { consolidateRows } from "@/lib/export/consolidation";
import { synthesiseCommentary, type SynthesisInputRow } from "@/lib/export/commentary-synthesis";

const RequestSchema = z.object({
  reportIds: z.array(z.string().cuid()).min(2, "Select at least 2 reports to consolidate"),
  periodType: z.enum(["Q", "FY"]),
  year: z.number().int().min(2000).max(2100),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]).optional(),
});

export async function POST(req: NextRequest) {
  // ── Parse + validate request body ────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { reportIds, periodType, year, quarter } = parsed.data;

  if (periodType === "Q" && !quarter) {
    return NextResponse.json(
      { error: "Quarter is required when periodType is Q" },
      { status: 422 }
    );
  }

  // Build the period suffix for the filename: Q1_2025 or FY_2025
  const periodSuffix = periodType === "Q" ? `${quarter}_${year}` : `FY_${year}`;
  const filename = `consolidated_${periodSuffix}.xlsx`;

  // ── Fetch all selected reports with rows + commentaries ───────────────────
  const reports = await prisma.report.findMany({
    where: { id: { in: reportIds } },
    include: {
      rows: {
        orderBy: { rowIndex: "asc" },
        include: {
          commentaries: {
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
          refinements: {
            where: {
              refinementStatus: { in: ["ACCEPTED", "EDITED_AND_ACCEPTED"] },
            },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (reports.length < 2) {
    return NextResponse.json(
      { error: "Could not find the requested reports. Ensure all report IDs are valid." },
      { status: 404 }
    );
  }

  // Preserve the order from the request (first = primary)
  const orderedReports = reportIds
    .map((id) => reports.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => r !== undefined);

  // ── Step 1: Numeric aggregation (deterministic) ───────────────────────────
  const consolidationInput = orderedReports.map((r) => ({
    id: r.id,
    name: r.name,
    reportingPeriod: r.reportingPeriod,
    rows: r.rows.map((row) => ({
      sourceCode: row.sourceCode,
      label: row.label,
      section: row.section,
      displayType: row.displayType,
      rowIndex: row.rowIndex,
      currentValue: row.currentValue,
      priorValue: row.priorValue,
      referenceTag: row.referenceTag,
    })),
  }));

  const consolidatedRows = consolidateRows(consolidationInput);

  // ── Step 2: Build per-row commentary map for each country ─────────────────
  const countryCommentaryMap = new Map<
    string,
    { country: string; reportingPeriod: string; commentaryText: string }[]
  >();

  for (const report of orderedReports) {
    for (const row of report.rows) {
      const latestCommentary = row.commentaries[0] ?? null;
      const latestRefinement = row.refinements[0] ?? null;

      const { text } = resolveCommentary({
        commentaryText: latestCommentary?.commentaryText ?? null,
        refinement: latestRefinement
          ? {
              aiRefinedCommentary: latestRefinement.aiRefinedCommentary,
              refinementStatus: latestRefinement.refinementStatus,
            }
          : null,
      });

      if (!text) continue;

      const existing = countryCommentaryMap.get(row.sourceCode) ?? [];
      existing.push({
        country: report.name,
        reportingPeriod: report.reportingPeriod,
        commentaryText: text,
      });
      countryCommentaryMap.set(row.sourceCode, existing);
    }
  }

  // ── Step 3: LLM commentary synthesis ─────────────────────────────────────
  const synthesisInputRows: SynthesisInputRow[] = [];

  for (const row of consolidatedRows) {
    const countryCommentaries = countryCommentaryMap.get(row.sourceCode);
    if (!countryCommentaries || countryCommentaries.length === 0) continue;

    synthesisInputRows.push({
      sourceCode: row.sourceCode,
      label: row.label,
      consolidatedCurrentValue: row.currentValue,
      consolidatedPriorValue: row.priorValue,
      countryCommentaries,
    });
  }

  const synthesisResultMap = await synthesiseCommentary(synthesisInputRows);

  // ── Step 4: Build workbook ────────────────────────────────────────────────
  try {
    const wb = createWorkbook();

    // Sheet 1: Consolidated — input-file format with commentary block at bottom
    const consolidatedExportRows = consolidatedRows.map((row) => ({
      rowIndex: row.rowIndex,
      sourceCode: row.sourceCode,
      label: row.label,
      section: row.section,
      displayType: row.displayType,
      currentValue: row.currentValue,
      priorValue: row.priorValue,
      varianceValue: row.varianceValue,
      variancePercent: row.variancePercent,
      referenceTag: row.referenceTag,
      commentaryText: synthesisResultMap.get(row.sourceCode) ?? null,
      commentarySource: synthesisResultMap.has(row.sourceCode) ? "CONSOLIDATED" : null,
    }));

    const consolidatedSheet = buildInputFormatSheet(consolidatedExportRows);
    addSheet(wb, consolidatedSheet, "Consolidated");

    // Sheets 2..N: One per country (input-file format)
    for (const report of orderedReports) {
      const countryExportRows = report.rows.map((row) => {
        const latestCommentary = row.commentaries[0] ?? null;
        const latestRefinement = row.refinements[0] ?? null;

        const { text, source } = resolveCommentary({
          commentaryText: latestCommentary?.commentaryText ?? null,
          refinement: latestRefinement
            ? {
                aiRefinedCommentary: latestRefinement.aiRefinedCommentary,
                refinementStatus: latestRefinement.refinementStatus,
              }
            : null,
        });

        return {
          rowIndex: row.rowIndex,
          sourceCode: row.sourceCode,
          label: row.label,
          section: row.section,
          displayType: row.displayType,
          currentValue: row.currentValue,
          priorValue: row.priorValue,
          varianceValue: row.varianceValue,
          variancePercent: row.variancePercent,
          referenceTag: row.referenceTag,
          commentaryText: text,
          commentarySource: source,
        };
      });

      const countrySheet = buildReviewSheet(countryExportRows);
      addSheet(wb, countrySheet, report.name);
    }

    const buffer = workbookToBuffer(wb);

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[Consolidate Export] Workbook build failed:", err);
    return NextResponse.json({ error: "Failed to generate consolidated export file" }, { status: 500 });
  }
}