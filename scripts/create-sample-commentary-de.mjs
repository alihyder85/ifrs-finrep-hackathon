/**
 * Generates sample-income-statement-de.xlsx
 * Germany entity — different numeric values and commentaries from the UK sample.
 *
 * Same layout as create-sample-commentary.mjs:
 *   Col 0: source code / ref tag
 *   Col 1: label / commentary bullet
 *   Col 2: Dec 2024
 *   Col 3: Dec 2023
 *   Col 4: Variance
 *   Col 5: Var %
 *   Col 6: Ref tag (income statement section only)
 *
 * Run: node scripts/create-sample-commentary-de.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _require = createRequire(
  path.join(__dirname, "../frontend/node_modules/xlsx/package.json")
);
const XLSX = _require("xlsx");

const H = (refTag, label, cur, prior, variance, varPct) =>
  [refTag, label, cur, prior, variance, varPct, ""];

const B = (text) => ["", text, "", "", "", "", ""];

const BLANK = ["", "", "", "", "", "", ""];

const rows = [
  // ── PART 1: INCOME STATEMENT ──────────────────────────────────────────────

  ["", "INCOME STATEMENT — GERMANY",                       "",        "",          "",       "",   ""],
  ["", "For the period ended 31 December 2024",            "",        "",          "",       "",   ""],
  BLANK,
  ["", "",                                           "Dec 2024", "Dec 2023", "Variance", "Var %", "Ref"],
  ["", "",                                           "EUR'000",  "EUR'000",  "EUR'000",  "",      ""],
  BLANK,

  // Interest Income
  ["",        "Interest Income",                  "",       "",      "",      "",    ""],
  ["P110100", "Loans and advances interest",   38600,  42300,  "(3700)", "(9%)",  "A1"],
  ["P110110", "Investment securities interest", 9800,   9200,     600,   "7%",   ""],
  ["P110120", "Interbank placements",           1900,   2400,   "(500)", "(21%)", ""],
  ["P110130", "Other interest income",           430,    510,    "(80)", "(16%)", ""],
  ["P110000", "Total Interest Income",         50730,  54410,  "(3680)",  "(7%)", ""],
  BLANK,

  // Interest Expense
  ["",        "Interest Expense",                  "",         "",         "",       "",     ""],
  ["P120100", "Customer deposits interest",  "(22100)", "(19800)", "(2300)", "(12%)", "B1"],
  ["P120110", "Wholesale funding interest",   "(7400)",  "(6600)",  "(800)", "(12%)", ""],
  ["P120120", "Subordinated debt interest",   "(1800)",  "(1800)",      "0",   "0%",  ""],
  ["P120000", "Total Interest Expense",      "(31300)", "(28200)", "(3100)", "(11%)", ""],
  BLANK,

  // Net Interest Income
  ["P110200", "Net Interest Income",    19430,  26210,  "(6780)", "(26%)", "C1"],
  BLANK,

  // Non-Interest Income
  ["",        "Non-Interest Income",              "",      "",    "",     "",     ""],
  ["PE00000", "Fee and Commission Income",       7200,   6800,   400,  "6%",  "C1.1"],
  ["PF00000", "Fee and Commission Expense", "(1800)", "(1650)", "(150)", "(9%)", ""],
  ["PE10000", "Net Fee and Commission Income",   5400,   5150,   250,  "5%",  ""],
  BLANK,
  ["PG81112", "Trading Income",                 1100,   2900, "(1800)", "(62%)", "D1"],
  ["PG82000", "Foreign Exchange Income",         2300,   1900,    400,  "21%",  ""],
  ["PH00100", "Other Operating Income",           310,    280,     30,  "11%",  ""],
  ["PE20000", "Total Non-Interest Income",       9110,  10230, "(1120)", "(11%)", ""],
  BLANK,

  // Operating totals
  ["PT10000", "Total Operating Income",  28540, 36440, "(7900)", "(22%)", ""],
  BLANK,

  // Operating Expenses
  ["",        "Operating Expenses",                   "",         "",         "",       "",     ""],
  ["PX10000", "Personnel Expenses",           "(15600)", "(15200)",  "(400)",  "(3%)",  "E1"],
  ["PX20000", "Technology and Systems",        "(5100)",  "(4200)",  "(900)", "(21%)",  "F1"],
  ["PX30000", "Premises and Equipment",        "(1800)",  "(1850)",     "50",   "3%",   ""],
  ["PX40000", "Marketing and Business Development", "(610)", "(590)", "(20)", "(3%)", ""],
  ["PX50000", "Legal and Professional Fees",    "(920)",   "(740)",  "(180)", "(24%)", ""],
  ["PX60000", "Other Operating Expenses",       "(980)",   "(870)",  "(110)", "(13%)", ""],
  ["PX00000", "Total Operating Expenses",     "(25010)", "(23450)", "(1560)",  "(7%)", ""],
  BLANK,

  ["PZ10000", "Operating Profit Before Provisions",  3530,  12990,  "(9460)", "(73%)", ""],
  BLANK,

  // Credit Impairment
  ["",        "Credit Impairment Charges",           "",        "",      "",       "",    ""],
  ["PL10000", "Specific Provisions",            "(4500)", "(2100)", "(2400)", "(114%)", "M1.3"],
  ["PL20000", "Collective Provisions",           "(1200)",  "(550)",  "(650)", "(118%)", "M1.8"],
  ["PL00000", "Total Credit Impairment Charges", "(5700)", "(2650)", "(3050)", "(115%)", ""],
  BLANK,

  // Net Profit
  ["PZ00000", "Operating Profit After Provisions", "(2170)", 10340, "(12510)", "(121%)", ""],
  BLANK,
  ["PT99000", "Income Tax Expense",         "0", "(3102)", "3102", "100%", ""],
  BLANK,
  ["PZ99999", "Net Profit After Tax", "(2170)",  7238, "(9408)", "(130%)", ""],

  // ── PART 2: COMMENTARY SECTION ────────────────────────────────────────────

  BLANK,
  BLANK,

  // A1 — Loans and advances interest
  H("A1", "Loans and advances interest",   38600, 42300, "(3700)", "(9%)"),
  B("Loan book contracted by EUR 3.7m (9%) reflecting deliberate de-risking of the commercial real estate portfolio."),
  B("Average lending rate declined from 4.8% to 4.4% as higher-yielding legacy corporate loans matured and were not renewed."),
  B("New originations focused on investment-grade trade finance; lower volumes than prior year due to cautious credit appetite."),
  BLANK,

  // B1 — Customer deposits interest
  H("B1", "Customer deposits interest",  "(22100)", "(19800)", "(2300)", "(12%)"),
  B("Deposit cost increased EUR 2.3m (12%) as customers shifted from current accounts to higher-rate term deposits."),
  B("Average cost of deposits rose from 1.9% to 2.6% driven by ECB rate pass-through and competitive pressure in the savings market."),
  B("Corporate deposit base repriced upward by an average of 85bps following the ECB July rate hike."),
  BLANK,

  // C1 — Net Interest Income
  H("C1", "Net Interest Income",  19430, 26210, "(6780)", "(26%)"),
  B("NII fell EUR 6.8m (26%) as rising deposit costs significantly outpaced the benefit of asset repricing."),
  B("Net interest margin compressed from 2.9% to 2.1%, reflecting the structural deposit cost mismatch on the German retail book."),
  B("Management action plan approved to reprice the loan book by Q2 2025 and grow higher-yielding SME lending."),
  BLANK,

  // C1.1 — Fee and Commission Income
  H("C1.1", "Fee and Commission Income",  7200, 6800, 400, "6%"),
  B("Fee income grew EUR 0.4m (6%) supported by increased custody and fund administration mandates from two new institutional clients."),
  B("Payment services fees up EUR 0.15m following migration of corporate clients to the new digital treasury platform in Q3."),
  BLANK,

  // D1 — Trading Income
  H("D1", "Trading Income",  1100, 2900, "(1800)", "(62%)"),
  B("Trading income fell EUR 1.8m (62%) due to mark-to-market losses on the rates book from sharp yield curve movements in Q1."),
  B("Prior year included EUR 0.9m of gains from strategic bond portfolio rebalancing; no comparable activity in 2024."),
  B("FX desk performance was flat against a volatile EUR/USD backdrop; hedging costs offset gross trading gains."),
  BLANK,

  // E1 — Personnel Expenses
  H("E1", "Personnel Expenses",  "(15600)", "(15200)", "(400)", "(3%)"),
  B("Headcount reduced by 8 FTEs through a targeted efficiency programme completed in Q2, saving EUR 0.6m annualised."),
  B("Savings partially offset by a 4.2% salary adjustment effective July 2024 in line with collective bargaining agreement."),
  B("No restructuring charges recognised in the period (prior year: EUR 0.3m)."),
  BLANK,

  // F1 — Technology and Systems
  H("F1", "Technology and Systems",  "(5100)", "(4200)", "(900)", "(21%)"),
  B("Increase of EUR 0.9m driven by accelerated investment in regulatory reporting infrastructure to meet BaFin DORA requirements."),
  B("One-off data migration cost of EUR 0.35m incurred in Q4 as part of pan-European core banking consolidation project."),
  B("Recurring technology run cost expected to reduce by EUR 0.2m in 2025 once legacy systems are decommissioned."),
  BLANK,

  // M1.3 — Specific Provisions
  H("M1.3", "Specific Provisions",  "(4500)", "(2100)", "(2400)", "(114%)"),
  B("Significant increase of EUR 2.4m driven by four commercial real estate exposures downgraded to Stage 3 in H2."),
  B("Office sector concentrations in Frankfurt and Munich impacted by sustained vacancy rates above 18%."),
  B("ECL coverage ratio on Stage 3 assets increased from 52% to 61% following collateral revaluation."),
  BLANK,

  // M1.8 — Collective Provisions
  H("M1.8", "Collective Provisions",  "(1200)", "(550)", "(650)", "(118%)"),
  B("Collective provisions increased EUR 0.65m reflecting deterioration in macro overlays for the German construction and property sectors."),
  B("Probability of default assumptions tightened following Q3 model review, increasing the collective ECL by EUR 0.3m."),
  B("Management overlay of EUR 0.25m maintained for residual climate-transition risk in the energy-intensive industrial portfolio."),
];

// ── Build workbook ──────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);

ws["!cols"] = [
  { wch: 10 },
  { wch: 56 },
  { wch: 12 },
  { wch: 12 },
  { wch: 12 },
  { wch:  9 },
  { wch:  8 },
];

XLSX.utils.book_append_sheet(wb, ws, "Income Statement");

const outputPath = path.join(__dirname, "..", "sample-income-statement-de.xlsx");
XLSX.writeFile(wb, outputPath);

console.log(`Created: ${outputPath}`);
console.log();
console.log("Commentary section preview:");
console.log("─".repeat(100));
rows.slice(rows.findIndex(r => r[0] === "A1")).forEach((r) => {
  const cols = [r[0], r[1], r[2], r[3], r[4], r[5]].map(v =>
    String(v ?? "").substring(0, 20).padEnd(21)
  );
  console.log(cols.join("|"));
});