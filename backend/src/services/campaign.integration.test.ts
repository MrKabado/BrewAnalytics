import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { CampaignImportRow } from "../utils/campaign.parser";
import { CampaignConflictError, importCampaigns } from "./campaign.service";

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
      name: `campaign-import-${randomUUID()}`,
      originalFileName: "campaigns.xlsx",
    },
  });
  datasetIds.push(dataset.id);
  return dataset;
}

function campaign(
  campaignId: string,
  overrides: Partial<CampaignImportRow> = {},
): CampaignImportRow {
  return {
    campaignId,
    campaignName: "Winter promotion",
    promotionType: "Discount",
    campaignChannel: "Online",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-01-31T00:00:00.000Z"),
    marketingCost: "1000.00",
    discountPercentage: "10.00",
    discountType: "PERCENTAGE",
    discountValue: "10.00",
    status: "ACTIVE",
    sourceRow: 2,
    ...overrides,
  };
}

describe(
  "Marketing Campaigns import service (local database integration)",
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

    it("creates campaigns scoped to the Dataset and returns correct totals", async () => {
      const dataset = await createDataset();
      const result = await importCampaigns(
        dataset.id,
        "Marketing Campaigns",
        [campaign("C-1")],
        prisma!,
      );
      const stored = await prisma!.marketingCampaign.findUniqueOrThrow({
        where: {
          datasetId_campaignId: {
            datasetId: dataset.id,
            campaignId: "C-1",
          },
        },
      });

      assert.equal(result.recordsCreated, 1);
      assert.equal(result.totalCampaigns, 1);
      assert.equal(stored.campaignChannel, "Online");
      assert.equal(stored.discountPercentage.toFixed(2), "10.00");
      assert.equal(stored.discountType, "PERCENTAGE");
      assert.equal(stored.discountValue?.toFixed(2), "10.00");
      assert.equal(stored.status, "ACTIVE");
    });

    it("rejects existing campaign IDs without overwriting the original record", async () => {
      const dataset = await createDataset();
      await prisma!.marketingCampaign.create({
        data: {
          datasetId: dataset.id,
          campaignId: "C-EXIST",
          campaignName: "Original",
          promotionType: "Discount",
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          endDate: new Date("2026-01-31T00:00:00.000Z"),
          marketingCost: new Prisma.Decimal("100.00"),
          discountPercentage: new Prisma.Decimal("0.00"),
          campaignChannel: "In Store",
        },
      });

      await assert.rejects(
        importCampaigns(
          dataset.id,
          "Marketing Campaigns",
          [campaign("C-EXIST")],
          prisma!,
        ),
        CampaignConflictError,
      );
      const stored = await prisma!.marketingCampaign.findUniqueOrThrow({
        where: {
          datasetId_campaignId: {
            datasetId: dataset.id,
            campaignId: "C-EXIST",
          },
        },
      });
      assert.equal(stored.campaignName, "Original");
      assert.equal(
        await prisma!.marketingCampaign.count({
          where: { datasetId: dataset.id },
        }),
        1,
      );
    });

    it("rolls back the campaign batch if a database constraint fails", async () => {
      const dataset = await createDataset();
      const invalidCampaign = campaign("C-INVALID", {
        startDate: new Date(Number.NaN),
      });
      await assert.rejects(
        importCampaigns(
          dataset.id,
          "Marketing Campaigns",
          [campaign("C-VALID"), invalidCampaign],
          prisma!,
        ),
      );
      assert.equal(
        await prisma!.marketingCampaign.count({
          where: { datasetId: dataset.id },
        }),
        0,
      );
    });
  },
);
