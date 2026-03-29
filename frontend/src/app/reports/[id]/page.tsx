import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ReportGridClient } from "./ReportGridClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return { title: "Not Found — FinRep Review" };
  return { title: `${report.name} — FinRep Review` };
}

async function getReportWithRows(id: string) {
  return prisma.report.findUnique({
    where: { id },
    include: {
      rows: {
        orderBy: { rowIndex: "asc" },
        include: {
          _count: { select: { commentaries: true } },
        },
      },
    },
  });
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReportWithRows(id);

  if (!report) notFound();

  return <ReportGridClient report={report} />;
}