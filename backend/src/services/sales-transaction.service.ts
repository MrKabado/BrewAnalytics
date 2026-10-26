import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { SalesTransactionImportRow } from "../utils/sales-transaction.parser";
import { ReferenceDatasetNotFoundError } from "./reference-data.service";

export interface SalesImportIssue {
  worksheet: string;
  rejectedRows: number[];
  errors: string[];
}

export class SalesTransactionImportError extends Error {
  constructor(
    message: string,
    readonly worksheetErrors: SalesImportIssue[] = [],
  ) {
    super(message);
    this.name = "SalesTransactionImportError";
  }
}

export class DuplicateSalesImportError extends Error {
  constructor(readonly issues: SalesImportIssue[]) {
    super("One or more sales lines already exist in this dataset.");
    this.name = "DuplicateSalesImportError";
  }
}

export class ConcurrentSalesImportError extends Error {
  constructor(readonly issues: SalesImportIssue[]) {
    super("The dataset changed during this sales import.");
    this.name = "ConcurrentSalesImportError";
  }
}

function salesLineSignature(record: {
  transactionId: string;
  saleDate: Date;
  saleDateTime: Date | null;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  paymentMethod: string;
  customerId: string | null;
}): string {
  return [
    record.transactionId,
    record.saleDate.toISOString().slice(0, 10),
    record.saleDateTime?.toISOString() ?? "",
    record.productName.trim().toLocaleLowerCase(),
    record.category.trim().toLocaleLowerCase(),
    record.quantity,
    record.unitPrice.toFixed(2),
    record.totalAmount.toFixed(2),
    record.paymentMethod.trim().toLocaleLowerCase(),
    record.customerId ?? "",
  ].join("\u0000");
}

function importedLineSignature(
  row: SalesTransactionImportRow,
  product: { productName: string; category: string },
): string {
  return salesLineSignature({
    transactionId: row.transactionId,
    saleDate: row.saleDate,
    saleDateTime: row.saleDateTime,
    productName: product.productName,
    category: product.category,
    quantity: row.quantity,
    unitPrice: new Prisma.Decimal(row.unitPrice),
    totalAmount: new Prisma.Decimal(row.totalAmount),
    paymentMethod: row.paymentMethod,
    customerId: row.customerId,
  });
}

export async function importSalesTransactions(
  datasetId: string,
  worksheetName: string,
  rows: SalesTransactionImportRow[],
  client: PrismaClient = prisma,
) {
  try {
    return await client.$transaction(
      async (transaction) => {
        const dataset = await transaction.dataset.findUnique({
          where: { id: datasetId },
          select: { id: true },
        });
        if (!dataset) throw new ReferenceDatasetNotFoundError();

        const productIds = [...new Set(rows.map(({ productId }) => productId))];
        const products = await transaction.product.findMany({
          where: { datasetId, productId: { in: productIds } },
          select: {
            productId: true,
            productName: true,
            category: true,
          },
        });
        const productsById = new Map(
          products.map((product) => [product.productId, product]),
        );

        const customerIds = [
          ...new Set(
            rows.flatMap(({ customerId }) => (customerId ? [customerId] : [])),
          ),
        ];
        const customers = customerIds.length
          ? await transaction.customer.findMany({
              where: { datasetId, customerId: { in: customerIds } },
              select: { customerId: true },
            })
          : [];
        const knownCustomers = new Set(
          customers.map(({ customerId }) => customerId),
        );

        const foreignKeyErrors: string[] = [];
        const rejectedRows = new Set<number>();
        for (const row of rows) {
          if (!productsById.has(row.productId)) {
            rejectedRows.add(row.sourceRow);
            foreignKeyErrors.push(
              `${worksheetName} row ${row.sourceRow}: productId "${row.productId}" does not exist in this dataset.`,
            );
          }
          if (row.customerId && !knownCustomers.has(row.customerId)) {
            rejectedRows.add(row.sourceRow);
            foreignKeyErrors.push(
              `${worksheetName} row ${row.sourceRow}: customerId "${row.customerId}" does not exist in this dataset.`,
            );
          }
        }
        if (foreignKeyErrors.length) {
          throw new SalesTransactionImportError(
            `Sales Transactions worksheet contains ${rejectedRows.size} row(s) with unknown references.`,
            [
              {
                worksheet: worksheetName,
                rejectedRows: [...rejectedRows].sort((a, b) => a - b),
                errors: foreignKeyErrors,
              },
            ],
          );
        }

        const transactionIds = [
          ...new Set(rows.map(({ transactionId }) => transactionId)),
        ];
        const existingRecords = await transaction.salesRecord.findMany({
          where: { datasetId, transactionId: { in: transactionIds } },
          select: {
            transactionId: true,
            saleDate: true,
            saleDateTime: true,
            productName: true,
            category: true,
            quantity: true,
            unitPrice: true,
            totalAmount: true,
            paymentMethod: true,
            customerId: true,
          },
        });
        const existingSignatures = new Set(
          existingRecords.map(salesLineSignature),
        );
        const conflicts = rows.filter((row) => {
          const product = productsById.get(row.productId)!;
          return existingSignatures.has(importedLineSignature(row, product));
        });
        if (conflicts.length) {
          throw new DuplicateSalesImportError([
            {
              worksheet: worksheetName,
              rejectedRows: conflicts.map(({ sourceRow }) => sourceRow),
              errors: conflicts.map(
                ({ sourceRow, transactionId }) =>
                  `${worksheetName} row ${sourceRow}: transactionId "${transactionId}" contains a sales line already present in this dataset.`,
              ),
            },
          ]);
        }

        const result = await transaction.salesRecord.createMany({
          data: rows.map((row) => {
            const product = productsById.get(row.productId)!;
            return {
              datasetId,
              transactionId: row.transactionId,
              saleDate: row.saleDate,
              saleDateTime: row.saleDateTime,
              productId: row.productId,
              customerId: row.customerId,
              productName: product.productName,
              category: product.category,
              quantity: row.quantity,
              unitPrice: new Prisma.Decimal(row.unitPrice),
              totalAmount: new Prisma.Decimal(row.totalAmount),
              paymentMethod: row.paymentMethod,
            };
          }),
        });
        await transaction.dataset.update({
          where: { id: datasetId },
          data: { rowCount: { increment: result.count } },
        });

        return {
          datasetId,
          worksheet: worksheetName,
          recordsCreated: result.count,
          datasetRowCount: await transaction.salesRecord.count({
            where: { datasetId },
          }),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      throw new ConcurrentSalesImportError([
        {
          worksheet: worksheetName,
          rejectedRows: rows.map(({ sourceRow }) => sourceRow),
          errors: [
            "The dataset changed during import. Check for duplicate sales lines before retrying.",
          ],
        },
      ]);
    }
    throw error;
  }
}
