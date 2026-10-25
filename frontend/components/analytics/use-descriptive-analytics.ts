"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getCategoryPerformance,
  getProductPerformance,
  getSalesOverview,
  getSalesTrends,
} from "@/lib/analytics-service"
import type {
  CategoryPerformanceResponse,
  ProductPerformanceResponse,
  SalesOverviewResponse,
  SalesTrendsResponse,
} from "@/lib/analytics-types"

type TrendOptions = {
  aggregation: "daily" | "monthly"
  startDate?: string
  endDate?: string
}

export function useDescriptiveAnalytics(
  datasetId: string | undefined,
  trendOptions: TrendOptions,
  category?: string,
) {
  const { aggregation, startDate, endDate } = trendOptions
  const summaryKey = JSON.stringify({ datasetId })
  const productKey = JSON.stringify({ datasetId, category })
  const trendKey = JSON.stringify({ datasetId, aggregation, startDate, endDate })
  const [overview, setOverview] = useState<SalesOverviewResponse | null>(null)
  const [products, setProducts] = useState<ProductPerformanceResponse | null>(null)
  const [categories, setCategories] = useState<CategoryPerformanceResponse | null>(null)
  const [loadedSummaryKey, setLoadedSummaryKey] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState("")
  const [loadedProductKey, setLoadedProductKey] = useState<string | null>(null)
  const [productError, setProductError] = useState("")
  const [trends, setTrends] = useState<SalesTrendsResponse | null>(null)
  const [loadedTrendKey, setLoadedTrendKey] = useState<string | null>(null)
  const [trendError, setTrendError] = useState("")
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    void Promise.all([
      getSalesOverview(datasetId),
      getCategoryPerformance(datasetId),
    ]).then(([nextOverview, nextCategories]) => {
        if (!active) return
        setOverview(nextOverview)
        setCategories(nextCategories)
        setSummaryError("")
        setLoadedSummaryKey(summaryKey)
      },
      (error: unknown) => {
        if (!active) return
        setSummaryError(
          error instanceof Error ? error.message : "Could not load analytics.",
        )
        setLoadedSummaryKey(summaryKey)
      },
    )
    return () => {
      active = false
    }
  }, [datasetId, retryKey, summaryKey])

  useEffect(() => {
    let active = true
    void getProductPerformance({ datasetId, category, topN: 10 }).then(
      (response) => {
        if (!active) return
        setProducts(response)
        setProductError("")
        setLoadedProductKey(productKey)
      },
      (error: unknown) => {
        if (!active) return
        setProductError(
          error instanceof Error ? error.message : "Could not load products.",
        )
        setLoadedProductKey(productKey)
      },
    )
    return () => {
      active = false
    }
  }, [datasetId, category, productKey, retryKey])

  useEffect(() => {
    let active = true
    void getSalesTrends({ datasetId, aggregation, startDate, endDate }).then(
      (response) => {
        if (!active) return
        setTrends(response)
        setTrendError("")
        setLoadedTrendKey(trendKey)
      },
      (error: unknown) => {
        if (!active) return
        setTrendError(
          error instanceof Error ? error.message : "Could not load sales trends.",
        )
        setLoadedTrendKey(trendKey)
      },
    )
    return () => {
      active = false
    }
  }, [datasetId, aggregation, startDate, endDate, retryKey, trendKey])

  const retry = useCallback(() => {
    setLoadedSummaryKey(null)
    setLoadedProductKey(null)
    setLoadedTrendKey(null)
    setRetryKey((key) => key + 1)
  }, [])

  return useMemo(
    () => ({
      overview,
      products,
      categories,
      trends,
      summaryLoading: loadedSummaryKey !== summaryKey,
      productLoading: loadedProductKey !== productKey,
      trendLoading: loadedTrendKey !== trendKey,
      summaryError: loadedSummaryKey === summaryKey ? summaryError : "",
      productError: loadedProductKey === productKey ? productError : "",
      trendError: loadedTrendKey === trendKey ? trendError : "",
      retry,
    }),
    [
      overview,
      products,
      categories,
      trends,
      loadedSummaryKey,
      summaryKey,
      loadedProductKey,
      productKey,
      productError,
      loadedTrendKey,
      trendKey,
      summaryError,
      trendError,
      retry,
    ],
  )
}
