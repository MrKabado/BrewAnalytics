import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  importReferenceData,
  ReferenceDataConflictError,
} from "./reference-data.service";
import type { ParsedReferenceWorkbook } from "../utils/reference-data.parser";

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

async function createDataset() {
  if (!prisma) throw new Error("DATABASE_URL_TEST is not configured.");
  const dataset = await prisma.dataset.create({
    data: {
      name: `reference-import-${randomUUID()}`,
      originalFileName: "reference-import.xlsx",
    },
  });
  datasetIds.push(dataset.id);
  return dataset;
}

function validReferenceData(
  productId: string,
  customerId: string,
): ParsedReferenceWorkbook {
  return {
    worksheetNames: ["Products", "Customers"],
    products: [
      {
        productId,
        productName: "Coffee",
        category: "Drinks",
        unitPrice: "100.00",
        unitCost: "35.00",
        status: "ACTIVE",
        sourceRow: 2,
      },
    ],
    customers: [
      {
        customerId,
        customerType: "Regular",
        ageGroup: "Adult",
        gender: null,
        registrationDate: new Date("2026-01-01T00:00:00.000Z"),
        sourceRow: 2,
      },
    ],
  };
}

describe(
  "Products and Customers import service (local database integration)",
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

    it("creates and queries both entity types without changing sales row counts", async () => {
      const dataset = await createDataset();
      const result = await importReferenceData(
        dataset.id,
        validReferenceData("P-1", "C-1"),
        prisma!,
      );

      assert.equal(result.totalRecordsCreated, 2);
      assert.deepEqual(
        result.worksheets.map(({ worksheet, recordsCreated }) => ({
          worksheet,
          recordsCreated,
        })),
        [
          { worksheet: "Products", recordsCreated: 1 },
          { worksheet: "Customers", recordsCreated: 1 },
        ],
      );
      assert.equal(
        await prisma!.salesRecord.count({ where: { datasetId: dataset.id } }),
        0,
      );
      assert.equal(
        await prisma!.product.count({
          where: { datasetId: dataset.id, productId: "P-1" },
        }),
        1,
      );
      assert.equal(
        await prisma!.customer.count({
          where: { datasetId: dataset.id, customerId: "C-1" },
        }),
        1,
      );
    });

    it("rejects existing IDs without overwriting or creating other worksheet rows", async () => {
      const dataset = await createDataset();
      await prisma!.product.create({
        data: {
          datasetId: dataset.id,
          productId: "P-1",
          productName: "Original",
          category: "Drinks",
          unitPrice: new Prisma.Decimal("90.00"),
        },
      });

      await assert.rejects(
        importReferenceData(
          dataset.id,
          validReferenceData("P-1", "C-1"),
          prisma!,
        ),
        ReferenceDataConflictError,
      );
      const product = await prisma!.product.findUnique({
        where: {
          datasetId_productId: { datasetId: dataset.id, productId: "P-1" },
        },
      });
      assert.equal(product?.productName, "Original");
      assert.equal(
        await prisma!.customer.count({ where: { datasetId: dataset.id } }),
        0,
      );
    });

    it("rejects existing customer IDs without inserting products or overwriting customers", async () => {
      const dataset = await createDataset();
      await prisma!.customer.create({
        data: {
          datasetId: dataset.id,
          customerId: "C-1",
          customerType: "Original",
          ageGroup: "Adult",
          registrationDate: new Date("2026-01-01T00:00:00.000Z"),
        },
      });

      await assert.rejects(
        importReferenceData(
          dataset.id,
          validReferenceData("P-1", "C-1"),
          prisma!,
        ),
        ReferenceDataConflictError,
      );
      const customer = await prisma!.customer.findUnique({
        where: {
          datasetId_customerId: { datasetId: dataset.id, customerId: "C-1" },
        },
      });
      assert.equal(customer?.customerType, "Original");
      assert.equal(
        await prisma!.product.count({ where: { datasetId: dataset.id } }),
        0,
      );
    });

    it("rolls back product creation if customer insertion fails", async () => {
      const dataset = await createDataset();
      const data = validReferenceData("P-ROLLBACK", "C-ROLLBACK");
      data.customers![0].registrationDate = new Date(Number.NaN);

      await assert.rejects(importReferenceData(dataset.id, data, prisma!));
      assert.equal(
        await prisma!.product.count({
          where: { datasetId: dataset.id, productId: "P-ROLLBACK" },
        }),
        0,
      );
    });
  },
);
