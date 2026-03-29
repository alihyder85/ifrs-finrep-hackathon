import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  referenceTag: z
    .string()
    .regex(
      /^[A-Za-z]\d+(\.\d+)*$/,
      "Reference tag must be like A1, C1.1, M1.8"
    )
    .nullable()
    .optional(),
  currentValue: z.number().nullable().optional(),
  priorValue: z.number().nullable().optional(),
  varianceValue: z.number().nullable().optional(),
  variancePercent: z.number().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string; rowId: string }> }
) {
  const { reportId, rowId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
    return NextResponse.json(
      { error: firstError ?? "Invalid input" },
      { status: 400 }
    );
  }

  const row = await prisma.reportRow.findFirst({
    where: { id: rowId, reportId },
  });

  if (!row) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }

  const { referenceTag, currentValue, priorValue, varianceValue, variancePercent } =
    parsed.data;

  const updateData: Record<string, unknown> = {};
  if (referenceTag !== undefined) updateData.referenceTag = referenceTag ?? null;
  if (currentValue !== undefined) updateData.currentValue = currentValue;
  if (priorValue !== undefined) updateData.priorValue = priorValue;
  if (varianceValue !== undefined) updateData.varianceValue = varianceValue;
  if (variancePercent !== undefined) updateData.variancePercent = variancePercent;

  const updated = await prisma.reportRow.update({
    where: { id: rowId },
    data: updateData,
  });

  return NextResponse.json({
    referenceTag: updated.referenceTag,
    currentValue: updated.currentValue,
    priorValue: updated.priorValue,
    varianceValue: updated.varianceValue,
    variancePercent: updated.variancePercent,
  });
}