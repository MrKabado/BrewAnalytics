export type RecommendationCategory =
  | "product_performance"
  | "revenue_improvement"
  | "product_demand"
  | "sales_trends"
  | "category_performance"
  | "marketing_analysis"

export type RecommendationPriority = "low" | "medium" | "high"
export type RecommendationBasis =
  "historical" | "forecast" | "historical_and_forecast"

export type BusinessRecommendation = {
  id: string
  title: string
  category: RecommendationCategory
  priority: RecommendationPriority
  recommendation: string
  explanation: string
  evidence: Record<string, string | number>
  datasetId: string | null
  basis: RecommendationBasis
}

export type RecommendationsResponse = {
  status: "success"
  datasetId: string | null
  aggregation: "daily" | "monthly"
  recommendationCount: number
  message?: string
  recommendations: BusinessRecommendation[]
  notes: string[]
}

export type RecommendationSummaryResponse = {
  status: "success"
  datasetId: string | null
  total: number
  byCategory: Partial<Record<RecommendationCategory, number>>
  byPriority: Record<RecommendationPriority, number>
}
