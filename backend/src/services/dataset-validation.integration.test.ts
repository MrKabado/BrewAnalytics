import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getDailySalesSummary } from "./analytics.service";
import { validateDataset } from "./dataset.validation.service";

const testDatabaseUrl = process.env.DATABASE_URL_TEST;
const databaseHost = testDatabaseUrl
  ? new URL(testDatabaseUrl).hostname
  : undefined;
if (
  databaseHost &&
  !["localhost", "127.0.0.1", "::1", "[::1]"].includes(databaseHost)
) {
  throw new Error(
    "DATABASE_URL_TEST must point to a local PostgreSQL test database.",
  );
}

const prisma = testDatabaseUrl
  ? new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl }),
    })
  : undefined;
const datasetIds: string[] = [];

async function createDataset(name: string) {
  if (!prisma) throw new Error("DATABASE_URL_TEST is not configured.");
  const dataset = await prisma.dataset.create({
    data: {
      name: `${name}-${randomUUID()}`,
      originalFileName: `${name}.xlsx`,
    },
  });
  datasetIds.push(dataset.id);
  return dataset;
}

interface RecordInput {
  transactionId: string;
  saleDate: string;
  productName: string;
  productId?: string | null;
  quantity: number;
  unitPrice: string;
  totalAmount: string;
  paymentMethod?: string;
}

async function insertRecords(datasetId: string, rows: RecordInput[]) {
  if (!prisma) throw new Error("DATABASE_URL_TEST is not configured.");
  await prisma.salesRecord.createMany({
    data: rows.map((row) => ({
      datasetId,
      transactionId: row.transactionId,
      saleDate: new Date(`${row.saleDate}T00:00:00.000Z`),
      productId: row.productId ?? null,
      productName: row.productName,
      category: "Coffee",
      quantity: row.quantity,
      unitPrice: new Prisma.Decimal(row.unitPrice),
      totalAmount: new Prisma.Decimal(row.totalAmount),
      paymentMethod: row.paymentMethod ?? "Cash",
    })),
  });
}

describe(
  "daily sales summary and dataset validation (local database integration)",
  { skip: !testDatabaseUrl },
  () => {
    before(async () => {
      await prisma?.$connect();
    });

    after(async () => {
      if (!prisma) return;
      for (const datasetId of datasetIds) {
        await prisma.dataset.deleteMany({ where: { id: datasetId } });
      }
      await prisma.$disconnect();
    });

    it("aggregates daily revenue, units, distinct transactions, products, and averages", async () => {
      const dataset = await createDataset("daily-summary");
      await insertRecords(dataset.id, [
        {
          transactionId: "T-1",
          saleDate: "2026-02-01",
          productName: "Latte",
          quantity: 2,
          unitPrice: "50.00",
          totalAmount: "100.00",
        },
        {
          transactionId: "T-1",
          saleDate: "2026-02-01",
          productName: "Muffin",
          quantity: 1,
          unitPrice: "10.00",
          totalAmount: "10.00",
        },
        {
          transactionId: "T-2",
          saleDate: "2026-02-01",
          productName: "Latte",
          quantity: 1,
          unitPrice: "50.00",
          totalAmount: "50.00",
        },
        {
          transactionId: "T-3",
          saleDate: "2026-02-03",
          productName: "Tea",
          quantity: 1,
          unitPrice: "20.00",
          totalAmount: "20.00",
        },
      ]);

      const summary = await getDailySalesSummary(
        { datasetId: dataset.id, aggregation: "daily" },
        prisma!,
      );
      assert.deepEqual(summary.dailySummary, [
        {
          saleDate: "2026-02-01",
          totalRevenue: "160.00",
          totalTransactions: 2,
          totalUnitsSold: 4,
          averageTransactionValue: "80.00",
          averageSellingPricePerUnit: "40.00",
          distinctProductsSold: 2,
        },
        {
          saleDate: "2026-02-03",
          totalRevenue: "20.00",
          totalTransactions: 1,
          totalUnitsSold: 1,
          averageTransactionValue: "20.00",
          averageSellingPricePerUnit: "20.00",
          distinctProductsSold: 1,
        },
      ]);
      assert.equal(summary.marketingSpend, null);
    });

    it("filters by date and dataset and returns an empty summary for no records", async () => {
      const included = await createDataset("summary-included");
      const excluded = await createDataset("summary-excluded");
      await insertRecords(included.id, [
        {
          transactionId: "IN",
          saleDate: "2026-02-01",
          productName: "Coffee",
          quantity: 1,
          unitPrice: "10",
          totalAmount: "10",
        },
      ]);
      await insertRecords(excluded.id, [
        {
          transactionId: "OUT",
          saleDate: "2026-02-01",
          productName: "Coffee",
          quantity: 1,
          unitPrice: "90",
          totalAmount: "90",
        },
      ]);

      const filtered = await getDailySalesSummary(
        {
          datasetId: included.id,
          aggregation: "daily",
          startDate: new Date("2026-02-01T00:00:00.000Z"),
          endDate: new Date("2026-02-01T00:00:00.000Z"),
        },
        prisma!,
      );
      const empty = await getDailySalesSummary(
        {
          datasetId: included.id,
          aggregation: "daily",
          startDate: new Date("2026-02-02T00:00:00.000Z"),
        },
        prisma!,
      );
      assert.equal(filtered.dailySummary.length, 1);
      assert.equal(filtered.dailySummary[0].totalRevenue, "10.00");
      assert.deepEqual(empty.dailySummary, []);
    });

    it("reports errors, duplicate candidates, extreme-value warnings, and row-count mismatches without changes", async () => {
      const dataset = await createDataset("validation");
      await prisma!.dataset.update({
        where: { id: dataset.id },
        data: { rowCount: 99 },
      });
      await insertRecords(dataset.id, [
        {
          transactionId: "DUP",
          saleDate: "2026-02-01",
          productName: "Coffee",
          quantity: 1,
          unitPrice: "10",
          totalAmount: "10",
        },
        {
          transactionId: "DUP",
          saleDate: "2026-02-01",
          productName: "Coffee",
          quantity: 1,
          unitPrice: "10",
          totalAmount: "10",
        },
        {
          transactionId: "BAD",
          saleDate: "2026-02-02",
          productName: "",
          quantity: 0,
          unitPrice: "-2",
          totalAmount: "25",
          paymentMethod: "",
        },
        {
          transactionId: "LARGE",
          saleDate: "2026-02-03",
          productName: "Bulk",
          quantity: 1,
          unitPrice: "1000001",
          totalAmount: "1000001",
        },
      ]);

      const validation = await validateDataset(dataset.id, prisma!);
      assert.equal(validation.inspectedRecords, 4);
      assert.equal(validation.recordsWithErrors, 1);
      assert.equal(validation.validRecords, 3);
      assert.equal(validation.recordsWithWarnings, 3);
      assert.equal(validation.informational.rowCountMatches, false);
      assert.equal(validation.informational.duplicateCandidateRecords, 2);
      assert.equal(validation.informational.duplicateCandidateLines, 1);
      assert.equal(validation.informational.recordedRevenue, "1000046.00");
      assert.equal(validation.informational.expectedRevenue, "1000021.00");
      assert.equal(
        validation.informational.absoluteRevenueDiscrepancy,
        "25.00",
      );
      assert.deepEqual(
        validation.errors.map(({ code }) => code).sort(),
        [
          "invalid_monetary_values",
          "invalid_quantity",
          "missing_required_fields",
          "revenue_mismatch",
        ].sort(),
      );
      assert.deepEqual(
        validation.warnings.map(({ code }) => code).sort(),
        [
          "dataset_row_count_mismatch",
          "duplicate_sales_lines",
          "unusually_large_values",
        ].sort(),
      );
      assert.equal(
        await prisma!.salesRecord.count({ where: { datasetId: dataset.id } }),
        4,
      );
    });
  },
);
