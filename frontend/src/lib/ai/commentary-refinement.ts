/**
 * AI-assisted commentary review service.
 *
 * Uses Anthropic claude-opus-4-6 with adaptive thinking when ANTHROPIC_API_KEY is set.
 * Falls back to a deterministic rule-based mock when the key is absent — so the app
 * remains fully functional in local dev without credentials.
 *
 * This module is a pure service layer; all persistence is handled by the API routes.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AIIssue, AIValidationStatus } from "@/types";

export interface CommentaryRefinementInput {
  sourceCode: string;
  label: string;
  section: string | null;
  displayType: string | null;
  currentValue: number | null;
  priorValue: number | null;
  varianceValue: number | null;
  variancePercent: number | null;
  referenceTag: string | null;
  commentaryText: string;
  reportName: string;
  reportingPeriod: string;
  currency: string;
}

export interface CommentaryRefinementOutput {
  validationStatus: AIValidationStatus;
  issues: AIIssue[];
  refinedCommentary: string;
  confidenceNote: string;
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

function fmtValue(val: number | null, currency: string): string {
  if (val === null) return "N/A";
  const abs = Math.abs(val);
  const f = abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return val < 0 ? `(${f}) ${currency}` : `${f} ${currency}`;
}

function fmtPct(val: number | null): string {
  if (val === null) return "N/A";
  const abs = Math.abs(val).toFixed(1);
  return val < 0 ? `(${abs}%)` : `${abs}%`;
}

function buildPrompt(input: CommentaryRefinementInput): string {
  return `You are a finance commentary review assistant for internal management reporting.

You are reviewing commentary written by a finance analyst for a financial statement line item.

ROW CONTEXT:
- Source Code: ${input.sourceCode}
- Description: ${input.label}${input.section ? `\n- Section: ${input.section}` : ""}${input.displayType ? `\n- Row Type: ${input.displayType}` : ""}
- Report: ${input.reportName} | Period: ${input.reportingPeriod} | Currency: ${input.currency}
- Current Period: ${fmtValue(input.currentValue, input.currency)}
- Prior Period:   ${fmtValue(input.priorValue, input.currency)}
- Variance:       ${fmtValue(input.varianceValue, input.currency)} (${fmtPct(input.variancePercent)})${input.referenceTag ? `\n- Reference Tag: ${input.referenceTag}` : ""}

EXISTING COMMENTARY:
"${input.commentaryText}"

YOUR TASK:
Review this commentary and provide structured feedback. Evaluate:

1. ALIGNMENT — Does the narrative direction match the numbers?
   - If commentary says "increase" but value declined → DIRECTION_MISMATCH (high)
   - If commentary says "slight" but numbers show a material swing → NUMERIC_MISMATCH (medium)
   - If a large variance (>10% or material) is not explained → MISSING_EXPLANATION (medium)

2. LANGUAGE — Typos, grammar errors, or unclear phrasing → TYPO_GRAMMAR

3. SPECIFICITY — Vague finance language:
   - "due to market conditions" with no specifics → VAGUE_WORDING (medium)
   - "performance improved" without referencing amounts → VAGUE_WORDING (low)

4. HISTORICAL / MACRO REFERENCES — For any mention of: COVID-19, Fed rate hikes/cuts, inflation,
   recession, regulatory changes, market volatility:
   - Mark as HISTORICAL_REFERENCE_CAUTION (low) if plausible given the period
   - Mark as HISTORICAL_REFERENCE_CAUTION (high) if the timing seems questionable
   - Do NOT assert external facts as confirmed — you do not have live data.

5. REFINED VERSION — Propose a cleaner, more precise version:
   - Preserve the analyst's core narrative and intent
   - Fix grammar/typos
   - Strengthen vague phrases using the numeric context provided
   - DO NOT fabricate causes not present in the original commentary
   - DO NOT introduce specific claims not grounded in the original text or numbers
   - Keep it concise (1–3 sentences for detail rows; 1 sentence for total/subtotal rows)

RULES:
- You are a REVIEW ASSISTANT, not a creative author.
- If the commentary is broadly acceptable, say so (validationStatus: "yes", issues: []).
- For historical references, use CAUTION — never flag as a confirmed error.
- Return ONLY valid JSON — no markdown fences, no preamble, no explanation.

Return this exact JSON shape:
{
  "validationStatus": "yes" | "no" | "partially",
  "issues": [
    {
      "type": "NUMERIC_MISMATCH" | "DIRECTION_MISMATCH" | "TYPO_GRAMMAR" | "HISTORICAL_REFERENCE_CAUTION" | "VAGUE_WORDING" | "MISSING_EXPLANATION",
      "description": "concise description of the issue",
      "severity": "low" | "medium" | "high"
    }
  ],
  "refinedCommentary": "improved version of the commentary",
  "confidenceNote": "any cautions about external claims or model uncertainty — empty string if none"
}`;
}

// ─── Mock (no API key) ────────────────────────────────────────────────────────

function mockRefine(input: CommentaryRefinementInput): CommentaryRefinementOutput {
  const text = input.commentaryText.toLowerCase();
  const issues: AIIssue[] = [];

  // Direction check
  if (input.varianceValue !== null) {
    const isUp = input.varianceValue > 0;
    const saysUp = /increas|higher|grew|growth|uplift|improv|better/.test(text);
    const saysDown = /declin|lower|fell|drop|decreas|reduc|deteriorat|weaker/.test(text);
    if (isUp && saysDown) {
      issues.push({ type: "DIRECTION_MISMATCH", description: "Commentary indicates a decline but values show an increase", severity: "high" });
    } else if (!isUp && saysUp) {
      issues.push({ type: "DIRECTION_MISMATCH", description: "Commentary indicates an increase but values show a decline", severity: "high" });
    }
  }

  // Vague wording
  if (/market conditions|various factors|external factors|broader environment/.test(text)) {
    issues.push({ type: "VAGUE_WORDING", description: "Commentary references external factors without sufficient specificity for finance reporting", severity: "medium" });
  }

  // Historical references — caution only
  const historicalPatterns: Array<{ re: RegExp; label: string }> = [
    { re: /covid|pandemic/, label: "COVID-19/pandemic" },
    { re: /fed rate|interest rate hike|federal reserve/, label: "Fed rate movements" },
    { re: /inflationar/, label: "inflation" },
    { re: /recession/, label: "recessionary environment" },
    { re: /supply chain/, label: "supply chain disruption" },
  ];
  for (const { re, label } of historicalPatterns) {
    if (re.test(text)) {
      issues.push({ type: "HISTORICAL_REFERENCE_CAUTION", description: `Reference to ${label} — plausible but cannot be independently verified by this review`, severity: "low" });
    }
  }

  // Missing explanation for large variance
  if (input.variancePercent !== null && Math.abs(input.variancePercent) > 15 && text.length < 80) {
    issues.push({ type: "MISSING_EXPLANATION", description: "Large variance (>15%) with a brief commentary — consider elaborating on the drivers", severity: "medium" });
  }

  const hasHigh = issues.some((i) => i.severity === "high");
  const validationStatus: AIValidationStatus = hasHigh ? "no" : issues.length > 0 ? "partially" : "yes";

  const confidenceNote = issues.some((i) => i.type === "HISTORICAL_REFERENCE_CAUTION")
    ? "Mock mode — historical references flagged for caution; a live AI review would provide deeper contextual analysis."
    : "Mock mode: configure ANTHROPIC_API_KEY for real AI commentary review.";

  return {
    validationStatus,
    issues,
    refinedCommentary: input.commentaryText,
    confidenceNote,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function refineCommentary(
  input: CommentaryRefinementInput
): Promise<CommentaryRefinementOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.info("[AI Commentary] No ANTHROPIC_API_KEY — using mock review");
    return mockRefine(input);
  }

  const client = new Anthropic();
  const prompt = buildPrompt(input);

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text block in AI response");
    }

    // Strip any accidental markdown fences
    let raw = textBlock.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\r?\n?/, "").replace(/\r?\n?```$/, "");
    }

    const parsed = JSON.parse(raw) as CommentaryRefinementOutput;

    if (!parsed.validationStatus || !Array.isArray(parsed.issues)) {
      throw new Error("Unexpected AI response shape");
    }

    return {
      validationStatus: parsed.validationStatus,
      issues: parsed.issues,
      refinedCommentary: parsed.refinedCommentary ?? input.commentaryText,
      confidenceNote: parsed.confidenceNote ?? "",
    };
  } catch (err) {
    console.error("[AI Commentary] API call failed, falling back to mock:", err);
    const result = mockRefine(input);
    result.confidenceNote =
      "AI service error — showing rule-based analysis. " + result.confidenceNote;
    return result;
  }
}
