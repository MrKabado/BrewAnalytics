import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../lib/prisma";
import {
  getCategoryPerformance,
  getProductPerformance,
  getSalesTrends,
} from "./analytics.service";
import { forecastProductDemand } from "./forecast.service";
import { completeCalendarSeries } from "../utils/forecasting";
import type { EvaluationFilters } from "../utils/forecast.query";
import { getCampaignPeriodAnalytics } from "./business-analytics.service";
import {
  generateRecommendations,
  summarizeRecommendations,
  type CategoryPeriodMetric,
  type ProductPeriodMetric,
  type Recommendation,
} from "../utils/recommendation.rules";

interface ProductPeriodRow {
  productName: string;
  category: string;
  period: string;
  quantity: bigint;
}

interface CategoryPeriodRow {
  category: string;
  period: string;
  revenue: Prisma.Decimal;
  unitsSold: bigint;
}

function periodSettings(aggregation: "daily" | "monthly") {
  return aggregation === "monthly"
    ? {
        truncatedDate: Prisma.sql`DATE_TRUNC('month', "saleDate")`,
        format: "YYYY-MM",
      }
    : {
        truncatedDate: Prisma.sql`DATE_TRUNC('day', "saleDate")`,
        format: "YYYY-MM-DD",
      };
}

async function getProductPeriodMetrics(filters: EvaluationFilters) {
  const conditions: Prisma.Sql[] = [];

  if (filters.datasetId) {
    conditions.push(Prisma.sql`"datasetId" = ${filters.datasetId}`);
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
  const { truncatedDate, format } = periodSettings(filters.aggregation);
  const rows = await prisma.$queryRaw<ProductPeriodRow[]>(Prisma.sql`
    SELECT
      MIN(BTRIM("productName")) AS "productName",
      MIN(BTRIM("category")) AS "category",
      TO_CHAR(${truncatedDate}, ${format}) AS "period",
      SUM("quantity")::bigint AS "quantity"
    FROM "SalesRecord"
    ${where}
    GROUP BY LOWER(BTRIM("productName")), ${truncatedDate}
    ORDER BY LOWER(BTRIM("productName")), ${truncatedDate}
  `);

  const byProduct = new Map<string, ProductPeriodRow[]>();
  for (const row of rows) {
    const key = row.productName.toLowerCase();
    const entries = byProduct.get(key) ?? [];
    entries.push(row);
    byProduct.set(key, entries);
  }

  const result: ProductPeriodMetric[] = [];
  for (const productRows of byProduct.values()) {
    const series = completeCalendarSeries(
      productRows.map((row) => ({
        period: row.period,
        value: Number(row.quantity),
      })),
      filters.aggregation
    );
    const { productName, category } = productRows[0];
    result.push(
      ...series.map((period) => ({
        productName,
        category,
        period: period.period,
        quantity: period.value,
      }))
    );
  }

  return result;
}

async function getCategoryPeriodMetrics(filters: EvaluationFilters) {
  const conditions: Prisma.Sql[] = [];

  if (filters.datasetId) {
    conditions.push(Prisma.sql`"datasetId" = ${filters.datasetId}`);
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
  const { truncatedDate, format } = periodSettings(filters.aggregation);
  const rows = await prisma.$queryRaw<CategoryPeriodRow[]>(Prisma.sql`
    SELECT
      MIN(BTRIM("category")) AS "category",
      TO_CHAR(${truncatedDate}, ${format}) AS "period",
      SUM("totalAmount")::numeric AS "revenue",
      SUM("quantity")::bigint AS "unitsSold"
    FROM "SalesRecord"
    ${where}
    GROUP BY LOWER(BTRIM("category")), ${truncatedDate}
    ORDER BY LOWER(BTRIM("category")), ${truncatedDate}
  `);

  const byCategory = new Map<string, CategoryPeriodRow[]>();
  for (const row of rows) {
    const key = row.category.toLowerCase();
    const entries = byCategory.get(key) ?? [];
    entries.push(row);
    byCategory.set(key, entries);
  }

  const result: CategoryPeriodMetric[] = [];
  for (const categoryRows of byCategory.values()) {
    const series = completeCalendarSeries(
      categoryRows.map((row) => ({
        period: row.period,
        value: Number(row.revenue.toString()),
      })),
      filters.aggregation
    );
    const { category } = categoryRows[0];
    const byPeriod = new Map(
      categoryRows.map((row) => [
        row.period,
        Number(row.unitsSold),
      ])
    );
    result.push(
      ...series.map((period) => ({
        category,
        period: period.period,
        revenue: period.value,
        unitsSold: byPeriod.get(period.period) ?? 0,
      }))
    );
  }

  return result;
}

export interface RecommendationFilters extends EvaluationFilters {}

export async function getBusinessRecommendations(
  filters: RecommendationFilters
): Promise<Recommendation[]> {
  const productFilters = {
    ...filters,
    horizon: filters.aggregation === "monthly" ? 6 : 7,
    topN: 100,
  };
  const [salesTrend, productPerformance, categoryPerformance, productForecast, productPeriods, categoryPeriods, campaignAnalytics] =
    await Promise.all([
      getSalesTrends(filters),
      getProductPerformance({ ...filters, topN: 100 }),
      getCategoryPerformance(filters),
      forecastProductDemand(productFilters),
      getProductPeriodMetrics(filters),
      getCategoryPeriodMetrics(filters),
      getCampaignPeriodAnalytics(filters.datasetId, false),
    ]);
  const salesPeriods = completeCalendarSeries(
    salesTrend.trends.map((trend) => ({
      period: trend.period,
      value: Number(trend.revenue),
    })),
    filters.aggregation
  );

  return generateRecommendations({
    ...filters,
    periods: salesPeriods.map((period) => ({
      period: period.period,
      revenue: period.value,
      unitsSold:
        salesTrend.trends.find((trend) => trend.period === period.period)
          ?.unitsSold ?? 0,
    })),
    productsByQuantity: productPerformance.bestSellingProducts,
    productsByRevenue: productPerformance.topRevenueProducts,
    categories: categoryPerformance.categories,
    productPeriods,
    categoryPeriods,
    productForecasts: productForecast.products,
    campaignPeriods: campaignAnalytics.campaigns
      .filter((campaign) => {
        const startDate = campaign.startDate;
        const endDate = campaign.endDate;
        return (
          (!filters.startDate ||
            endDate >= filters.startDate.toISOString().slice(0, 10)) &&
          (!filters.endDate ||
            startDate <= filters.endDate.toISOString().slice(0, 10))
        );
      })
      .map((campaign) => ({
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        activePeriodDays: campaign.activePeriod.days,
        priorPeriodCovered:
          campaign.priorComparablePeriod.coveredByObservedHistory,
        priorPeriodRevenue: Number(campaign.priorComparablePeriod.revenue),
        activePeriodRevenue: Number(campaign.activePeriod.revenue),
        activePeriodTransactions:
          campaign.activePeriod.distinctTransactions,
        explicitlyLinkedSalesRecords:
          campaign.explicitCampaignLinkedSales.salesRecordCount,
      })),
  });
}

export async function getBusinessRecommendationSummary(
  filters: RecommendationFilters
) {
  const recommendations = await getBusinessRecommendations(filters);
  return summarizeRecommendations(recommendations);
}
