import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean existing seed data
  await prisma.commentary.deleteMany({});
  await prisma.reportRow.deleteMany({});
  await prisma.report.deleteMany({});

  const report = await prisma.report.create({
    data: {
      name: "Income Statement — FY2024",
      reportingPeriod: "FY2024",
      currency: "GBP",
      sourceFileName: "finrep_fy2024_q4.xlsx",
    },
  });

  // Seed rows — realistic P&L structure
  // currentValue / priorValue in thousands
  const rows = [
    {
      rowIndex: 0,
      sourceCode: "P100000",
      label: "Net Interest Income",
      section: "Interest",
      displayType: "header",
      currentValue: null,
      priorValue: null,
      varianceValue: null,
      variancePercent: null,
      rawCurrentText: null,
      rawPriorText: null,
      rawVarianceText: null,
      rawVariancePercentText: null,
    },
    {
      rowIndex: 1,
      sourceCode: "P110100",
      label: "Interest Income",
      section: "Interest",
      displayType: "detail",
      currentValue: 4820,
      priorValue: 4324,
      varianceValue: 496,
      variancePercent: 11.47,
      rawCurrentText: "4,820",
      rawPriorText: "4,324",
      rawVarianceText: "496",
      rawVariancePercentText: "11.5%",
    },
    {
      rowIndex: 2,
      sourceCode: "P110200",
      label: "Interest Expense",
      section: "Interest",
      displayType: "detail",
      currentValue: -1240,
      priorValue: -1090,
      varianceValue: -150,
      variancePercent: -13.76,
      rawCurrentText: "(1,240)",
      rawPriorText: "(1,090)",
      rawVarianceText: "(150)",
      rawVariancePercentText: "(13.8%)",
    },
    {
      rowIndex: 3,
      sourceCode: "P110000",
      label: "Net Interest Income",
      section: "Interest",
      displayType: "subtotal",
      currentValue: 3580,
      priorValue: 3234,
      varianceValue: 346,
      variancePercent: 10.7,
      rawCurrentText: "3,580",
      rawPriorText: "3,234",
      rawVarianceText: "346",
      rawVariancePercentText: "10.7%",
      referenceTag: "A1",
    },
    {
      rowIndex: 4,
      sourceCode: "PE00000",
      label: "Fee Income",
      section: "Non-Interest Income",
      displayType: "detail",
      currentValue: 910,
      priorValue: 875,
      varianceValue: 35,
      variancePercent: 4.0,
      rawCurrentText: "910",
      rawPriorText: "875",
      rawVarianceText: "35",
      rawVariancePercentText: "4.0%",
      referenceTag: "B1",
    },
    {
      rowIndex: 5,
      sourceCode: "PF00000",
      label: "Fee Expense",
      section: "Non-Interest Income",
      displayType: "detail",
      currentValue: -210,
      priorValue: -195,
      varianceValue: -15,
      variancePercent: -7.69,
      rawCurrentText: "(210)",
      rawPriorText: "(195)",
      rawVarianceText: "(15)",
      rawVariancePercentText: "(7.7%)",
    },
    {
      rowIndex: 6,
      sourceCode: "PG00000",
      label: "Net Fee Income",
      section: "Non-Interest Income",
      displayType: "subtotal",
      currentValue: 700,
      priorValue: 680,
      varianceValue: 20,
      variancePercent: 2.94,
      rawCurrentText: "700",
      rawPriorText: "680",
      rawVarianceText: "20",
      rawVariancePercentText: "2.9%",
    },
    {
      rowIndex: 7,
      sourceCode: "PT00000",
      label: "Total Operating Income",
      section: null,
      displayType: "total",
      currentValue: 4280,
      priorValue: 3914,
      varianceValue: 366,
      variancePercent: 9.35,
      rawCurrentText: "4,280",
      rawPriorText: "3,914",
      rawVarianceText: "366",
      rawVariancePercentText: "9.4%",
      referenceTag: "C1",
    },
  ];

  const createdRows = await Promise.all(
    rows.map((row) =>
      prisma.reportRow.create({
        data: {
          reportId: report.id,
          ...row,
        },
      })
    )
  );

  // Seed commentary on two rows
  const netInterestRow = createdRows.find((r) => r.sourceCode === "P110000")!;
  const feeIncomeRow = createdRows.find((r) => r.sourceCode === "PE00000")!;

  await prisma.commentary.createMany({
    data: [
      {
        reportId: report.id,
        reportRowId: netInterestRow.id,
        sourceCode: netInterestRow.sourceCode,
        referenceTagSnapshot: netInterestRow.referenceTag,
        commentaryText:
          "Net interest income increased by £346k (10.7%) driven by higher asset yields on the back-book repricing in Q3. Interest expense grew moderately due to competitive deposit pricing.",
      },
      {
        reportId: report.id,
        reportRowId: feeIncomeRow.id,
        sourceCode: feeIncomeRow.sourceCode,
        referenceTagSnapshot: feeIncomeRow.referenceTag,
        commentaryText:
          "Fee income up £35k (4.0%) year-on-year, broadly in line with volume growth in transaction banking. No one-off items in current period.",
      },
    ],
  });

  console.log(`Seeded report: ${report.id} — "${report.name}"`);
  console.log(`  ${createdRows.length} rows`);
  console.log("  2 commentary records");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
