import { apiRequest } from "@/lib/api-client"
import type {
  DatasetDeleteResponse,
  DatasetDetailResponse,
  DatasetListResponse,
  DatasetRecordFilters,
  DatasetRecordsResponse,
  DatasetUploadResponse,
} from "@/lib/dataset-types"

export function listDatasets(page = 1, pageSize = 20) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  return apiRequest<DatasetListResponse>(`/api/datasets?${query}`)
}

export function uploadDataset(file: File) {
  const formData = new FormData()
  formData.append("file", file)
  return apiRequest<DatasetUploadResponse>("/api/datasets/upload", {
    method: "POST",
    body: formData,
  })
}

export function getDataset(id: string) {
  return apiRequest<DatasetDetailResponse>(
    `/api/datasets/${encodeURIComponent(id)}`,
  )
}

export function listDatasetRecords(
  id: string,
  filters: DatasetRecordFilters,
) {
  const query = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  })

  for (const key of [
    "productName",
    "category",
    "paymentMethod",
    "saleDateFrom",
    "saleDateTo",
  ] as const) {
    const value = filters[key]
    if (value) query.set(key, value)
  }

  return apiRequest<DatasetRecordsResponse>(
    `/api/datasets/${encodeURIComponent(id)}/records?${query}`,
  )
}

export function deleteDataset(id: string) {
  return apiRequest<DatasetDeleteResponse>(
    `/api/datasets/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  )
}
