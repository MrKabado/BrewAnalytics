"use client"

import { useState } from "react"
import { FileSpreadsheet, LoaderCircle, UploadCloud } from "lucide-react"
import { toast } from "sonner"
import { Panel } from "@/components/analytics/analytics-ui"
import { ApiError } from "@/lib/api-client"
import {
  importCampaignWorkbook,
  importReferenceWorkbook,
  importSalesTransactions,
  previewDatasetWorkbook,
} from "@/lib/dataset-service"
import type {
  CampaignImportResponse,
  ReferenceDataImportResponse,
  SalesTransactionsImportResponse,
  WorkbookPreviewResponse,
  WorkbookWorksheetPreview,
} from "@/lib/dataset-types"

type ImportKind = "reference-data" | "sales-transactions" | "campaigns"
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024

const importLabels: Record<ImportKind, string> = {
  "reference-data": "Products and Customers",
  "sales-transactions": "Sales Transactions",
  campaigns: "Marketing Campaigns",
}

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "")
}

function importKinds(sheet: WorkbookWorksheetPreview): ImportKind[] {
  const name = normalize(sheet.name)
  const headers = new Set(sheet.headers.map(normalize))
  const kinds: ImportKind[] = []
  if (["products", "customers"].includes(name)) {
    kinds.push("reference-data")
  }
  if (name === "salestransactions") {
    kinds.push("sales-transactions")
  }
  const campaignRequired = [
    ["campaignid"],
    ["campaignname"],
    ["promotiontype"],
    ["marketingchannel", "campaignchannel", "channel"],
    ["startdate"],
    ["enddate"],
    ["marketingcost"],
  ]
  if (
    ["marketingcampaigns", "campaigns"].includes(name) ||
    campaignRequired.every((aliases) =>
      aliases.some((alias) => headers.has(alias))
    )
  ) {
    kinds.push("campaigns")
  }
  return kinds
}

function errorDetails(error: unknown) {
  if (!(error instanceof ApiError)) return []
  const payload = error.payload
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("worksheets" in payload)
  ) {
    return []
  }
  const worksheets = payload.worksheets
  if (!Array.isArray(worksheets)) return []
  return worksheets.flatMap((worksheet) => {
    if (
      typeof worksheet !== "object" ||
      worksheet === null ||
      !("errors" in worksheet)
    ) {
      return []
    }
    const errors = worksheet.errors
    return Array.isArray(errors)
      ? errors.filter(
          (message): message is string => typeof message === "string"
        )
      : []
  })
}

type ImportResponse =
  | ReferenceDataImportResponse
  | SalesTransactionsImportResponse
  | CampaignImportResponse

function importedCount(kind: ImportKind, response: ImportResponse): number {
  if (kind === "reference-data" && "totalRecordsCreated" in response) {
    return response.totalRecordsCreated
  }
  if ("recordsCreated" in response) return response.recordsCreated
  return 0
}

export function WorkbookImportPanel({
  datasetId,
  onImported,
}: {
  datasetId: string
  onImported: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<WorkbookPreviewResponse | null>(null)
  const [previewError, setPreviewError] = useState("")
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState<ImportKind | null>(null)
  const [importError, setImportError] = useState("")
  const [validationDetails, setValidationDetails] = useState<string[]>([])
  const [success, setSuccess] = useState("")

  async function handlePreview() {
    if (!file || previewing || importing) return
    if (file.size > MAX_UPLOAD_SIZE) {
      setPreviewError("The uploaded workbook must be 10 MB or smaller.")
      return
    }
    setPreviewing(true)
    setPreviewError("")
    setImportError("")
    setValidationDetails([])
    setSuccess("")
    try {
      setPreview(await previewDatasetWorkbook(file))
    } catch (error) {
      setPreview(null)
      setPreviewError(
        error instanceof Error ? error.message : "Workbook preview failed."
      )
    } finally {
      setPreviewing(false)
    }
  }

  async function handleImport(kind: ImportKind) {
    if (!file || !preview || importing) return
    setImporting(kind)
    setImportError("")
    setValidationDetails([])
    setSuccess("")
    try {
      let response: ImportResponse
      if (kind === "reference-data") {
        response = await importReferenceWorkbook(datasetId, file)
      } else if (kind === "sales-transactions") {
        response = await importSalesTransactions(datasetId, file)
      } else {
        response = await importCampaignWorkbook(datasetId, file)
      }
      const count = importedCount(kind, response)
      const message = `${importLabels[kind]} imported: ${count.toLocaleString()} record${count === 1 ? "" : "s"} created.`
      setSuccess(message)
      toast.success(message)
      onImported()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Workbook import failed."
      setImportError(message)
      setValidationDetails(errorDetails(error))
      toast.error(message)
    } finally {
      setImporting(null)
    }
  }

  const fileExtension = file?.name.split(".").pop()?.toLowerCase()
  const fileValid = fileExtension === "xlsx" || fileExtension === "xls"

  return (
    <Panel
      title="Import workbook data"
      description="Preview workbook sheets before importing additional records into this dataset."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="grid flex-1 gap-1.5 text-xs font-medium text-muted-foreground">
          Excel workbook
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={previewing || Boolean(importing)}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setPreview(null)
              setPreviewError("")
              setImportError("")
              setValidationDetails([])
              setSuccess("")
            }}
            className="min-h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
          />
        </label>
        <button
          type="button"
          disabled={!file || !fileValid || previewing || Boolean(importing)}
          onClick={() => void handlePreview()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {previewing ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <UploadCloud className="size-4" />
          )}
          {previewing ? "Previewing…" : "Preview workbook"}
        </button>
      </div>
      {file && !fileValid && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Choose an XLSX or XLS workbook no larger than 10 MB.
        </p>
      )}
      {previewError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {previewError}
        </p>
      )}
      {importError && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <p>{importError}</p>
          {validationDetails.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-1">
              {validationDetails.map((detail, index) => (
                <li key={`${detail}-${index}`}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {success && (
        <p
          role="status"
          className="mt-3 rounded-lg bg-secondary/70 p-3 text-sm"
        >
          {success}
        </p>
      )}

      {preview && (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">
              {preview.fileName} · {preview.worksheetCount} worksheet
              {preview.worksheetCount === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Preview checks worksheet structure and sample rows. The selected
              backend importer validates every row and database reference
              atomically; rejected imports do not create partial records.
            </p>
          </div>
          {preview.worksheets.map((sheet) => {
            const kinds = importKinds(sheet)
            const actionableKinds = kinds.filter(
              (kind) =>
                preview.worksheets.find((candidate) =>
                  importKinds(candidate).includes(kind)
                )?.name === sheet.name
            )
            return (
              <section
                key={sheet.name}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    <h3 className="text-sm font-semibold">{sheet.name}</h3>
                    <span className="text-xs text-muted-foreground">
                      {sheet.rowCount.toLocaleString()} rows
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sheet.supportedBySalesImporter && (
                      <span className="rounded-full bg-secondary px-2 py-1 text-xs text-primary">
                        Single-sheet sales format
                      </span>
                    )}
                    {actionableKinds.map((kind) => (
                      <span
                        key={kind}
                        className="rounded-full bg-secondary px-2 py-1 text-xs text-primary"
                      >
                        {importLabels[kind]}
                      </span>
                    ))}
                    {!sheet.supportedBySalesImporter && kinds.length === 0 && (
                      <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                        No matching importer
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Headers:{" "}
                  {sheet.headers.length
                    ? sheet.headers.join(", ")
                    : "none detected"}
                </p>
                {sheet.warnings.length > 0 && (
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-800">
                    {sheet.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
                {sheet.previewRows.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          {sheet.headers.map((header, index) => (
                            <th
                              key={`${header}-${index}`}
                              className="px-2 py-2 font-medium"
                            >
                              {header || `Column ${index + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sheet.previewRows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {sheet.headers.map((_header, columnIndex) => (
                              <td
                                key={columnIndex}
                                className="max-w-56 truncate px-2 py-2"
                              >
                                {row[columnIndex] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {actionableKinds.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {actionableKinds.map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        disabled={Boolean(importing)}
                        onClick={() => void handleImport(kind)}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-input px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                      >
                        {importing === kind && (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        )}
                        {importing === kind
                          ? "Importing…"
                          : `Import ${importLabels[kind]}`}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
          <p className="text-xs text-muted-foreground">
            Worksheets without a matching import action are not imported. They
            remain in the selected file and are listed above; import them only
            using a supported worksheet format.
          </p>
        </div>
      )}
    </Panel>
  )
}
