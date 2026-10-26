export type DailySalesSummaryResponse = {
  status: "success"
  datasetId?: string
  startDate?: string
  endDate?: string
  marketingSpend: null
  marketingSpendNote: string
  dailySummary: Array<{
    saleDate: string
    totalRevenue: string
    totalTransactions: number
    totalUnitsSold: number
    averageTransactionValue: string
    averageSellingPricePerUnit: string
    distinctProductsSold: number
  }>
}

export type ProductCatalogResponse = {
  status: "success"
  datasetId: string
  products: Array<{
    productId: string
    productName: string
    category: string
    status: string
    currentUnitPrice: string
    unitCost: string | null
    unitsSold: number
    recordedRevenue: string
    salesRecordCount: number
    distinctTransactions: number
    hasSales: boolean
  }>
  definitions: {
    recordedRevenue: string
    unitsSold: string
    catalogProductsWithNoSales: string
  }
}

export type CampaignPeriodAnalyticsResponse = {
  status: "success"
  datasetId?: string
  campaignCount: number
  attributionAvailable: boolean
  attributionNote: string
  comparisonDefinition: string
  rankingDefinition: string
  campaigns: Array<{
    datasetId: string
    campaignId: string
    campaignName: string
    promotionType: string
    campaignChannel: string
    startDate: string
    endDate: string
    marketingCost: string
    discountPercentage: string
    discountType: string | null
    discountValue: string | null
    status: string | null
    activePeriod: {
      days: number
      revenue: string
      distinctTransactions: number
      unitsSold: number
      daysWithSales: number
    }
    observedSalesCoverage: {
      startDate: string | null
      endDate: string | null
    }
    priorComparablePeriod: {
      coveredByObservedHistory: boolean
      revenue: string
      distinctTransactions: number
      unitsSold: number
      daysWithSales: number
    }
    followingComparablePeriod: {
      coveredByObservedHistory: boolean
      revenue: string
      distinctTransactions: number
      unitsSold: number
      daysWithSales: number
    }
    dailyTrends: Array<{
      date: string
      phase: "before" | "during" | "after"
      revenue: string
      distinctTransactions: number
    }>
    explicitCampaignLinkedSales: {
      revenue: string
      distinctTransactions: number
      salesRecordCount: number
    }
    comparisonStatus:
      "comparable_periods_available" | "insufficient_observed_history"
    activePeriodRevenueRank: number | null
  }>
}

export type CustomerPurchaseAnalyticsResponse = {
  status: "success"
  datasetId?: string
  linkedCustomerCount: number
  linkedTransactionCount: number
  linkedRecordedRevenue: string
  linkedUnitsSold: number
  repeatCustomerCount: number
  unlinkedSales: {
    salesRecordCount: number
    distinctTransactions: number
    unitsSold: number
    recordedRevenue: string
  }
  segments: Array<{
    customerType: string
    ageGroup: string
    customers: number
    repeatCustomers: number
    distinctTransactions: number
    unitsSold: number
    recordedRevenue: string
    averageRevenuePerTransaction: string
  }>
  definitions: {
    linkedTransactions: string
    repeatCustomer: string
    unlinkedSales: string
    limitations: string
  }
}
