import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRecommendationFilters } from "./recommendation.query";
import { DatasetValidationError } from "./dataset.validation";

describe("recommendation query validation", () => {
  it("defaults recommendations to monthly periods and supports dataset scope", () => {
    assert.deepEqual(parseRecommendationFilters({}), {
      aggregation: "monthly",
    });
    assert.deepEqual(
      parseRecommendationFilters({
        datasetId: "dataset-a",
        aggregation: "daily",
        startDate: "2026-01-01",
      }),
      {
        datasetId: "dataset-a",
        aggregation: "daily",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
      }
    );
  });

  it("rejects invalid dataset ID and date query shapes", () => {
    for (const query of [
      { datasetId: ["a", "b"] },
      { datasetId: " " },
      { aggregation: "yearly" },
      { startDate: "not-a-date" },
      { startDate: "2026-02-02", endDate: "2026-02-01" },
    ]) {
      assert.throws(
        () => parseRecommendationFilters(query),
        DatasetValidationError
      );
    }
  });
});
