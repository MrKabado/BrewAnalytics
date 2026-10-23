import { DatasetValidationError } from "./dataset.validation";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface DatasetRecordFilters extends PaginationParams {
  productName?: string;
  category?: string;
  paymentMethod?: string;
  saleDateFrom?: Date;
  saleDateTo?: Date;
}

function readSingleString(value: unknown, key: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new DatasetValidationError(`${key} must be provided once as a string.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new DatasetValidationError(`${key} cannot be empty.`);
  }

  return trimmed;
}

function parsePositiveInteger(
  value: unknown,
  key: string,
  defaultValue: number
): number {
  const raw = readSingleString(value, key);

  if (raw === undefined) {
    return defaultValue;
  }

  if (!/^[1-9]\d*$/.test(raw)) {
    throw new DatasetValidationError(`${key} must be a positive integer.`);
  }

  const parsed = Number(raw);

  if (!Number.isSafeInteger(parsed)) {
    throw new DatasetValidationError(`${key} must be a positive integer.`);
  }

  if (key === "pageSize" && parsed > MAX_PAGE_SIZE) {
    throw new DatasetValidationError(
      `pageSize cannot exceed ${MAX_PAGE_SIZE}.`
    );
  }

  return parsed;
}

function parseDate(value: unknown, key: string): Date | undefined {
  const raw = readSingleString(value, key);

  if (raw === undefined) {
    return undefined;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);

  if (!match) {
    throw new DatasetValidationError(`${key} must use YYYY-MM-DD format.`);
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new DatasetValidationError(`${key} must be a valid calendar date.`);
  }

  return date;
}

export function parsePaginationParams(
  query: Record<string, unknown>
): PaginationParams {
  const pagination = {
    page: parsePositiveInteger(query.page, "page", DEFAULT_PAGE),
    pageSize: parsePositiveInteger(
      query.pageSize,
      "pageSize",
      DEFAULT_PAGE_SIZE
    ),
  };

  if (!Number.isSafeInteger((pagination.page - 1) * pagination.pageSize)) {
    throw new DatasetValidationError("page and pageSize exceed the valid range.");
  }

  return pagination;
}

export function parseDatasetRecordFilters(
  query: Record<string, unknown>
): DatasetRecordFilters {
  const pagination = parsePaginationParams(query);
  const productName = readSingleString(query.productName, "productName");
  const category = readSingleString(query.category, "category");
  const paymentMethod = readSingleString(query.paymentMethod, "paymentMethod");
  const saleDateFrom = parseDate(query.saleDateFrom, "saleDateFrom");
  const saleDateTo = parseDate(query.saleDateTo, "saleDateTo");

  if (saleDateFrom && saleDateTo && saleDateFrom > saleDateTo) {
    throw new DatasetValidationError(
      "saleDateFrom cannot be later than saleDateTo."
    );
  }

  return {
    ...pagination,
    ...(productName ? { productName } : {}),
    ...(category ? { category } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(saleDateFrom ? { saleDateFrom } : {}),
    ...(saleDateTo ? { saleDateTo } : {}),
  };
}
