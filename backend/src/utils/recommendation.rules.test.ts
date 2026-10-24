import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateRecommendations,
  summarizeRecommendations,
  type RecommendationInputs,
} from "./recommendation.rules";

function recommendationInputs(): RecommendationInputs {
  return {
    datasetId: "dataset-a",
    periods: [
      { period: "2026-01", revenue: 200, unitsSold: 20 },
      { period: "2026-02", revenue: 220, unitsSold: 22 },
      { period: "2026-03", revenue: 90, unitsSold: 9 },
      { period: "2026-04", revenue: 80, unitsSold: 8 },
    ],
    productsByQuantity: [
      {
        productName: "Latte",
        category: "Drinks",
        quantitySold: 40,
        totalRevenue: "200.00",
      },
      {
        productName: "Mocha",
        category: "Drinks",
        quantitySold: 10,
        totalRevenue: "50.00",
      },
    ],
    productsByRevenue: [
      {
        productName: "Latte",
        category: "Drinks",
        quantitySold: 40,
        totalRevenue: "200.00",
      },
    ],
    categories: [
      {
        category: "Drinks",
        revenue: "300.00",
        unitsSold: 50,
        salesRecordCount: 40,
        revenuePercentage: "75.00",
      },
      {
        category: "Food",
        revenue: "100.00",
        unitsSold: 12,
        salesRecordCount: 10,
        revenuePercentage: "25.00",
      },
    ],
    productPeriods: [
      { productName: "Latte", category: "Drinks", period: "2026-01", quantity: 20 },
      { productName: "Latte", category: "Drinks", period: "2026-02", quantity: 20 },
      { productName: "Latte", category: "Drinks", period: "2026-03", quantity: 9 },
      { productName: "Latte", category: "Drinks", period: "2026-04", quantity: 8 },
      { productName: "Mocha", category: "Drinks", period: "2026-01", quantity: 5 },
    ],
    categoryPeriods: [
      { category: "Drinks", period: "2026-01", revenue: 100, unitsSold: 20 },
      { category: "Drinks", period: "2026-02", revenue: 100, unitsSold: 20 },
      { category: "Drinks", period: "2026-03", revenue: 40, unitsSold: 8 },
      { category: "Drinks", period: "2026-04", revenue: 40, unitsSold: 8 },
    ],
    productForecasts: [
      {
        productName: "Latte",
        category: "Drinks",
        predictedDemand: 30,
        forecasts: [
          { period: "2026-05", predictedQuantity: 15 },
          { period: "2026-06", predictedQuantity: 15 },
        ],
      },
    ],
    aggregation: "monthly",
  };
}

describe("business recommendation rules", () => {
  it("recommends high-performing products with historical supporting metrics", () => {
    const recommendations = generateRecommendations(recommendationInputs());
    const highPerformer = recommendations.find(
      (item) => item.title === "Maintain visibility for Latte"
    );

    assert.ok(highPerformer);
    assert.equal(highPerformer.category, "product_performance");
    assert.equal(highPerformer.priority, "medium");
    assert.equal(highPerformer.basis, "historical");
    assert.equal(highPerformer.datasetId, "dataset-a");
    assert.equal(highPerformer.evidence.rankByUnits, 1);
    assert.equal(highPerformer.evidence.recordedRevenue, "200.00");
  });

  it("identifies product and overall revenue declines across comparable periods", () => {
    const recommendations = generateRecommendations(recommendationInputs());
    const productDecline = recommendations.find((item) =>
      item.title.includes("sales decline for Latte")
    );
    const revenueDecline = recommendations.find((item) =>
      item.title.includes("revenue decline")
    );

    assert.ok(productDecline);
    assert.equal(productDecline.evidence.thresholdPercent, -20);
    assert.ok(Number(productDecline.evidence.changePercent) <= -20);
    assert.ok(revenueDecline);
    assert.equal(revenueDecline.category, "revenue_improvement");
    assert.equal(revenueDecline.priority, "high");
  });

  it("identifies significant category revenue concentration without claiming profit", () => {
    const recommendations = generateRecommendations(recommendationInputs());
    const category = recommendations.find(
      (item) => item.category === "category_performance"
    );

    assert.ok(category);
    assert.equal(category.evidence.revenueSharePercent, 75);
    assert.match(category.explanation, /not a measure of category profitability/);
  });

  it("identifies category revenue declines across comparable periods", () => {
    const recommendations = generateRecommendations(recommendationInputs());
    const categoryDecline = recommendations.find((item) =>
      item.title.includes("revenue trend for Drinks")
    );

    assert.ok(categoryDecline);
    assert.equal(categoryDecline.category, "category_performance");
    assert.ok(Number(categoryDecline.evidence.changePercent) <= -20);
    assert.equal(categoryDecline.evidence.previousAverageRevenue, 100);
  });

  it("generates forecast-based preparation advice without inventory assertions", () => {
    const recommendations = generateRecommendations(recommendationInputs());
    const demand = recommendations.find(
      (item) => item.category === "product_demand"
    );

    assert.ok(demand);
    assert.equal(demand.basis, "historical_and_forecast");
    assert.equal(demand.evidence.predictedTotalUnits, 30);
    assert.match(demand.explanation, /estimates/);
    assert.doesNotMatch(
      `${demand.recommendation} ${demand.explanation}`,
      /stockout|excess inventory|profitability/i
    );
  });

  it("does not trigger decline rules with insufficient history", () => {
    const inputs = recommendationInputs();
    inputs.periods = inputs.periods.slice(0, 3);
    inputs.productPeriods = inputs.productPeriods.slice(0, 3);
    inputs.productsByQuantity = [];
    inputs.productsByRevenue = [];
    inputs.categories = [];
    inputs.productForecasts = [];
    inputs.categoryPeriods = [];

    assert.deepEqual(generateRecommendations(inputs), []);
  });

  it("deduplicates equivalent recommendation rules and stays deterministic", () => {
    const inputs = recommendationInputs();
    const first = generateRecommendations(inputs);
    const second = generateRecommendations(inputs);

    assert.deepEqual(first, second);
    assert.equal(new Set(first.map((item) => item.id)).size, first.length);
    assert.equal(
      first.filter((item) => item.title === "Maintain visibility for Latte")
        .length,
      1
    );
  });

  it("returns an empty list and zero summary for no observations", () => {
    const inputs = recommendationInputs();
    inputs.periods = [];
    inputs.productsByQuantity = [];
    inputs.productsByRevenue = [];
    inputs.categories = [];
    inputs.productPeriods = [];
    inputs.categoryPeriods = [];
    inputs.productForecasts = [];

    const recommendations = generateRecommendations(inputs);
    assert.deepEqual(recommendations, []);
    assert.deepEqual(summarizeRecommendations(recommendations), {
      total: 0,
      byCategory: {},
      byPriority: { high: 0, medium: 0, low: 0 },
    });
  });

  it("summarizes counts by recommendation category and priority", () => {
    const summary = summarizeRecommendations(
      generateRecommendations(recommendationInputs())
    );

    assert.ok(summary.total > 0);
    assert.ok(summary.byCategory.product_performance);
    assert.ok(summary.byPriority.high > 0);
  });
});
