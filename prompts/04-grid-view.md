Continue from the existing app.

Read and follow:
- CLAUDE.md
- all files in /agents
- all files in /docs

Task:
Build the main report review grid UI.

Goal:
After upload, a user should be able to open a report and review all parsed rows in a finance-friendly table.

---

## Page Structure

Create two files:

### `src/app/reports/[id]/page.tsx` — server component
- Fetches the report by ID from the database
- Fetches all ReportRows ordered by `rowIndex` ascending
- Includes `_count: { select: { commentaries: true } }` for each row (needed for commentary status dot)
- Returns 404 if report not found
- Sets dynamic page metadata using the report name
- Passes the complete data to `<ReportGridClient>`

### `src/app/reports/[id]/ReportGridClient.tsx` — client component
- All interactive grid logic lives here
- Receives `report` (with `rows`) as a prop

---

## Grid Implementation

Use **TanStack Table (React Table v8)** via `@tanstack/react-table`.

Show these columns in order:

| Column           | Width  | Alignment | Notes                                    |
|------------------|--------|-----------|------------------------------------------|
| Source Code      | 112px  | centre    | monospace, muted — hidden for header/blank rows |
| Description      | flex   | left      | styled per displayType (see below)       |
| Current          | 112px  | right     | formatted number                         |
| Prior            | 112px  | right     | formatted number                         |
| Variance         | 112px  | right     | coloured: positive = emerald, negative = red |
| Var %            | 88px   | right     | coloured: same rules                     |
| Ref              | 72px   | centre    | amber badge when tag present, dot otherwise |
| (status dot)     | 36px   | centre    | green dot = has commentary, grey = no commentary |

Number formatting rules:
- Negative values displayed in brackets: `(496)` not `-496`
- Percentage: `(70.0%)` not `-70.0%`
- `—` for null values
- Right-aligned, monospace, tabular numbers

---

## Row Visual Rules by displayType

Apply these styles to each row based on `displayType`:

| displayType | Description column style               | Row background          |
|-------------|----------------------------------------|-------------------------|
| `header`    | UPPERCASE, small, semibold, muted      | Muted/light background  |
| `detail`    | Normal weight, left-padded (pl-5)      | White, hover on hover   |
| `subtotal`  | Semibold, border-top                   | White                   |
| `total`     | Bold, double border-top                | White                   |
| `blank`     | Render as a spacer `<tr>` — no content, not selectable | Transparent |

- Blank rows must render as a single `<td colSpan={columns.length}>` with a fixed height — not clickable
- Header rows are clickable for selection but visually distinguished
- Numeric columns return `null` for header rows (show nothing)

---

## Row Selection

- Click a row to select it — highlights with blue left border and blue background
- Click the same row again to deselect
- Store `selectedRowId` in state (string | null)
- Selection drives the detail panel (added in slice 06)

---

## Additional Requirements

- `<thead>` must be sticky (stays visible on scroll)
- Column headers: 10px, uppercase, tracking-wider, muted
- Show report metadata above the grid: report name, reporting period, currency, source filename, total row count
- If the report has no rows, show an empty state with an icon and message
- Table must be horizontally scrollable if viewport is narrow

---

## Reports List Page

Update `src/app/reports/ReportsClient.tsx`:
- On successful upload, optimistically prepend the new report to the list without a page reload
- Each report in the list shows: icon, name, source filename, reporting period, row count, currency

Important:
The sourceCode column must always be visible and prominent.

Before coding:
Explain the component structure and data loading approach.
Then generate the code.