import { prisma } from "@/lib/prisma";
import { ReportsClient } from "./ReportsClient";

export const metadata = {
  title: "Reports — FinRep Review",
};

async function getReports() {
  return prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { rows: true } },
    },
  });
}

export default async function ReportsPage() {
  const reports = await getReports();

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-base font-semibold">Reports</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Import and review financial statements
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <ReportsClient initialReports={reports} />
        </div>
      </div>
    </div>
  );
}