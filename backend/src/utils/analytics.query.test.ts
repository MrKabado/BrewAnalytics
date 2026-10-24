import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_ANALYTICS_TOP_N,
  MAX_ANALYTICS_TOP_N,
  parseAnalyticsFilters,
  parseProductFilters,
  parseSalesTrendFilters,
} from "./analytics.query";
import { DatasetValidationError } from "./dataset.validation";

describe("analytics query validation", () => {
  it("accepts optional dataset filters", () => {
    assert.deepEqual(parseAnalyticsFilters({}), {});
    assert.deepEqual(parseAnalyticsFilters({ datasetId: "ds_123" }), {
      datasetId: "ds_123",
    });
  });

  it("rejects malformed dataset IDs", () => {
    assert.throws(
      () => parseAnalyticsFilters({ datasetId: ["one", "two"] }),
      DatasetValidationError
    );
    assert.throws(
      () => parseAnalyticsFilters({ datasetId: " " }),
      DatasetValidationError
    );
  });

  it("uses default and bounded product top-N filters", () => {
    assert.equal(parseProductFilters({}).topN, DEFAULT_ANALYTICS_TOP_N);
    assert.deepEqual(parseProductFilters({ category: " Drinks ", topN: "25" }), {
      category: "Drinks",
      topN: 25,
    });
    assert.equal(
      parseProductFilters({ topN: String(MAX_ANALYTICS_TOP_N) }).topN,
      MAX_ANALYTICS_TOP_N
    );

    for (const topN of ["0", "-1", "1.2", "101", "nope"]) {
      assert.throws(
        () => parseProductFilters({ topN }),
        DatasetValidationError
      );
    }
  });

  it("accepts daily and monthly trends with inclusive ISO date filters", () => {
    const daily = parseSalesTrendFilters({
      datasetId: "ds_1",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    assert.equal(daily.aggregation, "daily");
    assert.equal(daily.startDate?.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(daily.endDate?.toISOString(), "2026-01-31T00:00:00.000Z");
    assert.equal(
      parseSalesTrendFilters({ aggregation: "monthly" }).aggregation,
      "monthly"
    );
  });

  it("rejects invalid aggregation and date filters", () => {
    for (const query of [
      { aggregation: "yearly" },
      { startDate: "2026/01/01" },
      { startDate: "2026-02-30" },
      { startDate: "2026-02-02", endDate: "2026-02-01" },
    ]) {
      assert.throws(
        () => parseSalesTrendFilters(query),
        DatasetValidationError
      );
    }
  });
});
