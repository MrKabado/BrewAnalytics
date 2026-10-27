import path from "node:path";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { DatasetRecordFilters } from "../utils/dataset.query";
import {
  DatasetValidationError,
  validateSalesRows,
} from "../utils/dataset.validation";
import type { SalesCsvRow } from "../utils/csv.parser";

const SALES_RECORD_BATCH_SIZE = 2_000;

export async function createDatasetFromCsv(
  fileName: string,
  rows: SalesCsvRow[],
  client: PrismaClient = prisma,
) {
  const records = validateSalesRows(rows);
  const originalFileName = path.basename(fileName);
  const name = path.parse(originalFileName).name.trim();

  if (!name) {
    throw new DatasetValidationError("The uploaded file must have a valid name.");
  }

  return client.$transaction(
    async (transaction) => {
      const dataset = await transaction.dataset.create({
        data: {
          name,
          originalFileName,
          rowCount: records.length,
        },
      });

      const salesRecords = records.map((record) => ({
        ...record,
        datasetId: dataset.id,
      }));

      for (
        let offset = 0;
        offset < salesRecords.length;
        offset += SALES_RECORD_BATCH_SIZE
      ) {
        await transaction.salesRecord.createMany({
          data: salesRecords.slice(offset, offset + SALES_RECORD_BATCH_SIZE),
        });
      }

      return dataset;
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
    },
  );
}

export async function getDatasets(page: number, pageSize: number) {
  const [datasets, total] = await prisma.$transaction([
    prisma.dataset.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        name: true,
        originalFileName: true,
        rowCount: true,
        uploadedAt: true,
        _count: { select: { records: true } },
      },
    }),
    prisma.dataset.count(),
  ]);

  return {
    datasets: datasets.map(({ _count, ...dataset }) => ({
      ...dataset,
      recordCount: _count.records,
    })),
    total,
  };
}

export async function getDatasetById(id: string) {
  return prisma.dataset.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      originalFileName: true,
      rowCount: true,
      uploadedAt: true,
      _count: { select: { records: true } },
    },
  });
}

export async function getDatasetRecords(
  datasetId: string,
  filters: DatasetRecordFilters
) {
  const where: Prisma.SalesRecordWhereInput = {
    datasetId,
    ...(filters.productName
      ? { productName: { contains: filters.productName, mode: "insensitive" } }
      : {}),
    ...(filters.category
      ? { category: { contains: filters.category, mode: "insensitive" } }
      : {}),
    ...(filters.paymentMethod
      ? {
          paymentMethod: {
            contains: filters.paymentMethod,
            mode: "insensitive",
          },
        }
      : {}),
    ...(filters.saleDateFrom || filters.saleDateTo
      ? {
          saleDate: {
            ...(filters.saleDateFrom ? { gte: filters.saleDateFrom } : {}),
            ...(filters.saleDateTo ? { lte: filters.saleDateTo } : {}),
          },
        }
      : {}),
  };
  const [records, total] = await prisma.$transaction([
    prisma.salesRecord.findMany({
      where,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      orderBy: [{ saleDate: "desc" }, { id: "asc" }],
    }),
    prisma.salesRecord.count({ where }),
  ]);

  return { records, total };
}

export async function deleteDataset(id: string) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const dataset = await transaction.dataset.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!dataset) {
        return false;
      }

      await transaction.salesRecord.deleteMany({ where: { datasetId: id } });
      await transaction.dataset.delete({ where: { id } });
      return true;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return false;
    }

    throw error;
  }
}