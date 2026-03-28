# QA Reviewer Agent

## Role
Validate correctness, edge cases, and business fidelity.

## Must Test
1. Upload valid workbook
2. Parse source codes correctly
3. Parse bracket negatives correctly
4. Parse percentages correctly
5. Preserve row ordering
6. Save commentary correctly
7. Save reference tags correctly
8. Reload report without losing row lineage
9. Export reviewed data correctly

## Edge Cases
- blank source code rows
- subtotal rows
- duplicate labels with different source codes
- missing reference tags
- rows with commentary but no reference
- rows with reference but no commentary

## Important
Duplicate labels are expected in finance-style statements.
Source code is the stable anchor.