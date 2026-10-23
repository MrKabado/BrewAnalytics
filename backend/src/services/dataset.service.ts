import path from "node:path";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { DatasetRecordFilters } from "../utils/dataset.query";
import { DatasetValidationError } from "../utils/dataset.validation";
import type { SalesCsvRow } from "../utils/csv.parser";

function parseSaleDate(value: string, rowNumber: number): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    throw new DatasetValidationError(
      `Row ${rowNumber}: saleDate must use YYYY-MM-DD format.`
    );
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new DatasetValidationError(
      `Row ${rowNumber}: saleDate is not a valid calendar date.`
    );
  }

  return date;
}

function parseRequiredText(
  value: string,
  field: string,
  rowNumber: number
): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new DatasetValidationError(
      `Row ${rowNumber}: ${field} cannot be empty.`
    );
  }

  return trimmed;
}

function parseQuantity(value: string, rowNumber: number): number {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    throw new DatasetValidationError(
      `Row ${rowNumber}: quantity must be a positive whole number.`
    );
  }

  const quantity = Number(trimmed);

  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new DatasetValidationError(
      `Row ${rowNumber}: quantity must be a positive whole number.`
    );
  }

  return quantity;
}

function parseAmount(value: string, field: string, rowNumber: number): string {
  const trimmed = value.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    throw new DatasetValidationError(
      `Row ${rowNumber}: ${field} must be a non-negative amount with at most two decimal places.`
    );
  }

  const amount = Number(trimmed);

  if (!Number.isFinite(amount) || amount > 9999999999.99) {
    throw new DatasetValidationError(
      `Row ${rowNumber}: ${field} exceeds the supported amount range.`
    );
  }

  return trimmed;
}

function validateRows(rows: SalesCsvRow[]) {
  if (rows.length === 0) {
    throw new DatasetValidationError("The uploaded file contains no sales records.");
  }

  return rows.map((row, index) => {
    const rowNumber = index + 2;

    return {
      transactionId: parseRequiredText(row.transactionId, "transactionId", rowNumber),
      saleDate: parseSaleDate(row.saleDate, rowNumber),
      productName: parseRequiredText(row.productName, "productName", rowNumber),
      category: parseRequiredText(row.category, "category", rowNumber),
      quantity: parseQuantity(row.quantity, rowNumber),
      unitPrice: new Prisma.Decimal(
        parseAmount(row.unitPrice, "unitPrice", rowNumber)
      ),
      totalAmount: new Prisma.Decimal(
        parseAmount(row.totalAmount, "totalAmount", rowNumber)
      ),
      paymentMethod: parseRequiredText(row.paymentMethod, "paymentMethod", rowNumber),
    };
  });
}

export async function createDatasetFromCsv(
  fileName: string,
  rows: SalesCsvRow[]
) {
  const records = validateRows(rows);
  const originalFileName = path.basename(fileName);
  const name = path.parse(originalFileName).name.trim();

  if (!name) {
    throw new DatasetValidationError("The uploaded file must have a valid name.");
  }

  return prisma.$transaction(async (transaction) => {
    const dataset = await transaction.dataset.create({
      data: {
        name,
        originalFileName,
        rowCount: records.length,
      },
    });

    await transaction.salesRecord.createMany({
      data: records.map((record) => ({
        ...record,
        datasetId: dataset.id,
      })),
    });

    return dataset;
  });
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
    await prisma.dataset.delete({ where: { id } });
    return true;
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