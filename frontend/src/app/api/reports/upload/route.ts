import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseWorkbook } from "@/lib/parser/excel-parser";

const UploadFormSchema = z.object({
  reportName: z.string().min(1, "Report name is required").max(200),
  reportingPeriod: z.string().min(1, "Reporting period is required").max(100),
  currency: z.string().min(1).max(10).default("USD"),
});

export async function POST(req: NextRequest) {
  // ── Parse multipart form data ───────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data — expected multipart/form-data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file uploaded. Include a file field in the form." },
      { status: 400 }
    );
  }

  // ── Validate metadata fields ────────────────────────────────────────────
  const metaResult = UploadFormSchema.safeParse({
    reportName: formData.get("reportName"),
    reportingPeriod: formData.get("reportingPeriod"),
    currency: formData.get("currency") ?? "USD",
  });

  if (!metaResult.success) {
    return NextResponse.json(
      {
        error: "Invalid report metadata",
        details: metaResult.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const { reportName, reportingPeriod, currency } = metaResult.data;

  // ── Validate file type ──────────────────────────────────────────────────
  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    "application/octet-stream", // some browsers send this
  ];
  const allowedExtensions = /\.(xlsx|xls)$/i;

  if (
    !allowedTypes.includes(file.type) &&
    !allowedExtensions.test(file.name)
  ) {
    return NextResponse.json(
      {
        error:
          "Unsupported file type. Please upload an Excel file (.xlsx or .xls).",
      },
      { status: 415 }
    );
  }

  // ── Read and parse the workbook ─────────────────────────────────────────
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json(
      { error: "Could not read uploaded file" },
      { status: 400 }
    );
  }

  let parseResult;
  try {
    parseResult = parseWorkbook(buffer);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to parse workbook",
        detail: (err as Error).message,
      },
      { status: 422 }
    );
  }

  const { rows, warnings } = parseResult;

  // ── Persist in a single transaction ────────────────────────────────────
  let report;
  try {
    report = await prisma.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: {
          name: reportName,
          reportingPeriod,
          currency,
          sourceFileName: file.name,
        },
      });

      await tx.reportRow.createMany({
        data: rows.map((row) => ({
          reportId: created.id,
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
          rawCurrentText: row.rawCurrentText,
          rawPriorText: row.rawPriorText,
          rawVarianceText: row.rawVarianceText,
          rawVariancePercentText: row.rawVariancePercentText,
          rawReferenceText: row.rawReferenceText,
        })),
      });

      return created;
    });
  } catch (err) {
    console.error("[upload] DB error:", err);
    return NextResponse.json(
      { error: "Failed to save report to database" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      report: {
        id: report.id,
        name: report.name,
        reportingPeriod: report.reportingPeriod,
        currency: report.currency,
        sourceFileName: report.sourceFileName,
        rowCount: rows.length,
      },
      warnings,
    },
    { status: 201 }
  );
}

// Allow up to 10 MB uploads
export const config = {
  api: {
    bodyParser: false,
  },
};