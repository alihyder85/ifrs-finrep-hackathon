/**
 * Bulk AI commentary refinement — streams Server-Sent Events back to the client
 * so the UI can show real-time progress row by row.
 *
 * Event types:
 *   { type: "start",    total: number }
 *   { type: "progress", processed: number, total: number, rowId: string, label: string }
 *   { type: "result",   rowId: string, refinement: CommentaryRefinement }
 *   { type: "error",    rowId: string, message: string }
 *   { type: "complete", processed: number, total: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refineCommentary } from "@/lib/ai/commentary-refinement";

// Allow up to 5 minutes for bulk processing in production deployments.
export const maxDuration = 300;

type Params = { params: Promise<{ reportId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { reportId } = await params;

  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Fetch all rows that have at least one commentary
  const rowsWithCommentary = await prisma.reportRow.findMany({
    where: {
      reportId,
      commentaries: { some: {} },
    },
    include: {
      commentaries: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { rowIndex: "asc" },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const total = rowsWithCommentary.length;
      send({ type: "start", total });

      let processed = 0;

      for (const row of rowsWithCommentary) {
        const commentary = row.commentaries[0];
        if (!commentary) continue;

        send({ type: "progress", processed, total, rowId: row.id, label: row.label });

        try {
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
              reportRowId: row.id,
              sourceCode: row.sourceCode,
              originalCommentarySnapshot: commentary.commentaryText,
              aiRefinedCommentary: aiResult.refinedCommentary,
              aiValidationStatus: aiResult.validationStatus,
              aiIssuesJson: JSON.stringify(aiResult.issues),
              aiConfidenceNote: aiResult.confidenceNote || null,
              refinementStatus: "PENDING_REVIEW",
            },
          });

          send({ type: "result", rowId: row.id, refinement });
        } catch (err) {
          console.error(`[Bulk refine] row ${row.id}:`, err);
          send({ type: "error", rowId: row.id, message: "AI review failed for this row" });
        }

        processed++;
      }

      send({ type: "complete", processed, total });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
