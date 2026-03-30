/**
 * LLM-powered commentary synthesis for multi-country consolidation.
 *
 * Sends a single Anthropic API call with all rows that have at least one
 * country commentary. Falls back to plain concatenation if the call fails
 * or returns unparseable output — the export must never fail due to the LLM.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface CountryCommentary {
  country: string;
  reportingPeriod: string;
  commentaryText: string;
}

export interface SynthesisInputRow {
  sourceCode: string;
  label: string;
  consolidatedCurrentValue: number | null;
  consolidatedPriorValue: number | null;
  countryCommentaries: CountryCommentary[];
}

export interface SynthesisResult {
  sourceCode: string;
  consolidatedCommentary: string;
}

// ─── Fallback: plain concatenation ───────────────────────────────────────────

function fallbackConcatenate(rows: SynthesisInputRow[]): SynthesisResult[] {
  return rows.map((r) => ({
    sourceCode: r.sourceCode,
    consolidatedCommentary: r.countryCommentaries
      .map((c) => `[${c.country}] ${c.commentaryText}`)
      .join("  "),
  }));
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Synthesise consolidated commentary for a set of rows using a single LLM call.
 *
 * Only rows with at least one non-empty countryCommentaries entry should be
 * passed in — this function does not filter them out.
 *
 * Always returns a result map. On any failure returns the fallback concatenation.
 */
export async function synthesiseCommentary(
  rows: SynthesisInputRow[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  if (rows.length === 0) return result;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.info("[Commentary Synthesis] No ANTHROPIC_API_KEY — using fallback concatenation");
    for (const r of fallbackConcatenate(rows)) {
      result.set(r.sourceCode, r.consolidatedCommentary);
    }
    return result;
  }

  try {
    const client = new Anthropic();

    const inputJson = JSON.stringify({ rows }, null, 2);

    const userPrompt = `Below is an income statement with per-country analyst commentary.
For each row, synthesize the country commentaries into a single consolidated narrative.
- Preserve the key substance of each country's point.
- Reference the country name inline where it adds clarity (e.g. "In UK, ... while DE reported ...").
- Keep each consolidated commentary to 2–3 sentences maximum.
- If only one country has commentary for a row, paraphrase it with the country name as context.
- Return a JSON array where each element has:
  - "sourceCode": string
  - "consolidatedCommentary": string

Return ONLY valid JSON — no markdown fences, no preamble, no explanation outside the JSON array.

Input:
${inputJson}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system:
        "You are a financial reporting assistant helping consolidate income statement commentary across multiple country entities. " +
        "Your output must be factual, concise, and directly grounded in the provided per-country commentary. " +
        "Do not introduce facts, numbers, or explanations not present in the input. " +
        "Return only valid JSON — no markdown, no prose outside the JSON structure.",
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text block in LLM response");
    }

    let raw = textBlock.text.trim();
    // Strip accidental markdown fences
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\r?\n?/, "").replace(/\r?\n?```$/, "");
    }

    const parsed = JSON.parse(raw) as SynthesisResult[];

    if (!Array.isArray(parsed)) {
      throw new Error("LLM response is not a JSON array");
    }

    for (const item of parsed) {
      if (typeof item.sourceCode === "string" && typeof item.consolidatedCommentary === "string") {
        result.set(item.sourceCode, item.consolidatedCommentary);
      }
    }

    // For any row the LLM missed, fall back to concatenation
    for (const row of rows) {
      if (!result.has(row.sourceCode)) {
        const fallback = fallbackConcatenate([row])[0];
        result.set(row.sourceCode, fallback.consolidatedCommentary);
      }
    }

    return result;
  } catch (err) {
    console.error("[Commentary Synthesis] LLM call failed, using fallback concatenation:", err);
    for (const r of fallbackConcatenate(rows)) {
      result.set(r.sourceCode, r.consolidatedCommentary);
    }
    return result;
  }
}