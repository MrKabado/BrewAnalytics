"use client"

import { useEffect, useState } from "react"
import { AlertCircle, BarChart3, Crosshair, Gauge, Target } from "lucide-react"
import {
  EmptyState,
  PageHeading,
  Panel,
  RevenueChart,
  SelectControl,
  StatCard,
} from "@/components/analytics/analytics-ui"
import { useAnalyticsScope } from "@/components/analytics/analytics-scope"
import { formatCurrency } from "@/lib/format"
import {
  getForecastEvaluation,
  getProductForecast,
  getSalesForecast,
} from "@/lib/forecast-service"
import type {
  ForecastAggregation,
  ForecastEvaluationResponse,
  ProductForecastResponse,
  SalesForecastResponse,
} from "@/lib/forecast-types"

function money(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : formatCurrency(value)
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function PredictiveAnalyticsPage() {
  const [horizon, setHorizon] = useState("3")
  const [aggregation, setAggregation] = useState<ForecastAggregation>("monthly")
  const [sales, setSales] = useState<SalesForecastResponse | null>(null)
  const [products, setProducts] = useState<ProductForecastResponse | null>(null)
  const [evaluation, setEvaluation] = useState<ForecastEvaluationResponse | null>(null)
  const [salesLoadedKey, setSalesLoadedKey] = useState("")
  const [productsLoadedKey, setProductsLoadedKey] = useState("")
  const [evaluationLoadedKey, setEvaluationLoadedKey] = useState("")
  const [salesError, setSalesError] = useState("")
  const [productsError, setProductsError] = useState("")
  const [evaluationError, setEvaluationError] = useState("")
  const [retryKey, setRetryKey] = useState(0)
  const [productSearch, setProductSearch] = useState("")
  const [productName, setProductName] = useState("")
  const [productSort, setProductSort] = useState<"demand" | "name">("demand")
  const {
    datasetId,
    setDatasetId,
    datasets,
    datasetsLoading,
    datasetsError,
    refreshDatasets,
  } = useAnalyticsScope()
  const numericHorizon = Number(horizon)
  const salesKey = JSON.stringify({ datasetId, aggregation, horizon, retryKey })
  const productsKey = JSON.stringify({
    datasetId,
    aggregation,
    horizon,
    productName,
    retryKey,
  })
  const evaluationKey = JSON.stringify({ datasetId, aggregation, retryKey })

  useEffect(() => {
    let active = true
    void getSalesForecast({
      datasetId,
      aggregation,
      horizon: numericHorizon,
    }).then(
      (response) => {
        if (!active) return
        setSales(response)
        setSalesError("")
        setSalesLoadedKey(salesKey)
      },
      (error: unknown) => {
        if (!active) return
        setSalesError(errorMessage(error, "Could not load the sales forecast."))
        setSalesLoadedKey(salesKey)
      },
    )
    return () => {
      active = false
    }
  }, [aggregation, datasetId, numericHorizon, retryKey, salesKey])

  useEffect(() => {
    let active = true
    void getProductForecast({
      datasetId,
      aggregation,
      horizon: numericHorizon,
      topN: 10,
      ...(productName ? { productName } : {}),
    }).then(
      (response) => {
        if (!active) return
        setProducts(response)
        setProductsError("")
        setProductsLoadedKey(productsKey)
      },
      (error: unknown) => {
        if (!active) return
        setProductsError(errorMessage(error, "Could not load product forecasts."))
        setProductsLoadedKey(productsKey)
      },
    )
    return () => {
      active = false
    }
  }, [aggregation, datasetId, numericHorizon, productName, productsKey, retryKey])

  useEffect(() => {
    let active = true
    void getForecastEvaluation({ datasetId, aggregation }).then(
      (response) => {
        if (!active) return
        setEvaluation(response)
        setEvaluationError("")
        setEvaluationLoadedKey(evaluationKey)
      },
      (error: unknown) => {
        if (!active) return
        setEvaluationError(errorMessage(error, "Could not load forecast evaluation."))
        setEvaluationLoadedKey(evaluationKey)
      },
    )
    return () => {
      active = false
    }
  }, [aggregation, datasetId, evaluationKey, retryKey])

  const salesLoading = salesLoadedKey !== salesKey
  const productsLoading = productsLoadedKey !== productsKey
  const evaluationLoading = evaluationLoadedKey !== evaluationKey
  const selectedForecasts = [...(products?.products ?? [])].sort((first, second) =>
    productSort === "name"
      ? first.productName.localeCompare(second.productName)
      : second.predictedDemand - first.predictedDemand ||
        first.productName.localeCompare(second.productName),
  )
  const nextForecast = sales?.forecast[0]
  const actualAndForecast = [
    ...(sales?.historicalObservations.map((observation) => ({
      period: observation.period,
      revenue: Number(observation.revenue),
    })) ?? []),
    ...(sales?.forecast.map((estimate) => ({
      period: estimate.date,
      revenue: 0,
      forecast: Number(estimate.predictedRevenue),
    })) ?? []),
  ]
  const combinedError =
    datasetsError || salesError || productsError || evaluationError

  return (
    <>
      <PageHeading
        eyebrow="Analytics · Predictive"
        title="Plan with a clearer view ahead"
        description="Explore statistical estimates based on recorded sales history. Forecasts are estimates, not guaranteed outcomes."
        actions={
          <>
            <SelectControl
              label="Dataset"
              value={datasetId ?? "all"}
              onChange={setDatasetId}
              options={[
                { label: "All datasets", value: "all" },
                ...datasets.map((dataset) => ({
                  label: dataset.name,
                  value: dataset.id,
                })),
              ]}
              className={datasetsLoading ? "pointer-events-none opacity-60" : undefined}
            />
            <SelectControl
              label="Forecast aggregation"
              value={aggregation}
              onChange={(value) => {
                const nextAggregation = value as ForecastAggregation
                setAggregation(nextAggregation)
                setHorizon(nextAggregation === "daily" ? "7" : "3")
              }}
              options={[
                { label: "Monthly", value: "monthly" },
                { label: "Daily", value: "daily" },
              ]}
            />
            <SelectControl
              label="Forecast horizon"
              value={horizon}
              onChange={setHorizon}
              options={
                aggregation === "daily"
                  ? [
                      { label: "Next 7 periods", value: "7" },
                      { label: "Next 14 periods", value: "14" },
                      { label: "Next 30 periods", value: "30" },
                      { label: "Next 90 periods", value: "90" },
                    ]
                  : [
                      { label: "Next 1 period", value: "1" },
                      { label: "Next 3 periods", value: "3" },
                      { label: "Next 6 periods", value: "6" },
                      { label: "Next 12 periods", value: "12" },
                    ]
              }
            />
          </>
        }
      />

      {combinedError && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <span>{combinedError}</span>
          <button
            type="button"
            onClick={() => {
              setRetryKey((key) => key + 1)
              if (datasetsError) refreshDatasets()
            }}
            className="rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-semibold hover:bg-destructive/10"
          >
            Retry
          </button>
        </div>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {salesLoading || evaluationLoading ? (
          Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-xl bg-muted/70"
            />
          ))
        ) : (
          <>
            <StatCard
              label="Estimated next period revenue"
              value={
                salesError || sales?.forecastStatus !== "forecasted"
                  ? "—"
                  : money(Number(nextForecast?.predictedRevenue))
              }
              detail={
                salesError
                  ? "Forecast unavailable"
                  : nextForecast
                    ? `Estimate for ${nextForecast.date}`
                    : "Insufficient recorded history"
              }
              icon={Target}
            />
            <StatCard
              label="Mean absolute error (MAE)"
              value={
                evaluationError || evaluation?.evaluationStatus !== "evaluated"
                  ? "—"
                  : money(evaluation.meanAbsoluteError)
              }
              detail={
                evaluation?.evaluationStatus === "evaluated"
                  ? `Average absolute error · ${evaluation.evaluationObservations} holdout periods`
                  : "Not enough holdout periods to evaluate"
              }
              icon={Crosshair}
            />
            <StatCard
              label="Root mean squared error (RMSE)"
              value={
                evaluationError || evaluation?.evaluationStatus !== "evaluated"
                  ? "—"
                  : money(evaluation.rootMeanSquaredError)
              }
              detail={
                evaluation?.evaluationStatus === "evaluated"
                  ? "Larger errors affect this metric more"
                  : "Not enough holdout periods to evaluate"
              }
              icon={Gauge}
            />
          </>
        )}
      </div>

      <Panel
        title="Revenue forecast"
        description={`${aggregation === "daily" ? "Daily" : "Monthly"} historical revenue and estimates · next ${horizon} periods`}
      >
        {salesLoading ? (
          <div className="h-64 animate-pulse rounded-lg bg-muted/70" />
        ) : salesError ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Revenue forecast is unavailable. No sample values are shown.
          </p>
        ) : actualAndForecast.length ? (
          <>
            <RevenueChart data={actualAndForecast} comparison />
            {sales?.forecastStatus === "insufficient_data" && (
              <p className="mt-4 rounded-lg bg-secondary/70 p-4 text-sm text-muted-foreground">
                {sales.message} Select another dataset or aggregation if more
                recorded history is available.
              </p>
            )}
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              {sales?.limitations}
            </p>
          </>
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No recorded sales history"
            description="There is no revenue history available for this dataset scope."
          />
        )}
      </Panel>

      <Panel
        className="mt-5"
        title="Product demand outlook"
        description={`Estimated quantities for the next ${horizon} ${aggregation === "daily" ? "days" : "months"}. Historical quantities are shown for the periods included in the forecast response.`}
        action={
          <div className="flex flex-wrap gap-2">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                setProductName(productSearch.trim())
              }}
            >
              <label className="sr-only" htmlFor="product-forecast-search">
                Search products
              </label>
              <input
                id="product-forecast-search"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search products"
                className="h-9 w-40 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
              />
              <button
                type="submit"
                className="h-9 rounded-lg border border-input bg-card px-3 text-sm font-medium shadow-sm hover:bg-secondary"
              >
                Search
              </button>
            </form>
            <SelectControl
              label="Sort products by"
              value={productSort}
              onChange={(value) => setProductSort(value as "demand" | "name")}
              options={[
                { label: "Forecast quantity", value: "demand" },
                { label: "Product name", value: "name" },
              ]}
            />
          </div>
        }
      >
        {productsLoading ? (
          <div className="h-48 animate-pulse rounded-lg bg-muted/70" />
        ) : productsError ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Product forecasts are unavailable. No sample values are shown.
          </p>
        ) : selectedForecasts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 text-right font-medium">
                    Recorded units in history
                  </th>
                  <th className="pb-3 text-right font-medium">
                    Estimated units in horizon
                  </th>
                  <th className="pb-3 font-medium">Estimated by period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {selectedForecasts.map((product) => {
                  const historicalUnits = product.historicalObservations.reduce(
                    (total, observation) => total + observation.quantity,
                    0,
                  )
                  const historicalStart =
                    product.historicalObservations[0]?.period
                  const historicalEnd =
                    product.historicalObservations[
                      product.historicalObservations.length - 1
                    ]?.period

                  return (
                    <tr key={product.productName}>
                      <td className="py-3 font-medium">{product.productName}</td>
                      <td className="py-3 text-muted-foreground">
                        {product.category}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {historicalUnits.toLocaleString()}
                        {historicalStart && historicalEnd && (
                          <span className="block text-xs text-muted-foreground">
                            {historicalStart} – {historicalEnd}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right font-medium tabular-nums">
                        {product.predictedDemand.toLocaleString()}
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {product.forecasts
                          .map(
                            (estimate) =>
                              `${estimate.period}: ${estimate.predictedQuantity}`,
                          )
                          .join(" · ")}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={BarChart3}
            title={
              products?.forecastStatus === "insufficient_data"
                ? "Insufficient history for product forecasts"
                : "No product sales found"
            }
            description={
              products?.insufficientProducts.length
                ? products.insufficientProducts
                    .map(
                      (product) =>
                        `${product.productName}: ${product.reason}`,
                    )
                    .join(" ")
                : "No product demand forecasts are available for this dataset scope and filter."
            }
          />
        )}
        {!productsLoading && !productsError && products?.insufficientProducts.length ? (
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-sm font-medium">Products without forecasts</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {products.insufficientProducts.map((product) => (
                <li key={product.productName}>
                  {product.productName} · {product.observedPeriods} observed
                  periods · {product.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          {products?.limitations}
        </p>
      </Panel>

      <Panel
        className="mt-5"
        title="Forecast evaluation"
        description={`Historical holdout evaluation · ${aggregation} revenue`}
      >
        {evaluationLoading ? (
          <div className="h-40 animate-pulse rounded-lg bg-muted/70" />
        ) : evaluationError ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Evaluation metrics are unavailable.
          </p>
        ) : evaluation?.evaluationStatus === "evaluated" ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-secondary/60 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Evaluation period
                </p>
                <p className="mt-1 font-semibold">
                  {evaluation.evaluationStart} – {evaluation.evaluationEnd}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {evaluation.evaluationObservations} chronological holdout
                  observations; {evaluation.observedPeriods} periods had sales
                  records across {evaluation.historicalPeriods} calendar periods.
                </p>
              </div>
              <div className="rounded-lg bg-secondary/60 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Previous-period baseline
                </p>
                <p className="mt-1 text-sm">
                  MAE {money(evaluation.baseline.meanAbsoluteError)} · RMSE{" "}
                  {money(evaluation.baseline.rootMeanSquaredError)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The forecast errors can be compared with carrying forward the
                  previous period&apos;s revenue.
                </p>
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              MAE is the average size of the revenue prediction error. RMSE
              weighs larger errors more heavily. These are historical holdout
              scores, not guarantees of future accuracy. {evaluation.trainingPolicy}{" "}
              {evaluation.limitations}
            </p>
          </div>
        ) : (
          <EmptyState
            icon={Crosshair}
            title="Not enough history to evaluate"
            description={
              evaluation?.message ??
              "The selected dataset scope does not contain enough historical periods for a holdout evaluation."
            }
          />
        )}
      </Panel>

      <div className="mt-5 flex items-start gap-3 rounded-lg bg-secondary/70 p-4">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-xs leading-5 text-muted-foreground">
          Forecasts use a linear regression trend and do not model seasonality,
          promotions, stock availability, or external factors. They are estimates
          only and do not imply inventory shortages, excess stock, or guaranteed
          business outcomes.
        </p>
      </div>
    </>
  )
}
