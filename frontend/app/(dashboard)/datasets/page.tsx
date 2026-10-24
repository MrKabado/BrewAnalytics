"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  MoreHorizontal,
  Plus,
  Search,
  UploadCloud,
  X,
} from "lucide-react"
import { Badge, EmptyState, PageHeading, Panel } from "@/components/analytics/analytics-ui"
import { datasets as sampleDatasets } from "@/lib/mock-data"

export default function DatasetsPage() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<"upload" | "delete" | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [notice, setNotice] = useState("")
  const [empty, setEmpty] = useState(false)
  const [status, setStatus] = useState("all")
  const pageSize = 4
  const selectedDataset = sampleDatasets.find((item) => item.id === selectedId)
  const filtered = useMemo(
    () =>
      (empty ? [] : sampleDatasets).filter((dataset) =>
        `${dataset.name} ${dataset.fileName}`.toLowerCase().includes(search.toLowerCase()) &&
        (status === "all" || dataset.status.toLowerCase() === status),
      ),
    [empty, search, status],
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)

  function closeDialog() {
    setDialog(null)
    setSelectedFile(null)
  }

  return (
    <>
      <PageHeading
        eyebrow="Workspace"
        title="Datasets"
        description="Browse your imported sales files and review their records."
        actions={
          <button
            type="button"
            onClick={() => {
              setNotice("")
              setDialog("upload")
            }}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Upload dataset
          </button>
        }
      />
      {notice && <p role="status" className="mb-4 rounded-lg border border-border bg-secondary/70 px-4 py-3 text-sm text-secondary-foreground">{notice}</p>}
      <Panel className="p-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <label className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search datasets..."
              aria-label="Search datasets"
              className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm placeholder:text-muted-foreground"
            />
          </label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEmpty((value) => !value)} className="h-9 rounded-lg border border-input px-3 text-sm hover:bg-muted">
              {empty ? "Show sample data" : "Preview empty state"}
            </button>
            <select aria-label="Filter datasets by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="h-9 rounded-lg border border-input bg-card px-3 text-sm">
              <option value="all">All statuses</option><option value="ready">Ready</option><option value="processing">Processing</option>
            </select>
          </div>
        </div>
        {visible.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead><tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Dataset</th>
                  <th className="px-4 py-3 font-medium">Uploaded</th>
                  <th className="px-4 py-3 text-right font-medium">Records</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {visible.map((dataset) => (
                    <tr key={dataset.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3.5">
                        <Link href={`/datasets/${dataset.id}`} className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary"><FileSpreadsheet className="size-4" /></span>
                          <span className="min-w-0"><span className="block font-medium">{dataset.name}</span><span className="block truncate text-xs text-muted-foreground">{dataset.fileName}</span></span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{dataset.uploadedAt}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums">{dataset.records.toLocaleString()}</td>
                      <td className="px-4 py-3.5"><Badge tone="success"><Check className="mr-1 size-3" />{dataset.status}</Badge></td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1">
                          <Link href={`/datasets/${dataset.id}`} className="rounded-md px-2 py-1.5 text-xs font-medium text-primary hover:bg-secondary">View</Link>
                          <button type="button" aria-label={`More actions for ${dataset.name}`} onClick={() => { setSelectedId(dataset.id); setDialog("delete") }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><MoreHorizontal className="size-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} datasets</span>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page" className="rounded-md border border-border p-1.5 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
                <span>Page {page} of {pageCount}</span>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} aria-label="Next page" className="rounded-md border border-border p-1.5 disabled:opacity-40"><ChevronRight className="size-4" /></button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState icon={FileSpreadsheet} title={search ? "No datasets found" : "No datasets yet"} description={search ? "Try another search term." : "Upload a sales file to preview your dataset workspace."} />
        )}
      </Panel>
      <p className="mt-4 text-xs text-muted-foreground">Sample dataset information is illustrative. Upload and delete actions are UI previews only; no file or data is sent to a server.</p>

      {dialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/30 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog() }}>
          <section role="dialog" aria-modal="true" aria-labelledby="dataset-dialog-title" className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between">
              <div><h2 id="dataset-dialog-title" className="text-lg font-semibold">{dialog === "upload" ? "Upload a dataset" : "Delete dataset?"}</h2><p className="mt-1 text-sm text-muted-foreground">{dialog === "upload" ? "Choose a sales file to preview the upload flow." : `This is a preview for “${selectedDataset?.name}”. No dataset will be deleted.`}</p></div>
              <button type="button" onClick={closeDialog} aria-label="Close dialog" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
            </div>
            {dialog === "upload" ? (
              <div className="mt-5">
                <label
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    setSelectedFile(event.dataTransfer.files[0] ?? null)
                  }}
                  className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/40 bg-secondary/30 px-5 text-center hover:bg-secondary/50"
                >
                  <UploadCloud className="size-8 text-primary" />
                  <span className="mt-3 text-sm font-semibold">{selectedFile?.name ?? "Choose a file or drop it here"}</span>
                  <span className="mt-1 text-xs text-muted-foreground">CSV, XLSX, or XLS · maximum 10 MB</span>
                  <input type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
                </label>
                {selectedFile && <p className="mt-3 text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB selected. File remains in this browser preview.</p>}
                {notice && <p role="status" className="mt-3 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">{notice}</p>}
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={closeDialog} className="h-9 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Cancel</button>
                  <button type="button" disabled={!selectedFile} onClick={() => setNotice("Preview only: no file was uploaded. Backend integration will be added in a future phase.")} className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">Preview upload</button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={closeDialog} className="h-9 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Close</button>
                <button type="button" onClick={() => { setNotice("Preview only: no dataset was deleted."); closeDialog() }} className="h-9 rounded-lg bg-destructive px-3 text-sm font-semibold text-white hover:bg-destructive/90">Understood</button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}