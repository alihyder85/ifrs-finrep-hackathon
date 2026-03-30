"use client";

import { useState, useMemo } from "react";
import { Loader2, X, AlertTriangle, Download, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportOption {
  id: string;
  name: string;
  reportingPeriod: string;
  currency: string;
  sourceFileName: string;
}

interface Props {
  reports: ReportOption[];
  onClose: () => void;
}

type PeriodType = "Q" | "FY";
type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 5 + i);

export function ConsolidationModal({ reports, onClose }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [periodType, setPeriodType] = useState<PeriodType>("Q");
  const [quarter, setQuarter] = useState<Quarter>("Q1");
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  function toggleReport(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setExportError(null);
  }

  const periodMismatch = useMemo(() => {
    if (selectedIds.size < 2) return false;
    const selected = reports.filter((r) => selectedIds.has(r.id));
    const periods = new Set(selected.map((r) => r.reportingPeriod));
    return periods.size > 1;
  }, [selectedIds, reports]);

  const periodLabel = periodType === "Q" ? `${quarter} ${year}` : `FY ${year}`;

  async function generateExport() {
    if (selectedIds.size < 2) {
      setExportError("Select at least 2 reports to consolidate.");
      return;
    }

    setExporting(true);
    setExportError(null);

    try {
      const body: Record<string, unknown> = {
        reportIds: Array.from(selectedIds),
        periodType,
        year,
      };
      if (periodType === "Q") body.quarter = quarter;

      const res = await fetch("/api/reports/consolidate-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = "Export failed — please try again.";
        try {
          const data = await res.json();
          if (data.error) msg = data.error;
        } catch {}
        setExportError(msg);
        return;
      }

      const filename =
        periodType === "Q"
          ? `consolidated_${quarter}_${year}.xlsx`
          : `consolidated_FY_${year}.xlsx`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      onClose();
    } catch {
      setExportError("Network error — please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold">Consolidate & Export</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select 2 or more country reports to consolidate
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={exporting}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 flex flex-col">
          {/* Period form */}
          <div className="px-5 pt-4 pb-3 border-b border-border shrink-0 space-y-3">
            <p className="text-xs font-medium text-foreground">Reporting Period</p>

            {/* Period type toggle */}
            <div className="flex gap-2">
              {(["Q", "FY"] as PeriodType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setPeriodType(type)}
                  disabled={exporting}
                  className={cn(
                    "flex-1 py-1.5 text-xs rounded-md border font-medium transition-colors",
                    periodType === type
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:bg-muted/30"
                  )}
                >
                  {type === "Q" ? "Quarterly" : "Full Year"}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              {/* Quarter picker — only for Quarterly */}
              {periodType === "Q" && (
                <div className="relative flex-1">
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value as Quarter)}
                    disabled={exporting}
                    className="w-full appearance-none rounded-md border border-border bg-background px-3 py-1.5 text-xs pr-7 focus:outline-none focus:ring-1 focus:ring-foreground/30 disabled:opacity-50"
                  >
                    {QUARTERS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}

              {/* Year picker */}
              <div className="relative flex-1">
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  disabled={exporting}
                  className="w-full appearance-none rounded-md border border-border bg-background px-3 py-1.5 text-xs pr-7 focus:outline-none focus:ring-1 focus:ring-foreground/30 disabled:opacity-50"
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              File will be saved as{" "}
              <span className="font-mono text-foreground">
                {periodType === "Q"
                  ? `consolidated_${quarter}_${year}.xlsx`
                  : `consolidated_FY_${year}.xlsx`}
              </span>
            </p>
          </div>

          {/* Report list */}
          <div className="flex-1 px-5 py-3 space-y-1.5">
            {reports.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No reports available. Import at least 2 country reports first.
              </p>
            ) : (
              reports.map((report) => {
                const checked = selectedIds.has(report.id);
                return (
                  <label
                    key={report.id}
                    className={cn(
                      "flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors select-none",
                      checked
                        ? "border-foreground/30 bg-muted/40"
                        : "border-border hover:bg-muted/20"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 shrink-0 accent-foreground"
                      checked={checked}
                      onChange={() => toggleReport(report.id)}
                      disabled={exporting}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{report.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {report.sourceFileName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium">{report.reportingPeriod}</p>
                      <p className="text-xs text-muted-foreground font-mono">{report.currency}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0 space-y-3">
          {periodMismatch && (
            <div className="flex items-start gap-2 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-600" />
              <span>
                Selected reports have different reporting periods. Consolidation will proceed,
                but verify the periods are comparable.
              </span>
            </div>
          )}

          {exportError && (
            <p className="text-xs text-destructive">{exportError}</p>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {selectedIds.size === 0
                ? "No reports selected"
                : `${selectedIds.size} report${selectedIds.size > 1 ? "s" : ""} selected · ${periodLabel}`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={exporting}
                className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={generateExport}
                disabled={exporting || selectedIds.size < 2}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors",
                  "bg-foreground text-background hover:bg-foreground/90",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    Generate Consolidated Export
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}