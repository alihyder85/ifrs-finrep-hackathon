// Domain types mirroring the Prisma schema.
// Use these in server actions, route handlers, and components.

export type DisplayType = "header" | "detail" | "subtotal" | "total" | "blank";

export interface Report {
  id: string;
  name: string;
  reportingPeriod: string;
  currency: string;
  sourceFileName: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One financial line item from an imported statement.
 * sourceCode is a first-class business key — never omit it.
 */
export interface ReportRow {
  id: string;
  reportId: string;
  rowIndex: number;

  // Source lineage (mandatory)
  sourceCode: string;
  label: string;

  // Classification
  section: string | null;
  displayType: DisplayType | null;

  // Normalized numeric values
  currentValue: number | null;
  priorValue: number | null;
  varianceValue: number | null;
  variancePercent: number | null;

  // Reference tag assigned during review
  referenceTag: string | null;

  // Raw cell text for audit / export fidelity
  rawCurrentText: string | null;
  rawPriorText: string | null;
  rawVarianceText: string | null;
  rawVariancePercentText: string | null;
  rawReferenceText: string | null;
}

/**
 * Analyst commentary anchored to a row by stable identity.
 * sourceCode is denormalized here intentionally for audit/search.
 */
export interface Commentary {
  id: string;
  reportId: string;
  reportRowId: string;

  sourceCode: string;
  referenceTagSnapshot: string | null;

  commentaryText: string;
  commentarySource: string; // "IMPORTED" | "USER"
  createdAt: Date;
  updatedAt: Date;
}

// --- AI Commentary Refinement ---

export type RefinementStatus =
  | "PENDING_REVIEW"
  | "ACCEPTED"
  | "DISMISSED"
  | "EDITED_AND_ACCEPTED";

export type AIValidationStatus = "yes" | "no" | "partially";

export type AIIssueType =
  | "NUMERIC_MISMATCH"
  | "DIRECTION_MISMATCH"
  | "TYPO_GRAMMAR"
  | "HISTORICAL_REFERENCE_CAUTION"
  | "VAGUE_WORDING"
  | "MISSING_EXPLANATION";

export type IssueSeverity = "low" | "medium" | "high";

export interface AIIssue {
  type: AIIssueType;
  description: string;
  severity: IssueSeverity;
}

/**
 * AI-assisted review record for one commentary.
 * Never overwrites Commentary — stores the AI proposal separately.
 * The human decision is tracked in refinementStatus.
 */
export interface CommentaryRefinement {
  id: string;
  reportId: string;
  reportRowId: string;
  sourceCode: string;
  originalCommentarySnapshot: string;
  aiRefinedCommentary: string | null;
  aiValidationStatus: AIValidationStatus | null;
  aiIssuesJson: string | null; // JSON-encoded AIIssue[]
  aiConfidenceNote: string | null;
  refinementStatus: RefinementStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Convenience: row with its latest commentary attached
export interface ReportRowWithCommentary extends ReportRow {
  commentaries: Commentary[];
}

// Convenience: report with all rows
export interface ReportWithRows extends Report {
  rows: ReportRow[];
}
