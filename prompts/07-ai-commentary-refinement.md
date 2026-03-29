Continue from the existing app.

Read and follow:
- CLAUDE.md
- all files in /agents
- all files in /docs

Task:
Add an AI-assisted commentary validation and refinement workflow to the finance review app.

---

## Data Model — Add in This Slice

Add the `CommentaryRefinement` model to `prisma/schema.prisma` and generate a migration before implementing any UI or API code.

Goal:
Allow finance users to validate and refine commentary using LLM assistance before saving the final approved version.

This is NOT a fully autonomous overwrite workflow.
This is a human-in-the-loop review capability.

The UI action must be labeled exactly as:
**AI based commentary refinement**

---

## Core User Story

A finance reviewer has written commentary for one or more financial statement rows.

They want the application to:
1. check whether the commentary aligns with the row’s financial values
2. detect possible mismatch between the narrative and the actual numbers
3. detect likely typo / wording / grammar issues
4. check whether references to historical / macro / external events are sensible and not obviously wrong
   - examples:
     - Fed rate hike / rate cut
     - COVID period references
     - inflation
     - recession
     - market volatility
     - policy change references
5. propose a refined version of the commentary
6. allow the user to accept or amend the AI-refined version before updating

The user must be able to do this:
- for a **single selected row commentary**
- for **all commentaries in the report at once**

---

## Functional Requirements

### 1. Add AI Refinement Actions

Add a visible UI action labeled exactly:

**AI based commentary refinement**

Support both:
- **single-row refinement**
- **bulk refinement for all rows with commentary**

Suggested UX:
- one button inside the row commentary panel for the selected row
- one bulk action button near the report-level actions / toolbar

---

## 2. Single Commentary AI Review Flow

When user triggers refinement for a selected row, the app should send the following context to an LLM:

### Required row context
- sourceCode
- row label
- currentValue
- priorValue
- varianceValue
- variancePercent
- referenceTag (if any)
- existing commentary text

### Optional contextual enrichment
- report name
- reporting period
- nearby rows (optional if useful)
- whether row is subtotal / total / detail

The LLM should return a structured response that includes:

1. **validation summary**
   - does commentary broadly align with values?
   - yes / no / partially

2. **issues found**
   - numeric mismatch
   - direction mismatch
   - typo / grammar issue
   - unsupported or questionable historical reference
   - vague wording
   - missing explanation for large movement

3. **AI refined commentary**
   - a cleaner improved version of the commentary

4. **confidence / caution notes**
   - if the model is unsure about an external historical claim, it should explicitly say so

---

## 3. Bulk Commentary AI Review Flow

When user triggers bulk refinement:
- run AI refinement for all rows that currently have commentary
- do NOT automatically overwrite final saved commentary
- generate review results row by row

Requirements:
- show bulk progress state
- persist AI refinement results separately from user-approved commentary
- allow user to review each AI output before accepting
- support filtering rows by:
  - has commentary
  - has AI issues
  - AI refined pending approval

---

## 4. Human Approval Workflow (Critical)

The app must NEVER silently overwrite the user’s original commentary.

For each commentary row, support:
- Original Commentary
- AI Refined Commentary
- AI Findings / Flags
- Action buttons such as:
  - Accept AI Refined
  - Edit Before Accepting
  - Dismiss AI Suggestion

The user must be able to:
1. directly accept the AI refined text
2. edit/amend the AI refined text before updating
3. keep the original commentary if preferred

This is mandatory.

---

## 5. Data Model Changes

Create a dedicated `CommentaryRefinement` model in `prisma/schema.prisma`:

```prisma
model CommentaryRefinement {
  id                         String   @id @default(cuid())
  reportId                   String
  reportRowId                String
  sourceCode                 String
  originalCommentarySnapshot String   // immutable — never update this after creation
  aiRefinedCommentary        String?
  aiValidationStatus         String?  // "yes" | "no" | "partially"
  aiIssuesJson               String?  // JSON-encoded AIIssue[]
  aiConfidenceNote           String?
  refinementStatus           String   @default("PENDING_REVIEW")
  // PENDING_REVIEW | ACCEPTED | DISMISSED | EDITED_AND_ACCEPTED
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt

  report    Report    @relation(fields: [reportId], references: [id], onDelete: Cascade)
  reportRow ReportRow @relation(fields: [reportRowId], references: [id], onDelete: Cascade)

  @@index([reportId])
  @@index([reportRowId])
  @@index([reportId, refinementStatus])
}
```

Also add the inverse relations to `Report` and `ReportRow`:
```prisma
// In Report model:
refinements CommentaryRefinement[]

// In ReportRow model:
refinements CommentaryRefinement[]
```

Run `prisma migrate dev` to apply.

Important:
Preserve an auditable distinction between:
- user-authored commentary (in `Commentary` model)
- AI-proposed refinement (in `CommentaryRefinement.aiRefinedCommentary`)
- user-approved final commentary (updated back into `Commentary` on accept)

`originalCommentarySnapshot` must NEVER be updated after creation.
Do NOT collapse these into one field without traceability.

---

## 6. LLM Prompt Design Requirements

Implement the LLM integration with a strong, explicit prompt.

The LLM prompt must instruct the model to:

1. validate whether the commentary matches the direction and scale of the values
   - example:
     - if commentary says “increase” but values show decline, flag it
     - if commentary says “slight decline” but numbers show major drop, flag it

2. detect likely typo or wording issues

3. identify vague or weak finance commentary
   - example:
     - “movement due to market conditions” with no specificity

4. review references to macro / historic events carefully
   - examples:
     - Fed rate hikes
     - COVID disruption
     - inflation
     - recession
     - market volatility
     - regulatory change

5. avoid pretending certainty on external facts unless clearly justified

6. return structured JSON or strongly parseable output

Important:
The model should act as a **review assistant**, not as a fictional author inventing explanations.

The prompt must explicitly tell the model:
- do not fabricate causes not grounded in the commentary or context
- if an external claim cannot be confidently validated, mark it as caution rather than asserting truth

---

## 7. Historical / External Reference Validation

Add a validation rule for commentary containing references such as:
- “due to COVID”
- “due to Fed rate hikes”
- “because of inflation”
- “due to recessionary environment”
- “because of market volatility”

Requirements:
- detect when commentary includes such references
- ask the model to evaluate whether the reference is:
  - plausible
  - too vague
  - likely mistimed
  - potentially inaccurate

Important:
Do not claim perfect factual verification if the app does not use external retrieval yet.

For MVP:
Implement this as an LLM reasoning-based review with explicit caution labels.

Optional:
If you can cleanly design the code for future extension, structure it so external web/RAG verification can be added later.

---

## 8. UX Requirements

### For selected row
In the row detail panel:
- keep original commentary visible
- add AI refinement button
- show AI findings in a structured readable way
- show AI refined version in editable form
- allow user to accept or amend before saving

### For bulk review
Add a bulk review screen / modal / panel that shows:
- row label
- sourceCode
- referenceTag
- AI status
- issues found
- quick accept / review action

### Visual status suggestions
Use clear but restrained internal-tool style badges such as:
- OK
- Needs Review
- Caution
- Refined Pending Approval
- Accepted

Keep design professional and understated.

---

## 9. API / Server Requirements

Implement server-side actions / routes for:

1. **GET** `/api/reports/[reportId]/rows/[rowId]/commentary/refine` — fetch existing refinement for row
2. **POST** `/api/reports/[reportId]/rows/[rowId]/commentary/refine` — run single-row AI review
3. **POST** `/api/reports/[reportId]/commentary/refine-all` — run bulk AI review (SSE streaming)
4. **PATCH** `/api/reports/[reportId]/refinements/[refinementId]` — apply action (accept / dismiss / edit)

### Bulk Refinement — Server-Sent Events (SSE)

The bulk endpoint must use **Server-Sent Events** to stream progress to the client in real time. Do not wait for all rows to complete before responding.

SSE event format (one JSON object per `data:` line):
```
data: {"type":"start","total":12}
data: {"type":"progress","processed":1,"total":12,"rowId":"...","label":"Interest Income"}
data: {"type":"result","rowId":"...","refinement":{...CommentaryRefinement fields}}
data: {"type":"error","rowId":"...","message":"AI call failed"}
data: {"type":"complete","processed":12,"total":12}
```

The client connects with `EventSource` or `fetch` + `ReadableStream`. Process rows sequentially and send an event after each one. On per-row error, send the error event and continue to the next row.

Requirements:
- Strongly typed request/response contracts
- Clear loading and error handling
- Avoid blocking the full UI unnecessarily
- Support future swap of LLM provider

---

## 10. Implementation Expectations

Create `src/lib/ai/commentary-refinement.ts` as the AI service layer.

### LLM Provider

Use the **Anthropic Claude API** via `@anthropic-ai/sdk`:
- Model: `claude-opus-4-6`
- Enable extended thinking (budget_tokens: 4000) for deeper reasoning
- Read API key from `process.env.ANTHROPIC_API_KEY`

### Rule-Based Mock Fallback (mandatory)

The app must work fully when `ANTHROPIC_API_KEY` is not set.

When no API key is present, apply a deterministic rule-based fallback:
1. **Direction mismatch** — commentary says "increase"/"growth"/"up" but `varianceValue < 0`, or says "decline"/"decrease"/"down" but `varianceValue > 0` → flag as DIRECTION_MISMATCH (high severity)
2. **Vague wording** — commentary contains phrases like "market conditions", "external factors", "various factors", "normal fluctuation" without specifics → flag as VAGUE_WORDING (medium severity)
3. **Historical reference caution** — commentary mentions "COVID", "Fed", "inflation", "recession", "rate hike" → flag as HISTORICAL_REFERENCE_CAUTION (low severity, mark as caution not error)
4. **Missing explanation for large variance** — `|variancePercent| > 15` and commentary is fewer than 80 characters → flag as MISSING_EXPLANATION (medium severity)
5. **Grammar/typo** — not checked in mock mode

The mock must return a `CommentaryRefinementOutput` object with:
- `validationStatus`: determined by severity of issues found
- `issues`: array of detected issues
- `refinedCommentary`: lightly improved version of original text (or original if no issues)
- `confidenceNote`: note stating this is mock/rule-based output

The mock fallback must produce deterministic results for the same input — do not use random values.

---

## 11. Quality Rules

The AI feature must:
- be auditable
- preserve user control
- avoid silent overwrites
- avoid hallucinated certainty
- be finance-review oriented, not generic chatbot style

Important:
This feature should feel like a serious internal review assistant.

---

## 12. Out of Scope for This Slice

Do NOT add yet unless truly necessary:
- live web search
- automatic external fact retrieval
- approval workflows across multiple users
- AI-generated commentary for rows with no commentary at all (unless very easy and clearly separated)
- full prompt management UI

Stay focused on refinement / validation of existing commentary.

---

## Deliverables

Implement:
1. data model changes
2. AI refinement service layer
3. prompt template(s)
4. single-row refinement flow
5. bulk refinement flow
6. UI for reviewing and accepting/dismissing AI output
7. loading/error/empty states
8. any Prisma migration updates required

---

Before coding:
1. Explain your architecture and data model approach for storing AI refinement results safely
2. Explain your LLM prompt design approach
3. Explain your UI flow for single-row and bulk review
4. Then generate the code