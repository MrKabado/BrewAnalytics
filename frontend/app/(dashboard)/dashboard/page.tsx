"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Database,
  ReceiptText,
  ShoppingBag,
  Wallet,
} from "lucide-react"
import {
  Badge,
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
import { getTrendDateRange, type TrendRange } from "@/lib/analytics-date-range"
import { formatCurrency } from "@/lib/format"
import { useAuth } from "@/components/auth/auth-provider"

function currencyAmount(value: string | undefined) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date)
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<TrendRange>("30d")
  const { user } = useAuth()
  const {
    datasetId,
    setDatasetId,
    datasets,
    datasetsLoading,
    datasetsError,
    refreshDatasets,
  } = useAnalyticsScope()
  const dateRange = useMemo(() => getTrendDateRange(period, "daily"), [period])
  const analytics = useDescriptiveAnalytics(datasetId, {
    aggregation: "daily",
    ...dateRange,
  })
  const overview = analytics.overview?.metrics
  const productItems = analytics.products?.bestSellingProducts ?? []
  const categoryItems = analytics.categories?.categories ?? []
  const trendItems = analytics.trends?.trends ?? []
  const selectedDataset = datasets.find((dataset) => dataset.id === datasetId)

  return (
    <>
      <PageHeading
        eyebrow="Sales overview"
        title={`Good morning, ${user?.name ?? "Admin"}`}
        description="A clear view of your coffee shop's recorded sales."
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
              className={datasetsLoading ? "pointer-events-none opacity-60" : undefined}
            />
            <SelectControl
              label="Trend date range"
              value={period}
              onChange={(value) => setPeriod(value as TrendRange)}
              options={[
                { label: "Last 7 days", value: "7d" },
                { label: "Last 30 days", value: "30d" },
                { label: "Last 90 days", value: "90d" },
              ]}
            />
          </>
        }
      />

      {(datasetsError || analytics.summaryError || analytics.trendError) && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{datasetsError || analytics.summaryError || analytics.trendError}</span>
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

      {selectedDataset && (
        <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="size-3.5" />
          Dataset: <span className="font-medium text-foreground">{selectedDataset.name}</span>
        </div>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {analytics.summaryLoading ? (
          Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-xl bg-muted/70" />)
        ) : analytics.summaryError || !overview ? (
          <div className="col-span-full rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Sales overview is unavailable. No sample metrics are shown.
          </div>
        ) : (
          <>
            <StatCard label="Total revenue" value={formatCurrency(currencyAmount(overview.totalRevenue))} detail="All-time recorded revenue" icon={Wallet} />
            <StatCard label="Units sold" value={overview.totalUnitsSold.toLocaleString()} detail="Sum of sales quantities" icon={ShoppingBag} />
            <StatCard label="Transactions" value={overview.totalTransactions.toLocaleString()} detail={`${overview.totalSalesRecords.toLocaleString()} sales records · distinct transaction IDs`} icon={ReceiptText} />
            <StatCard label="Avg. transaction" value={formatCurrency(currencyAmount(overview.averageTransactionValue))} detail="Revenue ÷ distinct transactions" icon={ArrowUpRight} />
          </>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
        <Panel
          title="Revenue over time"
          description={`Recorded daily revenue · ${dateLabel(dateRange.startDate)} – ${dateLabel(dateRange.endDate)}. Dates without records are omitted.`}
        >
          {analytics.trendLoading ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted/70" />
          ) : analytics.trendError ? (
            <p role="alert" className="py-10 text-center text-sm text-muted-foreground">Sales trends could not be loaded.</p>
          ) : trendItems.length ? (
            <RevenueChart
              data={trendItems.map((item) => ({
                period: item.period,
                revenue: currencyAmount(item.revenue),
              }))}
            />
          ) : (
            <EmptyState icon={BarChart3} title="No sales in this date range" description="Choose a different period or dataset to view recorded revenue." />
          )}
        </Panel>
        <Panel
          title="Top-selling products"
          description="Ranked by units sold · all history"
          action={<Link href="/analytics/descriptive" className="text-xs font-medium text-primary hover:underline">View report</Link>}
        >
          {analytics.summaryLoading ? (
            <div className="h-52 animate-pulse rounded-lg bg-muted/70" />
          ) : productItems.length ? (
            <HorizontalBars
              items={productItems.slice(0, 5).map((product) => ({
                label: product.productName,
                value: product.quantitySold,
              }))}
              valueLabel="units sold"
            />
          ) : (
            <EmptyState icon={ShoppingBag} title="No product sales" description="No product records were found for this scope." />
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <Panel
          title="Category performance"
          description="Recorded revenue contribution across categories"
          action={<Link href="/analytics/descriptive" className="text-xs font-medium text-primary hover:underline">Details</Link>}
        >
          {analytics.summaryLoading ? (
            <div className="h-48 animate-pulse rounded-lg bg-muted/70" />
          ) : categoryItems.length ? (
            <div className="space-y-4">
              {categoryItems.slice(0, 5).map((category, index) => {
                const share = Number(category.revenuePercentage)
                return (
                  <div key={category.category} className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-primary">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{category.category}</span>
                        <span className="text-muted-foreground">{Number.isFinite(share) ? share.toFixed(2) : "0.00"}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(0, Math.min(share, 100))}%` }} />
                      </div>
                    </div>
                    <span className="w-24 text-right text-sm font-medium">{formatCurrency(currencyAmount(category.revenue))}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState icon={BarChart3} title="No category sales" description="No category records were found for this scope." />
          )}
        </Panel>
        <Panel
          title="Recent dataset activity"
          description="Latest uploads in your workspace"
          action={<Link href="/datasets" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">All datasets <ArrowRight className="size-3.5" /></Link>}
        >
          {datasetsLoading ? (
            <div className="space-y-3"><div className="h-14 animate-pulse rounded-lg bg-muted/70" /><div className="h-14 animate-pulse rounded-lg bg-muted/70" /></div>
          ) : datasetsError ? (
            <EmptyState icon={Database} title="Datasets unavailable" description={datasetsError} />
          ) : datasets.length ? (
            <div className="divide-y divide-border">
              {datasets.slice(0, 3).map((dataset) => (
                <Link key={dataset.id} href={`/datasets/${dataset.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-muted/40">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><Database className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{dataset.name}</span>
                    <span className="text-xs text-muted-foreground">{dateLabel(dataset.uploadedAt)} · {dataset.recordCount.toLocaleString()} records</span>
                  </span>
                  <Badge tone="success"><span className="sr-only">Uploaded file: </span>{dataset.originalFileName.split(".").pop()?.toUpperCase()}</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={Database} title="No datasets yet" description="Upload a dataset to see sales activity here." />
          )}
        </Panel>
      </div>
      <div className="mt-5 rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Explore descriptive analytics</p>
            <p className="mt-1 text-xs text-muted-foreground">Review historical product and category performance.</p>
          </div>
          <Link href="/analytics/descriptive" className="inline-flex items-center gap-2 self-start text-sm font-semibold text-primary hover:underline sm:self-auto">
            Open analytics <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </>
  )
}
