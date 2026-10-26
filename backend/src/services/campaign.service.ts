import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { CampaignImportRow } from "../utils/campaign.parser";
import { ReferenceDatasetNotFoundError } from "./reference-data.service";

export interface CampaignImportConflict {
  worksheet: string;
  rejectedRows: number[];
  errors: string[];
}

export class CampaignConflictError extends Error {
  constructor(readonly conflicts: CampaignImportConflict[]) {
    super("One or more campaign IDs already exist in this dataset.");
    this.name = "CampaignConflictError";
  }
}

export async function importCampaigns(
  datasetId: string,
  worksheetName: string,
  campaigns: CampaignImportRow[],
  client: PrismaClient = prisma,
) {
  return client.$transaction(async (transaction) => {
    const dataset = await transaction.dataset.findUnique({
      where: { id: datasetId },
      select: { id: true },
    });
    if (!dataset) throw new ReferenceDatasetNotFoundError();

    const ids = campaigns.map(({ campaignId }) => campaignId);
    const existing = await transaction.marketingCampaign.findMany({
      where: { datasetId, campaignId: { in: ids } },
      select: { campaignId: true },
    });
    const existingIds = new Set(existing.map(({ campaignId }) => campaignId));
    const conflicts = campaigns.filter(({ campaignId }) =>
      existingIds.has(campaignId),
    );
    if (conflicts.length) {
      throw new CampaignConflictError([
        {
          worksheet: worksheetName,
          rejectedRows: conflicts.map(({ sourceRow }) => sourceRow),
          errors: conflicts.map(
            ({ campaignId, sourceRow }) =>
              `${worksheetName} row ${sourceRow}: campaignId "${campaignId}" already exists in this dataset. Existing campaigns are not overwritten.`,
          ),
        },
      ]);
    }

    const result = await transaction.marketingCampaign.createMany({
      data: campaigns.map(
        ({
          sourceRow: _sourceRow,
          discountType,
          discountValue,
          status,
          ...campaign
        }) => ({
          ...campaign,
          datasetId,
          discountPercentage: new Prisma.Decimal(campaign.discountPercentage),
          discountType,
          discountValue: discountValue
            ? new Prisma.Decimal(discountValue)
            : null,
          status,
        }),
      ),
    });

    return {
      datasetId,
      worksheet: worksheetName,
      recordsCreated: result.count,
      totalCampaigns: await transaction.marketingCampaign.count({
        where: { datasetId },
      }),
    };
  });
}

export function isCampaignUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
