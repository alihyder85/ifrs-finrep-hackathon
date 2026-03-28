# Finance Review App — Claude Build Guide

## Objective
Build a production-quality internal web application for finance / management reporting review.

The app must allow users to:
1. Upload structured Excel-based financial statement sheets
2. Parse statement rows into a structured model
3. Preserve the original row lineage from the source system
4. Display statement values for multiple periods and variance
5. Associate commentary and references to statement rows
6. Export reviewed commentary in a clean and auditable format

---

## Core Domain Context

The uploaded spreadsheet contains financial statement line items such as:
- Interest Income
- Interest Expense
- Net Interest Income
- Fee Income
- Fee Expense
- Net Fee Income
- Total Operating Income
- Total Operating Expenses
- Operating Profit/Loss

The sheet also contains a **source system row code** column (example: `P110100`, `PE00000`, `PG81112`, etc.).
This source code is critical and must always be preserved.

### Important:
Each financial row may have:
- source row code
- display label
- statement section
- current period value
- prior period value
- variance
- variance %
- optional reference marker (e.g. `A1`, `C1.1`, `D1`, `M1.8`)
- optional analyst commentary

This app is NOT just an Excel viewer.
It is a **finance review and commentary system with traceability**.

---

## Non-Negotiable Product Requirements

### 1. Source Lineage
Every imported row must preserve:
- source system code (e.g. `P110100`)
- original row order
- original label text

This is mandatory.

### 2. Commentary Anchoring
Commentary must be stored against a stable row identity, not just visible row position.

A commentary record must be linked to:
- statement / report
- reporting period
- row source code
- row label
- optional reference tag

### 3. Reference Labels
Users must be able to attach or edit references like:
- A1
- B1
- C1
- C1.1
- C1.2
- D1
- E1
- F1
- M1.3

These references are used in commentary and review workflows.

### 4. Spreadsheet-Like Review UX
The main view should feel familiar to finance users:
- row-based grid
- frozen headers
- aligned numbers
- negative values in brackets
- variance highlighting
- row selection
- commentary panel linked to selected row

### 5. Human-in-the-Loop Parsing
Excel layouts may vary slightly.
The parser should be robust but configurable.
Do NOT hardcode only one exact file layout.

---

## Technical Expectations

Claude should generate a clean, maintainable application using:

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Table for grid behavior
- React Hook Form + Zod where needed

### Backend
- Next.js server actions or route handlers for MVP
- Optional separate API layer only if necessary
- Prisma ORM

### Database
- PostgreSQL

### File Parsing
- Excel parsing using `xlsx` or equivalent robust library

### Validation
- Zod schemas for imported row structure and commentary forms

### Export
- CSV and/or Excel export for reviewed commentary

---

## Architecture Principles

1. Build slice-by-slice, never huge one-shot generation
2. Prefer explicit domain modeling over vague generic CRUD
3. Preserve auditability and traceability
4. Separate parsing logic from UI logic
5. Keep imported source data immutable where possible
6. Support future extension to:
   - multi-sheet uploads
   - multiple report versions
   - approval workflow
   - AI-assisted commentary suggestions

---

## Data Modeling Expectations

Claude must model at minimum:

### Report
Represents one uploaded statement/report.

### ReportRow
Represents one financial line item.

Required attributes include:
- reportId
- rowIndex
- sourceCode
- label
- section (optional)
- currentValue
- priorValue
- varianceValue
- variancePercent
- referenceTag (optional)
- formatting hints if useful
- parent/child grouping if useful

### Commentary
Represents analyst commentary tied to a row.

Required attributes include:
- reportId
- reportRowId
- sourceCode (denormalized for audit/search)
- referenceTag (optional)
- commentaryText
- createdAt
- updatedAt

---

## Parsing Rules

The parser must:
1. Read uploaded workbook
2. Identify financial statement table area
3. Detect and preserve source code column
4. Detect line item labels
5. Detect numeric columns:
   - current period
   - prior period
   - variance
   - variance %
6. Detect optional reference tags in the right-most area
7. Normalize numeric values from:
   - plain numbers
   - bracketed negatives e.g. `(496)`
   - percentages e.g. `(70%)`
8. Preserve blank or subtotal rows if useful for rendering

---

## UX Expectations

### Main Review Screen
Must contain:
- report selector or current report header
- upload control
- parsed statement grid
- selected row detail panel
- commentary editor
- save/update actions

### Row Detail / Commentary Panel
When a row is selected, show:
- source code
- row label
- current/prior/variance values
- reference tag
- commentary history or latest commentary

### Export UX
Allow export of:
- all rows with commentary
- only referenced rows
- only rows with commentary

---

## Quality Bar

Claude must:
- write strongly typed code
- avoid unnecessary abstraction
- include loading/error/empty states
- include seed/sample data if useful
- include README setup instructions
- include migration-ready Prisma schema
- keep generated code production-oriented, not demo-only

---

## Working Style for Claude

When implementing each slice:
1. First explain the planned files and changes
2. Then generate code
3. Keep each slice independently runnable
4. Do not refactor unrelated parts unless necessary
5. Preserve compatibility with previous slices

---

## Output Priority Order

Always optimize for:
1. correctness
2. maintainability
3. auditability
4. finance-user usability
5. visual polish

---

## Critical Reminder

The **source system row code column is a first-class business key**.
Never drop it.
Never treat it as cosmetic.
Never rely only on row label text.