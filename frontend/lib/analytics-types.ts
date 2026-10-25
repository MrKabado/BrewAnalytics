export type AnalyticsMetrics = {
  totalRevenue: string
  totalUnitsSold: number
  totalTransactions: number
  averageTransactionValue: string
  totalSalesRecords: number
}

export type SalesOverviewResponse = {
  status: "success"
  datasetId?: string
  metrics: AnalyticsMetrics
}

export type ProductPerformanceItem = {
  productName: string
  quantitySold: number
  totalRevenue: string
}

export type ProductPerformanceResponse = {
  status: "success"
  datasetId?: string
  category?: string
  topN: number
  bestSellingProducts: ProductPerformanceItem[]
  topRevenueProducts: ProductPerformanceItem[]
}

export type CategoryPerformanceItem = {
  category: string
  revenue: string
  unitsSold: number
  salesRecordCount: number
  revenuePercentage: string
}

export type CategoryPerformanceResponse = {
  status: "success"
  datasetId?: string
  totalRevenue: string
  categories: CategoryPerformanceItem[]
}

export type SalesTrend = {
  period: string
  revenue: string
  unitsSold: number
}

export type SalesTrendsResponse = {
  status: "success"
  datasetId?: string
  aggregation: "daily" | "monthly"
  startDate?: string
  endDate?: string
  trends: SalesTrend[]
}
