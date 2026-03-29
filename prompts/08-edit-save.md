Continue from the existing app.

Read and follow:
- CLAUDE.md
- all files in /agents
- all files in /docs

Task:
Improve edit/save experience and review workflow quality.

Requirements:
1. Add success/error toasts
2. Add loading states for save/update actions
3. Add unsaved-change handling where appropriate
4. Improve keyboard-friendly review flow if practical
5. Make row switching safe when commentary is unsaved
6. Improve empty states and upload guidance
7. Ensure grid and side panel stay in sync
8. Ensure value correction (current, prior, variance, variance%) is fully wired:
   - The pencil icon on the Values section in the detail panel opens inline edit mode
   - All four fields are independently editable inputs
   - "Recalculate" button auto-fills variance and variance% from current and prior
   - Save uses the extensible PATCH `rows/[rowId]` endpoint
   - Success shows a toast; network errors show a toast
   - Grid row figures update immediately after save without a page reload

---

## Toast System

Create a lightweight custom `ToastProvider` in `src/components/ui/toast.tsx`:
- Context-based: `ToastProvider` wraps children; `useToast()` hook returns `toast(type, message)`
- Types: `"success"` (emerald) and `"error"` (red)
- Toasts appear fixed bottom-right, stack up to 3, auto-dismiss after 4 seconds
- Each toast has a dismiss (×) button
- Slide-in animation from the right on mount

**Placement**: Add `<ToastProvider>` in `AppShell` (not in `layout.tsx`), since it requires `"use client"`.

Use toasts for:
- Commentary saved/network error
- Reference tag saved/network error
- Values updated/network error
- Commentary load failure

Keep inline validation errors (e.g., "Commentary cannot be empty", "Invalid tag format") as inline messages — do not replace those with toasts.

---

## Unsaved Change Guard

Track whether commentary has been modified but not yet saved:
```ts
const isDirty = commentaryText !== (commentary?.commentaryText ?? "");
```

When `isDirty` is true:
- **Switching rows** — show a browser `confirm()` dialog before switching: "You have unsaved commentary changes. Switch rows and discard them?"
- **Closing the panel** — same confirm dialog before closing
- If the user cancels the confirm, stay on the current row/panel state

---

## Dirty Visual System (amber)

When `isDirty` is true, apply amber visual indicators throughout:
- **Grid row** — selected row border changes from blue to amber
- **Commentary textarea** — border colour changes to amber
- **Save button** — changes to an amber/orange background
- **Panel header** — show a small "Unsaved" badge with a warning icon next to "Row Detail"

When commentary is saved, all amber indicators revert to normal immediately.

---

## Keyboard Row Navigation

Add `↑` / `↓` arrow key navigation through rows:
- Only active when a row is selected (panel is open)
- **Guard**: skip if `document.activeElement` is a `TEXTAREA`, `INPUT`, or `SELECT` — never fire during text entry
- Navigate through non-blank, non-header rows only (i.e., rows where `displayType !== "blank"` and `displayType !== "header"`)
- When navigating, respect the dirty guard — confirm before switching if `isDirty`

Add visual navigation in the panel header:
- `↑` chevron button (navigate to previous row)
- `↓` chevron button (navigate to next row)
- Both buttons disabled when at start/end of navigable list

Add a position counter in the panel footer:
- Format: `N / total` (e.g., `3 / 24`)
- Shows current position within the navigable row list

Panel close (×) button hint text update: `⌘↵ to save · ↑↓ to navigate`

---

## Panel Close Safety

- The panel close (×) button must be **disabled** while any save is in progress (`commentarySaving || tagSaving || valueSaving`)
- This prevents accidentally closing mid-save

---

## Empty States

Improve the empty state on the Reports page (`/reports`) when no reports have been imported yet:
- Use a bordered, illustrated empty state box (not just a line of text)
- Include a description of what to do (import a report) and what will be possible after (review rows, add commentary, attach reference tags)

Improve the upload card on the same page:
- Add a brief description of the expected Excel file format (source code column, description column, numeric columns for current/prior/variance)

Improve the empty state in the report grid when a report has no rows:
- Show an icon, a title, and a helpful message explaining what might have gone wrong (file format mismatch)

---

Important:
This should feel like a serious internal finance workflow tool, not a toy demo.

Before coding:
Explain the UX improvements you will implement.
Then generate the code.