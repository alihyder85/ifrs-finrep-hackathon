/**
 * Generates sample-income-statement-sg.xlsx
 * Singapore entity — SGD values, MAS regulatory context, APAC market commentary.
 *
 * Same layout as other sample scripts:
 *   Col 0: source code / ref tag
 *   Col 1: label / commentary bullet
 *   Col 2: Dec 2024
 *   Col 3: Dec 2023
 *   Col 4: Variance
 *   Col 5: Var %
 *   Col 6: Ref tag (income statement section only)
 *
 * Run: node scripts/create-sample-commentary-sg.mjs
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

  ["", "INCOME STATEMENT — SINGAPORE",                     "",        "",          "",       "",   ""],
  ["", "For the period ended 31 December 2024",            "",        "",          "",       "",   ""],
  BLANK,
  ["", "",                                           "Dec 2024", "Dec 2023", "Variance", "Var %", "Ref"],
  ["", "",                                           "SGD'000",  "SGD'000",  "SGD'000",  "",      ""],
  BLANK,

  // Interest Income
  ["",        "Interest Income",                   "",       "",      "",      "",    ""],
  ["P110100", "Loans and advances interest",    52400,  44100,   8300,  "19%",  "A1"],
  ["P110110", "Investment securities interest", 14600,  11200,   3400,  "30%",  ""],
  ["P110120", "Interbank placements",            4800,   3600,   1200,  "33%",  ""],
  ["P110130", "Other interest income",           1050,    780,    270,  "35%",  ""],
  ["P110000", "Total Interest Income",          72850,  59680,  13170,  "22%",  ""],
  BLANK,

  // Interest Expense
  ["",        "Interest Expense",                   "",         "",         "",       "",     ""],
  ["P120100", "Customer deposits interest",  "(24600)", "(18900)", "(5700)", "(30%)", "B1"],
  ["P120110", "Wholesale funding interest",   "(8300)",  "(6100)", "(2200)", "(36%)", ""],
  ["P120120", "Subordinated debt interest",   "(1650)",  "(1500)",  "(150)", "(10%)", ""],
  ["P120000", "Total Interest Expense",      "(34550)", "(26500)", "(8050)", "(30%)", ""],
  BLANK,

  // Net Interest Income
  ["P110200", "Net Interest Income",    38300,  33180,   5120,  "15%",  "C1"],
  BLANK,

  // Non-Interest Income
  ["",        "Non-Interest Income",              "",      "",    "",     "",     ""],
  ["PE00000", "Fee and Commission Income",      11400,   9600,  1800,  "19%",  "C1.1"],
  ["PF00000", "Fee and Commission Expense", "(2600)", "(2200)", "(400)", "(18%)", ""],
  ["PE10000", "Net Fee and Commission Income",   8800,   7400,  1400,  "19%",  ""],
  BLANK,
  ["PG81112", "Trading Income",                 5100,   3800,  1300,  "34%",  "D1"],
  ["PG82000", "Foreign Exchange Income",         3700,   2900,   800,  "28%",  ""],
  ["PH00100", "Other Operating Income",           840,    720,   120,  "17%",  ""],
  ["PE20000", "Total Non-Interest Income",      18440,  14820,  3620,  "24%",  ""],
  BLANK,

  // Operating totals
  ["PT10000", "Total Operating Income",  56740, 48000, 8740, "18%", ""],
  BLANK,

  // Operating Expenses
  ["",        "Operating Expenses",                   "",         "",         "",       "",     ""],
  ["PX10000", "Personnel Expenses",           "(21300)", "(19400)", "(1900)", "(10%)",  "E1"],
  ["PX20000", "Technology and Systems",        "(6800)",  "(5200)", "(1600)", "(31%)",  "F1"],
  ["PX30000", "Premises and Equipment",        "(2400)",  "(2300)",  "(100)",  "(4%)",  ""],
  ["PX40000", "Marketing and Business Development", "(1050)", "(880)", "(170)", "(19%)", ""],
  ["PX50000", "Legal and Professional Fees",    "(740)",   "(650)",   "(90)", "(14%)", ""],
  ["PX60000", "Other Operating Expenses",      "(1380)",  "(1190)",  "(190)", "(16%)", ""],
  ["PX00000", "Total Operating Expenses",     "(33670)", "(29620)", "(4050)", "(14%)", ""],
  BLANK,

  ["PZ10000", "Operating Profit Before Provisions", 23070, 18380, 4690, "26%", ""],
  BLANK,

  // Credit Impairment
  ["",        "Credit Impairment Charges",           "",        "",      "",       "",    ""],
  ["PL10000", "Specific Provisions",            "(1800)", "(2100)",   "300",  "14%",  "M1.3"],
  ["PL20000", "Collective Provisions",            "(620)",  "(580)",   "(40)",  "(7%)", "M1.8"],
  ["PL00000", "Total Credit Impairment Charges", "(2420)", "(2680)",   "260",  "10%",  ""],
  BLANK,

  // Net Profit
  ["PZ00000", "Operating Profit After Provisions", 20650, 15700, 4950, "32%", ""],
  BLANK,
  ["PT99000", "Income Tax Expense",  "(3716)", "(2826)", "(890)", "(31%)", ""],
  BLANK,
  ["PZ99999", "Net Profit After Tax", 16934, 12874, 4060, "32%", ""],

  // ── PART 2: COMMENTARY SECTION ────────────────────────────────────────────

  BLANK,
  BLANK,

  // A1 — Loans and advances interest
  H("A1", "Loans and advances interest",   52400, 44100, 8300, "19%"),
  B("Loan book expanded SGD 8.3m (19%) driven by strong drawdowns on corporate revolving credit facilities across ASEAN infrastructure projects."),
  B("Average lending rate rose from 4.1% to 4.8% following MAS-aligned SORA repricing of the floating rate book in Q1 and Q3."),
  B("New private banking mortgage originations of SGD 18m in H2, partially offset by SGD 6m in scheduled repayments on the SME term loan portfolio."),
  BLANK,

  // B1 — Customer deposits interest
  H("B1", "Customer deposits interest",  "(24600)", "(18900)", "(5700)", "(30%)"),
  B("Deposit interest costs increased SGD 5.7m (30%) as high-net-worth and corporate clients rotated from CASA into higher-rate fixed deposits."),
  B("Average cost of deposits rose from 2.1% to 2.9% as the Singapore market remained competitive following elevated SORA levels throughout 2024."),
  B("CASA ratio declined from 48% to 41%, reflecting broader market trend of deposit migration into fixed-term products across Singapore retail banks."),
  BLANK,

  // C1 — Net Interest Income
  H("C1", "Net Interest Income",  38300, 33180, 5120, "15%"),
  B("NII grew SGD 5.1m (15%) as strong loan volume growth and asset repricing more than offset the higher deposit funding costs."),
  B("Net interest margin expanded from 3.1% to 3.4%, supported by sustained SORA levels and disciplined loan pricing on new originations."),
  B("Outlook: NIM is expected to moderate in H1 2025 as SORA begins to ease and competition for corporate deposits remains elevated."),
  BLANK,

  // C1.1 — Fee and Commission Income
  H("C1.1", "Fee and Commission Income",  11400, 9600, 1800, "19%"),
  B("Wealth management fees increased SGD 1.1m driven by strong AUM growth of 18% on the back of equity market performance across APAC."),
  B("Trade finance and letter of credit fees up SGD 0.4m as regional supply chain activity recovered strongly from H2 2023 lows."),
  B("Digital banking onboarding fees contributed SGD 0.3m following the launch of the new SME digital account product in March 2024."),
  BLANK,

  // D1 — Trading Income
  H("D1", "Trading Income",  5100, 3800, 1300, "34%"),
  B("Trading income increased SGD 1.3m (34%) driven by strong FX derivatives desk performance amid elevated USD/SGD and USD/CNH volatility."),
  B("Rates trading contributed SGD 0.5m from active positioning ahead of MAS monetary policy statements in April and October."),
  B("Equity-linked structured product income up SGD 0.3m from increased private banking client demand for capital-protected notes."),
  BLANK,

  // E1 — Personnel Expenses
  H("E1", "Personnel Expenses",  "(21300)", "(19400)", "(1900)", "(10%)"),
  B("Headcount grew by 18 FTEs (7%) to support the expansion of the wealth management division and the newly established digital banking unit."),
  B("Annual compensation review awarded an average increase of 4.8%, in line with Singapore MOM wage guidance and local market benchmarks."),
  B("Variable bonus pool increased SGD 0.4m reflecting strong group performance against ROE and revenue targets for the year."),
  BLANK,

  // F1 — Technology and Systems
  H("F1", "Technology and Systems",  "(6800)", "(5200)", "(1600)", "(31%)"),
  B("Technology costs increased SGD 1.6m (31%) primarily due to investment in MAS Technology Risk Management (TRM) compliance infrastructure."),
  B("Cloud migration Phase 2 completed in Q3 at a cost of SGD 0.6m; expected to deliver SGD 0.4m annual run-cost savings from 2025."),
  B("Cybersecurity uplift programme cost SGD 0.35m following MAS Notice 655 enhanced controls requirement effective January 2024."),
  BLANK,

  // M1.3 — Specific Provisions
  H("M1.3", "Specific Provisions",  "(1800)", "(2100)", "300", "14%"),
  B("Specific provisions improved SGD 0.3m as two previously impaired hospitality sector exposures were resolved through asset sales in Q2."),
  B("No new Stage 3 migrations in the period; the commercial real estate portfolio benefited from stable Singapore Grade A office occupancy above 92%."),
  B("ECL coverage ratio on Stage 3 assets maintained at 58%, consistent with prior year and within MAS supervisory expectations."),
  BLANK,

  // M1.8 — Collective Provisions
  H("M1.8", "Collective Provisions",  "(620)", "(580)", "(40)", "(7%)"),
  B("Collective provisions marginally higher by SGD 0.04m reflecting a model overlay applied to the regional SME portfolio for China trade slowdown risk."),
  B("Portfolio PD and LGD parameters refreshed in Q3 annual model review; no material changes to base case macro assumptions for Singapore."),
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

const outputPath = path.join(__dirname, "..", "sample-income-statement-sg.xlsx");
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