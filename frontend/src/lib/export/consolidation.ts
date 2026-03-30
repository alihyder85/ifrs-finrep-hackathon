/**
 * Deterministic numeric aggregation for multi-country consolidation.
 * Pure input/output — no side effects, no DB access, independently testable.
 */

export interface ConsolidationInputRow {
  sourceCode: string;
  label: string;
  section: string | null;
  displayType: string | null;
  rowIndex: number;
  currentValue: number | null;
  priorValue: number | null;
  referenceTag: string | null;
}

export interface ConsolidationInputReport {
  id: string;
  name: string;
  reportingPeriod: string;
  rows: ConsolidationInputRow[];
}

export interface ConsolidatedRow {
  sourceCode: string;
  label: string;
  section: string | null;
  displayType: string | null;
  rowIndex: number;
  currentValue: number | null;
  priorValue: number | null;
  varianceValue: number | null;
  variancePercent: number | null;
  referenceTag: string | null;
  /** Country names that contributed a value for this row */
  contributingCountries: string[];
}

/**
 * Aggregate numeric values across multiple country reports by sourceCode.
 *
 * Rules:
 * - Row order is driven by the first report in the array (primary report).
 * - Rows absent from the primary but present in secondaries are appended in their original order.
 * - null values are skipped (not treated as zero) when summing.
 * - varianceValue = currentValue - priorValue (null if both are null)
 * - variancePercent = varianceValue / |priorValue| (null if priorValue is 0 or null)
 */
export function consolidateRows(reports: ConsolidationInputReport[]): ConsolidatedRow[] {
  if (reports.length === 0) return [];

  const [primary, ...secondaries] = reports;

  // Build a map: sourceCode → accumulated sums across all reports
  type Accumulator = {
    label: string;
    section: string | null;
    displayType: string | null;
    rowIndex: number;
    currentSum: number | null;
    priorSum: number | null;
    referenceTag: string | null;
    contributors: string[];
  };

  const accMap = new Map<string, Accumulator>();

  // Process primary report first to establish row order
  for (const row of primary.rows) {
    accMap.set(row.sourceCode, {
      label: row.label,
      section: row.section,
      displayType: row.displayType,
      rowIndex: row.rowIndex,
      currentSum: row.currentValue,
      priorSum: row.priorValue,
      referenceTag: row.referenceTag,
      contributors: row.currentValue !== null || row.priorValue !== null ? [primary.name] : [],
    });
  }

  // Process secondary reports — accumulate into existing entries or append new
  let appendIndex = primary.rows.length;
  for (const report of secondaries) {
    for (const row of report.rows) {
      const existing = accMap.get(row.sourceCode);
      if (existing) {
        // Accumulate
        if (row.currentValue !== null) {
          existing.currentSum =
            existing.currentSum !== null
              ? existing.currentSum + row.currentValue
              : row.currentValue;
        }
        if (row.priorValue !== null) {
          existing.priorSum =
            existing.priorSum !== null
              ? existing.priorSum + row.priorValue
              : row.priorValue;
        }
        if (
          (row.currentValue !== null || row.priorValue !== null) &&
          !existing.contributors.includes(report.name)
        ) {
          existing.contributors.push(report.name);
        }
      } else {
        // Row not in primary — append
        accMap.set(row.sourceCode, {
          label: row.label,
          section: row.section,
          displayType: row.displayType,
          rowIndex: appendIndex++,
          currentSum: row.currentValue,
          priorSum: row.priorValue,
          referenceTag: row.referenceTag,
          contributors:
            row.currentValue !== null || row.priorValue !== null ? [report.name] : [],
        });
      }
    }
  }

  // Convert accumulators to ConsolidatedRow, sorted by rowIndex
  const consolidated: ConsolidatedRow[] = [];

  for (const [sourceCode, acc] of accMap.entries()) {
    const { currentSum, priorSum } = acc;

    let varianceValue: number | null = null;
    let variancePercent: number | null = null;

    if (currentSum !== null || priorSum !== null) {
      const cur = currentSum ?? 0;
      const pri = priorSum ?? 0;
      varianceValue = cur - pri;
      if (priorSum !== null && priorSum !== 0) {
        variancePercent = (varianceValue / Math.abs(priorSum)) * 100;
      }
    }

    consolidated.push({
      sourceCode,
      label: acc.label,
      section: acc.section,
      displayType: acc.displayType,
      rowIndex: acc.rowIndex,
      currentValue: currentSum,
      priorValue: priorSum,
      varianceValue,
      variancePercent,
      referenceTag: acc.referenceTag,
      contributingCountries: acc.contributors,
    });
  }

  consolidated.sort((a, b) => a.rowIndex - b.rowIndex);

  return consolidated;
}