import { parseEvaluationFilters } from "./forecast.query";

export function parseRecommendationFilters(query: Record<string, unknown>) {
  return parseEvaluationFilters({
    ...query,
    aggregation: query.aggregation ?? "monthly",
  });
}
