import { apiRequest } from "@/lib/api-client"
import type {
  RecommendationSummaryResponse,
  RecommendationsResponse,
} from "@/lib/recommendation-types"

function createQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const encoded = query.toString()
  return encoded ? `?${encoded}` : ""
}

export type RecommendationFilters = {
  datasetId?: string
  aggregation: "daily" | "monthly"
}

export function getRecommendations(filters: RecommendationFilters) {
  return apiRequest<RecommendationsResponse>(
    `/api/analytics/recommendations${createQuery({
      datasetId: filters.datasetId,
      aggregation: filters.aggregation,
    })}`,
  )
}

export function getRecommendationSummary(filters: RecommendationFilters) {
  return apiRequest<RecommendationSummaryResponse>(
    `/api/analytics/recommendations/summary${createQuery({
      datasetId: filters.datasetId,
      aggregation: filters.aggregation,
    })}`,
  )
}
