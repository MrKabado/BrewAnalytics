"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Rows3,
} from "lucide-react"
import {
  EmptyState,
  PageHeading,
  Panel,
  StatCard,
} from "@/components/analytics/analytics-ui"
import { DatasetValidationPanel } from "@/components/datasets/dataset-validation-panel"
import { WorkbookImportPanel } from "@/components/datasets/workbook-import-panel"
import { useAnalyticsScope } from "@/components/analytics/analytics-scope"
import { ApiError } from "@/lib/api-client"
import { formatCurrency } from "@/lib/format"
import { getDataset, listDatasetRecords } from "@/lib/dataset-service"
import type {
  Dataset,
  DatasetRecord,
  DatasetRecordFilters,
} from "@/lib/dataset-types"

const PAGE_SIZE = 20
type RecordFilters = Omit<DatasetRecordFilters, "page" | "pageSize">

function formatDate(value: string) {
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

function formatAmount(value: string) {
  const amount = Number(value)
  return Number.isFinite(amount) ? formatCurrency(amount) : value
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred."
}

export default function DatasetDetailPage() {
  const { refreshDatasets } = useAnalyticsScope()
  const params = useParams<{ id: string }>()
  const id = params.id
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [datasetLoading, setDatasetLoading] = useState(true)
  const [loadedDatasetId, setLoadedDatasetId] = useState<string | null>(null)
  const [datasetError, setDatasetError] = useState<unknown>(null)
  const [datasetReloadKey, setDatasetReloadKey] = useState(0)
  const [records, setRecords] = useState<DatasetRecord[]>([])
  const [recordTotal, setRecordTotal] = useState(0)
  const [recordTotalPages, setRecordTotalPages] = useState(0)
  const [recordLoading, setRecordLoading] = useState(true)
  const [recordError, setRecordError] = useState("")
  const [recordReloadKey, setRecordReloadKey] = useState(0)
  const [completedRecordsRequestKey, setCompletedRecordsRequestKey] = useState<
    string | null
  >(null)
  const [page, setPage] = useState(1)
  const [filterForm, setFilterForm] = useState({
    productName: "",
    category: "",
    paymentMethod: "",
    saleDateFrom: "",
    saleDateTo: "",
  })
  const [filters, setFilters] = useState<RecordFilters>({})
  const recordsRequestKey = JSON.stringify({
    id,
    page,
    filters,
    recordReloadKey,
  })
  const isDatasetLoading = datasetLoading || loadedDatasetId !== id
  const isRecordLoading =
    recordLoading || completedRecordsRequestKey !== recordsRequestKey

  useEffect(() => {
    let active = true
    void getDataset(id).then(
      (response) => {
        if (!active) return
        setDataset(response.dataset)
        setDatasetError(null)
        setLoadedDatasetId(id)
        setDatasetLoading(false)
      },
      (error: unknown) => {
        if (!active) return
        setDataset(null)
        setDatasetError(error)
        setLoadedDatasetId(id)
        setDatasetLoading(false)
      }
    )
    return () => {
      active = false
    }
  }, [id, datasetReloadKey])

  useEffect(() => {
    let active = true
    const requestFilters: DatasetRecordFilters = {
      ...filters,
      page,
      pageSize: PAGE_SIZE,
    }
    void listDatasetRecords(id, requestFilters).then(
      (response) => {
        if (!active) return
        setRecords(response.records)
        setRecordTotal(response.pagination.total)
        setRecordTotalPages(response.pagination.totalPages)
        setRecordError("")
        setCompletedRecordsRequestKey(recordsRequestKey)
        setRecordLoading(false)
      },
      (error: unknown) => {
        if (!active) return
        setRecords([])
        setRecordError(errorMessage(error))
        setCompletedRecordsRequestKey(recordsRequestKey)
        setRecordLoading(false)
      }
    )
    return () => {
      active = false
    }
  }, [filters, id, page, recordReloadKey, recordsRequestKey])

  const retryDataset = useCallback(() => {
    setDatasetLoading(true)
    setDatasetError(null)
    setDatasetReloadKey((key) => key + 1)
  }, [])

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextFilters: RecordFilters = {}
    for (const [key, value] of Object.entries(filterForm)) {
      if (value.trim()) {
        Object.assign(nextFilters, { [key]: value.trim() })
      }
    }
    setRecordLoading(true)
    setPage(1)
    setFilters(nextFilters)
  }

  function clearFilters() {
    setFilterForm({
      productName: "",
      category: "",
      paymentMethod: "",
      saleDateFrom: "",
      saleDateTo: "",
    })
    setRecordLoading(true)
    setPage(1)
    setFilters({})
  }

  if (isDatasetLoading) {
    return (
      <div aria-label="Loading dataset" aria-busy="true" className="space-y-5">
        <div className="h-20 animate-pulse rounded-xl bg-muted/70" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-xl bg-muted/70"
            />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl bg-muted/70" />
      </div>
    )
  }

  if (datasetError) {
    const notFound =
      datasetError instanceof ApiError && datasetError.status === 404
    return (
      <>
        <PageHeading
          title={notFound ? "Dataset not found" : "Could not load dataset"}
          description={
            notFound
              ? "The requested dataset does not exist or is no longer available."
              : errorMessage(datasetError)
          }
          actions={
            <Link
              href="/datasets"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              <ArrowLeft className="size-4" /> Back to datasets
            </Link>
          }
        />
        {!notFound && (
          <Panel>
            <div className="text-center">
              <p role="alert" className="text-sm text-muted-foreground">
                {errorMessage(datasetError)}
              </p>
              <button
                type="button"
                onClick={retryDataset}
                className="mt-4 h-9 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted"
              >
                Try again
              </button>
            </div>
          </Panel>
        )}
        {notFound && (
          <Panel>
            <EmptyState
              icon={FileSpreadsheet}
              title="No matching dataset"
              description="Return to the dataset list to select an available upload."
            />
          </Panel>
        )}
      </>
    )
  }

  if (!dataset) return null

  return (
    <>
      <PageHeading
        eyebrow="Datasets · Details"
        title={dataset.name}
        description={dataset.originalFileName}
        actions={
          <Link
            href="/datasets"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted"
          >
            <ArrowLeft className="size-4" /> All datasets
          </Link>
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Sales records"
          value={dataset.recordCount.toLocaleString()}
          detail="Imported records"
          icon={Rows3}
        />
        <StatCard
          label="Original file"
          value={
            dataset.originalFileName.split(".").pop()?.toUpperCase() ?? "File"
          }
          detail="Uploaded file format"
          icon={FileSpreadsheet}
        />
        <StatCard
          label="Uploaded"
          value={formatDate(dataset.uploadedAt)}
          detail="Upload date"
          icon={CalendarDays}
        />
      </div>
      <Panel
        title="Dataset metadata"
        description="Information returned for this upload"
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Dataset name</dt>
            <dd className="mt-1 text-sm font-medium break-words">
              {dataset.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Original file</dt>
            <dd className="mt-1 text-sm font-medium break-all">
              {dataset.originalFileName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Record count</dt>
            <dd className="mt-1 text-sm font-medium">
              {dataset.recordCount.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Uploaded at</dt>
            <dd className="mt-1 text-sm font-medium">
              {formatDate(dataset.uploadedAt)}
            </dd>
          </div>
        </dl>
      </Panel>

      <div className="mt-5 grid gap-5">
        <WorkbookImportPanel
          datasetId={id}
          onImported={() => {
            setDatasetLoading(true)
            setDatasetReloadKey((key) => key + 1)
            setRecordLoading(true)
            setRecordReloadKey((key) => key + 1)
            refreshDatasets()
          }}
        />
        <DatasetValidationPanel datasetId={id} />
      </div>

      <Panel
        title="Sales records"
        description="Records belonging to this dataset. Apply supported filters or page through results."
        className="mt-5 p-0"
      >
        <form
          onSubmit={applyFilters}
          className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Product name
            <input
              value={filterForm.productName}
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  productName: event.target.value,
                }))
              }
              className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Category
            <input
              value={filterForm.category}
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Payment method
            <input
              value={filterForm.paymentMethod}
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  paymentMethod: event.target.value,
                }))
              }
              className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Sale date from
            <input
              type="date"
              value={filterForm.saleDateFrom}
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  saleDateFrom: event.target.value,
                }))
              }
              className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Sale date to
            <input
              type="date"
              value={filterForm.saleDateTo}
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  saleDateTo: event.target.value,
                }))
              }
              className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted"
            >
              Clear
            </button>
          </div>
        </form>

        {isRecordLoading ? (
          <div
            aria-label="Loading records"
            aria-busy="true"
            className="space-y-3 p-5"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="h-10 animate-pulse rounded-lg bg-muted/70"
              />
            ))}
          </div>
        ) : recordError ? (
          <div className="p-8 text-center">
            <h3 className="font-semibold">Could not load records</h3>
            <p role="alert" className="mt-2 text-sm text-muted-foreground">
              {recordError}
            </p>
            <button
              type="button"
              onClick={() => {
                setRecordLoading(true)
                setRecordReloadKey((key) => key + 1)
              }}
              className="mt-4 h-9 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted"
            >
              Try again
            </button>
          </div>
        ) : records.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Transaction</th>
                    <th className="px-4 py-3 font-medium">Sale date</th>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Qty</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Unit price
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Total amount
                    </th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        {record.transactionId}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {record.saleDate.slice(0, 10)}
                      </td>
                      <td className="px-4 py-3">{record.productName}</td>
                      <td className="px-4 py-3">{record.category}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {record.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatAmount(record.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatAmount(record.totalAmount)}
                      </td>
                      <td className="px-4 py-3">{record.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, recordTotal)} of {recordTotal}{" "}
                records
              </span>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={page <= 1 || isRecordLoading}
                  onClick={() => {
                    setRecordLoading(true)
                    setPage((current) => current - 1)
                  }}
                  aria-label="Previous records page"
                  className="rounded-md border border-border p-1.5 disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span>
                  Page {page} of {Math.max(recordTotalPages, 1)}
                </span>
                <button
                  type="button"
                  disabled={page >= recordTotalPages || isRecordLoading}
                  onClick={() => {
                    setRecordLoading(true)
                    setPage((current) => current + 1)
                  }}
                  aria-label="Next records page"
                  className="rounded-md border border-border p-1.5 disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon={Rows3}
            title={
              Object.keys(filters).length
                ? "No matching records"
                : "No sales records"
            }
            description={
              Object.keys(filters).length
                ? "Adjust or clear the filters to see more records."
                : "This dataset has no imported sales records."
            }
          />
        )}
      </Panel>
      <p className="mt-4 text-xs text-muted-foreground">
        Monetary values and sales details are displayed from the records
        returned for this dataset.
      </p>
    </>
  )
}
