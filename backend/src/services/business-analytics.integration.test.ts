import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  getCampaignPeriodAnalytics,
  getCustomerPurchaseAnalytics,
  getProductCatalogPerformance,
} from "./business-analytics.service";

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
      name: `business-analytics-${randomUUID()}`,
      originalFileName: "business-analytics.xlsx",
    },
  });
  datasetIds.push(dataset.id);
  return dataset;
}

async function addSale(
  datasetId: string,
  transactionId: string,
  date: string,
  amount: string,
  options: { customerId?: string; campaignId?: string } = {},
) {
  if (!prisma) throw new Error("DATABASE_URL_TEST is not configured.");
  await prisma.salesRecord.create({
    data: {
      datasetId,
      transactionId,
      saleDate: new Date(`${date}T00:00:00.000Z`),
      productId: "P-1",
      customerId: options.customerId,
      campaignId: options.campaignId,
      productName: "Coffee",
      category: "Drinks",
      quantity: 1,
      unitPrice: new Prisma.Decimal(amount),
      totalAmount: new Prisma.Decimal(amount),
      paymentMethod: "Cash",
    },
  });
}

describe(
  "business analytics services (local database integration)",
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

    it("compares equal campaign windows and reports only explicitly linked sales as attributed", async () => {
      const dataset = await createDataset();
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
          datasetId: dataset.id,
          productId: "P-2",
          productName: "Tea",
          category: "Drinks",
          unitPrice: new Prisma.Decimal("75.00"),
        },
      });
      await prisma!.customer.create({
        data: {
          datasetId: dataset.id,
          customerId: "C-1",
          customerType: "Member",
          ageGroup: "Adult",
          registrationDate: new Date("2025-01-01T00:00:00.000Z"),
        },
      });
      await prisma!.customer.create({
        data: {
          datasetId: dataset.id,
          customerId: "C-2",
          customerType: "Member",
          ageGroup: "Adult",
          registrationDate: new Date("2025-01-01T00:00:00.000Z"),
        },
      });
      await prisma!.marketingCampaign.create({
        data: {
          datasetId: dataset.id,
          campaignId: "CAM-1",
          campaignName: "Weekend offer",
          promotionType: "Discount",
          startDate: new Date("2026-01-04T00:00:00.000Z"),
          endDate: new Date("2026-01-05T00:00:00.000Z"),
          marketingCost: new Prisma.Decimal("25.00"),
          discountPercentage: new Prisma.Decimal("10.00"),
          campaignChannel: "Online",
        },
      });

      await addSale(dataset.id, "T-0", "2025-12-31", "15.00");
      await addSale(dataset.id, "T-1", "2026-01-02", "80.00");
      await addSale(dataset.id, "T-2", "2026-01-03", "20.00");
      await addSale(dataset.id, "T-3", "2026-01-04", "60.00", {
        customerId: "C-1",
        campaignId: "CAM-1",
      });
      await addSale(dataset.id, "T-3", "2026-01-04", "40.00", {
        customerId: "C-2",
      });
      await addSale(dataset.id, "T-4", "2026-01-05", "100.00", {
        customerId: "C-1",
      });
      await addSale(dataset.id, "T-5", "2026-01-06", "100.00");
      await addSale(dataset.id, "T-6", "2026-01-07", "100.00");
      await addSale(dataset.id, "T-7", "2026-01-08", "10.00");

      const [campaigns, catalog, customers] = await Promise.all([
        getCampaignPeriodAnalytics(dataset.id),
        getProductCatalogPerformance(dataset.id),
        getCustomerPurchaseAnalytics(dataset.id),
      ]);
      const campaign = campaigns.campaigns[0];

      assert.equal(campaign.activePeriod.revenue, "200.00");
      assert.equal(campaign.activePeriod.distinctTransactions, 2);
      assert.equal(campaign.priorComparablePeriod.revenue, "100.00");
      assert.equal(campaign.followingComparablePeriod.revenue, "200.00");
      assert.equal(campaign.priorComparablePeriod.coveredByObservedHistory, true);
      assert.equal(campaign.followingComparablePeriod.coveredByObservedHistory, true);
      assert.equal(campaign.explicitCampaignLinkedSales.revenue, "60.00");
      assert.equal(campaign.explicitCampaignLinkedSales.distinctTransactions, 1);
      assert.equal(campaigns.attributionAvailable, true);
      assert.equal(
        campaign.dailyTrends.filter((day) => day.phase === "during").length,
        2,
      );

      const unsoldProduct = catalog.products.find(
        (product) => product.productId === "P-2",
      );
      assert.equal(unsoldProduct?.hasSales, false);
      assert.equal(unsoldProduct?.recordedRevenue, "0.00");

      assert.equal(customers.linkedCustomerCount, 2);
      assert.equal(customers.repeatCustomerCount, 1);
      assert.equal(customers.linkedTransactionCount, 2);
      assert.equal(customers.segments[0].distinctTransactions, 2);
      assert.equal(customers.unlinkedSales.distinctTransactions, 6);
    });

    it("returns empty campaign and customer analytics for an empty dataset", async () => {
      const dataset = await createDataset();
      const [campaigns, customers] = await Promise.all([
        getCampaignPeriodAnalytics(dataset.id),
        getCustomerPurchaseAnalytics(dataset.id),
      ]);

      assert.equal(campaigns.campaignCount, 0);
      assert.deepEqual(campaigns.campaigns, []);
      assert.equal(customers.linkedCustomerCount, 0);
      assert.equal(customers.linkedTransactionCount, 0);
      assert.equal(customers.unlinkedSales.salesRecordCount, 0);
    });
  },
);
