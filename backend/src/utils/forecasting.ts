import type { SalesAggregation } from "./analytics.query";

export interface NumericObservation {
  period: string;
  value: number;
}

export interface CompleteObservation extends NumericObservation {
  isImputedZero: boolean;
}

export const MIN_TRAINING_OBSERVATIONS = 3;
export const MIN_EVALUATION_OBSERVATIONS = 2;

function dateForPeriod(period: string, aggregation: SalesAggregation): Date {
  const date = aggregation === "monthly" ? `${period}-01` : period;
  return new Date(`${date}T00:00:00.000Z`);
}

function periodForDate(date: Date, aggregation: SalesAggregation): string {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");

  if (aggregation === "monthly") {
    return `${year}-${month}`;
  }

  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nextPeriod(
  period: string,
  aggregation: SalesAggregation,
  steps = 1
): string {
  const date = dateForPeriod(period, aggregation);

  if (aggregation === "monthly") {
    date.setUTCMonth(date.getUTCMonth() + steps);
  } else {
    date.setUTCDate(date.getUTCDate() + steps);
  }

  return periodForDate(date, aggregation);
}

export function completeCalendarSeries(
  observations: NumericObservation[],
  aggregation: SalesAggregation
): CompleteObservation[] {
  if (observations.length === 0) {
    return [];
  }

  const sorted = [...observations].sort((a, b) =>
    a.period.localeCompare(b.period)
  );
  const values = new Map(sorted.map((item) => [item.period, item.value]));
  const series: CompleteObservation[] = [];

  for (
    let period = sorted[0].period;
    period <= sorted[sorted.length - 1].period;
    period = nextPeriod(period, aggregation)
  ) {
    const value = values.get(period);
    series.push({
      period,
      value: value ?? 0,
      isImputedZero: value === undefined,
    });
  }

  return series;
}

export function linearRegressionForecast(
  values: number[],
  horizon: number,
  minimumObservations = MIN_TRAINING_OBSERVATIONS
): number[] | undefined {
  if (
    values.length < minimumObservations ||
    values.some((value) => !Number.isFinite(value))
  ) {
    return undefined;
  }

  const count = values.length;
  const meanX = (count - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / count;
  let covariance = 0;
  let variance = 0;

  for (let index = 0; index < count; index += 1) {
    const deltaX = index - meanX;
    covariance += deltaX * (values[index] - meanY);
    variance += deltaX * deltaX;
  }

  const slope = variance === 0 ? 0 : covariance / variance;
  const intercept = meanY - slope * meanX;

  return Array.from({ length: horizon }, (_, index) =>
    Math.max(0, intercept + slope * (count + index))
  );
}

export function evaluateLinearRegression(
  observations: NumericObservation[]
) {
  const actual = observations.map((item) => item.value);
  const firstForecastIndex = Math.max(
    MIN_TRAINING_OBSERVATIONS,
    Math.floor(actual.length * 0.7)
  );
  const regressionErrors: number[] = [];
  const baselineErrors: number[] = [];

  for (let index = firstForecastIndex; index < actual.length; index += 1) {
    const prediction = linearRegressionForecast(
      actual.slice(0, index),
      1
    )?.[0];

    if (prediction === undefined) {
      continue;
    }

    regressionErrors.push(prediction - actual[index]);
    baselineErrors.push(actual[index - 1] - actual[index]);
  }

  if (regressionErrors.length < MIN_EVALUATION_OBSERVATIONS) {
    return {
      status: "insufficient_data" as const,
      evaluationObservations: regressionErrors.length,
      meanAbsoluteError: null,
      rootMeanSquaredError: null,
      baseline: {
        method: "previous_period",
        meanAbsoluteError: null,
        rootMeanSquaredError: null,
      },
      message:
        "At least two chronological holdout observations are required to report evaluation metrics.",
    };
  }

  const mae = (errors: number[]) =>
    errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length;
  const rmse = (errors: number[]) =>
    Math.sqrt(
      errors.reduce((sum, error) => sum + error * error, 0) / errors.length
    );
  const round = (value: number) => Number(value.toFixed(2));

  return {
    status: "evaluated" as const,
    evaluationObservations: regressionErrors.length,
    meanAbsoluteError: round(mae(regressionErrors)),
    rootMeanSquaredError: round(rmse(regressionErrors)),
    baseline: {
      method: "previous_period",
      meanAbsoluteError: round(mae(baselineErrors)),
      rootMeanSquaredError: round(rmse(baselineErrors)),
    },
  };
}
