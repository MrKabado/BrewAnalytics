"use client"

import { useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react"
import { Panel } from "@/components/analytics/analytics-ui"
import { validateDataset } from "@/lib/dataset-service"
import type { DatasetValidationResponse } from "@/lib/dataset-types"

export function DatasetValidationPanel({ datasetId }: { datasetId: string }) {
  const [result, setResult] = useState<DatasetValidationResponse | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function runValidation() {
    if (loading) return
    setLoading(true)
    setError("")
    try {
      setResult(await validateDataset(datasetId))
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Dataset validation failed."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel
      title="Dataset validation"
      description="Read-only checks and reconciliation against the stored sales records."
      action={
        <button
          type="button"
          onClick={() => void runValidation()}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"
        >
          {loading && <LoaderCircle className="size-3.5 animate-spin" />}
          {result ? "Run again" : "Validate dataset"}
        </button>
      }
    >
      {loading && !result ? (
        <div
          role="status"
          aria-busy="true"
          className="h-16 animate-pulse rounded-lg bg-muted/70"
        />
      ) : error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void runValidation()}
            className="mt-2 font-semibold underline"
          >
            Try again
          </button>
        </div>
      ) : !result ? (
        <p className="text-sm text-muted-foreground">
          Run validation to review row errors, warnings, and revenue
          reconciliation. No records are changed.
        </p>
      ) : (
        <div aria-live="polite" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Summary label="Inspected" value={result.inspectedRecords} />
            <Summary label="Valid" value={result.validRecords} />
            <Summary
              label="Records with errors"
              value={result.recordsWithErrors}
              warning={result.recordsWithErrors > 0}
            />
            <Summary
              label="Records with warnings"
              value={result.recordsWithWarnings}
              warning={result.recordsWithWarnings > 0}
            />
          </div>
          <dl className="grid gap-x-6 gap-y-2 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">
                Distinct transactions
              </dt>
              <dd className="mt-1 font-medium">
                {result.informational.distinctTransactions.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total quantity</dt>
              <dd className="mt-1 font-medium">
                {result.informational.totalQuantity.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Recorded revenue
              </dt>
              <dd className="mt-1 font-medium">
                {result.informational.recordedRevenue}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Expected revenue (unit price × quantity)
              </dt>
              <dd className="mt-1 font-medium">
                {result.informational.expectedRevenue}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Absolute revenue discrepancy
              </dt>
              <dd className="mt-1 font-medium">
                {result.informational.absoluteRevenueDiscrepancy}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Stored / inspected row count
              </dt>
              <dd className="mt-1 font-medium">
                {result.informational.storedRowCount.toLocaleString()} /{" "}
                {result.inspectedRecords.toLocaleString()}
              </dd>
            </div>
          </dl>
          {result.errors.length > 0 ? (
            <IssueList
              title="Errors"
              icon={ShieldAlert}
              issues={result.errors}
              tone="error"
            />
          ) : (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="size-4" /> No validation errors were
              found.
            </p>
          )}
          {result.warnings.length > 0 && (
            <IssueList
              title="Warnings"
              icon={AlertTriangle}
              issues={result.warnings}
              tone="warning"
            />
          )}
        </div>
      )}
    </Panel>
  )
}

function Summary({
  label,
  value,
  warning = false,
}: {
  label: string
  value: number
  warning?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${warning ? "border-amber-200 bg-amber-50" : "border-border bg-card"}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  )
}

function IssueList({
  title,
  icon: Icon,
  issues,
  tone,
}: {
  title: string
  icon: typeof AlertTriangle
  issues: DatasetValidationResponse["errors"]
  tone: "error" | "warning"
}) {
  return (
    <section
      className={`rounded-lg border p-4 ${tone === "error" ? "border-destructive/20 bg-destructive/5" : "border-amber-200 bg-amber-50"}`}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4" aria-hidden="true" /> {title}
      </h3>
      <ul className="mt-2 space-y-2">
        {issues.map((issue) => (
          <li key={issue.code} className="text-sm">
            <span className="font-medium">
              {issue.count.toLocaleString()} · {issue.code.replaceAll("_", " ")}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {issue.description}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
