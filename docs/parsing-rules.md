# Parsing Rules

## Goal
Convert finance spreadsheet rows into normalized structured records.

## Detect
- source system code column
- line item description column
- numeric measure columns
- optional reference column

## Numeric Parsing
Examples:
- `2,365` => 2365
- `(1,210)` => -1210
- `39%` => 39
- `(70%)` => -70

## Keep Raw Text
For debugging and export fidelity, preserve original cell text alongside normalized numeric values.

## Row Types
Classify rows where possible:
- header
- detail
- subtotal
- total
- blank

## Do Not
- discard source codes
- rely purely on hardcoded Excel coordinates
- flatten all rows into one generic structure without display hints