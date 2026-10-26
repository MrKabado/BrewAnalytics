"use client"

import { useEffect, useMemo, useState } from "react"
import { Lightbulb } from "lucide-react"
import {
  Badge,
  EmptyState,
  PageHeading,
  Panel,
  SelectControl,
} from "@/components/analytics/analytics-ui"
import { useAnalyticsScope } from "@/components/analytics/analytics-scope"
import {
  getRecommendationSummary,
  getRecommendations,
} from "@/lib/recommendation-service"
import type {
  BusinessRecommendation,
  RecommendationBasis,
  RecommendationCategory,
  RecommendationPriority,
  RecommendationSummaryResponse,
  RecommendationsResponse,
} from "@/lib/recommendation-types"

const categoryLabels: Record<RecommendationCategory, string> = {
  product_performance: "Product performance",
  revenue_improvement: "Revenue improvement",
  product_demand: "Product demand",
  sales_trends: "Sales trends",
  category_performance: "Category performance",
  marketing_analysis: "Marketing analysis",
}

const recommendationCategories: RecommendationCategory[] = [
  "product_performance",
  "revenue_improvement",
  "product_demand",
  "sales_trends",
  "category_performance",
  "marketing_analysis",
]

const priorityTones: Record<
  RecommendationPriority,
  "danger" | "warning" | "neutral"
> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
}

const basisLabels: Record<RecommendationBasis, string> = {
  historical: "Historical sales",
  forecast: "Forecast",
  historical_and_forecast: "Historical sales + forecast",
}

function formatEvidenceLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Percent$/, " percent")
    .replace(/^./, (letter) => letter.toUpperCase())
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function RecommendationCard({
  item,
  datasetName,
}: {
  item: BusinessRecommendation
  datasetName: string
}) {
  return (
    <Panel key={item.id} className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{categoryLabels[item.category]}</Badge>
          <Badge tone={priorityTones[item.priority]}>
            {item.priority} priority
          </Badge>
        </div>
        <span className="rounded-lg bg-secondary p-2 text-primary">
          <Lightbulb className="size-4" aria-hidden="true" />
        </span>
      </div>
      <h2 className="mt-4 text-base font-semibold">{item.title}</h2>
      <p className="mt-2 text-sm leading-6">{item.recommendation}</p>
      <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
        {item.explanation}
      </p>
      <div className="mt-4 rounded-lg bg-muted/70 p-3">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Evidence · {basisLabels[item.basis]}
        </p>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(item.evidence).map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="text-xs text-muted-foreground">
                {formatEvidenceLabel(key)}
              </dt>
              <dd className="text-sm font-medium break-words">
                {String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Dataset: {datasetName}</span>
        <span>Reference: {item.id}</span>
      </div>
    </Panel>
  )
}

export default function PrescriptiveAnalyticsPage() {
  const [aggregation, setAggregation] = useState<"daily" | "monthly">("monthly")
  const [priority, setPriority] = useState<RecommendationPriority | "all">(
    "all"
  )
  const [category, setCategory] = useState<RecommendationCategory | "all">(
    "all"
  )
  const [recommendationResponse, setRecommendationResponse] =
    useState<RecommendationsResponse | null>(null)
  const [summary, setSummary] = useState<RecommendationSummaryResponse | null>(
    null
  )
  const [loadedKey, setLoadedKey] = useState("")
  const [recommendationError, setRecommendationError] = useState("")
  const [summaryError, setSummaryError] = useState("")
  const [retryKey, setRetryKey] = useState(0)
  const {
    datasetId,
    setDatasetId,
    datasets,
    datasetsLoading,
    datasetsError,
    refreshDatasets,
  } = useAnalyticsScope()

  const requestKey = JSON.stringify({ datasetId, aggregation, retryKey })

  useEffect(() => {
    let active = true
    void Promise.allSettled([
      getRecommendations({ datasetId, aggregation }),
      getRecommendationSummary({ datasetId, aggregation }),
    ]).then(([recommendationResult, summaryResult]) => {
      if (!active) return
      if (recommendationResult.status === "fulfilled") {
        setRecommendationResponse(recommendationResult.value)
        setRecommendationError("")
      } else {
        setRecommendationError(
          errorMessage(
            recommendationResult.reason,
            "Could not load business recommendations."
          )
        )
      }
      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value)
        setSummaryError("")
      } else {
        setSummaryError(
          errorMessage(
            summaryResult.reason,
            "Could not load the recommendation summary."
          )
        )
      }
      setLoadedKey(requestKey)
    })
    return () => {
      active = false
    }
  }, [aggregation, datasetId, requestKey, retryKey])

  const loading = loadedKey !== requestKey
  const recommendations = useMemo(
    () =>
      (recommendationResponse?.recommendations ?? []).filter(
        (item) =>
          (priority === "all" || item.priority === priority) &&
          (category === "all" || item.category === category)
      ),
    [category, priority, recommendationResponse]
  )
  const availableCategories = useMemo(
    () =>
      [
        ...new Set(
          recommendationResponse?.recommendations.map(
            (item) => item.category
          ) ?? []
        ),
      ]
        .sort()
        .map((item) => ({
          label: categoryLabels[item],
          value: item,
        })),
    [recommendationResponse]
  )
  const selectedDatasetName = datasetId
    ? (datasets.find((dataset) => dataset.id === datasetId)?.name ?? datasetId)
    : "All datasets"
  const displayedError = loading
    ? ""
    : datasetsError || recommendationError || summaryError

  return (
    <>
      <PageHeading
        eyebrow="Analytics · Prescriptive"
        title="Recommendations to consider"
        description="Rule-based guidance generated from recorded sales and forecast results. Recommendations are not guaranteed outcomes."
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
              className={
                datasetsLoading ? "pointer-events-none opacity-60" : undefined
              }
            />
            <SelectControl
              label="Recommendation period grouping"
              value={aggregation}
              onChange={(value) => setAggregation(value as "daily" | "monthly")}
              options={[
                { label: "Monthly periods", value: "monthly" },
                { label: "Daily periods", value: "daily" },
              ]}
            />
            <SelectControl
              label="Filter recommendations by priority"
              value={priority}
              onChange={(value) =>
                setPriority(value as RecommendationPriority | "all")
              }
              options={[
                { label: "All priorities", value: "all" },
                { label: "High", value: "high" },
                { label: "Medium", value: "medium" },
                { label: "Low", value: "low" },
              ]}
            />
            <SelectControl
              label="Filter recommendations by category"
              value={category}
              onChange={(value) =>
                setCategory(value as RecommendationCategory | "all")
              }
              options={[
                { label: "All categories", value: "all" },
                ...availableCategories,
              ]}
            />
          </>
        }
      />

      {displayedError && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <span>{displayedError}</span>
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

      {loading ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-xl bg-muted/70"
            />
          ))}
        </div>
      ) : summaryError ? (
        <p className="mb-5 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Recommendation summary is unavailable. No sample counts are shown.
        </p>
      ) : (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {(["high", "medium", "low"] as const).map((level) => (
            <div
              key={level}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <span className="text-sm text-muted-foreground">
                {level} priority · current dataset scope
              </span>
              <span className="text-xl font-semibold">
                {summary?.byPriority[level] ?? 0}
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && !summaryError && summary?.byCategory ? (
        <div className="mb-5 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Recommendations by category</h2>
          {recommendationCategories.some(
            (categoryKey) => summary.byCategory[categoryKey] !== undefined
          ) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {recommendationCategories.flatMap((categoryKey) => {
                const count = summary.byCategory[categoryKey]
                return count === undefined
                  ? []
                  : [
                      <Badge key={categoryKey} tone="accent">
                        {categoryLabels[categoryKey]} · {count}
                      </Badge>,
                    ]
              })}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No recommendation categories have triggered for this scope.
            </p>
          )}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-72 animate-pulse rounded-xl bg-muted/70"
            />
          ))}
        </div>
      ) : recommendationError ? (
        <Panel>
          <EmptyState
            icon={Lightbulb}
            title="Recommendations are unavailable"
            description="The recommendation request failed. Retry to fetch the latest results."
          />
        </Panel>
      ) : recommendations.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {recommendations.map((item) => (
            <RecommendationCard
              key={item.id}
              item={item}
              datasetName={
                item.datasetId
                  ? (datasets.find((dataset) => dataset.id === item.datasetId)
                      ?.name ?? item.datasetId)
                  : selectedDatasetName
              }
            />
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState
            icon={Lightbulb}
            title={
              recommendationResponse?.recommendationCount === 0
                ? "No recommendations for this dataset scope"
                : "No recommendations match these filters"
            }
            description={
              recommendationResponse?.message ??
              "Try another priority or category to review the available recommendations."
            }
          />
        </Panel>
      )}

      {!loading &&
      !recommendationError &&
      recommendationResponse?.notes.length ? (
        <div className="mt-4 space-y-1 text-xs text-muted-foreground">
          {recommendationResponse.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Summary counts show all recommendations for the selected dataset and
        period grouping; priority and category selections filter the cards only.
      </p>
    </>
  )
}
