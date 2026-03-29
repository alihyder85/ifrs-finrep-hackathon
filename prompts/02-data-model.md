Continue from the existing app.

Read and follow:
- CLAUDE.md
- all files in /agents
- all files in /docs

Task:
Design and implement the Prisma data model and supporting TypeScript types for the finance review app.

You must model these entities:
1. Report
2. ReportRow
3. Commentary

Do NOT add CommentaryRefinement in this slice — it will be added in slice 07.

Critical business rule:
The source system row code column is mandatory to preserve and must be modeled as a first-class field.

Requirements:

### Report
- id: CUID primary key
- name: string
- reportingPeriod: string
- currency: string (default "USD")
- sourceFileName: string
- createdAt, updatedAt timestamps
- Relations: rows[], commentaries[]

### ReportRow
- id: CUID primary key
- reportId: foreign key with cascade delete
- rowIndex: Int (0-based parse order — must be preserved)
- sourceCode: string (e.g. P110100 — first-class business key, never drop)
- label: string
- section: string? (header section context, optional)
- displayType: string? (values: "header" | "detail" | "subtotal" | "total" | "blank")
- currentValue: Float?
- priorValue: Float?
- varianceValue: Float?
- variancePercent: Float?
- referenceTag: string? (e.g. A1, C1.1, M1.8)
- rawCurrentText: string?
- rawPriorText: string?
- rawVarianceText: string?
- rawVariancePercentText: string?
- rawReferenceText: string?
- Unique constraint: @@unique([reportId, rowIndex])
- Index: @@index([reportId, sourceCode])

### Commentary
- id: CUID primary key
- reportId: foreign key
- reportRowId: foreign key with cascade delete
- sourceCode: string (denormalised for audit trail — always copy from row)
- referenceTagSnapshot: string? (capture tag value at time of commentary creation)
- commentaryText: string
- createdAt, updatedAt timestamps
- Indexes: @@index([reportId, sourceCode]), @@index([reportRowId])

Also:
- Create `src/types/index.ts` with TypeScript interfaces mirroring the Prisma models:
  - `DisplayType` union type: "header" | "detail" | "subtotal" | "total" | "blank"
  - `Report`, `ReportRow`, `Commentary` interfaces
  - Convenience types: `ReportWithRows`, `ReportRowWithCommentary`
- Add a Prisma seed file at `prisma/seed.ts` with one sample report containing at least these rows with realistic numeric values:

| rowIndex | sourceCode | label               | displayType | currentValue | priorValue | varianceValue | variancePercent |
|----------|------------|---------------------|-------------|--------------|------------|---------------|-----------------|
| 0        | HDR001     | Income Statement    | header      | null         | null       | null          | null            |
| 1        | P110100    | Interest Income     | detail      | 52400        | 48900      | 3500          | 7.2             |
| 2        | P110200    | Interest Expense    | detail      | -18600       | -16200     | -2400         | -14.8           |
| 3        | P110000    | Net Interest Income | subtotal    | 33800        | 32700      | 1100          | 3.4             |
| 4        | PE00000    | Fee Income          | detail      | 12100        | 11400      | 700           | 6.1             |
| 5        | PF00000    | Fee Expense         | detail      | -3200        | -2900      | -300          | -10.3           |

Before coding:
Explain your schema choices and why they fit this finance use case.
Then generate the code.