/**
 * PATCH /api/reports/[reportId]/refinements/[refinementId]
 *
 * Human approval actions for an AI refinement result.
 * When accepted (or edited and accepted) the main Commentary record is updated.
 * The original CommentaryRefinement is NEVER deleted — it stays for audit.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ reportId: string; refinementId: string }> };

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("dismiss") }),
  z.object({
    action: z.literal("edit"),
    editedText: z.string().min(1).max(5000),
  }),
]);

export async function PATCH(req: NextRequest, { params }: Params) {
  const { reportId, refinementId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid action" },
      { status: 400 }
    );
  }

  const existing = await prisma.commentaryRefinement.findFirst({
    where: { id: refinementId, reportId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Refinement not found" }, { status: 404 });
  }

  const { data } = parsed;
  let newStatus: string;
  let finalText: string | null = existing.aiRefinedCommentary;

  if (data.action === "accept") {
    newStatus = "ACCEPTED";
  } else if (data.action === "dismiss") {
    newStatus = "DISMISSED";
  } else {
    newStatus = "EDITED_AND_ACCEPTED";
    finalText = data.editedText;
  }

  const refinement = await prisma.commentaryRefinement.update({
    where: { id: refinementId },
    data: {
      refinementStatus: newStatus,
      aiRefinedCommentary: finalText,
    },
  });

  // When accepted, propagate the approved text to the main Commentary record.
  // This preserves the original commentary snapshot inside CommentaryRefinement
  // while updating the live Commentary that users read.
  if (newStatus === "ACCEPTED" || newStatus === "EDITED_AND_ACCEPTED") {
    const approvedText = finalText ?? existing.originalCommentarySnapshot;

    const existingCommentary = await prisma.commentary.findFirst({
      where: { reportRowId: existing.reportRowId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (existingCommentary) {
      await prisma.commentary.update({
        where: { id: existingCommentary.id },
        data: { commentaryText: approvedText },
      });
    } else {
      await prisma.commentary.create({
        data: {
          reportId: existing.reportId,
          reportRowId: existing.reportRowId,
          sourceCode: existing.sourceCode,
          commentaryText: approvedText,
        },
      });
    }
  }

  return NextResponse.json({ refinement });
}
