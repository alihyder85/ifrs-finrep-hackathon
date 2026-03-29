Continue from the existing app.

Read and follow:
- CLAUDE.md
- all files in /agents
- all files in /docs

Task:
Add editable reference tag support.

Goal:
Users should be able to view and edit row-level reference tags such as:
- A1
- B1
- C1
- C1.1
- C1.2
- D1
- M1.8

---

## UX — Inline Editing in Detail Panel

The reference tag is displayed and edited inside the row detail panel (right sidebar introduced in slice 06, but the UI widget is built here and wired in that panel).

Edit flow:
1. A pencil icon button appears next to the "Reference Tag" section label
2. Clicking the pencil replaces the read-only badge with an inline input + Save + Cancel buttons
3. Pressing **Enter** triggers save; pressing **Escape** cancels
4. During save, the Save button shows a spinner and the input is disabled
5. On success, the edit mode closes and the grid's Ref column updates immediately
6. On validation error, show an inline error message below the input
7. Leave field blank and save to remove the tag

---

## Validation

Validate the reference tag format on the client before calling the API.

Regex: `^[A-Za-z]\d+(\.\d+)*$`

Valid examples: `A1`, `C1.1`, `M1.8`, `D2.3.1`
Invalid examples: `1A`, `A`, `C1.`, `.1`

If invalid, show an inline error message — do not call the API.

---

## API Route

Extend the PATCH endpoint at `PATCH /api/reports/[reportId]/rows/[rowId]`.

This endpoint must be designed with an **extensible Zod schema using all-optional fields** — not a single-field schema. Future slices will add `currentValue`, `priorValue`, `varianceValue`, and `variancePercent` to this same endpoint.

Schema pattern:
```ts
const patchSchema = z.object({
  referenceTag: z.string().regex(...).nullable().optional(),
  currentValue: z.number().nullable().optional(),
  priorValue: z.number().nullable().optional(),
  varianceValue: z.number().nullable().optional(),
  variancePercent: z.number().nullable().optional(),
});
```

Only apply fields that are present in the request body:
```ts
if (field !== undefined) updateData.field = value;
```

Response: return all five fields that can be updated (`referenceTag`, `currentValue`, `priorValue`, `varianceValue`, `variancePercent`).

---

## Grid Sync

After saving, update the in-memory `rows` state so the Ref column in the grid reflects the change immediately — no page reload required.

---

## Requirements

1. Pencil icon UX for inline editing in the detail panel
2. Enter to save, Escape to cancel
3. Validation regex `^[A-Za-z]\d+(\.\d+)*$` with inline error
4. Persist changes via the extensible PATCH endpoint
5. Reflect saved values immediately in the grid
6. Preserve sourceCode linkage — never update the wrong row

Important:
Reference tags are row-level review metadata and must remain tied to the imported row identity.

Before coding:
Explain whether you will use inline editing or panel-based editing and why.
Then generate the code.