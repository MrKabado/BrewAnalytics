import { apiRequest } from "@/lib/api-client"
import type {
  ForecastAggregation,
  ForecastEvaluationResponse,
  ProductForecastResponse,
  SalesForecastResponse,
} from "@/lib/forecast-types"

function createQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const encoded = query.toString()
  return encoded ? `?${encoded}` : ""
}

export function getSalesForecast(options: {
  datasetId?: string
  aggregation: ForecastAggregation
  horizon: number
}) {
  return apiRequest<SalesForecastResponse>(
    `/api/analytics/forecasts/sales${createQuery({
      datasetId: options.datasetId,
      aggregation: options.aggregation,
      horizon: String(options.horizon),
    })}`,
  )
}

export function getProductForecast(options: {
  datasetId?: string
  aggregation: ForecastAggregation
  horizon: number
  topN?: number
  productName?: string
  category?: string
}) {
  return apiRequest<ProductForecastResponse>(
    `/api/analytics/forecasts/products${createQuery({
      datasetId: options.datasetId,
      aggregation: options.aggregation,
      horizon: String(options.horizon),
      topN: options.topN === undefined ? undefined : String(options.topN),
      productName: options.productName,
      category: options.category,
    })}`,
  )
}

export function getForecastEvaluation(options: {
  datasetId?: string
  aggregation: ForecastAggregation
}) {
  return apiRequest<ForecastEvaluationResponse>(
    `/api/analytics/forecasts/evaluation${createQuery({
      datasetId: options.datasetId,
      aggregation: options.aggregation,
    })}`,
  )
}
