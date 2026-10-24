import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completeCalendarSeries,
  evaluateLinearRegression,
  linearRegressionForecast,
  nextPeriod,
} from "./forecasting";

describe("forecasting calculations", () => {
  it("forecasts a daily linear trend and constrains negative revenue", () => {
    assert.deepEqual(linearRegressionForecast([10, 20, 30], 2), [40, 50]);
    assert.deepEqual(linearRegressionForecast([3, 2, 1], 2), [0, 0]);
  });

  it("forecasts monthly periods across calendar year boundaries", () => {
    assert.equal(nextPeriod("2026-12", "monthly"), "2027-01");
    assert.deepEqual(linearRegressionForecast([100, 200, 300], 2), [400, 500]);
  });

  it("fills only missing periods inside the observed range and marks zero-sales gaps", () => {
    assert.deepEqual(
      completeCalendarSeries(
        [
          { period: "2026-01-01", value: 10 },
          { period: "2026-01-03", value: 30 },
        ],
        "daily"
      ),
      [
        { period: "2026-01-01", value: 10, isImputedZero: false },
        { period: "2026-01-02", value: 0, isImputedZero: true },
        { period: "2026-01-03", value: 30, isImputedZero: false },
      ]
    );
  });

  it("uses chronological holdout and compares against previous-period baseline", () => {
    const evaluation = evaluateLinearRegression([
      { period: "2026-01", value: 10 },
      { period: "2026-02", value: 20 },
      { period: "2026-03", value: 30 },
      { period: "2026-04", value: 40 },
      { period: "2026-05", value: 50 },
    ]);

    assert.equal(evaluation.status, "evaluated");
    assert.equal(evaluation.evaluationObservations, 2);
    assert.equal(evaluation.meanAbsoluteError, 0);
    assert.equal(evaluation.rootMeanSquaredError, 0);
    assert.equal(evaluation.baseline.method, "previous_period");
    assert.equal(evaluation.baseline.meanAbsoluteError, 10);
  });

  it("does not report fabricated metrics for insufficient evaluation history", () => {
    const evaluation = evaluateLinearRegression([
      { period: "2026-01", value: 10 },
      { period: "2026-02", value: 20 },
      { period: "2026-03", value: 30 },
      { period: "2026-04", value: 40 },
    ]);

    assert.equal(evaluation.status, "insufficient_data");
    assert.equal(evaluation.meanAbsoluteError, null);
    assert.equal(evaluation.baseline.rootMeanSquaredError, null);
  });
});
