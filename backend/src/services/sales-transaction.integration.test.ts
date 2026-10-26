import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  DuplicateSalesImportError,
  importSalesTransactions,
  SalesTransactionImportError,
} from "./sales-transaction.service";
import type { SalesTransactionImportRow } from "../utils/sales-transaction.parser";

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

async function createFixtures() {
  if (!prisma) throw new Error("DATABASE_URL_TEST is not configured.");
  const dataset = await prisma.dataset.create({
    data: {
      name: `sales-transaction-import-${randomUUID()}`,
      originalFileName: "sales-transactions.xlsx",
    },
  });
  datasetIds.push(dataset.id);
  await prisma.product.createMany({
    data: [
      {
        datasetId: dataset.id,
        productId: "P-1",
        productName: "Latte",
        category: "Coffee",
        unitPrice: new Prisma.Decimal("90.00"),
      },
      {
        datasetId: dataset.id,
        productId: "P-2",
        productName: "Muffin",
        category: "Bakery",
        unitPrice: new Prisma.Decimal("50.00"),
      },
    ],
  });
  await prisma.customer.create({
    data: {
      datasetId: dataset.id,
      customerId: "C-1",
      customerType: "Regular",
      ageGroup: "Adult",
      registrationDate: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
  return dataset;
}

function row(
  overrides: Partial<SalesTransactionImportRow> = {},
): SalesTransactionImportRow {
  return {
    transactionId: "T-1",
    saleDate: new Date("2026-02-01T00:00:00.000Z"),
    saleDateTime: null,
    productId: "P-1",
    customerId: "C-1",
    quantity: 2,
    unitPrice: "50.00",
    totalAmount: "100.00",
    paymentMethod: "Cash",
    sourceRow: 2,
    ...overrides,
  };
}

describe(
  "Sales Transactions import service (local database integration)",
  { skip: !testDatabaseUrl },
  () => {
    before(async () => {
      await prisma?.$connect();
    });

    after(async () => {
      if (!prisma) return;
      for (const datasetId of datasetIds) {
        await prisma.salesRecord.deleteMany({ where: { datasetId } });
        await prisma.dataset.deleteMany({ where: { id: datasetId } });
      }
      await prisma.$disconnect();
    });

    it("links Products and Customers, preserves historical prices, and updates dataset row count", async () => {
      const dataset = await createFixtures();
      const result = await importSalesTransactions(
        dataset.id,
        "Sales Transactions",
        [row({ saleDateTime: new Date("2026-02-01T14:30:00.000Z") })],
        prisma!,
      );
      const record = await prisma!.salesRecord.findFirstOrThrow({
        where: { datasetId: dataset.id },
      });
      const updatedDataset = await prisma!.dataset.findUniqueOrThrow({
        where: { id: dataset.id },
      });

      assert.equal(result.recordsCreated, 1);
      assert.equal(result.datasetRowCount, 1);
      assert.equal(updatedDataset.rowCount, 1);
      assert.equal(record.productId, "P-1");
      assert.equal(record.customerId, "C-1");
      assert.equal(record.productName, "Latte");
      assert.equal(record.category, "Coffee");
      assert.equal(record.unitPrice.toFixed(2), "50.00");
      assert.equal(
        record.saleDateTime?.toISOString(),
        "2026-02-01T14:30:00.000Z",
      );
    });

    it("allows anonymous sales and repeated transaction IDs for distinct products", async () => {
      const dataset = await createFixtures();
      const result = await importSalesTransactions(
        dataset.id,
        "Sales Transactions",
        [
          row({ customerId: null, sourceRow: 2 }),
          row({
            productId: "P-2",
            unitPrice: "10.00",
            totalAmount: "20.00",
            customerId: null,
            sourceRow: 3,
          }),
        ],
        prisma!,
      );
      assert.equal(result.recordsCreated, 2);
      assert.equal(
        await prisma!.salesRecord.count({ where: { datasetId: dataset.id } }),
        2,
      );
    });

    it("rejects unknown Product and Customer references with source rows", async () => {
      const dataset = await createFixtures();
      await assert.rejects(
        importSalesTransactions(
          dataset.id,
          "Sales Transactions",
          [row({ productId: "UNKNOWN", customerId: "UNKNOWN", sourceRow: 7 })],
          prisma!,
        ),
        (error: unknown) =>
          error instanceof SalesTransactionImportError &&
          error.worksheetErrors[0].rejectedRows.includes(7) &&
          error.worksheetErrors[0].errors.length === 2,
      );
      assert.equal(
        await prisma!.salesRecord.count({ where: { datasetId: dataset.id } }),
        0,
      );
    });

    it("rejects reimported sales lines without adding duplicates", async () => {
      const dataset = await createFixtures();
      const salesLine = row();
      await importSalesTransactions(
        dataset.id,
        "Sales Transactions",
        [salesLine],
        prisma!,
      );
      await assert.rejects(
        importSalesTransactions(
          dataset.id,
          "Sales Transactions",
          [salesLine],
          prisma!,
        ),
        DuplicateSalesImportError,
      );
      assert.equal(
        await prisma!.salesRecord.count({ where: { datasetId: dataset.id } }),
        1,
      );
      assert.equal(
        (await prisma!.dataset.findUniqueOrThrow({ where: { id: dataset.id } }))
          .rowCount,
        1,
      );
    });

    it("rolls back sales rows and counts when persistence fails", async () => {
      const dataset = await createFixtures();
      const invalidRow = row({ saleDate: new Date(Number.NaN) });
      await assert.rejects(
        importSalesTransactions(
          dataset.id,
          "Sales Transactions",
          [invalidRow],
          prisma!,
        ),
      );
      assert.equal(
        await prisma!.salesRecord.count({ where: { datasetId: dataset.id } }),
        0,
      );
      const unchanged = await prisma!.dataset.findUniqueOrThrow({
        where: { id: dataset.id },
      });
      assert.equal(unchanged.rowCount, 0);
    });
  },
);
