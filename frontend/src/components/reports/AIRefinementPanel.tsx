"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AIIssue, AIValidationStatus, RefinementStatus } from "@/types";

type RefinementRecord = {
  id: string;
  originalCommentarySnapshot: string;
  aiRefinedCommentary: string | null;
  aiValidationStatus: AIValidationStatus | null;
  aiIssuesJson: string | null;
  aiConfidenceNote: string | null;
  refinementStatus: RefinementStatus;
  updatedAt: string;
};

interface Props {
  reportId: string;
  rowId: string;
  commentary: { id: string; commentaryText: string } | null;
  onCommentaryAccepted: (newText: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseIssues(json: string | null): AIIssue[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as AIIssue[];
  } catch {
    return [];
  }
}

function ValidationBadge({ status }: { status: AIValidationStatus | null }) {
  if (!status) return null;
  const map = {
    yes: { label: "OK", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    partially: { label: "Needs Review", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    no: { label: "Caution", cls: "bg-red-50 text-red-700 border-red-200" },
  } as const;
  const { label, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border", cls)}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: RefinementStatus }) {
  const map: Record<RefinementStatus, { label: string; cls: string }> = {
    PENDING_REVIEW: { label: "Pending Review", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    ACCEPTED: { label: "Accepted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    DISMISSED: { label: "Dismissed", cls: "bg-slate-100 text-slate-500 border-slate-200" },
    EDITED_AND_ACCEPTED: { label: "Edited & Accepted", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  const { label, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border", cls)}>
      {label}
    </span>
  );
}

function IssueRow({ issue }: { issue: AIIssue }) {
  const severityColor = {
    high: "text-red-500",
    medium: "text-amber-500",
    low: "text-slate-400",
  }[issue.severity];

  const typeLabel: Record<AIIssue["type"], string> = {
    NUMERIC_MISMATCH: "Numeric Mismatch",
    DIRECTION_MISMATCH: "Direction Mismatch",
    TYPO_GRAMMAR: "Typo / Grammar",
    HISTORICAL_REFERENCE_CAUTION: "Caution: Historical Ref",
    VAGUE_WORDING: "Vague Wording",
    MISSING_EXPLANATION: "Missing Explanation",
  };

  return (
    <div className="flex gap-1.5 text-xs">
      <span className={cn("mt-0.5 shrink-0", severityColor)}>●</span>
      <span>
        <span className="font-medium text-foreground/80">{typeLabel[issue.type]}: </span>
        <span className="text-muted-foreground">{issue.description}</span>
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AIRefinementPanel({ reportId, rowId, commentary, onCommentaryAccepted }: Props) {
  const [refinement, setRefinement] = useState<RefinementRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const prevRowIdRef = useRef<string | null>(null);

  // Fetch existing refinement whenever the selected row changes
  useEffect(() => {
    if (!rowId || !commentary) {
      setRefinement(null);
      setError(null);
      setIsEditing(false);
      prevRowIdRef.current = rowId;
      return;
    }

    // Only re-fetch when the row actually changes (not on every commentary save)
    if (prevRowIdRef.current === rowId && refinement !== null) return;
    prevRowIdRef.current = rowId;

    fetch(`/api/reports/${reportId}/rows/${rowId}/commentary/refine`)
      .then((r) => r.json())
      .then((data) => {
        setRefinement(data.refinement ?? null);
        setIsEditing(false);
      })
      .catch(() => {/* silent */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId, reportId]);

  async function runRefinement() {
    setLoading(true);
    setError(null);
    setIsEditing(false);
    try {
      const res = await fetch(`/api/reports/${reportId}/rows/${rowId}/commentary/refine`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "AI review failed");
        return;
      }
      setRefinement(data.refinement);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  async function applyAction(action: "accept" | "dismiss" | "edit") {
    if (!refinement) return;
    setActionLoading(true);
    try {
      const body =
        action === "edit"
          ? { action, editedText }
          : { action };

      const res = await fetch(
        `/api/reports/${reportId}/refinements/${refinement.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Action failed");
        return;
      }
      setRefinement(data.refinement);
      setIsEditing(false);

      if (action === "accept") {
        onCommentaryAccepted(data.refinement.aiRefinedCommentary ?? refinement.originalCommentarySnapshot);
      } else if (action === "edit") {
        onCommentaryAccepted(editedText);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setActionLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const issues = parseIssues(refinement?.aiIssuesJson ?? null);
  const isDone = refinement?.refinementStatus === "ACCEPTED"
    || refinement?.refinementStatus === "DISMISSED"
    || refinement?.refinementStatus === "EDITED_AND_ACCEPTED";

  return (
    <div className="pt-3 border-t space-y-2">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          AI based commentary refinement
        </p>
        {refinement && !loading && (
          <button
            onClick={runRefinement}
            title="Re-run AI review"
            className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-2.5 w-2.5" />
          </button>
        )}
      </div>

      {/* No commentary */}
      {!commentary && (
        <p className="text-xs text-muted-foreground/60 italic">
          Write and save commentary above to enable AI review.
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Analysing commentary…
        </div>
      )}

      {/* No refinement yet */}
      {!loading && commentary && !refinement && (
        <button
          onClick={runRefinement}
          className="w-full flex items-center justify-center gap-1.5 h-7 px-3 rounded text-xs font-medium border border-input bg-background hover:bg-muted transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          Run AI Review
        </button>
      )}

      {/* Done state */}
      {!loading && refinement && isDone && (
        <div className="space-y-1.5">
          <StatusBadge status={refinement.refinementStatus} />
          {refinement.refinementStatus === "DISMISSED" && (
            <p className="text-[10px] text-muted-foreground/60">
              AI suggestion was dismissed. Re-run to generate a new review.
            </p>
          )}
        </div>
      )}

      {/* Pending review state */}
      {!loading && refinement && refinement.refinementStatus === "PENDING_REVIEW" && (
        <div className="space-y-2.5">
          {/* Validation summary */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Alignment:</span>
            <ValidationBadge status={refinement.aiValidationStatus} />
          </div>

          {/* Issues */}
          {issues.length > 0 && (
            <div className="space-y-1 bg-muted/30 rounded p-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Issues Found ({issues.length})
              </p>
              {issues.map((issue, i) => (
                <IssueRow key={i} issue={issue} />
              ))}
            </div>
          )}

          {/* Original (read-only) */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Original
            </p>
            <p className="text-xs text-muted-foreground bg-muted/20 rounded px-2 py-1.5 leading-relaxed border border-border/50">
              {refinement.originalCommentarySnapshot}
            </p>
          </div>

          {/* AI Refined */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              AI Refined
            </p>
            {isEditing ? (
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={4}
                className="w-full text-xs rounded border border-ring bg-background px-2.5 py-2 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <p className="text-xs text-foreground bg-blue-50/40 rounded px-2 py-1.5 leading-relaxed border border-blue-100">
                {refinement.aiRefinedCommentary ?? "—"}
              </p>
            )}
          </div>

          {/* Confidence note */}
          {refinement.aiConfidenceNote && (
            <div className="flex gap-1.5 text-[10px] text-muted-foreground bg-amber-50/50 rounded px-2 py-1.5 border border-amber-100">
              <Info className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
              <span>{refinement.aiConfidenceNote}</span>
            </div>
          )}

          {/* Action buttons */}
          {!isEditing ? (
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => applyAction("accept")}
                disabled={actionLoading}
                className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="h-3 w-3" />
                Accept AI Refined
              </button>
              <button
                onClick={() => {
                  setEditedText(refinement.aiRefinedCommentary ?? "");
                  setIsEditing(true);
                }}
                disabled={actionLoading}
                className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                Edit Before Accepting
              </button>
              <button
                onClick={() => applyAction("dismiss")}
                disabled={actionLoading}
                className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium text-muted-foreground border border-input hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <XCircle className="h-3 w-3" />
                Dismiss
              </button>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <button
                onClick={() => applyAction("edit")}
                disabled={actionLoading || !editedText.trim()}
                className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                Accept Edited
              </button>
              <button
                onClick={() => setIsEditing(false)}
                disabled={actionLoading}
                className="h-6 px-2 rounded text-[10px] font-medium text-muted-foreground border border-input hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
