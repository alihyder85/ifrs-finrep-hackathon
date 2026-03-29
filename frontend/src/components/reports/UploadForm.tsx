"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadResult {
  report: {
    id: string;
    name: string;
    reportingPeriod: string;
    currency: string;
    sourceFileName: string;
    rowCount: number;
  };
  warnings: string[];
}

interface UploadFormProps {
  onSuccess?: (result: UploadResult) => void;
}

export function UploadForm({ onSuccess }: UploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [reportName, setReportName] = useState("");
  const [reportingPeriod, setReportingPeriod] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  function handleFile(f: File) {
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      setError("Only Excel files (.xlsx or .xls) are supported.");
      return;
    }
    setError(null);
    setResult(null);
    setFile(f);
    // Pre-fill name from filename if empty
    if (!reportName) {
      const base = f.name.replace(/\.(xlsx|xls)$/i, "").replace(/[-_]/g, " ");
      setReportName(base);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) handleFile(picked);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !reportName.trim() || !reportingPeriod.trim()) return;

    setIsUploading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("reportName", reportName.trim());
    form.append("reportingPeriod", reportingPeriod.trim());
    form.append("currency", currency);

    try {
      const res = await fetch("/api/reports/upload", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }

      setResult(data as UploadResult);
      onSuccess?.(data as UploadResult);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  function reset() {
    setFile(null);
    setReportName("");
    setReportingPeriod("");
    setCurrency("USD");
    setError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Report imported successfully
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {result.report.rowCount} rows imported from{" "}
              <span className="font-mono">{result.report.sourceFileName}</span>
            </p>
            <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{result.report.name}</span>
              <span>{result.report.reportingPeriod}</span>
              <span>{result.report.currency}</span>
            </div>
            {result.warnings.length > 0 && (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
                  Parser warnings
                </p>
                <ul className="space-y-0.5">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={reset} className="shrink-0 h-7 px-2">
            Upload another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Drop zone */}
      <div
        className={[
          "relative rounded-lg border-2 border-dashed transition-colors cursor-pointer",
          isDragOver
            ? "border-primary bg-primary/5"
            : file
            ? "border-border bg-muted/30"
            : "border-border hover:border-primary/50 hover:bg-muted/20",
        ].join(" ")}
        onClick={() => !file && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="sr-only"
          onChange={handleChange}
        />

        {file ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <FileSpreadsheet className="h-8 w-8 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Drop your Excel file here
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse — .xlsx and .xls supported
            </p>
          </div>
        )}
      </div>

      {/* Metadata fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-foreground mb-1">
            Report name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            placeholder="e.g. Q4 2024 Income Statement"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Reporting period <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={reportingPeriod}
            onChange={(e) => setReportingPeriod(e.target.value)}
            placeholder="e.g. December 2024"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="AUD">AUD</option>
            <option value="SGD">SGD</option>
            <option value="HKD">HKD</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        disabled={!file || !reportName.trim() || !reportingPeriod.trim() || isUploading}
        className="w-full"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Parsing and importing…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Import report
          </>
        )}
      </Button>
    </form>
  );
}