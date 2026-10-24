import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../lib/prisma";
import { DatasetNotFoundError } from "./analytics.service";
import type {
  EvaluationFilters,
  ForecastFilters,
  ProductForecastFilters,
} from "../utils/forecast.query";
import {
  completeCalendarSeries,
  evaluateLinearRegression,
  linearRegressionForecast,
  type NumericObservation,
} from "../utils/forecasting";

interface SalesPeriodRow {
  period: string;
  revenue: Prisma.Decimal;
  unitsSold: bigint;
}

interface ProductPeriodRow {
  productName: string;
  category: string;
  period: string;
  quantity: bigint;
}

async function ensureDatasetExists(datasetId?: string) {
  if (!datasetId) {
    return;
  }

  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    select: { id: true },
  });

  if (!dataset) {
    throw new DatasetNotFoundError();
  }
}

function dateConditions(
  datasetId: string | undefined,
  startDate?: Date,
  endDate?: Date
) {
  const conditions: Prisma.Sql[] = [];

  if (datasetId) {
    conditions.push(Prisma.sql`"datasetId" = ${datasetId}`);
  }
  if (startDate) {
    conditions.push(Prisma.sql`"saleDate" >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(Prisma.sql`"saleDate" <= ${endDate}`);
  }

  return conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;
}

function periodSettings(aggregation: "daily" | "monthly") {
  return aggregation === "monthly"
    ? { unit: "month", format: "YYYY-MM" }
    : { unit: "day", format: "YYYY-MM-DD" };
}

function decimalString(value: number) {
  return Math.max(0, value).toFixed(2);
}

function roundedQuantity(value: number) {
  return Math.max(0, Math.round(value));
}

function countObservedPeriods(observations: NumericObservation[]) {
  return observations.length;
}

async function getSalesPeriods(filters: ForecastFilters | EvaluationFilters) {
  await ensureDatasetExists(filters.datasetId);
  const { unit, format } = periodSettings(filters.aggregation);
  const where = dateConditions(
    filters.datasetId,
    filters.startDate,
    filters.endDate
  );

  return prisma.$queryRaw<SalesPeriodRow[]>(Prisma.sql`
    SELECT
      TO_CHAR(DATE_TRUNC(${unit}, "saleDate"), ${format}) AS "period",
      SUM("totalAmount")::numeric AS "revenue",
      SUM("quantity")::bigint AS "unitsSold"
    FROM "SalesRecord"
    ${where}
    GROUP BY DATE_TRUNC(${unit}, "saleDate")
    ORDER BY DATE_TRUNC(${unit}, "saleDate") ASC
  `);
}

export async function forecastSales(filters: ForecastFilters) {
  const rows = await getSalesPeriods(filters);
  const observed: NumericObservation[] = rows.map((row) => ({
    period: row.period,
    value: Number(row.revenue.toString()),
  }));
  const historical = completeCalendarSeries(observed, filters.aggregation);
  const predictions =
    countObservedPeriods(observed) >= 3
      ? linearRegressionForecast(
          historical.map((observation) => observation.value),
          filters.horizon
        )
      : undefined;

  const commonResponse = {
    ...(filters.datasetId ? { datasetId: filters.datasetId } : {}),
    aggregation: filters.aggregation,
    horizon: filters.horizon,
    method: "linear_regression",
    forecastStatus: predictions ? "forecasted" : "insufficient_data",
    historicalObservations: historical.map((observation) => ({
      period: observation.period,
      revenue: decimalString(observation.value),
      isImputedZero: observation.isImputedZero,
    })),
    limitations:
      "Estimates use a linear trend, are constrained to non-negative revenue, and do not model seasonality, promotions, or other external factors. Missing calendar periods between the first and last recorded periods represent zero recorded sales.",
  };

  if (!predictions || historical.length === 0) {
    return {
      ...commonResponse,
      forecast: [],
      message:
        "At least three historical periods with recorded sales are required to produce forecasts.",
    };
  }

  const lastPeriod = historical[historical.length - 1].period;
  let period = lastPeriod;
  const forecast = predictions.map((predictedRevenue) => {
    const date = new Date(
      `${filters.aggregation === "monthly" ? `${period}-01` : period}T00:00:00.000Z`
    );

    if (filters.aggregation === "monthly") {
      date.setUTCMonth(date.getUTCMonth() + 1);
      period = date.toISOString().slice(0, 7);
    } else {
      date.setUTCDate(date.getUTCDate() + 1);
      period = date.toISOString().slice(0, 10);
    }

    return {
      date: period,
      predictedRevenue: decimalString(predictedRevenue),
      isEstimate: true,
    };
  });

  return { ...commonResponse, forecast };
}

export async function forecastProductDemand(filters: ProductForecastFilters) {
  await ensureDatasetExists(filters.datasetId);
  const { unit, format } = periodSettings(filters.aggregation);
  const conditions: Prisma.Sql[] = [];

  if (filters.datasetId) {
    conditions.push(Prisma.sql`"datasetId" = ${filters.datasetId}`);
  }
  if (filters.category) {
    conditions.push(
      Prisma.sql`LOWER(BTRIM("category")) = LOWER(BTRIM(${filters.category}))`
    );
  }
  if (filters.productName) {
    conditions.push(
      Prisma.sql`POSITION(LOWER(${filters.productName}) IN LOWER(BTRIM("productName"))) > 0`
    );
  }
  if (filters.startDate) {
    conditions.push(Prisma.sql`"saleDate" >= ${filters.startDate}`);
  }
  if (filters.endDate) {
    conditions.push(Prisma.sql`"saleDate" <= ${filters.endDate}`);
  }

  const where = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<ProductPeriodRow[]>(Prisma.sql`
    SELECT
      MIN(BTRIM("productName")) AS "productName",
      MIN(BTRIM("category")) AS "category",
      TO_CHAR(DATE_TRUNC(${unit}, "saleDate"), ${format}) AS "period",
      SUM("quantity")::bigint AS "quantity"
    FROM "SalesRecord"
    ${where}
    GROUP BY LOWER(BTRIM("productName")), DATE_TRUNC(${unit}, "saleDate")
    ORDER BY LOWER(BTRIM("productName")), DATE_TRUNC(${unit}, "saleDate")
  `);

  const grouped = new Map<
    string,
    { productName: string; category: string; observations: NumericObservation[] }
  >();

  for (const row of rows) {
    const key = row.productName.toLocaleLowerCase();
    const product = grouped.get(key) ?? {
      productName: row.productName,
      category: row.category,
      observations: [],
    };
    product.observations.push({
      period: row.period,
      value: Number(row.quantity),
    });
    grouped.set(key, product);
  }

  const ranked = [...grouped.values()]
    .map((product) => ({
      ...product,
      totalObservedQuantity: product.observations.reduce(
        (total, observation) => total + observation.value,
        0
      ),
    }))
    .sort(
      (a, b) =>
        b.totalObservedQuantity - a.totalObservedQuantity ||
        a.productName.localeCompare(b.productName)
    )
    .slice(0, filters.topN);

  const forecasts: Array<{
    productName: string;
    category: string;
    predictedDemand: number;
    forecasts: Array<{ period: string; predictedQuantity: number }>;
  }> = [];
  const insufficientProducts: Array<{
    productName: string;
    observedPeriods: number;
    reason: string;
  }> = [];

  for (const product of ranked) {
    const complete = completeCalendarSeries(
      product.observations,
      filters.aggregation
    );
    const predictions =
      product.observations.length >= 3
        ? linearRegressionForecast(
            complete.map((observation) => observation.value),
            filters.horizon
          )
        : undefined;

    if (!predictions) {
      insufficientProducts.push({
        productName: product.productName,
        observedPeriods: product.observations.length,
        reason: "At least three historical selling periods are required.",
      });
      continue;
    }

    let period = complete[complete.length - 1].period;
    const productForecast = predictions.map((predictedQuantity) => {
      const date = new Date(
        `${filters.aggregation === "monthly" ? `${period}-01` : period}T00:00:00.000Z`
      );

      if (filters.aggregation === "monthly") {
        date.setUTCMonth(date.getUTCMonth() + 1);
        period = date.toISOString().slice(0, 7);
      } else {
        date.setUTCDate(date.getUTCDate() + 1);
        period = date.toISOString().slice(0, 10);
      }

      return {
        period,
        predictedQuantity: roundedQuantity(predictedQuantity),
      };
    });

    forecasts.push({
      productName: product.productName,
      category: product.category,
      predictedDemand: productForecast.reduce(
        (sum, item) => sum + item.predictedQuantity,
        0
      ),
      forecasts: productForecast,
    });
  }

  forecasts.sort(
    (a, b) =>
      b.predictedDemand - a.predictedDemand ||
      a.productName.localeCompare(b.productName)
  );

  return {
    ...(filters.datasetId ? { datasetId: filters.datasetId } : {}),
    aggregation: filters.aggregation,
    horizon: filters.horizon,
    topN: filters.topN,
    method: "linear_regression",
    forecastStatus: forecasts.length > 0 ? "forecasted" : "insufficient_data",
    products: forecasts,
    insufficientProducts,
    limitations:
      "Forecasts are based on recorded product sales and a linear trend. Missing product-sales periods between that product's first and last recorded sales are treated as zero recorded demand. The model does not account for inventory availability, stockouts, seasonality, promotions, or external factors.",
  };
}

export async function evaluateRevenueForecast(filters: EvaluationFilters) {
  const rows = await getSalesPeriods(filters);
  const observed: NumericObservation[] = rows.map((row) => ({
    period: row.period,
    value: Number(row.revenue.toString()),
  }));
  const complete = completeCalendarSeries(observed, filters.aggregation);
  const evaluation = evaluateLinearRegression(complete);
  const { status: evaluationStatus, ...evaluationMetrics } = evaluation;

  return {
    ...(filters.datasetId ? { datasetId: filters.datasetId } : {}),
    aggregation: filters.aggregation,
    ...(filters.startDate
      ? { startDate: filters.startDate.toISOString().slice(0, 10) }
      : {}),
    ...(filters.endDate
      ? { endDate: filters.endDate.toISOString().slice(0, 10) }
      : {}),
    method: "linear_regression",
    evaluationMethod: "chronological_rolling_origin",
    trainingPolicy:
      "Each holdout prediction is trained only on preceding periods; the initial training window contains at least three periods.",
    historicalPeriods: complete.length,
    observedPeriods: observed.length,
    ...(complete.length
      ? {
          evaluationStart:
            complete[
              Math.max(3, Math.floor(complete.length * 0.7))
            ]?.period ?? null,
          evaluationEnd: complete[complete.length - 1].period,
        }
      : { evaluationStart: null, evaluationEnd: null }),
    evaluationStatus,
    ...evaluationMetrics,
    limitations:
      "Missing calendar periods between the first and last recorded periods represent zero recorded sales. Evaluation scores are not reported unless there are at least two chronological holdout predictions.",
  };
}
