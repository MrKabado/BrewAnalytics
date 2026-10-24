"use client"

import { useMemo, useState } from "react"
import { ArrowRight, Lightbulb } from "lucide-react"
import { Badge, EmptyState, PageHeading, Panel, SelectControl } from "@/components/analytics/analytics-ui"
import { recommendationSamples } from "@/lib/mock-data"

export default function PrescriptiveAnalyticsPage() {
  const [priority, setPriority] = useState("all")
  const [category, setCategory] = useState("all")
  const recommendations = useMemo(
    () =>
      recommendationSamples.filter(
        (item) =>
          (priority === "all" || item.priority.toLowerCase() === priority) &&
          (category === "all" || item.category === category),
      ),
    [priority, category],
  )

  return (
    <>
      <PageHeading
        eyebrow="Analytics · Prescriptive"
        title="Recommendations to consider"
        description="Rule-based guidance connected to sample sales evidence. Recommendations do not guarantee outcomes."
        actions={
          <>
            <SelectControl label="Filter recommendations by priority" value={priority} onChange={setPriority} options={[{ label: "All priorities", value: "all" }, { label: "High", value: "high" }, { label: "Medium", value: "medium" }, { label: "Low", value: "low" }]} />
            <SelectControl label="Filter recommendations by category" value={category} onChange={setCategory} options={[{ label: "All categories", value: "all" }, ...recommendationSamples.map((item) => item.category).filter((value, index, values) => values.indexOf(value) === index).map((value) => ({ label: value, value }))]} />
          </>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {(["High", "Medium", "Low"] as const).map((level) => (
          <div key={level} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <span className="text-sm text-muted-foreground">{level} priority</span>
            <span className="text-xl font-semibold">{recommendationSamples.filter((item) => item.priority === level).length}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {recommendations.map((item) => (
          <Panel key={item.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge tone="accent">{item.category}</Badge>
                <Badge tone={item.priority === "High" ? "danger" : item.priority === "Medium" ? "warning" : "neutral"}>{item.priority} priority</Badge>
              </div>
              <span className="rounded-lg bg-secondary p-2 text-primary"><Lightbulb className="size-4" /></span>
            </div>
            <h2 className="mt-4 text-base font-semibold">{item.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{item.text}</p>
            <div className="mt-4 rounded-lg bg-muted/70 p-3">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Supporting evidence · {item.basis}</p>
              <p className="mt-1.5 text-sm font-medium">{item.evidence}</p>
            </div>
            <button type="button" className="mt-4 inline-flex items-center gap-1 self-start text-sm font-semibold text-primary hover:underline">
              Review details <ArrowRight className="size-4" />
            </button>
          </Panel>
        ))}
      </div>
      {recommendations.length === 0 && (
        <Panel><EmptyState icon={Lightbulb} title="No recommendations match these filters" description="Try another priority or category to view illustrative guidance." /></Panel>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Sample recommendations are illustrative. Revenue does not represent profit; stock levels and staffing data are not available.</p>
    </>
  )
}