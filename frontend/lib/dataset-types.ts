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

export type WorkbookWorksheetPreview = {
  name: string
  headers: string[]
  rowCount: number
  previewRows: string[][]
  supportedBySalesImporter: boolean
  warnings: string[]
}

export type WorkbookPreviewResponse = {
  status: "success"
  fileName: string
  worksheetCount: number
  worksheets: WorkbookWorksheetPreview[]
}

export type WorksheetImportResult = {
  worksheet: string
  recordsCreated: number
  rejectedRows: number[]
  errors: string[]
}

export type ReferenceDataImportResponse = {
  status: "success"
  message: string
  datasetId: string
  worksheets: WorksheetImportResult[]
  totalRecordsCreated: number
}

export type SalesTransactionsImportResponse = {
  status: "success"
  message: string
  detectedWorksheets: string[]
  datasetId: string
  worksheet: string
  recordsCreated: number
  datasetRowCount: number
}

export type CampaignImportResponse = {
  status: "success"
  message: string
  detectedWorksheets: string[]
  datasetId: string
  worksheet: string
  recordsCreated: number
  totalCampaigns: number
}

export type DatasetValidationIssue = {
  code: string
  count: number
  description: string
}

export type DatasetValidationResponse = {
  status: "success"
  datasetId: string
  inspectedRecords: number
  validRecords: number
  recordsWithErrors: number
  recordsWithWarnings: number
  errors: DatasetValidationIssue[]
  warnings: DatasetValidationIssue[]
  informational: {
    rowCountMatches: boolean
    storedRowCount: number
    totalQuantity: number
    recordedRevenue: string
    expectedRevenue: string
    absoluteRevenueDiscrepancy: string
    distinctTransactions: number
    distinctProducts: number
    distinctCategories: number
    distinctPaymentMethods: number
    duplicateCandidateRecords: number
    duplicateCandidateLines: number
  }
}
