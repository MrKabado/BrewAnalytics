import { createHash } from "node:crypto";
import { completeCalendarSeries } from "./forecasting";

export const RECOMMENDATION_RULES = {
  comparisonPeriods: 2,
  minimumPeriodsForComparison: 4,
  minimumPriorValue: 5,
  declinePercent: 20,
  significantCategorySharePercent: 40,
  meaningfulForecastChangePercent: 20,
  maximumHighPerformers: 3,
} as const;

export type RecommendationCategory =
  | "product_performance"
  | "revenue_improvement"
  | "product_demand"
  | "sales_trends"
  | "category_performance";

export type RecommendationPriority = "low" | "medium" | "high";
export type RecommendationBasis = "historical" | "forecast" | "historical_and_forecast";

export interface Recommendation {
  id: string;
  title: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  recommendation: string;
  explanation: string;
  evidence: Record<string, string | number>;
  datasetId: string | null;
  basis: RecommendationBasis;
}

export interface PeriodMetric {
  period: string;
  revenue: number;
  unitsSold: number;
}

export interface ProductMetric {
  productName: string;
  category?: string;
  quantitySold: number;
  totalRevenue: string;
}

export interface CategoryMetric {
  category: string;
  revenue: string;
  unitsSold: number;
  salesRecordCount: number;
  revenuePercentage: string;
}

export interface ProductPeriodMetric {
  productName: string;
  category: string;
  period: string;
  quantity: number;
}

export interface CategoryPeriodMetric {
  category: string;
  period: string;
  revenue: number;
  unitsSold: number;
}

export interface ProductForecastMetric {
  productName: string;
  category: string;
  predictedDemand: number;
  forecasts: Array<{ period: string; predictedQuantity: number }>;
}

export interface RecommendationInputs {
  datasetId?: string;
  periods: PeriodMetric[];
  productsByQuantity: ProductMetric[];
  productsByRevenue: ProductMetric[];
  categories: CategoryMetric[];
  productPeriods: ProductPeriodMetric[];
  categoryPeriods: CategoryPeriodMetric[];
  productForecasts: ProductForecastMetric[];
  aggregation: "daily" | "monthly";
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function percentChange(previous: number, current: number) {
  return ((current - previous) / previous) * 100;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stableId(rule: string, subject: string, datasetId?: string) {
  const key = `${rule}:${datasetId ?? "all"}:${subject.trim().toLowerCase()}`;
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 16);
  return `rec_${digest}`;
}

function buildRecommendation(
  inputs: RecommendationInputs,
  recommendation: Omit<Recommendation, "id" | "datasetId">
): Recommendation {
  return {
    ...recommendation,
    id: stableId(
      recommendation.title,
      String(recommendation.evidence.subject ?? recommendation.category),
      inputs.datasetId
    ),
    datasetId: inputs.datasetId ?? null,
  };
}

function chronologicalPeriods(periods: PeriodMetric[]) {
  return [...periods].sort((a, b) => a.period.localeCompare(b.period));
}

function compareTwoPeriodBlocks(values: number[]) {
  const count = RECOMMENDATION_RULES.comparisonPeriods;
  const prior = values.slice(-count * 2, -count);
  const recent = values.slice(-count);

  if (prior.length !== count || recent.length !== count) {
    return undefined;
  }

  const previousValue = average(prior);
  const currentValue = average(recent);

  if (previousValue < RECOMMENDATION_RULES.minimumPriorValue) {
    return undefined;
  }

  return {
    previousValue,
    currentValue,
    changePercent: percentChange(previousValue, currentValue),
  };
}

export function generateRecommendations(
  inputs: RecommendationInputs
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const periods = chronologicalPeriods(inputs.periods);

  if (periods.length >= RECOMMENDATION_RULES.minimumPeriodsForComparison) {
    const comparison = compareTwoPeriodBlocks(
      periods.map((period) => period.revenue)
    );

    if (
      comparison &&
      comparison.changePercent <= -RECOMMENDATION_RULES.declinePercent
    ) {
      const priorPeriods = periods.slice(-4, -2);
      const recentPeriods = periods.slice(-2);
      recommendations.push(
        buildRecommendation(inputs, {
          title: "Review the recent revenue decline",
          category: "revenue_improvement",
          priority: comparison.changePercent <= -40 ? "high" : "medium",
          recommendation:
            "Review recent pricing, promotion, and product-placement decisions against the prior comparable periods.",
          explanation:
            "Average recorded revenue declined across the two most recent periods compared with the preceding two periods. This is an observed association, not evidence of a specific cause.",
          evidence: {
            subject: "overall_revenue",
            comparisonPeriods: `${priorPeriods[0].period} to ${priorPeriods[1].period} vs ${recentPeriods[0].period} to ${recentPeriods[1].period}`,
            previousAverageRevenue: round(comparison.previousValue),
            recentAverageRevenue: round(comparison.currentValue),
            changePercent: round(comparison.changePercent),
            thresholdPercent: -RECOMMENDATION_RULES.declinePercent,
          },
          basis: "historical",
        })
      );
    }
  }

  const highPerformers = new Map<
    string,
    { product: ProductMetric; rankByUnits?: number; rankByRevenue?: number }
  >();
  for (const [index, product] of inputs.productsByQuantity
    .slice(0, RECOMMENDATION_RULES.maximumHighPerformers)
    .entries()) {
    const key = product.productName.toLowerCase();
    highPerformers.set(key, {
      product,
      rankByUnits: index + 1,
      rankByRevenue: highPerformers.get(key)?.rankByRevenue,
    });
  }
  for (const [index, product] of inputs.productsByRevenue
    .slice(0, RECOMMENDATION_RULES.maximumHighPerformers)
    .entries()) {
    const key = product.productName.toLowerCase();
    highPerformers.set(key, {
      product: highPerformers.get(key)?.product ?? product,
      rankByUnits: highPerformers.get(key)?.rankByUnits,
      rankByRevenue: index + 1,
    });
  }

  for (const { product, rankByUnits, rankByRevenue } of highPerformers.values()) {
    recommendations.push(
      buildRecommendation(inputs, {
        title: `Maintain visibility for ${product.productName}`,
        category: "product_performance",
        priority: "medium",
        recommendation:
          "Consider preserving this product's visibility and reviewing its menu presentation while monitoring sales.",
        explanation:
          "This product ranks among the highest in recorded unit sales, revenue, or both. Revenue alone does not indicate profit or margin because cost data is unavailable.",
        evidence: {
          subject: product.productName,
          ...(rankByUnits ? { rankByUnits } : {}),
          ...(rankByRevenue ? { rankByRevenue } : {}),
          quantitySold: product.quantitySold,
          recordedRevenue: product.totalRevenue,
        },
        basis: "historical",
      })
    );
  }

  const productsByPeriod = new Map<string, ProductPeriodMetric[]>();
  for (const item of inputs.productPeriods) {
    const key = item.productName.toLowerCase();
    const values = productsByPeriod.get(key) ?? [];
    values.push(item);
    productsByPeriod.set(key, values);
  }

  for (const productPeriods of productsByPeriod.values()) {
    const sorted = [...productPeriods].sort((a, b) =>
      a.period.localeCompare(b.period)
    );
    if (sorted.length < RECOMMENDATION_RULES.minimumPeriodsForComparison) {
      continue;
    }

    const comparison = compareTwoPeriodBlocks(
      sorted.map((period) => period.quantity)
    );
    if (
      !comparison ||
      comparison.changePercent > -RECOMMENDATION_RULES.declinePercent
    ) {
      continue;
    }

    const product = sorted[0];
    recommendations.push(
      buildRecommendation(inputs, {
        title: `Review the sales decline for ${product.productName}`,
        category: "product_performance",
        priority: comparison.changePercent <= -40 ? "high" : "medium",
        recommendation:
          "Review the product's recent sales, placement, and promotion options before making assortment decisions.",
        explanation:
          "Average recorded units declined in the two most recent observed periods compared with the preceding two. Low or declining sales alone do not justify discontinuation.",
        evidence: {
          subject: product.productName,
          comparisonPeriods: `${sorted[sorted.length - 4].period} to ${sorted[sorted.length - 3].period} vs ${sorted[sorted.length - 2].period} to ${sorted[sorted.length - 1].period}`,
          previousAverageUnits: round(comparison.previousValue),
          recentAverageUnits: round(comparison.currentValue),
          changePercent: round(comparison.changePercent),
          thresholdPercent: -RECOMMENDATION_RULES.declinePercent,
        },
        basis: "historical",
      })
    );
  }

  for (const category of inputs.categories) {
    const revenueShare = Number(category.revenuePercentage);
    if (
      revenueShare < RECOMMENDATION_RULES.significantCategorySharePercent ||
      inputs.categories.length < 2
    ) {
      continue;
    }

    recommendations.push(
      buildRecommendation(inputs, {
        title: `Review revenue concentration in ${category.category}`,
        category: "category_performance",
        priority: revenueShare >= 60 ? "high" : "medium",
        recommendation:
          "Review the category's product mix and consider whether menu placement or targeted promotion aligns with business goals.",
        explanation:
          "This category contributes a substantial share of recorded revenue. Revenue share is not a measure of category profitability.",
        evidence: {
          subject: category.category,
          revenue: category.revenue,
          revenueSharePercent: round(revenueShare),
          unitsSold: category.unitsSold,
          salesRecordCount: category.salesRecordCount,
          thresholdPercent: RECOMMENDATION_RULES.significantCategorySharePercent,
        },
        basis: "historical",
      })
    );
  }

  const categoryPeriodMap = new Map<string, CategoryPeriodMetric[]>();
  for (const item of inputs.categoryPeriods) {
    const key = item.category.toLowerCase();
    const values = categoryPeriodMap.get(key) ?? [];
    values.push(item);
    categoryPeriodMap.set(key, values);
  }

  for (const categoryPeriods of categoryPeriodMap.values()) {
    const sorted = [...categoryPeriods].sort((a, b) =>
      a.period.localeCompare(b.period)
    );
    if (sorted.length < RECOMMENDATION_RULES.minimumPeriodsForComparison) {
      continue;
    }

    const comparison = compareTwoPeriodBlocks(
      sorted.map((period) => period.revenue)
    );
    if (
      !comparison ||
      comparison.changePercent > -RECOMMENDATION_RULES.declinePercent
    ) {
      continue;
    }

    const category = sorted[0].category;
    recommendations.push(
      buildRecommendation(inputs, {
        title: `Review the revenue trend for ${category}`,
        category: "category_performance",
        priority: comparison.changePercent <= -40 ? "high" : "medium",
        recommendation:
          "Review the category's product mix and consider whether targeted placement or promotions merit testing.",
        explanation:
          "Average recorded category revenue declined across two comparable period blocks. This trend does not establish a cause or category profitability.",
        evidence: {
          subject: category,
          comparisonPeriods: `${sorted[sorted.length - 4].period} to ${sorted[sorted.length - 3].period} vs ${sorted[sorted.length - 2].period} to ${sorted[sorted.length - 1].period}`,
          previousAverageRevenue: round(comparison.previousValue),
          recentAverageRevenue: round(comparison.currentValue),
          changePercent: round(comparison.changePercent),
          thresholdPercent: -RECOMMENDATION_RULES.declinePercent,
        },
        basis: "historical",
      })
    );
  }

  const observedProductMeans = new Map<string, number>();
  for (const [key, records] of productsByPeriod) {
    const sorted = [...records].sort((a, b) =>
      a.period.localeCompare(b.period)
    );
    const complete = completeCalendarSeries(
      sorted.map((item) => ({ period: item.period, value: item.quantity })),
      inputs.aggregation
    );
    const recent = complete.slice(-3);
    if (recent.length === 3) {
      observedProductMeans.set(
        key,
        average(recent.map((item) => item.value))
      );
    }
  }

  for (const product of inputs.productForecasts) {
    const baseline = observedProductMeans.get(product.productName.toLowerCase());
    if (baseline === undefined || baseline <= 0) {
      continue;
    }

    const forecastMean =
      product.forecasts.reduce(
        (sum, item) => sum + item.predictedQuantity,
        0
      ) / product.forecasts.length;

    if (product.forecasts.length === 0) {
      continue;
    }

    const change = percentChange(baseline, forecastMean);
    if (Math.abs(change) < RECOMMENDATION_RULES.meaningfulForecastChangePercent) {
      continue;
    }

    const increasing = change > 0;
    recommendations.push(
      buildRecommendation(inputs, {
        title: `${increasing ? "Prepare for higher" : "Review lower"} expected demand for ${product.productName}`,
        category: "product_demand",
        priority: Math.abs(change) >= 40 ? "high" : "medium",
        recommendation: increasing
          ? "Review preparation plans against the forecast and monitor actual sales as they arrive."
          : "Review preparation assumptions for this product and compare upcoming actual sales with the forecast.",
        explanation: `The predicted average demand differs from the recent historical average by ${round(change)}%. Predictions are estimates and do not establish inventory shortages or excess stock.`,
        evidence: {
          subject: product.productName,
          recentAverageUnitsPerPeriod: round(baseline),
          forecastAverageUnitsPerPeriod: round(forecastMean),
          forecastHorizon: product.forecasts.length,
          predictedTotalUnits: product.predictedDemand,
          changePercent: round(change),
          thresholdPercent: RECOMMENDATION_RULES.meaningfulForecastChangePercent,
        },
        basis: "historical_and_forecast",
      })
    );
  }

  const unique = new Map<string, Recommendation>();
  for (const recommendation of recommendations) {
    unique.set(recommendation.id, recommendation);
  }

  return [...unique.values()].sort(
    (a, b) =>
      priorityOrder(a.priority) - priorityOrder(b.priority) ||
      a.category.localeCompare(b.category) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id)
  );
}

function priorityOrder(priority: RecommendationPriority) {
  return priority === "high" ? 0 : priority === "medium" ? 1 : 2;
}

export function summarizeRecommendations(recommendations: Recommendation[]) {
  const byCategory: Partial<Record<RecommendationCategory, number>> = {};
  const byPriority: Record<RecommendationPriority, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const recommendation of recommendations) {
    byCategory[recommendation.category] =
      (byCategory[recommendation.category] ?? 0) + 1;
    byPriority[recommendation.priority] += 1;
  }

  return {
    total: recommendations.length,
    byCategory,
    byPriority,
  };
}
