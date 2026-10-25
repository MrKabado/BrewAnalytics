export type Dataset = {
  id: string
  name: string
  originalFileName: string
  rowCount: number
  recordCount: number
  uploadedAt: string
}

export type UploadedDataset = Omit<Dataset, "recordCount"> & {
  recordCount?: number
}

export type DatasetPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type DatasetListResponse = {
  status: "success"
  datasets: Dataset[]
  pagination: DatasetPagination
}

export type DatasetDetailResponse = {
  status: "success"
  dataset: Dataset
}

export type DatasetUploadResponse = {
  status: "success"
  message: string
  dataset: UploadedDataset
}

export type DatasetDeleteResponse = {
  status: "success"
  message: string
}

export type DatasetRecord = {
  id: string
  datasetId: string
  transactionId: string
  saleDate: string
  productName: string
  category: string
  quantity: number
  unitPrice: string
  totalAmount: string
  paymentMethod: string
}

export type DatasetRecordsResponse = {
  status: "success"
  records: DatasetRecord[]
  pagination: DatasetPagination
}

export type DatasetRecordFilters = {
  page: number
  pageSize: number
  productName?: string
  category?: string
  paymentMethod?: string
  saleDateFrom?: string
  saleDateTo?: string
}
