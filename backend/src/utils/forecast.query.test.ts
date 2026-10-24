import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseEvaluationFilters,
  parseForecastFilters,
  parseProductForecastFilters,
} from "./forecast.query";
import { DatasetValidationError } from "./dataset.validation";

describe("forecast query validation", () => {
  it("applies daily/monthly defaults and configurable horizons", () => {
    assert.deepEqual(parseForecastFilters({}), {
      aggregation: "daily",
      horizon: 7,
    });
    assert.deepEqual(
      parseForecastFilters({ aggregation: "monthly", horizon: "12" }),
      { aggregation: "monthly", horizon: 12 }
    );
  });

  it("parses product filters and evaluation scope", () => {
    assert.deepEqual(
      parseProductForecastFilters({
        datasetId: "dataset-a",
        productName: "Latte",
        category: "Drinks",
        aggregation: "monthly",
        horizon: "3",
        topN: "5",
      }),
      {
        datasetId: "dataset-a",
        productName: "Latte",
        category: "Drinks",
        aggregation: "monthly",
        horizon: 3,
        topN: 5,
      }
    );
    assert.deepEqual(
      parseEvaluationFilters({
        datasetId: "dataset-b",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      }),
      {
        datasetId: "dataset-b",
        aggregation: "daily",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-01-31T00:00:00.000Z"),
      }
    );
  });

  it("rejects invalid horizons, top-N, aggregation, dates, and repeated parameters", () => {
    for (const query of [
      { horizon: "0" },
      { horizon: "91" },
      { aggregation: "yearly" },
      { aggregation: "monthly", horizon: "37" },
      { startDate: "2026-02-30" },
      { startDate: "2026-02-02", endDate: "2026-02-01" },
      { datasetId: ["a", "b"] },
      { topN: "101" },
    ]) {
      assert.throws(
        () => parseProductForecastFilters(query),
        DatasetValidationError
      );
    }
  });
});
