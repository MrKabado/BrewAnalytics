export type ForecastAggregation = "daily" | "monthly"

export type HistoricalRevenueObservation = {
  period: string
  revenue: string
  isImputedZero: boolean
}

export type RevenueForecastPoint = {
  date: string
  predictedRevenue: string
  isEstimate: boolean
}

export type SalesForecastResponse = {
  status: "success"
  datasetId?: string
  aggregation: ForecastAggregation
  horizon: number
  method: string
  forecastStatus: "forecasted" | "insufficient_data"
  historicalObservations: HistoricalRevenueObservation[]
  forecast: RevenueForecastPoint[]
  limitations: string
  message?: string
}

export type ProductForecastPoint = {
  period: string
  predictedQuantity: number
}

export type ProductForecast = {
  productName: string
  category: string
  predictedDemand: number
  forecasts: ProductForecastPoint[]
  historicalObservations: Array<{
    period: string
    quantity: number
    isImputedZero: boolean
  }>
}

export type InsufficientProductForecast = {
  productName: string
  observedPeriods: number
  reason: string
}

export type ProductForecastResponse = {
  status: "success"
  datasetId?: string
  aggregation: ForecastAggregation
  horizon: number
  topN: number
  method: string
  forecastStatus: "forecasted" | "insufficient_data"
  products: ProductForecast[]
  insufficientProducts: InsufficientProductForecast[]
  limitations: string
}

export type ForecastEvaluationResponse = {
  status: "success"
  datasetId?: string
  aggregation: ForecastAggregation
  startDate?: string
  endDate?: string
  method: string
  evaluationMethod: string
  trainingPolicy: string
  historicalPeriods: number
  observedPeriods: number
  evaluationStart: string | null
  evaluationEnd: string | null
  evaluationStatus: "evaluated" | "insufficient_data"
  evaluationObservations: number
  meanAbsoluteError: number | null
  rootMeanSquaredError: number | null
  baseline: {
    method: string
    meanAbsoluteError: number | null
    rootMeanSquaredError: number | null
  }
  message?: string
  limitations: string
}
