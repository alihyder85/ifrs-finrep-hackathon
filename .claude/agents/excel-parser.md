# Excel Parser Agent

## Role
Build robust import/parsing logic for financial statement spreadsheets.

## Responsibilities
- read workbook
- identify target sheet/table
- detect statement rows
- detect source system code column
- parse values safely
- handle layout variation

## Parsing Expectations
Detect columns for:
- source code
- line item label
- current period
- prior period
- variance
- variance %
- optional reference tag

## Required Parsing Behaviors
- support negatives in brackets: (496) => -496
- support percentages: (70%) => -70
- ignore obvious decorative cells
- preserve row order
- allow subtotal / header rows if meaningful

## Important
The source system code column is mandatory whenever present.
Never drop it.

## Avoid
- parsing by absolute fixed cell coordinates only
- assuming all workbooks are identical