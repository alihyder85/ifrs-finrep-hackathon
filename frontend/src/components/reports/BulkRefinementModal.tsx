"use client";

import { useState, useRef } from "react";
import {
  X,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AIIssue, AIValidationStatus, RefinementStatus } from "@/types";

type RefinementRecord = {
  id: string;
  reportRowId: string;
  sourceCode: string;
  originalCommentarySnapshot: string;
  aiRefinedCommentary: string | null;
  aiValidationStatus: AIValidationStatus | null;
  aiIssuesJson: string | null;
  aiConfidenceNote: string | null;
  refinementStatus: RefinementStatus;
};

type RowInfo = {
  id: string;
  sourceCode: string;
  label: string;
  referenceTag: string | null;
};

interface Props {
  reportId: string;
  rowsWithCommentary: RowInfo[];
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseIssues(json: string | null): AIIssue[] {
  if (!json) return [];
  try { return JSON.parse(json) as AIIssue[]; } catch { return []; }
}

function ValidationBadge({ status }: { status: AIValidationStatus | null }) {
  if (!status) return null;
  const map = {
    yes: { label: "OK", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    partially: { label: "Needs Review", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    no: { label: "Caution", cls: "bg-red-50 text-red-700 border-red-200" },
  } as const;
  const { label, cls } = map[status];
  return <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border", cls)}>{label}</span>;
}

// ─── Row result card ─────────────────────────────────────────────────────────

function RefinementResultCard({
  row,
  refinement,
  reportId,
  onUpdated,
}: {
  row: RowInfo;
  refinement: RefinementRecord;
  reportId: string;
  onUpdated: (r: RefinementRecord) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issues = parseIssues(refinement.aiIssuesJson);
  const isDone =
    refinement.refinementStatus === "ACCEPTED" ||
    refinement.refinementStatus === "DISMISSED" ||
    refinement.refinementStatus === "EDITED_AND_ACCEPTED";

  async function applyAction(action: "accept" | "dismiss" | "edit") {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/refinements/${refinement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "edit" ? { action, editedText } : { action }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Action failed"); return; }
      onUpdated(data.refinement);
      setIsEditing(false);
    } catch {
      setError("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  const statusMap: Record<RefinementStatus, { label: string; cls: string }> = {
    PENDING_REVIEW: { label: "Pending Review", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    ACCEPTED: { label: "Accepted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    DISMISSED: { label: "Dismissed", cls: "bg-slate-100 text-slate-500 border-slate-200" },
    EDITED_AND_ACCEPTED: { label: "Edited & Accepted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };

  return (
    <div className={cn("border rounded-md overflow-hidden", isDone && "opacity-70")}>
      {/* Row header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="font-mono text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
          {row.sourceCode}
        </span>
        <span className="flex-1 text-xs font-medium truncate">{row.label}</span>
        {row.referenceTag && (
          <span className="text-[10px] font-mono font-semibold px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
            {row.referenceTag}
          </span>
        )}
        <ValidationBadge status={refinement.aiValidationStatus} />
        {issues.length > 0 && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {issues.length} issue{issues.length !== 1 ? "s" : ""}
          </span>
        )}
        <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0", statusMap[refinement.refinementStatus].cls)}>
          {statusMap[refinement.refinementStatus].label}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t px-3 py-3 space-y-2.5 bg-background">
          {/* Issues */}
          {issues.length > 0 && (
            <div className="space-y-1">
              {issues.map((issue, i) => {
                const severityColor = { high: "text-red-500", medium: "text-amber-500", low: "text-slate-400" }[issue.severity];
                const typeLabel: Record<AIIssue["type"], string> = {
                  NUMERIC_MISMATCH: "Numeric Mismatch",
                  DIRECTION_MISMATCH: "Direction Mismatch",
                  TYPO_GRAMMAR: "Typo / Grammar",
                  HISTORICAL_REFERENCE_CAUTION: "Caution: Historical Ref",
                  VAGUE_WORDING: "Vague Wording",
                  MISSING_EXPLANATION: "Missing Explanation",
                };
                return (
                  <div key={i} className="flex gap-1.5 text-xs">
                    <span className={cn("mt-0.5 shrink-0", severityColor)}>●</span>
                    <span>
                      <span className="font-medium">{typeLabel[issue.type]}: </span>
                      <span className="text-muted-foreground">{issue.description}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Original */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Original</p>
            <p className="text-xs text-muted-foreground bg-muted/20 rounded px-2 py-1.5 leading-relaxed border border-border/50">
              {refinement.originalCommentarySnapshot}
            </p>
          </div>

          {/* AI Refined */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">AI Refined</p>
            {isEditing ? (
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={3}
                className="w-full text-xs rounded border border-ring bg-background px-2.5 py-2 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <p className="text-xs text-foreground bg-blue-50/40 rounded px-2 py-1.5 leading-relaxed border border-blue-100">
                {refinement.aiRefinedCommentary ?? "—"}
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {/* Actions */}
          {!isDone && !isEditing && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => applyAction("accept")} disabled={actionLoading}
                className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                <CheckCircle className="h-3 w-3" />Accept AI Refined
              </button>
              <button onClick={() => { setEditedText(refinement.aiRefinedCommentary ?? ""); setIsEditing(true); }} disabled={actionLoading}
                className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors">
                Edit Before Accepting
              </button>
              <button onClick={() => applyAction("dismiss")} disabled={actionLoading}
                className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium text-muted-foreground border border-input hover:bg-muted disabled:opacity-50 transition-colors">
                <XCircle className="h-3 w-3" />Dismiss
              </button>
            </div>
          )}
          {!isDone && isEditing && (
            <div className="flex gap-1.5">
              <button onClick={() => applyAction("edit")} disabled={actionLoading || !editedText.trim()}
                className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                Accept Edited
              </button>
              <button onClick={() => setIsEditing(false)} disabled={actionLoading}
                className="h-6 px-2 rounded text-[10px] font-medium text-muted-foreground border border-input hover:bg-muted disabled:opacity-50 transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export function BulkRefinementModal({ reportId, rowsWithCommentary, onClose }: Props) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, currentLabel: "" });
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<Map<string, RefinementRecord>>(new Map());
  const [errors, setErrors] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  async function startBulkReview() {
    setProcessing(true);
    setDone(false);
    setResults(new Map());
    setErrors([]);

    abortRef.current = new AbortController();

    try {
      const response = await fetch(`/api/reports/${reportId}/commentary/refine-all`, {
        method: "POST",
        signal: abortRef.current.signal,
      });

      if (!response.body) { setErrors(["Stream not supported"]); return; }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(trimmed.slice(6));
            if (event.type === "start") {
              setProgress({ processed: 0, total: event.total, currentLabel: "" });
            } else if (event.type === "progress") {
              setProgress({ processed: event.processed, total: event.total, currentLabel: event.label });
            } else if (event.type === "result") {
              setResults((prev) => new Map(prev).set(event.rowId, event.refinement));
            } else if (event.type === "error") {
              setErrors((prev) => [...prev, `${event.rowId}: ${event.message}`]);
            } else if (event.type === "complete") {
              setProgress((p) => ({ ...p, processed: event.processed }));
              setDone(true);
            }
          } catch { /* ignore malformed event */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setErrors((prev) => [...prev, "Stream connection failed"]);
      }
    } finally {
      setProcessing(false);
    }
  }

  const pendingCount = Array.from(results.values()).filter((r) => r.refinementStatus === "PENDING_REVIEW").length;
  const resolvedCount = results.size - pendingCount;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold">AI Based Commentary Refinement — Bulk Review</h2>
          </div>
          <button onClick={onClose} className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Pre-run state */}
          {!processing && !done && results.size === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{rowsWithCommentary.length} row{rowsWithCommentary.length !== 1 ? "s" : ""}</span> with commentary will be reviewed by AI.
              </p>
              <p className="text-xs text-muted-foreground/80">
                Each commentary will be checked for alignment with numeric values, vague wording, historical references, and grammar. You review and approve each result individually — nothing is overwritten automatically.
              </p>
              <button
                onClick={startBulkReview}
                className="flex items-center gap-2 h-8 px-4 rounded text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Start Bulk Review
              </button>
            </div>
          )}

          {/* Progress */}
          {(processing || (done && results.size > 0)) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {processing ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Processing {progress.currentLabel ? `"${progress.currentLabel}"` : "…"}
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-medium">Review complete</span>
                  )}
                </span>
                <span>{progress.processed} / {progress.total}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: progress.total > 0 ? `${(progress.processed / progress.total) * 100}%` : "0%" }}
                />
              </div>
              {done && (
                <div className="flex items-center gap-3 text-xs pt-1">
                  <span className="text-muted-foreground">{pendingCount} pending review</span>
                  <span className="text-emerald-600">{resolvedCount} resolved</span>
                  {errors.length > 0 && <span className="text-red-500">{errors.length} errors</span>}
                </div>
              )}
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded px-2.5 py-2 border border-red-200">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>{errors.map((e, i) => <p key={i}>{e}</p>)}</div>
            </div>
          )}

          {/* Results list */}
          {results.size > 0 && (
            <div className="space-y-2">
              {rowsWithCommentary.map((row) => {
                const refinement = results.get(row.id);
                if (!refinement) return null;
                return (
                  <RefinementResultCard
                    key={row.id}
                    row={row}
                    refinement={refinement}
                    reportId={reportId}
                    onUpdated={(updated) =>
                      setResults((prev) => new Map(prev).set(row.id, updated))
                    }
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t shrink-0">
          <p className="text-[10px] text-muted-foreground/60">
            AI suggestions require human approval. Original commentary is never overwritten automatically.
          </p>
          <button onClick={onClose} className="h-7 px-3 rounded text-xs font-medium border border-input bg-background hover:bg-muted transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
