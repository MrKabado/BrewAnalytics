import { apiRequest } from "@/lib/api-client"
import type {
  CategoryPerformanceResponse,
  ProductPerformanceResponse,
  SalesOverviewResponse,
  SalesTrendsResponse,
} from "@/lib/analytics-types"

function createQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const encoded = query.toString()
  return encoded ? `?${encoded}` : ""
}

export function getSalesOverview(datasetId?: string) {
  return apiRequest<SalesOverviewResponse>(
    `/api/analytics/overview${createQuery({ datasetId })}`,
  )
}

export function getProductPerformance(options: {
  datasetId?: string
  category?: string
  topN?: number
} = {}) {
  return apiRequest<ProductPerformanceResponse>(
    `/api/analytics/products${createQuery({
      datasetId: options.datasetId,
      category: options.category,
      topN: options.topN === undefined ? undefined : String(options.topN),
    })}`,
  )
}

export function getCategoryPerformance(datasetId?: string) {
  return apiRequest<CategoryPerformanceResponse>(
    `/api/analytics/categories${createQuery({ datasetId })}`,
  )
}

export function getSalesTrends(options: {
  datasetId?: string
  aggregation: "daily" | "monthly"
  startDate?: string
  endDate?: string
}) {
  return apiRequest<SalesTrendsResponse>(
    `/api/analytics/sales-trends${createQuery({
      datasetId: options.datasetId,
      aggregation: options.aggregation,
      startDate: options.startDate,
      endDate: options.endDate,
    })}`,
  )
}
