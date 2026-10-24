"use client"

import { useState } from "react"
import { AlertCircle, Crosshair, Gauge, Target } from "lucide-react"
import { Badge, PageHeading, Panel, RevenueChart, SelectControl, StatCard } from "@/components/analytics/analytics-ui"
import { forecastHistory } from "@/lib/mock-data"

const demandRows = [
  { product: "Oat Milk Latte", category: "Espresso", recent: 94, predicted: 112 },
  { product: "Cold Brew", category: "Cold drinks", recent: 64, predicted: 78 },
  { product: "Cappuccino", category: "Espresso", recent: 76, predicted: 81 },
  { product: "Butter Croissant", category: "Bakery", recent: 55, predicted: 51 },
]

export default function PredictiveAnalyticsPage() {
  const [horizon, setHorizon] = useState("3")
  const [aggregation, setAggregation] = useState("monthly")
  const [datasetId, setDatasetId] = useState("all")

  return (
    <>
      <PageHeading
        eyebrow="Analytics · Predictive"
        title="Plan with a clearer view ahead"
        description="Explore statistical estimates based on recorded sales history. Forecasts are estimates, not guaranteed outcomes."
        actions={
          <>
            <SelectControl label="Forecast aggregation" value={aggregation} onChange={setAggregation} options={[{ label: "Monthly", value: "monthly" }, { label: "Daily", value: "daily" }]} />
            <SelectControl label="Forecast horizon" value={horizon} onChange={setHorizon} options={[{ label: "Next 1 period", value: "1" }, { label: "Next 3 periods", value: "3" }]} />
            <SelectControl label="Dataset" value={datasetId} onChange={setDatasetId} options={[{ label: "All datasets", value: "all" }, { label: "Q1 2026", value: "q1" }]} />
          </>
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Estimated next period" value="$18,100" detail="Linear trend estimate" icon={Target} />
        <StatCard label="Forecast accuracy · MAE" value="$1,240" detail="Historical holdout error" icon={Crosshair} />
        <StatCard label="Forecast accuracy · RMSE" value="$1,610" detail="Historical holdout error" icon={Gauge} />
      </div>
      <Panel title="Revenue forecast" description={`Historical actuals and estimated revenue · ${aggregation} · ${horizon} periods`}>
        <RevenueChart
          data={forecastHistory.slice(
            0,
            Math.min(forecastHistory.length, 3 + Number(horizon)),
          ).map((point) => ({
            period: point.period,
            revenue: point.actual,
            forecast: point.forecast,
          }))}
          comparison
        />
        <div className="mt-5 flex items-start gap-3 rounded-lg bg-secondary/70 p-4">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-xs leading-5 text-muted-foreground">
            Forecasts use a linear regression trend and are constrained to non-negative estimates. The method does not model seasonality, promotions, stock availability, or external factors. Historical and forecast values are shown separately.
          </p>
        </div>
      </Panel>
      <Panel className="mt-5" title="Product demand outlook" description="Illustrative expected units per week compared with the recent average">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground">
              <th className="pb-3 font-medium">Product</th><th className="pb-3 font-medium">Category</th><th className="pb-3 text-right font-medium">Recent avg. / wk</th><th className="pb-3 text-right font-medium">Estimated / wk</th><th className="pb-3 text-right font-medium">Change</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {demandRows.map((row) => {
                const change = ((row.predicted - row.recent) / row.recent) * 100
                return <tr key={row.product}>
                  <td className="py-3 font-medium">{row.product}</td><td className="py-3 text-muted-foreground">{row.category}</td><td className="py-3 text-right tabular-nums">{row.recent}</td><td className="py-3 text-right font-medium tabular-nums">{row.predicted}</td><td className="py-3 text-right"><Badge tone={change >= 0 ? "success" : "warning"}>{change >= 0 ? "+" : ""}{change.toFixed(0)}%</Badge></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="mt-4 text-xs text-muted-foreground">Illustrative sample values only. Estimates should be compared with future actual sales before operational decisions.</p>
    </>
  )
}