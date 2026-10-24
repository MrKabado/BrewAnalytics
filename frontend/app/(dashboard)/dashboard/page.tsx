"use client"

import Link from "next/link"
import {
  ArrowRight,
  ArrowUpRight,
  Database,
  ReceiptText,
  ShoppingBag,
  Wallet,
} from "lucide-react"
import { useState } from "react"
import {
  Badge,
  HorizontalBars,
  PageHeading,
  Panel,
  RevenueChart,
  SelectControl,
  StatCard,
} from "@/components/analytics/analytics-ui"
import {
  categories,
  datasets,
  datasetSnapshots,
  formatCurrency,
  products,
} from "@/lib/mock-data"

export default function DashboardPage() {
  const [period, setPeriod] = useState("30d")
  const [datasetId, setDatasetId] = useState("all")
  const selectedDataset = datasets.find((dataset) => dataset.id === datasetId)
  const snapshot = datasetSnapshots[datasetId] ?? datasetSnapshots.all
  const chartData = period === "7d" ? snapshot.history.slice(-2) : snapshot.history

  return (
    <>
      <PageHeading
        eyebrow="Monday, March 30, 2026"
        title="Good morning, Brew Admin"
        description="A clear view of how your coffee shop is performing."
        actions={
          <>
            <SelectControl
              label="Filter by dataset"
              value={datasetId}
              onChange={setDatasetId}
              options={[
                { label: "All datasets", value: "all" },
                ...datasets.map((dataset) => ({
                  label: dataset.name,
                  value: dataset.id,
                })),
              ]}
            />
            <SelectControl
              label="Select reporting period"
              value={period}
              onChange={setPeriod}
              options={[
                { label: "Last 7 days", value: "7d" },
                { label: "Last 30 days", value: "30d" },
                { label: "This quarter", value: "quarter" },
              ]}
            />
          </>
        }
      />

      {selectedDataset && (
        <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="size-3.5" />
          Showing sample metrics for <span className="font-medium text-foreground">{selectedDataset.name}</span>
        </div>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total revenue" value={formatCurrency(snapshot.revenue)} detail="vs previous period" change="+12.8%" icon={Wallet} />
        <StatCard label="Units sold" value={snapshot.units.toLocaleString()} detail="vs previous period" change="+8.2%" icon={ShoppingBag} />
        <StatCard label="Transactions" value={snapshot.transactions.toLocaleString()} detail="vs previous period" change="+6.4%" icon={ReceiptText} />
        <StatCard label="Avg. transaction" value={`$${snapshot.average.toFixed(2)}`} detail="vs previous period" change="+2.1%" icon={ArrowUpRight} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
        <Panel
          title="Revenue over time"
          description={period === "quarter" ? "Quarterly sales performance" : `Sales performance · ${period === "7d" ? "last 7 days" : "last 30 days"}`}
          action={<Badge tone="success">+12.8%</Badge>}
        >
          <RevenueChart data={chartData} />
        </Panel>
        <Panel
          title="Top-selling products"
          description="Ranked by units sold this period"
          action={
            <Link href="/analytics/descriptive" className="text-xs font-medium text-primary hover:underline">
              View report
            </Link>
          }
        >
          <HorizontalBars
            items={products.slice(0, 5).map((product) => ({
              label: product.name,
              value: product.units,
            }))}
            valueLabel="units sold"
          />
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <Panel
          title="Category performance"
          description="Revenue contribution across your menu"
          action={<Link href="/analytics/descriptive" className="text-xs font-medium text-primary hover:underline">Details</Link>}
        >
          <div className="space-y-4">
            {categories.map((category, index) => (
              <div key={category.name} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{category.name}</span>
                    <span className="text-muted-foreground">{category.share}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-chart-1" style={{ width: `${category.share}%` }} />
                  </div>
                </div>
                <span className="w-20 text-right text-sm font-medium">{formatCurrency(category.revenue)}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Recent dataset activity"
          description="Latest imports in your workspace"
          action={
            <Link href="/datasets" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              All datasets <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          <div className="divide-y divide-border">
            {datasets.slice(0, 3).map((dataset) => (
              <Link key={dataset.id} href={`/datasets/${dataset.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-muted/40">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Database className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{dataset.name}</span>
                  <span className="text-xs text-muted-foreground">{dataset.uploadedAt} · {dataset.records.toLocaleString()} records</span>
                </span>
                <Badge tone="success">{dataset.status}</Badge>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-5 rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Explore your business in more detail</p>
            <p className="mt-1 text-xs text-muted-foreground">Compare product results, review forecasts, and explore evidence-based recommendations.</p>
          </div>
          <Link href="/analytics/descriptive" className="inline-flex items-center gap-2 self-start text-sm font-semibold text-primary hover:underline sm:self-auto">
            Open analytics <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </>
  )
}