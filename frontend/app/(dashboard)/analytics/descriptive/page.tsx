"use client"

import { useMemo, useState } from "react"
import { BarChart3, ReceiptText, ShoppingBag, Wallet } from "lucide-react"
import {
  EmptyState,
  HorizontalBars,
  PageHeading,
  Panel,
  RevenueChart,
  SelectControl,
  StatCard,
} from "@/components/analytics/analytics-ui"
import { useAnalyticsScope } from "@/components/analytics/analytics-scope"
import { useDescriptiveAnalytics } from "@/components/analytics/use-descriptive-analytics"
import { BusinessAnalyticsPanel } from "@/components/analytics/business-analytics-panel"
import { getTrendDateRange, type TrendRange } from "@/lib/analytics-date-range"
import { formatCurrency } from "@/lib/format"

function currencyAmount(value: string | undefined) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

export default function DescriptiveAnalyticsPage() {
  const [aggregation, setAggregation] = useState<"daily" | "monthly">("daily")
  const [range, setRange] = useState<TrendRange>("30d")
  const [category, setCategory] = useState("all")
  const [ranking, setRanking] = useState<"revenue" | "quantity">("revenue")
  const {
    datasetId,
    setDatasetId,
    datasets,
    datasetsLoading,
    datasetsError,
    refreshDatasets,
  } = useAnalyticsScope()
  const dateRange = useMemo(
    () => getTrendDateRange(range, aggregation),
    [aggregation, range]
  )
  const selectedCategory = category === "all" ? undefined : category
  const analytics = useDescriptiveAnalytics(
    datasetId,
    { aggregation, ...dateRange },
    selectedCategory
  )
  const overview = analytics.overview?.metrics
  const categoryItems = analytics.categories?.categories ?? []
  const products =
    ranking === "quantity"
      ? (analytics.products?.bestSellingProducts ?? [])
      : (analytics.products?.topRevenueProducts ?? [])
  const trends = analytics.trends?.trends ?? []
  const totalRevenue = currencyAmount(overview?.totalRevenue)
  const categoryOptions = [
    { label: "All categories", value: "all" },
    ...categoryItems.map((item) => ({
      label: item.category,
      value: item.category,
    })),
  ]

  return (
    <>
      <PageHeading
        eyebrow="Analytics · Descriptive"
        title="Understand your sales"
        description="Explore recorded revenue, transaction volume, product rankings, and category performance."
        actions={
          <>
            <SelectControl
              label="Filter by dataset"
              value={datasetId ?? "all"}
              onChange={(value) => setDatasetId(value)}
              options={[
                { label: "All datasets", value: "all" },
                ...datasets.map((dataset) => ({
                  label: dataset.name,
                  value: dataset.id,
                })),
              ]}
              className={
                datasetsLoading ? "pointer-events-none opacity-60" : undefined
              }
            />
            <SelectControl
              label="Trend aggregation"
              value={aggregation}
              onChange={(value) => setAggregation(value as "daily" | "monthly")}
              options={[
                { label: "Daily", value: "daily" },
                { label: "Monthly", value: "monthly" },
              ]}
            />
            <SelectControl
              label="Trend date range"
              value={range}
              onChange={(value) => setRange(value as TrendRange)}
              options={[
                { label: "Last 30 days", value: "30d" },
                { label: "Last 90 days", value: "90d" },
                { label: "Last 12 months", value: "12m" },
              ]}
            />
          </>
        }
      />

      {(datasetsError ||
        analytics.summaryError ||
        analytics.productError ||
        analytics.trendError) && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <span>
            {datasetsError ||
              analytics.summaryError ||
              analytics.productError ||
              analytics.trendError}
          </span>
          <button
            type="button"
            onClick={() => {
              analytics.retry()
              refreshDatasets()
            }}
            className="rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-semibold hover:bg-destructive/10"
          >
            Retry
          </button>
        </div>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {analytics.summaryLoading ? (
          Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-xl bg-muted/70"
            />
          ))
        ) : analytics.summaryError || !overview ? (
          <div className="col-span-full rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Summary metrics are unavailable. No sample values are shown.
          </div>
        ) : (
          <>
            <StatCard
              label="Revenue"
              value={formatCurrency(totalRevenue)}
              detail="All-time recorded revenue"
              icon={Wallet}
            />
            <StatCard
              label="Units sold"
              value={overview.totalUnitsSold.toLocaleString()}
              detail="Sum of sales quantities"
              icon={ShoppingBag}
            />
            <StatCard
              label="Transactions"
              value={overview.totalTransactions.toLocaleString()}
              detail={`${overview.totalSalesRecords.toLocaleString()} sales records · distinct transaction IDs`}
              icon={ReceiptText}
            />
            <StatCard
              label="Average transaction value"
              value={formatCurrency(
                currencyAmount(overview.averageTransactionValue)
              )}
              detail="Revenue ÷ distinct transactions"
              icon={BarChart3}
            />
          </>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]">
        <Panel
          title="Revenue trend"
          description={`${aggregation === "daily" ? "Daily" : "Monthly"} recorded revenue · ${dateRange.startDate} – ${dateRange.endDate}. Periods without records are omitted.`}
        >
          {analytics.trendLoading ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted/70" />
          ) : analytics.trendError ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Revenue trends are unavailable.
            </p>
          ) : trends.length ? (
            <RevenueChart
              data={trends.map((item) => ({
                period: item.period,
                revenue: currencyAmount(item.revenue),
              }))}
            />
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No sales in this date range"
              description="Choose another range or dataset to view recorded revenue."
            />
          )}
        </Panel>
        <Panel
          title="Revenue by category"
          description="Revenue share is calculated against total revenue for this dataset scope"
        >
          {analytics.summaryLoading ? (
            <div className="h-56 animate-pulse rounded-lg bg-muted/70" />
          ) : analytics.summaryError ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Category performance is unavailable.
            </p>
          ) : categoryItems.length ? (
            <HorizontalBars
              items={categoryItems.map((item) => ({
                label: item.category,
                value: currencyAmount(item.revenue),
              }))}
              valueLabel="revenue"
              formatValue={(value) => formatCurrency(value)}
            />
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No category sales"
              description="No sales records were found in this dataset scope."
            />
          )}
        </Panel>
      </div>

      <Panel
        className="mt-5"
        title="Product performance"
        description={`Top ${analytics.products?.topN ?? 10} products ranked by ${ranking === "revenue" ? "recorded revenue" : "units sold"}${selectedCategory ? ` in ${selectedCategory}` : ""}.`}
        action={
          <div className="flex flex-wrap gap-2">
            <SelectControl
              label="Filter products by category"
              value={category}
              onChange={setCategory}
              options={categoryOptions}
            />
            <SelectControl
              label="Rank products by"
              value={ranking}
              onChange={(value) => setRanking(value as "revenue" | "quantity")}
              options={[
                { label: "Revenue", value: "revenue" },
                { label: "Units sold", value: "quantity" },
              ]}
            />
          </div>
        }
      >
        {analytics.productLoading ? (
          <div className="h-56 animate-pulse rounded-lg bg-muted/70" />
        ) : analytics.productError ? (
          <p
            role="alert"
            className="py-10 text-center text-sm text-muted-foreground"
          >
            Product performance is unavailable.
          </p>
        ) : products.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 text-right font-medium">Units sold</th>
                  <th className="pb-3 text-right font-medium">Revenue</th>
                  <th className="pb-3 text-right font-medium">
                    Share of scope revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => {
                  const revenue = currencyAmount(product.totalRevenue)
                  const share =
                    totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0
                  return (
                    <tr key={product.productName}>
                      <td className="py-3 font-medium">
                        {product.productName}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {product.quantitySold.toLocaleString()}
                      </td>
                      <td className="py-3 text-right font-medium tabular-nums">
                        {formatCurrency(revenue)}
                      </td>
                      <td className="py-3 text-right text-muted-foreground tabular-nums">
                        {share.toFixed(2)}%
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
            title="No product sales"
            description="No products matched the selected dataset and category."
          />
        )}
      </Panel>

      <Panel
        className="mt-5"
        title="Category performance"
        description="Revenue, units sold, sales records, and revenue share for each category"
      >
        {analytics.summaryLoading ? (
          <div className="h-48 animate-pulse rounded-lg bg-muted/70" />
        ) : analytics.summaryError ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Category performance is unavailable.
          </p>
        ) : categoryItems.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 text-right font-medium">Units sold</th>
                  <th className="pb-3 text-right font-medium">Sales records</th>
                  <th className="pb-3 text-right font-medium">Revenue</th>
                  <th className="pb-3 text-right font-medium">Revenue share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categoryItems.map((item) => (
                  <tr key={item.category}>
                    <td className="py-3 font-medium">{item.category}</td>
                    <td className="py-3 text-right tabular-nums">
                      {item.unitsSold.toLocaleString()}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {item.salesRecordCount.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-medium tabular-nums">
                      {formatCurrency(currencyAmount(item.revenue))}
                    </td>
                    <td className="py-3 text-right text-muted-foreground tabular-nums">
                      {Number(item.revenuePercentage).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No category sales"
            description="No category records were found for this dataset scope."
          />
        )}
      </Panel>
      <BusinessAnalyticsPanel
        datasetId={datasetId}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
      />
      <p className="mt-4 text-xs text-muted-foreground">
        Revenue uses the backend&apos;s stored total amounts and is not profit.
        Summary and ranking cards cover all available history; the date range
        filters the trend only.
      </p>
    </>
  )
}
