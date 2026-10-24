import { DatasetValidationError } from "./dataset.validation";

export type SalesAggregation = "daily" | "monthly";

export interface AnalyticsFilters {
  datasetId?: string;
}

export interface SalesTrendFilters extends AnalyticsFilters {
  aggregation: SalesAggregation;
  startDate?: Date;
  endDate?: Date;
}

export const DEFAULT_ANALYTICS_TOP_N = 10;
export const MAX_ANALYTICS_TOP_N = 100;

function readOptionalString(
  query: Record<string, unknown>,
  key: string
): string | undefined {
  const value = query[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new DatasetValidationError(`${key} must be a non-empty string.`);
  }

  return value.trim();
}

function parseDate(value: string | undefined, key: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

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

export function parseAnalyticsFilters(
  query: Record<string, unknown>
): AnalyticsFilters {
  const datasetId = readOptionalString(query, "datasetId");
  return datasetId ? { datasetId } : {};
}

export function parseProductFilters(query: Record<string, unknown>) {
  const { datasetId } = parseAnalyticsFilters(query);
  const category = readOptionalString(query, "category");
  const rawTopN = readOptionalString(query, "topN");
  let topN = DEFAULT_ANALYTICS_TOP_N;

  if (rawTopN !== undefined) {
    if (!/^[1-9]\d*$/.test(rawTopN)) {
      throw new DatasetValidationError("topN must be a positive integer.");
    }

    topN = Number(rawTopN);

    if (!Number.isSafeInteger(topN) || topN > MAX_ANALYTICS_TOP_N) {
      throw new DatasetValidationError(
        `topN cannot exceed ${MAX_ANALYTICS_TOP_N}.`
      );
    }
  }

  return {
    ...(datasetId ? { datasetId } : {}),
    ...(category ? { category } : {}),
    topN,
  };
}

export function parseSalesTrendFilters(
  query: Record<string, unknown>
): SalesTrendFilters {
  const { datasetId } = parseAnalyticsFilters(query);
  const rawAggregation = readOptionalString(query, "aggregation");
  const aggregation = rawAggregation ?? "daily";

  if (aggregation !== "daily" && aggregation !== "monthly") {
    throw new DatasetValidationError(
      "aggregation must be either 'daily' or 'monthly'."
    );
  }

  const startDate = parseDate(
    readOptionalString(query, "startDate"),
    "startDate"
  );
  const endDate = parseDate(readOptionalString(query, "endDate"), "endDate");

  if (startDate && endDate && startDate > endDate) {
    throw new DatasetValidationError(
      "startDate cannot be later than endDate."
    );
  }

  return {
    ...(datasetId ? { datasetId } : {}),
    aggregation,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
}
