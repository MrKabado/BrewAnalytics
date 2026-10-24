import { DatasetValidationError } from "./dataset.validation";
import type { SalesAggregation } from "./analytics.query";

export interface ForecastFilters {
  datasetId?: string;
  aggregation: SalesAggregation;
  horizon: number;
  startDate?: Date;
  endDate?: Date;
}

export interface ProductForecastFilters extends ForecastFilters {
  productName?: string;
  category?: string;
  topN: number;
}

export interface EvaluationFilters {
  datasetId?: string;
  aggregation: SalesAggregation;
  startDate?: Date;
  endDate?: Date;
}

const DAILY_DEFAULT_HORIZON = 7;
const MONTHLY_DEFAULT_HORIZON = 6;
const MAX_DAILY_HORIZON = 90;
const MAX_MONTHLY_HORIZON = 36;
const DEFAULT_PRODUCT_TOP_N = 10;
const MAX_PRODUCT_TOP_N = 100;

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

function parseAggregation(value: string | undefined): SalesAggregation {
  const aggregation = value ?? "daily";

  if (aggregation !== "daily" && aggregation !== "monthly") {
    throw new DatasetValidationError(
      "aggregation must be either 'daily' or 'monthly'."
    );
  }

  return aggregation;
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

function parseDateRange(query: Record<string, unknown>) {
  const startDate = parseDate(readOptionalString(query, "startDate"), "startDate");
  const endDate = parseDate(readOptionalString(query, "endDate"), "endDate");

  if (startDate && endDate && startDate > endDate) {
    throw new DatasetValidationError(
      "startDate cannot be later than endDate."
    );
  }

  return { startDate, endDate };
}

function parseDatasetId(query: Record<string, unknown>) {
  return readOptionalString(query, "datasetId");
}

function parseHorizon(
  value: string | undefined,
  aggregation: SalesAggregation
) {
  const defaultValue =
    aggregation === "daily" ? DAILY_DEFAULT_HORIZON : MONTHLY_DEFAULT_HORIZON;
  const max = aggregation === "daily" ? MAX_DAILY_HORIZON : MAX_MONTHLY_HORIZON;

  if (value === undefined) {
    return defaultValue;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    throw new DatasetValidationError("horizon must be a positive integer.");
  }

  const horizon = Number(value);

  if (!Number.isSafeInteger(horizon) || horizon > max) {
    throw new DatasetValidationError(
      `horizon cannot exceed ${max} for ${aggregation} forecasts.`
    );
  }

  return horizon;
}

function parseTopN(value: string | undefined) {
  if (value === undefined) {
    return DEFAULT_PRODUCT_TOP_N;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    throw new DatasetValidationError("topN must be a positive integer.");
  }

  const topN = Number(value);

  if (!Number.isSafeInteger(topN) || topN > MAX_PRODUCT_TOP_N) {
    throw new DatasetValidationError(
      `topN cannot exceed ${MAX_PRODUCT_TOP_N}.`
    );
  }

  return topN;
}

export function parseForecastFilters(
  query: Record<string, unknown>
): ForecastFilters {
  const aggregation = parseAggregation(
    readOptionalString(query, "aggregation")
  );
  const { startDate, endDate } = parseDateRange(query);
  const datasetId = parseDatasetId(query);

  return {
    ...(datasetId ? { datasetId } : {}),
    aggregation,
    horizon: parseHorizon(
      readOptionalString(query, "horizon"),
      aggregation
    ),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
}

export function parseProductForecastFilters(
  query: Record<string, unknown>
): ProductForecastFilters {
  const filters = parseForecastFilters(query);
  const productName = readOptionalString(query, "productName");
  const category = readOptionalString(query, "category");

  return {
    ...filters,
    ...(productName ? { productName } : {}),
    ...(category ? { category } : {}),
    topN: parseTopN(readOptionalString(query, "topN")),
  };
}

export function parseEvaluationFilters(
  query: Record<string, unknown>
): EvaluationFilters {
  const aggregation = parseAggregation(
    readOptionalString(query, "aggregation")
  );
  const { startDate, endDate } = parseDateRange(query);
  const datasetId = parseDatasetId(query);

  return {
    ...(datasetId ? { datasetId } : {}),
    aggregation,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
}
