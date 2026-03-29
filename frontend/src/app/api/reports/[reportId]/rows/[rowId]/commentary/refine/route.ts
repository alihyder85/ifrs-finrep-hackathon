import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refineCommentary } from "@/lib/ai/commentary-refinement";

type Params = { params: Promise<{ reportId: string; rowId: string }> };

/** GET — load the most recent AI refinement for this row (or null). */
export async function GET(_req: NextRequest, { params }: Params) {
  const { reportId, rowId } = await params;

  try {
    const refinement = await prisma.commentaryRefinement.findFirst({
      where: { reportId, reportRowId: rowId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ refinement: refinement ?? null });
  } catch {
    return NextResponse.json({ error: "Failed to load refinement" }, { status: 500 });
  }
}

/** POST — run AI review for this row's current commentary and persist the result. */
export async function POST(_req: NextRequest, { params }: Params) {
  const { reportId, rowId } = await params;

  try {
    const [row, report] = await Promise.all([
      prisma.reportRow.findFirst({ where: { id: rowId, reportId } }),
      prisma.report.findUnique({ where: { id: reportId } }),
    ]);

    if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const commentary = await prisma.commentary.findFirst({
      where: { reportRowId: rowId },
      orderBy: { updatedAt: "desc" },
    });

    if (!commentary) {
      return NextResponse.json(
        { error: "No commentary found for this row. Write and save commentary first." },
        { status: 400 }
      );
    }

    const aiResult = await refineCommentary({
      sourceCode: row.sourceCode,
      label: row.label,
      section: row.section,
      displayType: row.displayType,
      currentValue: row.currentValue,
      priorValue: row.priorValue,
      varianceValue: row.varianceValue,
      variancePercent: row.variancePercent,
      referenceTag: row.referenceTag,
      commentaryText: commentary.commentaryText,
      reportName: report.name,
      reportingPeriod: report.reportingPeriod,
      currency: report.currency,
    });

    const refinement = await prisma.commentaryRefinement.create({
      data: {
        reportId,
        reportRowId: rowId,
        sourceCode: row.sourceCode,
        originalCommentarySnapshot: commentary.commentaryText,
        aiRefinedCommentary: aiResult.refinedCommentary,
        aiValidationStatus: aiResult.validationStatus,
        aiIssuesJson: JSON.stringify(aiResult.issues),
        aiConfidenceNote: aiResult.confidenceNote || null,
        refinementStatus: "PENDING_REVIEW",
      },
    });

    return NextResponse.json({ refinement });
  } catch (err) {
    console.error("[POST /commentary/refine]", err);
    return NextResponse.json({ error: "Failed to run AI refinement" }, { status: 500 });
  }
}
