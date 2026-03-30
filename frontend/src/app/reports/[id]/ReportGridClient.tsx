"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import {
  ArrowLeft,
  MessageSquare,
  Tag,
  Hash,
  Calendar,
  Coins,
  FileSpreadsheet,
  X,
  Pencil,
  Check,
  Save,
  Loader2,
  Sparkles,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Download,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AIRefinementPanel } from "@/components/reports/AIRefinementPanel";
import { BulkRefinementModal } from "@/components/reports/BulkRefinementModal";
import { useToast } from "@/components/ui/toast";

const REFERENCE_TAG_REGEX = /^[A-Za-z]\d+(\.\d+)*$/;

type CommentaryRecord = {
  id: string;
  commentaryText: string;
  sourceCode: string;
  referenceTagSnapshot: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReportRow = {
  id: string;
  rowIndex: number;
  sourceCode: string;
  label: string;
  section: string | null;
  displayType: string | null;
  currentValue: number | null;
  priorValue: number | null;
  varianceValue: number | null;
  variancePercent: number | null;
  referenceTag: string | null;
  _count: { commentaries: number };
};

type Report = {
  id: string;
  name: string;
  reportingPeriod: string;
  currency: string;
  sourceFileName: string;
  createdAt: Date;
  rows: ReportRow[];
};

interface Props {
  report: Report;
}

function formatNumber(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return val < 0 ? `(${formatted})` : formatted;
}

function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  const abs = Math.abs(val);
  const formatted = abs.toFixed(1) + "%";
  return val < 0 ? `(${formatted})` : formatted;
}

const columnHelper = createColumnHelper<ReportRow>();

export function ReportGridClient({ report }: Props) {
  const toast = useToast();

  const [rows, setRows] = useState<ReportRow[]>(report.rows);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Reference tag edit state
  const [editingTag, setEditingTag] = useState(false);
  const [tagValue, setTagValue] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  // Value editing state
  const [editingValues, setEditingValues] = useState(false);
  const [valueInputs, setValueInputs] = useState({
    current: "",
    prior: "",
    variance: "",
    varPercent: "",
  });
  const [valueSaving, setValueSaving] = useState(false);
  const [valueError, setValueError] = useState<string | null>(null);

  // Commentary state
  const [commentary, setCommentary] = useState<CommentaryRecord | null>(null);
  const [commentaryText, setCommentaryText] = useState("");
  const [commentaryLoading, setCommentaryLoading] = useState(false);
  const [commentarySaving, setCommentarySaving] = useState(false);
  const [commentaryError, setCommentaryError] = useState<string | null>(null);
  const [commentarySaved, setCommentarySaved] = useState(false);
  const [commentaryRefTag, setCommentaryRefTag] = useState("");
  const [commentaryRefTagError, setCommentaryRefTagError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the saved text to detect unsaved changes
  const savedCommentaryText = commentary?.commentaryText ?? "";
  const isDirty = commentaryText !== savedCommentaryText && !commentaryLoading;

  // Bulk AI refinement modal
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Export dropdown
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  async function downloadExport(filter: "all" | "referenced" | "commented") {
    setExportMenuOpen(false);
    setExportLoading(true);
    try {
      const res = await fetch(`/api/reports/${report.id}/export?filter=${filter}`);
      if (!res.ok) {
        toast("error", "Export failed — please try again");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_export.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast("error", "Network error — export not downloaded");
    } finally {
      setExportLoading(false);
    }
  }

  // Navigable rows (skip blank and header rows)
  const navigableRows = useMemo(
    () => rows.filter((r) => r.displayType !== "blank" && r.displayType !== "header"),
    [rows]
  );

  function startEditValues(row: ReportRow) {
    setValueInputs({
      current: row.currentValue !== null ? String(row.currentValue) : "",
      prior: row.priorValue !== null ? String(row.priorValue) : "",
      variance: row.varianceValue !== null ? String(row.varianceValue) : "",
      varPercent: row.variancePercent !== null ? String(row.variancePercent) : "",
    });
    setValueError(null);
    setEditingValues(true);
  }

  function cancelEditValues() {
    setEditingValues(false);
    setValueError(null);
  }

  function recalculateVariance() {
    const cur = parseFloat(valueInputs.current);
    const pri = parseFloat(valueInputs.prior);
    if (isNaN(cur) || isNaN(pri)) return;
    const variance = cur - pri;
    const varPct = pri !== 0 ? (variance / Math.abs(pri)) * 100 : null;
    setValueInputs((prev) => ({
      ...prev,
      variance: String(variance),
      varPercent: varPct !== null ? String(parseFloat(varPct.toFixed(2))) : "",
    }));
  }

  function parseNumericInput(val: string): number | null {
    const trimmed = val.trim();
    if (trimmed === "" || trimmed === "—") return null;
    // Support bracketed negatives like (496)
    const bracketed = trimmed.match(/^\(([0-9.,]+)\)$/);
    if (bracketed) return -parseFloat(bracketed[1].replace(/,/g, ""));
    const n = parseFloat(trimmed.replace(/,/g, ""));
    return isNaN(n) ? null : n;
  }

  async function saveValues() {
    if (!selectedRow) return;

    const currentValue = parseNumericInput(valueInputs.current);
    const priorValue = parseNumericInput(valueInputs.prior);
    const varianceValue = parseNumericInput(valueInputs.variance);
    const variancePercent = parseNumericInput(valueInputs.varPercent);

    // Validate — at least one must be non-empty
    const allBlank =
      valueInputs.current.trim() === "" &&
      valueInputs.prior.trim() === "" &&
      valueInputs.variance.trim() === "" &&
      valueInputs.varPercent.trim() === "";

    if (allBlank) {
      setValueError("Enter at least one value to update");
      return;
    }

    // Check for parse errors on non-blank fields
    if (valueInputs.current.trim() !== "" && currentValue === null) {
      setValueError("Current value is not a valid number");
      return;
    }
    if (valueInputs.prior.trim() !== "" && priorValue === null) {
      setValueError("Prior value is not a valid number");
      return;
    }
    if (valueInputs.variance.trim() !== "" && varianceValue === null) {
      setValueError("Variance is not a valid number");
      return;
    }
    if (valueInputs.varPercent.trim() !== "" && variancePercent === null) {
      setValueError("Variance % is not a valid number");
      return;
    }

    setValueSaving(true);
    setValueError(null);

    try {
      const res = await fetch(
        `/api/reports/${report.id}/rows/${selectedRow.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentValue, priorValue, varianceValue, variancePercent }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setValueError(data.error ?? "Failed to save values");
        return;
      }

      // Sync rows state so grid reflects updated figures
      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedRow.id
            ? {
                ...r,
                currentValue: data.currentValue,
                priorValue: data.priorValue,
                varianceValue: data.varianceValue,
                variancePercent: data.variancePercent,
              }
            : r
        )
      );

      setEditingValues(false);
      toast("success", "Values updated");
    } catch {
      toast("error", "Network error — values not saved");
    } finally {
      setValueSaving(false);
    }
  }

  function confirmDiscardIfDirty(): boolean {
    if (!isDirty) return true;
    return window.confirm(
      "You have unsaved commentary changes. Switch rows and discard them?"
    );
  }

  function handleSelectRow(id: string) {
    if (id === selectedRowId) {
      if (!confirmDiscardIfDirty()) return;
      setSelectedRowId(null);
      return;
    }
    if (!confirmDiscardIfDirty()) return;
    const row = rows.find((r) => r.id === id);
    setCommentaryRefTag(row?.referenceTag ?? "");
    setCommentaryRefTagError(null);
    setSelectedRowId(id);
    setEditingTag(false);
    setTagError(null);
    setEditingValues(false);
    setValueError(null);
    setCommentaryError(null);
    setCommentarySaved(false);
  }

  // Keyboard navigation: ArrowDown / ArrowUp when not typing in a field
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!selectedRowId) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = navigableRows.findIndex((r) => r.id === selectedRowId);
        if (idx === -1) return;
        const nextIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
        const nextRow = navigableRows[nextIdx];
        if (nextRow) handleSelectRow(nextRow.id);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRowId, navigableRows, isDirty]);

  // Fetch commentary when selected row changes
  useEffect(() => {
    if (!selectedRowId) return;
    const row = rows.find((r) => r.id === selectedRowId);
    if (!row) return;

    if (row._count.commentaries === 0) {
      setCommentary(null);
      setCommentaryText("");
      return;
    }

    setCommentaryLoading(true);
    setCommentary(null);
    setCommentaryText("");

    fetch(`/api/reports/${report.id}/rows/${selectedRowId}/commentary`)
      .then((res) => res.json())
      .then((data) => {
        if (data.commentary) {
          setCommentary(data.commentary);
          setCommentaryText(data.commentary.commentaryText);
        }
      })
      .catch(() => {
        toast("error", "Failed to load commentary — please try again");
      })
      .finally(() => setCommentaryLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRowId]);

  function startEditTag(row: ReportRow) {
    setTagValue(row.referenceTag ?? "");
    setTagError(null);
    setEditingTag(true);
  }

  function cancelEditTag() {
    setEditingTag(false);
    setTagError(null);
  }

  async function saveTag() {
    if (!selectedRow) return;
    const trimmed = tagValue.trim().toUpperCase();

    if (trimmed && !REFERENCE_TAG_REGEX.test(trimmed)) {
      setTagError("Format must be like A1, C1.1, M1.8");
      return;
    }

    setTagSaving(true);
    setTagError(null);

    try {
      const res = await fetch(
        `/api/reports/${report.id}/rows/${selectedRow.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referenceTag: trimmed || null }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setTagError(data.error ?? "Failed to save");
        return;
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedRow.id ? { ...r, referenceTag: data.referenceTag } : r
        )
      );
      setEditingTag(false);
      toast(
        "success",
        trimmed
          ? `Reference tag set to ${data.referenceTag}`
          : "Reference tag removed"
      );
    } catch {
      toast("error", "Network error — reference tag not saved");
    } finally {
      setTagSaving(false);
    }
  }

  async function saveCommentary() {
    if (!selectedRow) return;
    const text = commentaryText.trim();
    if (!text) {
      setCommentaryError("Commentary cannot be empty");
      return;
    }

    // Require a reference tag — either already on the row or entered by user
    const refTag = selectedRow.referenceTag ?? commentaryRefTag.trim().toUpperCase();
    if (!refTag) {
      setCommentaryRefTagError("Reference tag is required before saving commentary");
      return;
    }
    if (!REFERENCE_TAG_REGEX.test(refTag)) {
      setCommentaryRefTagError("Format must be like A1, C1.1, M1.8");
      return;
    }

    setCommentarySaving(true);
    setCommentaryError(null);
    setCommentaryRefTagError(null);

    try {
      const res = await fetch(
        `/api/reports/${report.id}/rows/${selectedRow.id}/commentary`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentaryText: text, referenceTag: refTag }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setCommentaryError(data.error ?? "Failed to save");
        toast("error", data.error ?? "Failed to save commentary");
        return;
      }

      setCommentary(data.commentary);
      setCommentaryText(data.commentary.commentaryText);

      // Sync grid: commentary dot + referenceTag if it was just assigned
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== selectedRow.id) return r;
          return {
            ...r,
            referenceTag: data.referenceTag ?? r.referenceTag,
            _count: {
              commentaries: r._count.commentaries === 0 ? 1 : r._count.commentaries,
            },
          };
        })
      );

      setCommentarySaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setCommentarySaved(false), 2500);
    } catch {
      toast("error", "Network error — commentary not saved");
    } finally {
      setCommentarySaving(false);
    }
  }

  const selectedRow = rows.find((r) => r.id === selectedRowId);

  // Position within navigable rows for the panel footer
  const navigableIndex = selectedRowId
    ? navigableRows.findIndex((r) => r.id === selectedRowId)
    : -1;

  const columns = useMemo(
    () => [
      columnHelper.accessor("sourceCode", {
        header: "Source Code",
        size: 112,
        cell: (info) => {
          const val = info.getValue();
          const displayType = info.row.original.displayType;
          if (displayType === "header" || displayType === "blank" || !val)
            return null;
          return (
            <span className="font-mono text-xs text-slate-400 tracking-wide select-all">
              {val}
            </span>
          );
        },
      }),
      columnHelper.accessor("label", {
        header: "Description",
        cell: (info) => {
          const displayType = info.row.original.displayType;
          return (
            <span
              className={cn("text-sm leading-tight", {
                "font-semibold text-xs uppercase tracking-wider text-muted-foreground":
                  displayType === "header",
                "font-semibold text-foreground": displayType === "subtotal",
                "font-bold text-foreground": displayType === "total",
                "pl-5 text-foreground": displayType === "detail",
                "text-foreground": !displayType,
              })}
            >
              {info.getValue()}
            </span>
          );
        },
      }),
      columnHelper.accessor("currentValue", {
        header: "Current",
        size: 112,
        cell: (info) => {
          const val = info.getValue();
          const displayType = info.row.original.displayType;
          if (displayType === "header") return null;
          return (
            <span
              className={cn("num text-sm", {
                "num-negative": val !== null && val < 0,
                "font-semibold":
                  displayType === "subtotal" || displayType === "total",
                "font-bold": displayType === "total",
              })}
            >
              {formatNumber(val)}
            </span>
          );
        },
      }),
      columnHelper.accessor("priorValue", {
        header: "Prior",
        size: 112,
        cell: (info) => {
          const val = info.getValue();
          const displayType = info.row.original.displayType;
          if (displayType === "header") return null;
          return (
            <span
              className={cn("num text-sm", {
                "num-negative": val !== null && val < 0,
                "font-semibold":
                  displayType === "subtotal" || displayType === "total",
                "font-bold": displayType === "total",
              })}
            >
              {formatNumber(val)}
            </span>
          );
        },
      }),
      columnHelper.accessor("varianceValue", {
        header: "Variance",
        size: 112,
        cell: (info) => {
          const val = info.getValue();
          const displayType = info.row.original.displayType;
          if (displayType === "header") return null;
          return (
            <span
              className={cn("num text-sm font-medium", {
                "num-negative": val !== null && val < 0,
                "num-positive": val !== null && val > 0,
                "font-semibold":
                  displayType === "subtotal" || displayType === "total",
                "font-bold": displayType === "total",
              })}
            >
              {formatNumber(val)}
            </span>
          );
        },
      }),
      columnHelper.accessor("variancePercent", {
        header: "Var %",
        size: 88,
        cell: (info) => {
          const val = info.getValue();
          const displayType = info.row.original.displayType;
          if (displayType === "header") return null;
          return (
            <span
              className={cn("num text-sm font-medium", {
                "num-negative": val !== null && val < 0,
                "num-positive": val !== null && val > 0,
              })}
            >
              {formatPercent(val)}
            </span>
          );
        },
      }),
      columnHelper.accessor("referenceTag", {
        header: "Ref",
        size: 72,
        cell: (info) => {
          const tag = info.getValue();
          if (!tag)
            return (
              <span className="block text-center text-muted-foreground/40 text-xs select-none">
                ·
              </span>
            );
          return (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200 tabular-nums">
              {tag}
            </span>
          );
        },
      }),
      columnHelper.accessor((row) => row._count.commentaries, {
        id: "commentaryStatus",
        header: "",
        size: 36,
        cell: (info) => {
          const count = info.getValue();
          return (
            <div className="flex justify-center">
              <div
                title={
                  count > 0
                    ? `${count} comment${count !== 1 ? "s" : ""}`
                    : "No commentary"
                }
                className={cn("h-2 w-2 rounded-full", {
                  "bg-emerald-400": count > 0,
                  "bg-slate-200": count === 0,
                })}
              />
            </div>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const rowsWithCommentary = rows.filter((r) => r._count.commentaries > 0).length;
  const rowsWithRef = rows.filter((r) => r.referenceTag).length;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-start gap-3">
          <Link
            href="/reports"
            className="shrink-0 mt-0.5 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate leading-tight">
              {report.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
              <MetaItem icon={<Calendar className="h-3 w-3" />} label={report.reportingPeriod} />
              <MetaItem icon={<Coins className="h-3 w-3" />} label={report.currency} mono />
              <MetaItem
                icon={<FileSpreadsheet className="h-3 w-3" />}
                label={report.sourceFileName}
                className="hidden sm:flex max-w-[220px] truncate"
              />
              <MetaItem
                icon={<Hash className="h-3 w-3" />}
                label={`${report.rows.length} rows`}
              />
              {rowsWithRef > 0 && (
                <MetaItem
                  icon={<Tag className="h-3 w-3" />}
                  label={`${rowsWithRef} referenced`}
                />
              )}
              {rowsWithCommentary > 0 && (
                <MetaItem
                  icon={<MessageSquare className="h-3 w-3" />}
                  label={`${rowsWithCommentary} commented`}
                  className="text-emerald-600"
                />
              )}
            </div>

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {rowsWithCommentary > 0 && (
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium border border-input bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Sparkles className="h-3 w-3 text-blue-500" />
                  AI based commentary refinement
                </button>
              )}

              {/* Export dropdown */}
              <div className="relative">
                <button
                  onClick={() => setExportMenuOpen((v) => !v)}
                  disabled={exportLoading}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium border border-input bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {exportLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  Export
                  <ChevronDown className="h-3 w-3" />
                </button>

                {exportMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setExportMenuOpen(false)}
                    />
                    <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-md border border-border bg-background shadow-md py-1">
                      {[
                        { label: "Export All Rows", filter: "all" as const },
                        { label: "Referenced Rows Only", filter: "referenced" as const },
                        { label: "Commented Rows Only", filter: "commented" as const },
                      ].map(({ label, filter }) => (
                        <button
                          key={filter}
                          onClick={() => downloadExport(filter)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid + panel area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Scrollable table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const colId = header.column.id;
                    return (
                      <th
                        key={header.id}
                        className={cn(
                          "px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap",
                          colId === "sourceCode" || colId === "commentaryStatus"
                            ? "text-center"
                            : colId === "label"
                            ? "text-left"
                            : "text-right"
                        )}
                        style={{
                          width: header.column.columnDef.size
                            ? `${header.column.columnDef.size}px`
                            : undefined,
                          minWidth: header.column.columnDef.size
                            ? `${header.column.columnDef.size}px`
                            : undefined,
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody>
              {table.getRowModel().rows.map((row) => {
                const displayType = row.original.displayType;
                const isSelected = row.original.id === selectedRowId;
                const isBlank = displayType === "blank";
                const isHeader = displayType === "header";
                const isSubtotal = displayType === "subtotal";
                const isTotal = displayType === "total";
                // Show amber dot on selected row when there are unsaved changes
                const showDirtyDot = isSelected && isDirty;

                if (isBlank) {
                  return (
                    <tr key={row.id} aria-hidden="true">
                      <td
                        colSpan={columns.length}
                        className="h-3 bg-transparent border-0"
                      />
                    </tr>
                  );
                }

                return (
                  <tr
                    key={row.id}
                    onClick={() => handleSelectRow(row.original.id)}
                    className={cn(
                      "border-b border-border/40 cursor-pointer transition-colors select-none",
                      isSelected
                        ? showDirtyDot
                          ? "bg-amber-50/60 border-l-2 border-l-amber-400"
                          : "bg-blue-50/80 border-l-2 border-l-blue-500"
                        : isHeader
                        ? "bg-muted/40 hover:bg-muted/60"
                        : "hover:bg-muted/25",
                      (isSubtotal || isTotal) && "border-t border-t-border",
                      isTotal && "border-t-2 border-t-foreground/30"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const colId = cell.column.id;
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-3",
                            isHeader ? "py-1.5" : "py-[7px]",
                            colId === "sourceCode" || colId === "commentaryStatus"
                              ? "text-center"
                              : colId === "label"
                              ? "text-left"
                              : "text-right"
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {report.rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center px-8">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No rows found in this report
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                The uploaded file may not have matched the expected layout. Check
                that your sheet contains source codes, labels, and numeric columns.
              </p>
            </div>
          )}
        </div>

        {/* Row detail panel */}
        {selectedRow && (
          <div
            className="shrink-0 border-l bg-background overflow-y-auto"
            style={{ width: "320px" }}
          >
            <div className="p-4 space-y-4">
              {/* Panel header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Row Detail
                  </span>
                  {isDirty && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Unsaved
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {/* Row navigation */}
                  {navigableIndex > 0 && (
                    <button
                      onClick={() => handleSelectRow(navigableRows[navigableIndex - 1].id)}
                      title="Previous row (↑)"
                      className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {navigableIndex < navigableRows.length - 1 && (
                    <button
                      onClick={() => handleSelectRow(navigableRows[navigableIndex + 1].id)}
                      title="Next row (↓)"
                      className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!confirmDiscardIfDirty()) return;
                      setSelectedRowId(null);
                    }}
                    disabled={commentarySaving || tagSaving}
                    className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Source code — first-class */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  Source Code
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-50 border border-amber-200">
                  <span className="font-mono text-sm font-semibold text-amber-800 tracking-wide select-all">
                    {selectedRow.sourceCode}
                  </span>
                </div>
              </div>

              {/* Label */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                  Description
                </p>
                <p className="text-sm font-medium text-foreground leading-snug">
                  {selectedRow.label}
                </p>
              </div>

              {/* Numeric values */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Values ({report.currency})
                  </p>
                  {!editingValues && (
                    <button
                      onClick={() => startEditValues(selectedRow)}
                      title="Correct values"
                      className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>

                {editingValues ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      <ValueInput
                        label="Current"
                        value={valueInputs.current}
                        onChange={(v) =>
                          setValueInputs((p) => ({ ...p, current: v }))
                        }
                        disabled={valueSaving}
                      />
                      <ValueInput
                        label="Prior"
                        value={valueInputs.prior}
                        onChange={(v) =>
                          setValueInputs((p) => ({ ...p, prior: v }))
                        }
                        disabled={valueSaving}
                      />
                      <ValueInput
                        label="Variance"
                        value={valueInputs.variance}
                        onChange={(v) =>
                          setValueInputs((p) => ({ ...p, variance: v }))
                        }
                        disabled={valueSaving}
                      />
                      <ValueInput
                        label="Var %"
                        value={valueInputs.varPercent}
                        onChange={(v) =>
                          setValueInputs((p) => ({ ...p, varPercent: v }))
                        }
                        disabled={valueSaving}
                      />
                    </div>

                    {valueError && (
                      <p className="text-xs text-red-600">{valueError}</p>
                    )}

                    <button
                      type="button"
                      onClick={recalculateVariance}
                      disabled={valueSaving}
                      className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 disabled:opacity-40 transition-colors"
                    >
                      <RefreshCw className="h-2.5 w-2.5" />
                      Recalculate variance from current &amp; prior
                    </button>

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        onClick={saveValues}
                        disabled={valueSaving}
                        className="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {valueSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Save values
                      </button>
                      <button
                        onClick={cancelEditValues}
                        disabled={valueSaving}
                        className="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium border border-input text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>

                    <p className="text-[10px] text-muted-foreground/60">
                      Use brackets for negatives, e.g. (496). Leave blank to keep existing.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    <ValueCell label="Current" value={formatNumber(selectedRow.currentValue)} />
                    <ValueCell label="Prior" value={formatNumber(selectedRow.priorValue)} />
                    <ValueCell
                      label="Variance"
                      value={formatNumber(selectedRow.varianceValue)}
                      numVal={selectedRow.varianceValue}
                      colored
                    />
                    <ValueCell
                      label="Var %"
                      value={formatPercent(selectedRow.variancePercent)}
                      numVal={selectedRow.variancePercent}
                      colored
                    />
                  </div>
                )}
              </div>

              {/* Reference tag — editable */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Reference Tag
                  </p>
                  {!editingTag && (
                    <button
                      onClick={() => startEditTag(selectedRow)}
                      title="Edit reference tag"
                      className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>

                {editingTag ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={tagValue}
                        onChange={(e) => setTagValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveTag();
                          if (e.key === "Escape") cancelEditTag();
                        }}
                        placeholder="e.g. A1, C1.1"
                        autoFocus
                        disabled={tagSaving}
                        className="flex-1 h-7 px-2 text-xs font-mono rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                      />
                      <button
                        onClick={saveTag}
                        disabled={tagSaving}
                        title="Save"
                        className="h-7 w-7 flex items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {tagSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={cancelEditTag}
                        disabled={tagSaving}
                        title="Cancel"
                        className="h-7 w-7 flex items-center justify-center rounded border border-input text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {tagError && (
                      <p className="text-xs text-red-600">{tagError}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70">
                      Leave blank to remove. Enter to save, Esc to cancel.
                    </p>
                  </div>
                ) : selectedRow.referenceTag ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-xs font-mono font-semibold text-amber-700">
                    <Tag className="h-3 w-3" />
                    {selectedRow.referenceTag}
                  </span>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    None assigned
                  </p>
                )}
              </div>

              {/* Commentary editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Commentary
                  </p>
                  {commentary && (
                    <span className="text-[10px] text-muted-foreground/60 font-mono">
                      updated{" "}
                      {new Date(commentary.updatedAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                      })}
                    </span>
                  )}
                </div>

                {commentaryLoading ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <>
                    {!selectedRow.referenceTag && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          Reference Tag
                          <span className="text-red-500 text-xs">*</span>
                        </label>
                        <input
                          type="text"
                          value={commentaryRefTag}
                          onChange={(e) => {
                            setCommentaryRefTag(e.target.value);
                            setCommentaryRefTagError(null);
                          }}
                          placeholder="e.g. A1, C1.1, M1.8"
                          disabled={commentarySaving}
                          className={cn(
                            "w-full h-7 px-2 text-xs font-mono rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60",
                            commentaryRefTagError
                              ? "border-red-400 focus:ring-red-400"
                              : "border-input"
                          )}
                        />
                        {commentaryRefTagError && (
                          <p className="text-xs text-red-600">{commentaryRefTagError}</p>
                        )}
                      </div>
                    )}
                    <textarea
                      value={commentaryText}
                      onChange={(e) => {
                        setCommentaryText(e.target.value);
                        setCommentaryError(null);
                        setCommentarySaved(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          saveCommentary();
                        }
                      }}
                      placeholder="Write commentary for this row…"
                      disabled={commentarySaving}
                      rows={5}
                      className={cn(
                        "w-full text-xs rounded border bg-background px-2.5 py-2 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 placeholder:text-muted-foreground/50 transition-colors",
                        isDirty
                          ? "border-amber-300 focus:ring-amber-400"
                          : "border-input"
                      )}
                    />

                    {commentaryError && (
                      <p className="text-xs text-red-600">{commentaryError}</p>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground/60">
                        ⌘↵ to save · ↑↓ to navigate
                      </p>
                      <button
                        onClick={saveCommentary}
                        disabled={commentarySaving || !commentaryText.trim()}
                        className={cn(
                          "flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium transition-colors",
                          commentarySaved
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : isDirty
                            ? "bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                            : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        )}
                      >
                        {commentarySaving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : commentarySaved ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                        {commentarySaved
                          ? "Saved"
                          : commentary
                          ? "Update"
                          : "Save"}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* AI Refinement Panel */}
              <AIRefinementPanel
                reportId={report.id}
                rowId={selectedRow.id}
                commentary={commentary}
                onCommentaryAccepted={(newText) => {
                  setCommentaryText(newText);
                  if (commentary) {
                    setCommentary({
                      ...commentary,
                      commentaryText: newText,
                      updatedAt: new Date().toISOString(),
                    });
                  }
                  setCommentarySaved(true);
                  if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
                  savedTimerRef.current = setTimeout(
                    () => setCommentarySaved(false),
                    2500
                  );
                }}
              />

              {/* Section */}
              {selectedRow.section && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                    Section
                  </p>
                  <p className="text-xs text-foreground/80 leading-snug">
                    {selectedRow.section}
                  </p>
                </div>
              )}

              {/* Row index + navigation position */}
              <div className="pt-2 border-t flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground/60 font-mono">
                  Row #{selectedRow.rowIndex}
                </p>
                {navigableIndex >= 0 && (
                  <p className="text-[10px] text-muted-foreground/60">
                    {navigableIndex + 1} / {navigableRows.length}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk AI refinement modal */}
      {showBulkModal && (
        <BulkRefinementModal
          reportId={report.id}
          rowsWithCommentary={rows
            .filter((r) => r._count.commentaries > 0)
            .map((r) => ({
              id: r.id,
              sourceCode: r.sourceCode,
              label: r.label,
              referenceTag: r.referenceTag,
            }))}
          onClose={() => setShowBulkModal(false)}
        />
      )}
    </div>
  );
}

function MetaItem({
  icon,
  label,
  mono,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs text-muted-foreground",
        mono && "font-mono",
        className
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function ValueCell({
  label,
  value,
  colored,
  numVal,
}: {
  label: string;
  value: string;
  colored?: boolean;
  numVal?: number | null;
}) {
  return (
    <div className="bg-muted/40 rounded px-2 py-1.5 space-y-0.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn("font-mono text-sm font-medium tabular-nums", {
          "text-red-600":
            colored && numVal !== null && numVal !== undefined && numVal < 0,
          "text-emerald-700":
            colored && numVal !== null && numVal !== undefined && numVal > 0,
        })}
      >
        {value}
      </p>
    </div>
  );
}

function ValueInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="—"
        className="w-full h-7 px-2 text-xs font-mono rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 text-right tabular-nums"
      />
    </div>
  );
}