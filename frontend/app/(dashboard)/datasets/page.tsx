"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  Search,
  UploadCloud,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { EmptyState, PageHeading, Panel } from "@/components/analytics/analytics-ui"
import { useAnalyticsScope } from "@/components/analytics/analytics-scope"
import { deleteDataset, listDatasets, uploadDataset } from "@/lib/dataset-service"
import type { Dataset } from "@/lib/dataset-types"

const PAGE_SIZE = 20
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred."
}

export default function DatasetsPage() {
  const { refreshDatasets } = useAnalyticsScope()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [search, setSearch] = useState("")
  const [fileType, setFileType] = useState("all")
  const [dialog, setDialog] = useState<"upload" | "delete" | null>(null)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dialogError, setDialogError] = useState("")
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    void listDatasets(page, PAGE_SIZE).then(
      (response) => {
        if (!active) return
        setDatasets(response.datasets)
        setTotal(response.pagination.total)
        setTotalPages(response.pagination.totalPages)
        setLoadError("")
        setLoading(false)
      },
      (error: unknown) => {
        if (!active) return
        setLoadError(errorMessage(error))
        setLoading(false)
      },
    )
    return () => {
      active = false
    }
  }, [page, reloadKey])

  const visible = useMemo(
    () =>
      datasets.filter((dataset) => {
        const queryMatches = `${dataset.name} ${dataset.originalFileName}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
        const extension = dataset.originalFileName.split(".").pop()?.toLowerCase()
        const typeMatches =
          fileType === "all" ||
          (fileType === "csv" && extension === "csv") ||
          (fileType === "excel" && (extension === "xlsx" || extension === "xls"))
        return queryMatches && typeMatches
      }),
    [datasets, fileType, search],
  )

  const retry = useCallback(() => {
    setLoadError("")
    setLoading(true)
    setReloadKey((key) => key + 1)
  }, [])

  function openUpload() {
    setSelectedFile(null)
    setDialogError("")
    setDialog("upload")
  }

  function openDelete(dataset: Dataset) {
    setSelectedDataset(dataset)
    setDialogError("")
    setDialog("delete")
  }

  function closeDialog() {
    if (busy) return
    setDialog(null)
    setSelectedFile(null)
    setSelectedDataset(null)
    setDialogError("")
  }

  async function handleUpload() {
    if (!selectedFile || busy) return
    const extension = selectedFile.name.split(".").pop()?.toLowerCase()
    if (!extension || !["csv", "xlsx", "xls"].includes(extension)) {
      setDialogError("Choose a CSV, XLSX, or XLS file.")
      return
    }
    if (selectedFile.size > MAX_UPLOAD_SIZE) {
      setDialogError("The uploaded file must be 10 MB or smaller.")
      return
    }

    setBusy(true)
    setDialogError("")
    try {
      const response = await uploadDataset(selectedFile)
      toast.success(response.message || "Dataset uploaded successfully.")
      setDialog(null)
      setSelectedFile(null)
      setPage(1)
      setLoading(true)
      setReloadKey((key) => key + 1)
      refreshDatasets()
    } catch (error) {
      const message = errorMessage(error)
      setDialogError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!selectedDataset || busy) return
    setBusy(true)
    setDialogError("")
    try {
      const response = await deleteDataset(selectedDataset.id)
      toast.success(response.message || "Dataset deleted successfully.")
      setDialog(null)
      setSelectedDataset(null)
      setLoading(true)
      refreshDatasets()
      if (datasets.length === 1 && page > 1) {
        setPage((current) => current - 1)
      } else {
        setReloadKey((key) => key + 1)
      }
    } catch (error) {
      const message = errorMessage(error)
      setDialogError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Workspace"
        title="Datasets"
        description="Browse imported sales files and review their records."
        actions={
          <button
            type="button"
            onClick={openUpload}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Upload dataset
          </button>
        }
      />
      <Panel className="p-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <label className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search this page..."
              aria-label="Search datasets on this page"
              className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm placeholder:text-muted-foreground"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            File type
            <select
              aria-label="Filter datasets by file type"
              value={fileType}
              onChange={(event) => setFileType(event.target.value)}
              className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground"
            >
              <option value="all">All types</option>
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
            </select>
          </label>
        </div>

        {loadError ? (
          <div className="p-8 text-center">
            <h2 className="font-semibold">Could not load datasets</h2>
            <p role="alert" className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 h-9 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <div aria-label="Loading datasets" aria-busy="true" className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/70" />
            ))}
          </div>
        ) : visible.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Dataset</th>
                    <th className="px-4 py-3 font-medium">Uploaded</th>
                    <th className="px-4 py-3 text-right font-medium">Records</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((dataset) => (
                    <tr key={dataset.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3.5">
                        <Link href={`/datasets/${dataset.id}`} className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
                            <FileSpreadsheet className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium">{dataset.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{dataset.originalFileName}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{formatDate(dataset.uploadedAt)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{dataset.recordCount.toLocaleString()}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1">
                          <Link href={`/datasets/${dataset.id}`} className="rounded-md px-2 py-1.5 text-xs font-medium text-primary hover:bg-secondary">View</Link>
                          <button
                            type="button"
                            aria-label={`Delete ${dataset.name}`}
                            onClick={() => openDelete(dataset)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} datasets
                {search || fileType !== "all" ? ` · ${visible.length} match this page` : ""}
              </span>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => { setLoading(true); setPage((value) => value - 1) }}
                  aria-label="Previous page"
                  className="rounded-md border border-border p-1.5 disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span>Page {page} of {Math.max(totalPages, 1)}</span>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => { setLoading(true); setPage((value) => value + 1) }}
                  aria-label="Next page"
                  className="rounded-md border border-border p-1.5 disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon={FileSpreadsheet}
            title={search || fileType !== "all" ? "No datasets found on this page" : "No datasets yet"}
            description={
              search || fileType !== "all"
                ? "Try a different search or file type. Search only applies to the current page."
                : "Upload a CSV or Excel sales file to create your first dataset."
            }
          />
        )}
      </Panel>
      <p className="mt-4 text-xs text-muted-foreground">
        Dataset information is loaded from the BrewAnalytics API. File type and text filters apply to the current page only.
      </p>

      {dialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 p-4"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog() }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="dataset-dialog-title" className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="dataset-dialog-title" className="text-lg font-semibold">
                  {dialog === "upload" ? "Upload a dataset" : "Delete dataset?"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dialog === "upload"
                    ? "Choose a sales file to import into your workspace."
                    : `Delete “${selectedDataset?.name}” and its associated sales records? This cannot be undone.`}
                </p>
              </div>
              <button type="button" disabled={busy} onClick={closeDialog} aria-label="Close dialog" className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-50">
                <X className="size-5" />
              </button>
            </div>
            {dialog === "upload" ? (
              <div className="mt-5">
                <label
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDialogError("")
                    setSelectedFile(event.dataTransfer.files[0] ?? null)
                  }}
                  className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/40 bg-secondary/30 px-5 text-center hover:bg-secondary/50"
                >
                  <UploadCloud className="size-8 text-primary" />
                  <span className="mt-3 text-sm font-semibold">{selectedFile?.name ?? "Choose a file or drop it here"}</span>
                  <span className="mt-1 text-xs text-muted-foreground">CSV, XLSX, or XLS · maximum 10 MB</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    disabled={busy}
                    className="sr-only"
                    onChange={(event) => {
                      setDialogError("")
                      setSelectedFile(event.target.files?.[0] ?? null)
                    }}
                  />
                </label>
                {selectedFile && <p className="mt-3 text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB selected.</p>}
                {dialogError && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{dialogError}</p>}
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" disabled={busy} onClick={closeDialog} className="h-9 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-50">Cancel</button>
                  <button type="button" disabled={!selectedFile || busy} onClick={() => void handleUpload()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    {busy && <LoaderCircle className="size-4 animate-spin" />}
                    {busy ? "Uploading…" : "Upload dataset"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {dialogError && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{dialogError}</p>}
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" disabled={busy} onClick={closeDialog} className="h-9 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-50">Cancel</button>
                  <button type="button" disabled={busy || !selectedDataset} onClick={() => void handleDelete()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-destructive px-3 text-sm font-semibold text-white hover:bg-destructive/90 disabled:opacity-50">
                    {busy && <LoaderCircle className="size-4 animate-spin" />}
                    {busy ? "Deleting…" : "Delete dataset"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  )
}
