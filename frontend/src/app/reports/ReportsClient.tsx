"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Clock, Hash, ChevronRight, Layers } from "lucide-react";
import { UploadForm } from "@/components/reports/UploadForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsolidationModal } from "@/components/ConsolidationModal";

interface ReportSummary {
  id: string;
  name: string;
  reportingPeriod: string;
  currency: string;
  sourceFileName: string;
  createdAt: Date;
  _count: { rows: number };
}

interface Props {
  initialReports: ReportSummary[];
}

export function ReportsClient({ initialReports }: Props) {
  const [reports, setReports] = useState(initialReports);
  const [showConsolidationModal, setShowConsolidationModal] = useState(false);

  function handleUploadSuccess(result: {
    report: {
      id: string;
      name: string;
      reportingPeriod: string;
      currency: string;
      sourceFileName: string;
      rowCount: number;
    };
  }) {
    // Optimistically prepend the new report to the list
    setReports((prev) => [
      {
        id: result.report.id,
        name: result.report.name,
        reportingPeriod: result.report.reportingPeriod,
        currency: result.report.currency,
        sourceFileName: result.report.sourceFileName,
        createdAt: new Date(),
        _count: { rows: result.report.rowCount },
      },
      ...prev,
    ]);
  }

  return (
    <div className="space-y-8">
      {/* Upload section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Import a financial statement
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Upload an Excel workbook (.xlsx / .xls) containing a financial statement.
            The parser looks for a <span className="font-mono bg-muted px-1 rounded">source code</span> column
            (e.g. <span className="font-mono">P110100</span>), a description column,
            and numeric columns for current period, prior period, variance, and variance %.
          </p>
        </CardHeader>
        <CardContent>
          <UploadForm onSuccess={handleUploadSuccess} />
        </CardContent>
      </Card>

      {/* Reports list */}
      {reports.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Imported reports
            </h2>
            {reports.length >= 2 && (
              <button
                onClick={() => setShowConsolidationModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors font-medium"
              >
                <Layers className="h-3.5 w-3.5" />
                Consolidate &amp; Export
              </button>
            )}
          </div>
          <div className="space-y-2">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/30 transition-colors group"
              >
                <div className="h-8 w-8 rounded flex items-center justify-center bg-muted shrink-0">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {report.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {report.sourceFileName}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                  <span className="hidden sm:flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {report.reportingPeriod}
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {report._count.rows} rows
                  </span>
                  <span className="font-mono text-xs">{report.currency}</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            No reports imported yet
          </p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Use the form above to import your first financial statement.
            Once imported, you can review rows, add commentary, and attach reference tags.
          </p>
        </div>
      )}

      {showConsolidationModal && (
        <ConsolidationModal
          reports={reports}
          onClose={() => setShowConsolidationModal(false)}
        />
      )}
    </div>
  );
}