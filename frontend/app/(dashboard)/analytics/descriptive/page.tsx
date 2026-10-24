"use client"

import { useMemo, useState } from "react"
import { BarChart3, ReceiptText, Wallet } from "lucide-react"
import {
  HorizontalBars,
  PageHeading,
  Panel,
  RevenueChart,
  SelectControl,
  StatCard,
} from "@/components/analytics/analytics-ui"
import { categories, datasets, datasetSnapshots, formatCurrency, products } from "@/lib/mock-data"

export default function DescriptiveAnalyticsPage() {
  const [category, setCategory] = useState("all")
  const [datasetId, setDatasetId] = useState("all")
  const [range, setRange] = useState("12")
  const filteredProducts = useMemo(
    () => products.filter((product) => category === "all" || product.category === category),
    [category],
  )
  const snapshot = datasetSnapshots[datasetId] ?? datasetSnapshots.all
  const chartData = snapshot.history.slice(-Math.min(Number(range), snapshot.history.length))

  return (
    <>
      <PageHeading
        eyebrow="Analytics · Descriptive"
        title="Understand your sales"
        description="Explore historical performance across revenue, transactions, products, and categories."
        actions={
          <>
            <SelectControl label="Filter by dataset" value={datasetId} onChange={setDatasetId} options={[{ label: "All datasets", value: "all" }, ...datasets.map((dataset) => ({ label: dataset.name, value: dataset.id }))]} />
            <SelectControl label="Date range" value={range} onChange={setRange} options={[{ label: "Last 4 weeks", value: "4" }, { label: "Last 8 weeks", value: "8" }, { label: "Last 12 weeks", value: "12" }]} />
          </>
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Revenue" value={formatCurrency(snapshot.revenue)} detail="Across selected dataset" icon={Wallet} />
        <StatCard label="Transactions" value={snapshot.transactions.toLocaleString()} detail="Distinct transactions" icon={ReceiptText} />
        <StatCard label="Average order value" value={`$${snapshot.average.toFixed(2)}`} detail="Revenue per transaction" icon={BarChart3} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]">
        <Panel title="Revenue trend" description="Recorded revenue by week">
          <RevenueChart data={chartData} />
        </Panel>
        <Panel title="Revenue by category" description="Share of total recorded revenue">
          <HorizontalBars items={categories.map((item) => ({ label: item.name, value: item.revenue }))} valueLabel="revenue" formatValue={formatCurrency} />
        </Panel>
      </div>
      <Panel
        className="mt-5"
        title="Product performance"
        description="Compare units sold and recorded revenue by product"
        action={
          <SelectControl
            label="Filter products by category"
            value={category}
            onChange={setCategory}
            options={[{ label: "All categories", value: "all" }, ...categories.map((item) => ({ label: item.name, value: item.name }))]}
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="pb-3 font-medium">Product</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 text-right font-medium">Units sold</th>
                <th className="pb-3 text-right font-medium">Revenue</th>
                <th className="pb-3 text-right font-medium">Revenue share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProducts.map((product) => (
                <tr key={product.name}>
                  <td className="py-3 font-medium">{product.name}</td>
                  <td className="py-3 text-muted-foreground">{product.category}</td>
                  <td className="py-3 text-right tabular-nums">{product.units.toLocaleString()}</td>
                  <td className="py-3 text-right font-medium tabular-nums">{formatCurrency(product.revenue)}</td>
                  <td className="py-3 text-right text-muted-foreground tabular-nums">{((product.revenue / 37660) * 100).toFixed(1)}%</td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No products match this category.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="mt-4 text-xs text-muted-foreground">
        {datasetId === "all"
          ? "All datasets selected."
          : `Selected sample scope: ${datasets.find((dataset) => dataset.id === datasetId)?.name ?? "dataset"}.`}
        {" "}All figures are illustrative sample data. Revenue reflects recorded sales amounts and is not profit; product and category rankings are sample-wide.
      </p>
    </>
  )
}