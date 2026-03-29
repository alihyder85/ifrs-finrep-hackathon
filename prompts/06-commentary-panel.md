Continue from the existing app.

Read and follow:
- CLAUDE.md
- all files in /agents
- all files in /docs

Task:
Build the row detail and commentary workflow.

Goal:
When a user selects a row, they should be able to review row context and write/update commentary.

---

## Detail Panel

When a row is selected, show a **320px fixed-width right sidebar** panel alongside the grid.

Panel sections (top to bottom):
1. **Panel header** — "Row Detail" label + close (×) button (right-aligned)
2. **Source Code** — displayed as a prominent amber badge; user can select-all to copy
3. **Description** — the row label
4. **Values** — 2×2 grid showing Current, Prior, Variance, Var % (see value editing below)
5. **Reference Tag** — shows tag badge or "None assigned"; pencil icon to edit (from slice 05)
6. **Commentary** — see below
7. **Section** — shows section name if present
8. **Footer** — row index (`Row #N`)

---

## Value Editing

The numeric values (Current, Prior, Variance, Var %) must be editable to allow correction of parsing errors.

- Show values in read-only `ValueCell` components by default
- A pencil icon next to the "Values" section header opens edit mode
- Edit mode replaces the 4 display cells with 4 text inputs, pre-filled with current values
- Accept bracketed negative input: `(496)` → -496
- Include a "Recalculate variance from current & prior" button:
  - `varianceValue = currentValue - priorValue`
  - `variancePercent = (varianceValue / |priorValue|) × 100`
- Save uses the extensible PATCH `rows/[rowId]` endpoint
- Grid row figures update immediately after save without a page reload
- Cancel discards changes and returns to read-only view
- Leave a field blank to keep its existing value unchanged

---

## Commentary API Routes

### GET /api/reports/[reportId]/rows/[rowId]/commentary
Returns the latest commentary for the row:
```json
{ "commentary": { "id", "commentaryText", "sourceCode", "referenceTagSnapshot", "createdAt", "updatedAt" } | null }
```

### PUT /api/reports/[reportId]/rows/[rowId]/commentary
Creates or updates commentary (upsert semantics):
- If no commentary exists for the row → create a new one; snapshot the current referenceTag value into `referenceTagSnapshot`
- If commentary already exists → update `commentaryText` and `updatedAt`
- Validate: `commentaryText` must be 1–5000 characters (Zod)
- Return the full updated commentary object
- HTTP 201 on create, 200 on update

---

## Commentary Editor UX

- When a row is selected, immediately fetch existing commentary via `GET` and populate the textarea
- Show a loading indicator (`Loader2` spinner) while fetching
- Textarea: 5 rows tall, full width, resize disabled
- Keyboard shortcut: **⌘↵** (Mac) / **Ctrl+↵** (Windows) triggers save
- Show `updatedAt` timestamp next to the Commentary section label when commentary exists (formatted as "updated DD Mon YY")
- Save button label: "Save" when no commentary exists; "Update" when it does
- Show a spinner on the Save/Update button during the API call; disable the button while saving
- After a successful save, show a brief "Saved" success state on the button for 2.5 seconds
- Show inline error message below textarea on validation or API failure
- Commentary status dot in the grid (introduced in slice 04) must update immediately after the first save on a row — no page reload

---

## Commentary must be tied to

- report (`reportId`)
- reportRow (`reportRowId`)
- sourceCode (denormalised — always copy from the row)

This is mandatory for auditability.

---

## Requirements

1. 320px right sidebar panel shown when a row is selected
2. Panel close button (×) dismisses the panel and deselects the row
3. Source code displayed as first-class amber badge
4. Editable numeric values with recalculation (see above)
5. Commentary create/update via GET + PUT API routes
6. Fetch commentary on row select; show loading state
7. ⌘↵ / Ctrl+↵ keyboard shortcut to save
8. `updatedAt` timestamp display
9. 5000 character limit enforced on backend (Zod)
10. Commentary status dot in the grid updates immediately after first save
11. Commentary tied to report + reportRow + sourceCode

Before coding:
Explain the interaction design and persistence flow.
Then generate the code.