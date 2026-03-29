import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const putSchema = z.object({
  commentaryText: z
    .string()
    .min(1, "Commentary cannot be empty")
    .max(5000, "Commentary must be under 5000 characters"),
});

type Params = { params: Promise<{ reportId: string; rowId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { reportId, rowId } = await params;

  const row = await prisma.reportRow.findFirst({
    where: { id: rowId, reportId },
    select: { id: true },
  });

  if (!row) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }

  const commentary = await prisma.commentary.findFirst({
    where: { reportRowId: rowId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ commentary: commentary ?? null });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { reportId, rowId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const row = await prisma.reportRow.findFirst({
    where: { id: rowId, reportId },
    select: { id: true, sourceCode: true, referenceTag: true },
  });

  if (!row) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }

  const existing = await prisma.commentary.findFirst({
    where: { reportRowId: rowId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  let commentary;
  if (existing) {
    commentary = await prisma.commentary.update({
      where: { id: existing.id },
      data: { commentaryText: parsed.data.commentaryText },
    });
  } else {
    commentary = await prisma.commentary.create({
      data: {
        reportId,
        reportRowId: rowId,
        sourceCode: row.sourceCode,
        referenceTagSnapshot: row.referenceTag,
        commentaryText: parsed.data.commentaryText,
      },
    });
  }

  return NextResponse.json({ commentary }, { status: existing ? 200 : 201 });
}
