/**
 * Generates sample-income-statement-with-commentary.xlsx
 *
 * Layout matches the actual Excel format:
 *
 *   PART 1 — Income Statement
 *   Col 0: source code (P110100, etc.)
 *   Col 1: label
 *   Col 2: Dec 2024
 *   Col 3: Dec 2023
 *   Col 4: Variance
 *   Col 5: Var %
 *   Col 6: Ref tag (A1, B1, …)
 *
 *   PART 2 — Commentary Section (all grouped at the bottom)
 *   Commentary block header row mirrors the income statement column layout exactly,
 *   but with the reference tag in col 0 instead of a P-code, and col 6 left blank:
 *     Col 0: ref tag  (A1, B1, C1.1 …)
 *     Col 1: label    (same label as the referenced income statement row)
 *     Col 2: Dec 2024 value  (same value as income statement row)
 *     Col 3: Dec 2023 value
 *     Col 4: Variance
 *     Col 5: Var %
 *     Col 6: (blank)
 *   Commentary bullet rows:
 *     Col 0: (blank)
 *     Col 1: bullet text
 *     Col 2-6: (blank)
 *
 * The parser detects a reference tag (A1, C1.1 …) in col 0 as a Layout B
 * commentary section header and associates all following bullet rows to that tag.
 *
 * Run: node scripts/create-sample-commentary.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _require = createRequire(
  path.join(__dirname, "../frontend/node_modules/xlsx/package.json")
);
const XLSX = _require("xlsx");

// Commentary block header: mirrors income statement column layout.
// refTag goes in col 0 (source code position); col 6 (ref column) left blank.
const H = (refTag, label, cur, prior, variance, varPct) =>
  [refTag, label, cur, prior, variance, varPct, ""];

// Commentary bullet row: text in label column only.
const B = (text) => ["", text, "", "", "", "", ""];

// Blank separator row
const BLANK = ["", "", "", "", "", "", ""];

const rows = [
  // ── PART 1: INCOME STATEMENT ──────────────────────────────────────────────
  // Col:  [0-SourceCode]  [1-Label]                         [2-Dec2024]  [3-Dec2023]  [4-Variance]  [5-Var%]  [6-Ref]

  ["", "INCOME STATEMENT",                              "",        "",        "",      "",    ""],
  ["", "For the period ended 31 December 2024",         "",        "",        "",      "",    ""],
  BLANK,
  ["", "",                                           "Dec 2024", "Dec 2023", "Variance", "Var %", "Ref"],
  ["", "",                                           "$'000",    "$'000",    "$'000",    "",      ""],
  BLANK,

  // Interest Income
  ["",        "Interest Income",               "",       "",       "",      "",     ""],
  ["P110100", "Loans and advances interest",   45200,  41800,   3400,   "8%",  "A1"],
  ["P110110", "Investment securities interest",12300,  11900,    400,   "3%",  ""],
  ["P110120", "Interbank placements",           3100,   2800,    300,  "11%",  ""],
  ["P110130", "Other interest income",           890,    750,    140,  "19%",  ""],
  ["P110000", "Total Interest Income",         61490,  57250,   4240,   "7%",  ""],
  BLANK,

  // Interest Expense
  ["",        "Interest Expense",                   "",         "",         "",       "",     ""],
  ["P120100", "Customer deposits interest",   "(18400)", "(17200)", "(1200)", "(7%)",  "B1"],
  ["P120110", "Wholesale funding interest",    "(6200)",  "(5900)",  "(300)", "(5%)",  ""],
  ["P120120", "Subordinated debt interest",    "(1450)",  "(1450)",      "0",  "0%",  ""],
  ["P120000", "Total Interest Expense",       "(26050)", "(24550)", "(1500)", "(6%)",  ""],
  BLANK,

  // Net Interest Income
  ["P110200", "Net Interest Income",    35440, 32700,  2740,  "8%",  "C1"],
  BLANK,

  // Non-Interest Income
  ["",        "Non-Interest Income",              "",      "",    "",     "",     ""],
  ["PE00000", "Fee and Commission Income",       8900,   8200,   700,  "9%",  "C1.1"],
  ["PF00000", "Fee and Commission Expense", "(2100)", "(1950)", "(150)", "(8%)", ""],
  ["PE10000", "Net Fee and Commission Income",   6800,   6250,   550,  "9%",  ""],
  BLANK,
  ["PG81112", "Trading Income",                 3200,   2100,  1100, "52%",  "D1"],
  ["PG82000", "Foreign Exchange Income",         1450,   1680,  "(230)", "(14%)", ""],
  ["PH00100", "Other Operating Income",           620,    590,    30,  "5%",  ""],
  ["PE20000", "Total Non-Interest Income",      12070,  10620,  1450, "14%",  ""],
  BLANK,

  // Operating totals
  ["PT10000", "Total Operating Income",  47510, 43320, 4190, "10%", ""],
  BLANK,

  // Operating Expenses
  ["",        "Operating Expenses",                  "",         "",         "",       "",     ""],
  ["PX10000", "Personnel Expenses",           "(18200)", "(17100)", "(1100)",  "(6%)",  "E1"],
  ["PX20000", "Technology and Systems",        "(4300)",  "(3900)",  "(400)", "(10%)",  "F1"],
  ["PX30000", "Premises and Equipment",        "(2100)",  "(2050)",   "(50)",  "(2%)",  ""],
  ["PX40000", "Marketing and Business Development", "(890)", "(820)", "(70)", "(9%)",  ""],
  ["PX50000", "Legal and Professional Fees",    "(650)",   "(580)",   "(70)", "(12%)", ""],
  ["PX60000", "Other Operating Expenses",      "(1240)",  "(1100)",  "(140)", "(13%)", ""],
  ["PX00000", "Total Operating Expenses",     "(27380)", "(25550)", "(1830)",  "(7%)", ""],
  BLANK,

  ["PZ10000", "Operating Profit Before Provisions", 20130, 17770, 2360, "13%", ""],
  BLANK,

  // Credit Impairment
  ["",        "Credit Impairment Charges",          "",        "",      "",      "",     ""],
  ["PL10000", "Specific Provisions",           "(3200)", "(2800)",  "(400)", "(14%)", "M1.3"],
  ["PL20000", "Collective Provisions",           "(850)",  "(600)",  "(250)", "(42%)", "M1.8"],
  ["PL00000", "Total Credit Impairment Charges","(4050)", "(3400)",  "(650)", "(19%)", ""],
  BLANK,

  // Net Profit
  ["PZ00000", "Operating Profit After Provisions", 16080, 14370, 1710, "12%", ""],
  BLANK,
  ["PT99000", "Income Tax Expense",  "(4824)", "(4311)", "(513)", "(12%)", ""],
  BLANK,
  ["PZ99999", "Net Profit After Tax", 11256, 10059, 1197, "12%", ""],

  // ── PART 2: COMMENTARY SECTION ────────────────────────────────────────────
  // Each commentary block header mirrors the income statement row it references:
  //   Col 0: reference tag (A1, B1 …) — parser detects this as commentary header
  //   Col 1: same label as the income statement row
  //   Col 2-5: same Dec 2024 / Dec 2023 / Variance / Var% values
  //   Col 6: blank (ref tag column — left empty since ref tag is already in col 0)
  //
  // Bullet rows have text only in col 1; all other columns blank.

  BLANK,
  BLANK,

  // A1 — Loans and advances interest
  H("A1", "Loans and advances interest",    45200, 41800,  3400,  "8%"),
  B("Loan book grew by $3.4m (8%) driven by new commercial term lending drawn down in H2."),
  B("Average lending rate increased from 4.2% to 4.5% following Q3 back-book repricing."),
  B("New mortgage originations of $12m in Q4 partially offset by $8m in scheduled repayments."),
  BLANK,

  // B1 — Customer deposits interest
  H("B1", "Customer deposits interest",  "(18400)", "(17200)", "(1200)", "(7%)"),
  B("Deposit volumes increased 7% YoY reflecting strong retail savings inflows from new product launch."),
  B("Average cost of funds rose from 1.8% to 2.0% in line with central bank rate increases."),
  B("Partially mitigated by a shift toward shorter-tenor term deposits repriced at lower marginal rates."),
  BLANK,

  // C1 — Net Interest Income
  H("C1", "Net Interest Income",  35440, 32700, 2740, "8%"),
  B("NII increased $2.7m (8%) as asset volume growth and rate repricing outpaced rising funding costs."),
  B("Net interest margin expanded from 2.1% to 2.3%, the highest level since 2019."),
  B("Outlook: further margin compression expected in H1 2025 as fixed-rate deposits roll over."),
  BLANK,

  // C1.1 — Fee and Commission Income
  H("C1.1", "Fee and Commission Income",  8900, 8200, 700, "9%"),
  B("Transaction banking fees up $0.5m on higher trade finance volumes from three new corporate clients."),
  B("Card fee income increased $0.2m from expanded merchant acquiring business (15 new merchants)."),
  BLANK,

  // D1 — Trading Income
  H("D1", "Trading Income",  3200, 2100, 1100, "52%"),
  B("Significant increase of $1.1m driven by FX desk performance during elevated market volatility in Q2."),
  B("Rates desk contributed $0.4m from active duration management ahead of the rate decision in June."),
  B("Prior year included a one-off loss of $0.3m from a legacy position close-out — not repeated."),
  BLANK,

  // E1 — Personnel Expenses
  H("E1", "Personnel Expenses",  "(18200)", "(17100)", "(1100)", "(6%)"),
  B("Headcount increased by 12 FTEs (3%) to support business growth in commercial banking and technology."),
  B("Annual salary review effective 1 March 2024 at an average uplift of 3.5%, in line with CPI."),
  B("One-off restructuring charge of $0.2m relating to branch rationalisation in the South region."),
  BLANK,

  // F1 — Technology and Systems
  H("F1", "Technology and Systems",  "(4300)", "(3900)", "(400)", "(10%)"),
  B("Cloud migration project costs of $0.25m expensed in the current year per accounting policy."),
  B("Core banking platform licence renewed at an increased cost of $0.15m (+12%) effective Q3."),
  BLANK,

  // M1.3 — Specific Provisions
  H("M1.3", "Specific Provisions",  "(3200)", "(2800)", "(400)", "(14%)"),
  B("Increase driven by two commercial real estate exposures downgraded to Stage 3 in Q4."),
  B("Total Stage 3 ECL coverage ratio maintained at 65%, consistent with prior year."),
  B("No write-offs recognised in the period (prior year: $0.1m)."),
  BLANK,

  // M1.8 — Collective Provisions
  H("M1.8", "Collective Provisions",  "(850)", "(600)", "(250)", "(42%)"),
  B("Model overlay of $0.15m applied to the SME portfolio reflecting macroeconomic deterioration."),
  B("Portfolio-wide PD and LGD parameters refreshed in Q4 following annual model review."),
];

// ── Build workbook ──────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);

ws["!cols"] = [
  { wch: 10 }, // Col 0: Source Code / Ref Tag
  { wch: 52 }, // Col 1: Label / Commentary bullet
  { wch: 12 }, // Col 2: Dec 2024
  { wch: 12 }, // Col 3: Dec 2023
  { wch: 12 }, // Col 4: Variance
  { wch:  9 }, // Col 5: Var %
  { wch:  8 }, // Col 6: Ref (income statement only; blank in commentary section)
];

XLSX.utils.book_append_sheet(wb, ws, "Income Statement");

const outputPath = path.join(
  __dirname,
  "..",
  "sample-income-statement-with-commentary.xlsx"
);
XLSX.writeFile(wb, outputPath);

// Print a preview of the commentary section to verify structure
console.log(`Created: ${outputPath}`);
console.log();
console.log("Commentary section preview (col 0 | col 1 | col 2 | col 3 | col 4 | col 5):");
console.log("─".repeat(100));
rows.slice(rows.findIndex(r => r[0] === "A1")).forEach((r) => {
  const cols = [r[0], r[1], r[2], r[3], r[4], r[5]].map(v =>
    String(v ?? "").substring(0, 18).padEnd(19)
  );
  console.log(cols.join("|"));
});