import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { ParsedReferenceWorkbook } from "../utils/reference-data.parser";

export class ReferenceDatasetNotFoundError extends Error {
  constructor() {
    super("Dataset not found.");
    this.name = "ReferenceDatasetNotFoundError";
  }
}

export interface ReferenceDataConflict {
  worksheet: "Products" | "Customers";
  rejectedRows: number[];
  errors: string[];
}

export class ReferenceDataConflictError extends Error {
  constructor(readonly conflicts: ReferenceDataConflict[]) {
    super("One or more identifiers already exist in this dataset.");
    this.name = "ReferenceDataConflictError";
  }
}

export async function importReferenceData(
  datasetId: string,
  referenceData: ParsedReferenceWorkbook,
  client: PrismaClient = prisma,
) {
  return client.$transaction(async (transaction) => {
    const dataset = await transaction.dataset.findUnique({
      where: { id: datasetId },
      select: { id: true },
    });
    if (!dataset) {
      throw new ReferenceDatasetNotFoundError();
    }

    const conflicts: ReferenceDataConflict[] = [];
    if (referenceData.products) {
      const ids = referenceData.products.map((product) => product.productId);
      const existing = await transaction.product.findMany({
        where: { datasetId, productId: { in: ids } },
        select: { productId: true },
      });
      const existingIds = new Set(existing.map(({ productId }) => productId));
      const rows = referenceData.products.filter((product) =>
        existingIds.has(product.productId),
      );
      if (rows.length) {
        conflicts.push({
          worksheet: "Products",
          rejectedRows: rows.map(({ sourceRow }) => sourceRow),
          errors: rows.map(
            ({ productId, sourceRow }) =>
              `Products row ${sourceRow}: productId "${productId}" already exists in this dataset. Existing records are not overwritten.`,
          ),
        });
      }
    }

    if (referenceData.customers) {
      const ids = referenceData.customers.map(
        (customer) => customer.customerId,
      );
      const existing = await transaction.customer.findMany({
        where: { datasetId, customerId: { in: ids } },
        select: { customerId: true },
      });
      const existingIds = new Set(existing.map(({ customerId }) => customerId));
      const rows = referenceData.customers.filter((customer) =>
        existingIds.has(customer.customerId),
      );
      if (rows.length) {
        conflicts.push({
          worksheet: "Customers",
          rejectedRows: rows.map(({ sourceRow }) => sourceRow),
          errors: rows.map(
            ({ customerId, sourceRow }) =>
              `Customers row ${sourceRow}: customerId "${customerId}" already exists in this dataset. Existing records are not overwritten.`,
          ),
        });
      }
    }

    if (conflicts.length) {
      throw new ReferenceDataConflictError(conflicts);
    }

    const results: Array<{
      worksheet: "Products" | "Customers";
      recordsCreated: number;
      rejectedRows: number[];
      errors: string[];
    }> = [];

    if (referenceData.products) {
      const { count } = await transaction.product.createMany({
        data: referenceData.products.map(
          ({ sourceRow: _sourceRow, ...product }) => ({
            ...product,
            datasetId,
            unitPrice: new Prisma.Decimal(product.unitPrice),
            unitCost: product.unitCost
              ? new Prisma.Decimal(product.unitCost)
              : null,
          }),
        ),
      });
      results.push({
        worksheet: "Products",
        recordsCreated: count,
        rejectedRows: [],
        errors: [],
      });
    }

    if (referenceData.customers) {
      const { count } = await transaction.customer.createMany({
        data: referenceData.customers.map(
          ({ sourceRow: _sourceRow, ...customer }) => ({
            ...customer,
            datasetId,
          }),
        ),
      });
      results.push({
        worksheet: "Customers",
        recordsCreated: count,
        rejectedRows: [],
        errors: [],
      });
    }

    return {
      datasetId,
      worksheets: results,
      totalRecordsCreated: results.reduce(
        (total, result) => total + result.recordsCreated,
        0,
      ),
    };
  });
}

export function isReferenceUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
