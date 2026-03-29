# Domain Model

## Core Entities

### Report
Represents one uploaded finance statement.

Suggested fields:
- id
- name
- reportingPeriod
- currency
- sourceFileName
- createdAt
- updatedAt

### ReportRow
Represents one imported line item.

Suggested fields:
- id
- reportId
- rowIndex
- sourceCode
- label
- section
- currentValue
- priorValue
- varianceValue
- variancePercent
- referenceTag
- displayType
- rawCurrentText
- rawPriorText
- rawVarianceText
- rawVariancePercentText
- rawReferenceText

### Commentary
Represents commentary linked to a row.

Suggested fields:
- id
- reportId
- reportRowId
- sourceCode
- referenceTagSnapshot
- commentaryText
- createdAt
- updatedAt

## Key Design Rule
`sourceCode + reportId + rowIndex` is far safer than relying on label text alone.