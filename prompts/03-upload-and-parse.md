Continue from the existing app.

Read and follow:
- CLAUDE.md
- all files in /agents
- all files in /docs

Task:
Implement the report upload and Excel parsing flow.

Goal:
A user should be able to upload an Excel file and have it parsed into Report + ReportRow records.

Critical:
The parser must preserve the left-most source system code column such as:
- P110100
- P110200
- P110000
- PE00000
- PG81112
etc.

---

## API Route

Create `POST /api/reports/upload` as a Next.js route handler.

Request: multipart form with these fields:
- `file` — the Excel file (.xlsx or .xls)
- `reportName` — string (required)
- `reportingPeriod` — string (required)
- `currency` — string (optional, default "USD")

Response on success (HTTP 201):
```json
{
  "report": {
    "id": "...",
    "name": "...",
    "reportingPeriod": "...",
    "currency": "...",
    "sourceFileName": "...",
    "rowCount": 42
  },
  "warnings": ["string"]
}
```

Error codes:
- 400 — missing required fields
- 415 — unsupported file type (not .xlsx or .xls)
- 422 — parse failure
- 500 — database error

---

## Parser Architecture

Split parser logic across three files:

### `src/lib/parser/normalizers.ts`
Pure functions for value normalisation:
- `parseNumericValue(raw)` — handles plain numbers, bracketed negatives `(496)` → -496, commas; returns `number | null`
- `parsePercentValue(raw)` — handles `(70%)` → -70, `25%` → 25, Excel decimal fractions `0.25` → 25, N/M → null; returns `number | null`
- `normalizeRawText(val)` — converts any cell to trimmed string or null
- `isNumericLike(val)` — heuristic for column detection (returns boolean)
- `isPercentLike(val)` — identifies percentage-format cells (returns boolean)

### `src/lib/parser/column-detector.ts`
Heuristic column mapping. Accepts raw sheet data and returns column indices:
- `sourceCode` — column with highest density of source code pattern `/^P[A-Z0-9]{4,7}$/` or alphanumeric codes
- `label` — first text-heavy column (>30% non-numeric) excluding source code column
- `currentValue`, `priorValue`, `varianceValue` — numeric columns ordered left to right
- `variancePercent` — numeric column with highest proportion of %-format cells
- `referenceTag` — rightmost column with pattern `/^[A-Za-z]\d+(\.\d+)?$/` matches

Export a `detectColumns(rows): ColumnMapping` function.

### `src/lib/parser/excel-parser.ts`
Main entry point. Export:
```ts
parseWorkbook(buffer: Buffer): ParseResult
```

Where `ParseResult` is:
```ts
{
  rows: ParsedRow[];
  warnings: string[];
}
```

And `ParsedRow` has:
- `rowIndex`, `sourceCode`, `label`, `section`, `displayType`
- `currentValue`, `priorValue`, `varianceValue`, `variancePercent`
- `rawCurrentText`, `rawPriorText`, `rawVarianceText`, `rawVariancePercentText`, `rawReferenceText`
- `referenceTag`

Row classification rules:
- `displayType = "blank"` — row has no content
- `displayType = "header"` — row has a text label but no source code and no numeric values
- `displayType = "detail"` — row has a source code matching the detection pattern
- `displayType = "subtotal"` — row has numeric values, no source code, label contains subtotal/net/total keywords
- `displayType = "total"` — row has numeric values, no source code, label contains "total" with prominence

Track header row text as `section` context for subsequent detail rows.

---

## UploadForm Component

Create `src/components/reports/UploadForm.tsx` as a client component.

Features:
1. Drag-and-drop zone — accepts .xlsx/.xls files; shows drag-over highlight
2. Click to browse — file input (hidden, triggered by clicking drop zone)
3. Auto-fills the report name field from the filename (strip extension, replace hyphens/underscores with spaces)
4. Form fields: report name (required), reporting period (required), currency (select: USD, EUR, GBP, AUD, SGD, HKD)
5. Upload button — disabled until file + required fields are present; shows spinner during upload
6. On success: show a result card with row count and any parser warnings
7. On error: show an error card with the error message
8. After success: show "Upload another" button to reset the form

Props: `onSuccess(result: UploadResult): void`

---

## Requirements

1. Parse workbook rows into structured records using the three-file parser
2. Detect and persist: sourceCode, label, currentValue, priorValue, varianceValue, variancePercent, referenceTag
3. Normalize values: `(496)` → -496, `(70%)` → -70
4. Preserve row order via rowIndex
5. Store raw imported text alongside normalized values
6. Handle header / subtotal / total / blank rows gracefully using displayType
7. Create Report + all ReportRows in a single Prisma transaction
8. Add clear validation and error messages

Important:
- Do not hardcode only one exact row range — parser must be heuristic-based
- Keep parser logic modular and testable — pure functions where possible

Before coding:
Explain your parsing strategy, especially how you identify the source code column and numeric columns.
Then generate the code.