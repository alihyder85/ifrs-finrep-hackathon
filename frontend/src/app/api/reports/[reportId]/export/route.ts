import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  buildReviewSheet,
  createWorkbook,
  addSheet,
  workbookToBuffer,
  resolveCommentary,
  type ExportFilter,
} from "@/lib/export/excel-builder";

const FilterSchema = z.enum(["all", "referenced", "commented"]).default("all");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;

  const filterParam = req.nextUrl.searchParams.get("filter") ?? "all";
  const filterResult = FilterSchema.safeParse(filterParam);
  if (!filterResult.success) {
    return NextResponse.json(
      { error: "Invalid filter value. Use: all, referenced, or commented" },
      { status: 400 }
    );
  }
  const filter = filterResult.data as ExportFilter;

  // ── Fetch report with rows ────────────────────────────────────────────────
  const report = await prisma.report.findUnique({
    where: { id: reportId },
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

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // ── Apply filter ──────────────────────────────────────────────────────────
  let rows = report.rows;

  if (filter === "referenced") {
    rows = rows.filter((r) => r.referenceTag !== null);
  } else if (filter === "commented") {
    rows = rows.filter((r) => r.commentaries.length > 0);
  }

  // ── Build export rows ─────────────────────────────────────────────────────
  const exportRows = rows.map((r) => {
    const latestCommentary = r.commentaries[0] ?? null;
    const latestRefinement = r.refinements[0] ?? null;

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
      rowIndex: r.rowIndex,
      sourceCode: r.sourceCode,
      label: r.label,
      section: r.section,
      displayType: r.displayType,
      currentValue: r.currentValue,
      priorValue: r.priorValue,
      varianceValue: r.varianceValue,
      variancePercent: r.variancePercent,
      referenceTag: r.referenceTag,
      commentaryText: text,
      commentarySource: source,
    };
  });

  // ── Build workbook ────────────────────────────────────────────────────────
  try {
    const wb = createWorkbook();
    const ws = buildReviewSheet(exportRows);
    addSheet(wb, ws, "Reviewed Statement");

    const buffer = workbookToBuffer(wb);
    const safeName = report.name.replace(/[^a-zA-Z0-9_\-]/g, "_");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeName}_export.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[Export] Workbook build failed:", err);
    return NextResponse.json({ error: "Failed to generate export file" }, { status: 500 });
  }
}