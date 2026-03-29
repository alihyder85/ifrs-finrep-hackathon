import * as XLSX from "xlsx";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Financial statement data
// Columns: Source Code | Label | Current Period | Prior Period | Variance | Variance % | Ref
const rows = [
  // Headers
  ["", "INCOME STATEMENT", "", "", "", "", ""],
  ["", "For the period ended December 2024", "", "", "", "", ""],
  ["", "", "", "", "", "", ""],
  ["", "", "Dec 2024", "Dec 2023", "Variance", "Var %", "Ref"],
  ["", "", "$'000", "$'000", "$'000", "", ""],
  ["", "", "", "", "", "", ""],

  // Interest income section
  ["", "Interest Income", "", "", "", "", ""],
  ["P110100", "Loans and advances interest", 45200, 41800, 3400, "8%", "A1"],
  ["P110110", "Investment securities interest", 12300, 11900, 400, "3%", ""],
  ["P110120", "Interbank placements", 3100, 2800, 300, "11%", ""],
  ["P110130", "Other interest income", 890, 750, 140, "19%", ""],
  ["P110000", "Total Interest Income", 61490, 57250, 4240, "7%", ""],
  ["", "", "", "", "", "", ""],

  // Interest expense section
  ["", "Interest Expense", "", "", "", "", ""],
  ["P120100", "Customer deposits interest", "(18400)", "(17200)", "(1200)", "(7%)", "B1"],
  ["P120110", "Wholesale funding interest", "(6200)", "(5900)", "(300)", "(5%)", ""],
  ["P120120", "Subordinated debt interest", "(1450)", "(1450)", 0, "0%", ""],
  ["P120000", "Total Interest Expense", "(26050)", "(24550)", "(1500)", "(6%)", ""],
  ["", "", "", "", "", "", ""],

  // Net interest
  ["P110200", "Net Interest Income", 35440, 32700, 2740, "8%", "C1"],
  ["", "", "", "", "", "", ""],

  // Non-interest income section
  ["", "Non-Interest Income", "", "", "", "", ""],
  ["PE00000", "Fee and Commission Income", 8900, 8200, 700, "9%", "C1.1"],
  ["PF00000", "Fee and Commission Expense", "(2100)", "(1950)", "(150)", "(8%)", ""],
  ["PE10000", "Net Fee and Commission Income", 6800, 6250, 550, "9%", ""],
  ["", "", "", "", "", "", ""],
  ["PG81112", "Trading Income", 3200, 2100, 1100, "52%", "D1"],
  ["PG82000", "Foreign Exchange Income", 1450, 1680, "(230)", "(14%)", ""],
  ["PH00100", "Other Operating Income", 620, 590, 30, "5%", ""],
  ["PE20000", "Total Non-Interest Income", 12070, 10620, 1450, "14%", ""],
  ["", "", "", "", "", "", ""],

  // Operating income
  ["PT10000", "Total Operating Income", 47510, 43320, 4190, "10%", ""],
  ["", "", "", "", "", "", ""],

  // Operating expenses
  ["", "Operating Expenses", "", "", "", "", ""],
  ["PX10000", "Personnel Expenses", "(18200)", "(17100)", "(1100)", "(6%)", "E1"],
  ["PX20000", "Technology and Systems", "(4300)", "(3900)", "(400)", "(10%)", "F1"],
  ["PX30000", "Premises and Equipment", "(2100)", "(2050)", "(50)", "(2%)", ""],
  ["PX40000", "Marketing and Business Development", "(890)", "(820)", "(70)", "(9%)", ""],
  ["PX50000", "Legal and Professional Fees", "(650)", "(580)", "(70)", "(12%)", ""],
  ["PX60000", "Other Operating Expenses", "(1240)", "(1100)", "(140)", "(13%)", ""],
  ["PX00000", "Total Operating Expenses", "(27380)", "(25550)", "(1830)", "(7%)", ""],
  ["", "", "", "", "", "", ""],

  // Operating profit
  ["PZ10000", "Operating Profit Before Provisions", 20130, 17770, 2360, "13%", ""],
  ["", "", "", "", "", "", ""],

  // Provisions
  ["", "Credit Impairment Charges", "", "", "", "", ""],
  ["PL10000", "Specific Provisions", "(3200)", "(2800)", "(400)", "(14%)", "M1.3"],
  ["PL20000", "Collective Provisions", "(850)", "(600)", "(250)", "(42%)", "M1.8"],
  ["PL00000", "Total Credit Impairment Charges", "(4050)", "(3400)", "(650)", "(19%)", ""],
  ["", "", "", "", "", "", ""],

  // Net profit
  ["PZ00000", "Operating Profit After Provisions", 16080, 14370, 1710, "12%", ""],
  ["", "", "", "", "", "", ""],
  ["PT99000", "Income Tax Expense", "(4824)", "(4311)", "(513)", "(12%)", ""],
  ["", "", "", "", "", "", ""],
  ["PZ99999", "Net Profit After Tax", 11256, 10059, 1197, "12%", ""],
];

// Create workbook
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);

// Column widths
ws["!cols"] = [
  { wch: 10 },  // Source Code
  { wch: 42 },  // Label
  { wch: 14 },  // Current
  { wch: 14 },  // Prior
  { wch: 14 },  // Variance
  { wch: 10 },  // Var %
  { wch: 8 },   // Ref
];

XLSX.utils.book_append_sheet(wb, ws, "Income Statement");

const outputPath = path.join(__dirname, "..", "sample-income-statement.xlsx");
XLSX.writeFile(wb, outputPath);

console.log(`Created: ${outputPath}`);