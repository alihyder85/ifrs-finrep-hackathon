Continue from the existing app.

Read and follow:
- CLAUDE.md
- all files in /agents
- all files in /docs

---

# Slice 09 — Export and Multi-Country Consolidation

Implement two distinct but related export capabilities:

1. **Single-report export** — export one report's reviewed data to Excel
2. **Multi-country consolidation export** — select multiple country reports for the same period, consolidate numeric values, synthesize commentary via a single LLM call, and export the consolidated result to Excel

---

## Part A — Single-Report Export

### Route
`GET /api/reports/[reportId]/export`

### Behaviour
- Fetch all `ReportRow` records for the report, ordered by `rowIndex`
- For each row, attach its latest `Commentary` record (most recent `updatedAt`)
- Also attach the accepted `CommentaryRefinement` if `refinementStatus` is `ACCEPTED` or `EDITED_AND_ACCEPTED` — use the `aiRefinedCommentary` field in that case as the final commentary text, otherwise fall back to the `Commentary.commentaryText`
- Build an Excel workbook using the `xlsx` library

### Excel Output — Sheet: "Reviewed Statement"

Columns in order:

| Column | Source |
|---|---|
| Row # | `rowIndex` |
| Source Code | `sourceCode` |
| Label | `label` |
| Section | `section` |
| Current Period | `currentValue` (formatted as number) |
| Prior Period | `priorValue` |
| Variance | `varianceValue` |
| Variance % | `variancePercent` (formatted as %) |
| Reference | `referenceTag` |
| Commentary | resolved commentary text (see above) |
| Commentary Source | `"USER"`, `"AI_ACCEPTED"`, or `"AI_EDITED"` |

### Formatting Rules
- Negative numbers displayed as `(496)` — not `-496`
- Null/missing numeric values displayed as empty cell (not zero, not dash)
- Header row bold, frozen
- Column widths: auto-fit to content with a minimum of 12 and maximum of 60 characters
- Rows where `displayType` is `"header"` or `"subtotal"` or `"total"`: apply bold font
- Rows where `displayType` is `"blank"`: output empty row, skip commentary

### Export Filter Options
The route must accept a query parameter `filter`:
- `filter=all` — all rows (default)
- `filter=referenced` — only rows where `referenceTag` is not null
- `filter=commented` — only rows where a commentary record exists

### Response
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="<reportName>_export.xlsx"`

---

## Part B — Multi-Country Consolidation Export

### Overview
The user selects two or more `Report` records (each representing a different country's income statement for the same or comparable period) and exports a single consolidated Excel workbook containing:
1. A **Consolidated** sheet with summed numeric values and LLM-synthesized commentary
2. One **country sheet** per selected report showing that country's reviewed rows (same format as Part A)

### UI Entry Point
Add a **"Consolidate & Export"** button to the reports list page (`/reports`).

On click, open a modal (`ConsolidationModal.tsx`) that:
- Lists all available reports with checkboxes
- Shows `reportingPeriod` and `currency` next to each report name
- Allows the user to select 2 or more reports
- Does **not** enforce that reporting periods match — show a soft warning if they differ, but do not block
- Has a **"Generate Consolidated Export"** button that triggers the consolidation API

### Route
`POST /api/reports/consolidate-export`

### Request Body (Zod-validated)
```ts
{
  reportIds: string[]  // min length 2
}
```

### Consolidation Logic — Numeric Aggregation (Application Code)

This must be pure deterministic arithmetic — no LLM involvement.

Steps:
1. Fetch all selected reports with their `ReportRow` records
2. Identify the union of all `sourceCode` values across reports
3. For each unique `sourceCode`:
   - Sum `currentValue` across all reports that have that row (skip nulls)
   - Sum `priorValue` across all reports that have that row (skip nulls)
   - Compute `varianceValue = currentValue - priorValue`
   - Compute `variancePercent = varianceValue / abs(priorValue)` (null if priorValue is zero or null)
   - Take `label`, `section`, `displayType`, `rowIndex` from the report that has the lowest `rowIndex` for that `sourceCode` (i.e. the "primary" report's structure drives the row order and labels)
4. Preserve the original row order from the primary report (the first report in `reportIds`)
5. Rows present in secondary reports but absent from the primary report are appended at the end in their original order

### Consolidation Logic — Commentary Synthesis (Single LLM Call)

Only rows that have at least one non-empty commentary across any of the selected reports should be included in the LLM call.

#### Input to LLM
Construct a JSON payload:
```ts
{
  rows: Array<{
    sourceCode: string
    label: string
    consolidatedCurrentValue: number | null
    consolidatedPriorValue: number | null
    countryCommentaries: Array<{
      country: string         // Report.name
      reportingPeriod: string // Report.reportingPeriod
      commentaryText: string  // resolved final commentary (same resolution logic as Part A)
    }>
  }>
}
```

#### LLM Prompt (system + user)
System:
```
You are a financial reporting assistant helping consolidate income statement commentary across multiple country entities.
Your output must be factual, concise, and directly grounded in the provided per-country commentary.
Do not introduce facts, numbers, or explanations not present in the input.
Return only valid JSON — no markdown, no prose outside the JSON structure.
```

User:
```
Below is an income statement with per-country analyst commentary.
For each row, synthesize the country commentaries into a single consolidated narrative.
- Preserve the key substance of each country's point.
- Reference the country name inline where it adds clarity (e.g. "In UK, ... while DE reported ...").
- Keep each consolidated commentary to 2–3 sentences maximum.
- If only one country has commentary for a row, paraphrase it with the country name as context.
- Return a JSON array where each element has:
  - "sourceCode": string
  - "consolidatedCommentary": string

Input:
<json payload>
```

#### LLM Call
- Use the Anthropic SDK (`@anthropic-ai/sdk`)
- Model: `claude-sonnet-4-6`
- Max tokens: 4096
- Parse the response as `Array<{ sourceCode: string; consolidatedCommentary: string }>`
- If the LLM call fails or returns unparseable JSON: fall back to plain concatenation in the format `[UK] <text> [DE] <text>` with no synthesis — log the error server-side, do not surface it as an export failure

### Excel Output — Consolidated Workbook

#### Sheet 1: "Consolidated"
Same column structure as Part A, with these additions:
- **Commentary** column contains the LLM-synthesized consolidated commentary (or fallback concatenation)
- **Commentary Source** column value is always `"CONSOLIDATED"`
- Add a **Countries** column (after Source Code): comma-separated list of country names that contributed to that row

#### Sheets 2..N: One sheet per selected report
Named by `Report.name` (truncated to 31 chars — Excel sheet name limit).
Same column structure and formatting as Part A single-report export.

### Response
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="consolidated_export.xlsx"`

---

## Part C — Export UI Controls on Report Grid

On the existing report detail page (`/reports/[id]`), add an **Export** dropdown button (top-right of the grid header) with three options:
- Export All Rows
- Export Referenced Rows Only
- Export Commented Rows Only

Each option triggers a `GET /api/reports/[reportId]/export?filter=<value>` and downloads the file.

---

## Files to Create or Modify

| File | Action |
|---|---|
| `src/app/api/reports/[reportId]/export/route.ts` | Create — Part A export route |
| `src/app/api/reports/consolidate-export/route.ts` | Create — Part B consolidation + export route |
| `src/app/reports/ReportsClient.tsx` | Modify — add "Consolidate & Export" button |
| `src/components/ConsolidationModal.tsx` | Create — country selection modal |
| `src/app/reports/[id]/ReportGridClient.tsx` | Modify — add Export dropdown (Part C) |
| `src/lib/export/excel-builder.ts` | Create — shared Excel workbook construction logic used by both routes |
| `src/lib/export/consolidation.ts` | Create — deterministic numeric aggregation logic |
| `src/lib/export/commentary-synthesis.ts` | Create — LLM call + fallback logic |

---

## Constraints and Quality Requirements

- `excel-builder.ts` must be usable by both the single-report and consolidation routes — extract shared formatting logic, do not duplicate
- `consolidation.ts` must have no side effects and be independently testable — pure input/output functions only
- `commentary-synthesis.ts` must never throw — always return a result (synthesized or fallback)
- The LLM call in `commentary-synthesis.ts` must only include rows that have at least one non-empty commentary entry — never send rows with no commentary to the model
- All numeric aggregation must treat `null` as zero-contribution (skip the row for that country), not as `0`
- The `variancePercent` computation must guard against division by zero
- Follow all conventions in CLAUDE.md: typed functions, Zod validation on POST body, no raw Prisma errors to client, `cn()` for conditional classes, `save<Noun>()` naming for fetch calls in client components