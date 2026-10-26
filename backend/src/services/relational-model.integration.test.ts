import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const testDatabaseUrl = process.env.DATABASE_URL_TEST;
const databaseHost = testDatabaseUrl
  ? new URL(testDatabaseUrl).hostname
  : undefined;

if (
  databaseHost &&
  !["localhost", "127.0.0.1", "::1", "[::1]"].includes(databaseHost)
) {
  throw new Error(
    "DATABASE_URL_TEST must point to a local PostgreSQL test database."
  );
}

const prisma = testDatabaseUrl
  ? new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl }),
    })
  : undefined;
const datasetIds: string[] = [];

async function createTestDataset() {
  if (!prisma) {
    throw new Error("DATABASE_URL_TEST is not configured.");
  }

  const dataset = await prisma.dataset.create({
    data: {
      name: `relational-test-${randomUUID()}`,
      originalFileName: "relational-test.csv",
    },
  });
  datasetIds.push(dataset.id);
  return dataset;
}

async function createLegacySalesRecord(datasetId: string, transactionId: string) {
  if (!prisma) {
    throw new Error("DATABASE_URL_TEST is not configured.");
  }

  return prisma.salesRecord.create({
    data: {
      datasetId,
      transactionId,
      saleDate: new Date("2026-10-01T00:00:00.000Z"),
      productName: "Coffee",
      category: "Drinks",
      quantity: 1,
      unitPrice: new Prisma.Decimal("100.00"),
      totalAmount: new Prisma.Decimal("100.00"),
      paymentMethod: "Cash",
    },
  });
}

describe(
  "relational business data schema (local database integration)",
  { skip: !testDatabaseUrl },
  () => {
    before(async () => {
      await prisma?.$connect();
    });

    after(async () => {
      if (!prisma) {
        return;
      }

      for (const datasetId of datasetIds) {
        await prisma.salesRecord.deleteMany({ where: { datasetId } });
        await prisma.dataset.deleteMany({ where: { id: datasetId } });
      }
      await prisma.$disconnect();
    });

    it("keeps legacy sales rows valid and permits multiple lines per transaction", async () => {
      const dataset = await createTestDataset();
      const transactionId = `txn-${randomUUID()}`;

      await createLegacySalesRecord(dataset.id, transactionId);
      await createLegacySalesRecord(dataset.id, transactionId);

      assert.equal(
        await prisma!.salesRecord.count({
          where: { datasetId: dataset.id, transactionId },
        }),
        2
      );
    });

    it("creates and queries dataset-scoped product, customer, campaign, and linked sales", async () => {
      const dataset = await createTestDataset();

      await prisma!.product.create({
        data: {
          datasetId: dataset.id,
          productId: "P-1",
          productName: "Coffee",
          category: "Drinks",
          unitPrice: new Prisma.Decimal("100.00"),
          unitCost: new Prisma.Decimal("35.00"),
        },
      });
      await prisma!.customer.create({
        data: {
          datasetId: dataset.id,
          customerId: "C-1",
          customerType: "Regular",
          ageGroup: "Adult",
          registrationDate: new Date("2026-01-01T00:00:00.000Z"),
        },
      });
      await prisma!.marketingCampaign.create({
        data: {
          datasetId: dataset.id,
          campaignId: "M-1",
          campaignName: "Launch offer",
          promotionType: "Discount",
          startDate: new Date("2026-10-01T00:00:00.000Z"),
          endDate: new Date("2026-10-31T00:00:00.000Z"),
          marketingCost: new Prisma.Decimal("500.00"),
          discountPercentage: new Prisma.Decimal("10.00"),
          campaignChannel: "In-store",
        },
      });
      const record = await prisma!.salesRecord.create({
        data: {
          datasetId: dataset.id,
          transactionId: `txn-${randomUUID()}`,
          saleDate: new Date("2026-10-01T00:00:00.000Z"),
          saleDateTime: new Date("2026-10-01T09:30:00.000Z"),
          productId: "P-1",
          customerId: "C-1",
          campaignId: "M-1",
          productName: "Coffee",
          category: "Drinks",
          quantity: 1,
          unitPrice: new Prisma.Decimal("100.00"),
          unitCost: new Prisma.Decimal("35.00"),
          totalAmount: new Prisma.Decimal("90.00"),
          paymentMethod: "Cash",
        },
        include: { product: true, customer: true, campaign: true },
      });

      assert.equal(record.product?.productName, "Coffee");
      assert.equal(record.customer?.customerType, "Regular");
      assert.equal(record.campaign?.campaignName, "Launch offer");
    });

    it("enforces scoped foreign keys and composite identifier uniqueness", async () => {
      const dataset = await createTestDataset();
      const otherDataset = await createTestDataset();

      await prisma!.product.create({
        data: {
          datasetId: dataset.id,
          productId: "P-1",
          productName: "Coffee",
          category: "Drinks",
          unitPrice: new Prisma.Decimal("100.00"),
        },
      });
      await prisma!.product.create({
        data: {
          datasetId: otherDataset.id,
          productId: "P-1",
          productName: "Coffee",
          category: "Drinks",
          unitPrice: new Prisma.Decimal("100.00"),
        },
      });

      await assert.rejects(
        prisma!.product.create({
          data: {
            datasetId: dataset.id,
            productId: "P-1",
            productName: "Duplicate",
            category: "Drinks",
            unitPrice: new Prisma.Decimal("100.00"),
          },
        }),
        (error: unknown) =>
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
      );
      await assert.rejects(
        prisma!.salesRecord.create({
          data: {
            datasetId: dataset.id,
            transactionId: `txn-${randomUUID()}`,
            saleDate: new Date("2026-10-01T00:00:00.000Z"),
            productId: "MISSING",
            productName: "Coffee",
            category: "Drinks",
            quantity: 1,
            unitPrice: new Prisma.Decimal("100.00"),
            totalAmount: new Prisma.Decimal("100.00"),
            paymentMethod: "Cash",
          },
        }),
        (error: unknown) =>
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003"
      );
      await assert.rejects(
        prisma!.salesRecord.create({
          data: {
            datasetId: dataset.id,
            transactionId: `txn-${randomUUID()}`,
            saleDate: new Date("2026-10-01T00:00:00.000Z"),
            productId: "P-1",
            productName: "Coffee",
            category: "Drinks",
            quantity: 1,
            unitPrice: new Prisma.Decimal("100.00"),
            totalAmount: new Prisma.Decimal("100.00"),
            paymentMethod: "Cash",
          },
        }),
        (error: unknown) =>
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003"
      );
    });

    it("retains intentional dataset deletion ordering for linked records", async () => {
      const dataset = await createTestDataset();

      await prisma!.product.create({
        data: {
          datasetId: dataset.id,
          productId: "P-1",
          productName: "Coffee",
          category: "Drinks",
          unitPrice: new Prisma.Decimal("100.00"),
        },
      });
      await createLegacySalesRecord(dataset.id, `txn-${randomUUID()}`);

      await prisma!.$transaction(async (transaction) => {
        await transaction.salesRecord.deleteMany({
          where: { datasetId: dataset.id },
        });
        await transaction.dataset.delete({ where: { id: dataset.id } });
      });

      assert.equal(
        await prisma!.product.count({ where: { datasetId: dataset.id } }),
        0
      );
    });
  }
);
