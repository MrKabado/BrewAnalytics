import { Prisma } from "@/generated/prisma/client";
import type { SalesCsvRow } from "./csv.parser";

export class DatasetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatasetValidationError";
  }
}

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

export function validateSalesRows(rows: SalesCsvRow[]) {
  if (rows.length === 0) {
    throw new DatasetValidationError(
      "The uploaded file contains no sales records."
    );
  }

  return rows.map((row, index) => {
    const rowNumber = index + 2;

    return {
      transactionId: parseRequiredText(
        row.transactionId,
        "transactionId",
        rowNumber
      ),
      saleDate: parseSaleDate(row.saleDate, rowNumber),
      productName: parseRequiredText(
        row.productName,
        "productName",
        rowNumber
      ),
      category: parseRequiredText(row.category, "category", rowNumber),
      quantity: parseQuantity(row.quantity, rowNumber),
      unitPrice: new Prisma.Decimal(
        parseAmount(row.unitPrice, "unitPrice", rowNumber)
      ),
      totalAmount: new Prisma.Decimal(
        parseAmount(row.totalAmount, "totalAmount", rowNumber)
      ),
      paymentMethod: parseRequiredText(
        row.paymentMethod,
        "paymentMethod",
        rowNumber
      ),
    };
  });
}
