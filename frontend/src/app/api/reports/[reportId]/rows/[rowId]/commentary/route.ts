import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const putSchema = z.object({
  commentaryText: z
    .string()
    .min(1, "Commentary cannot be empty")
    .max(5000, "Commentary must be under 5000 characters"),
  referenceTag: z
    .string()
    .regex(/^[A-Z]\d+(\.\d+)?$/, "Reference tag format must be like A1, C1.1, M1.8"),
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

  const { commentaryText, referenceTag } = parsed.data;

  let commentary;
  if (existing) {
    commentary = await prisma.commentary.update({
      where: { id: existing.id },
      data: { commentaryText, referenceTagSnapshot: referenceTag },
    });
  } else {
    commentary = await prisma.commentary.create({
      data: {
        reportId,
        reportRowId: rowId,
        sourceCode: row.sourceCode,
        referenceTagSnapshot: referenceTag,
        commentaryText,
      },
    });
  }

  // If the row had no reference tag, persist the one the user provided
  if (!row.referenceTag) {
    await prisma.reportRow.update({
      where: { id: rowId },
      data: { referenceTag },
    });
  }

  return NextResponse.json(
    { commentary, referenceTag: row.referenceTag ?? referenceTag },
    { status: existing ? 200 : 201 }
  );
}
