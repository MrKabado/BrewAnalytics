import type { Request, Response } from "express";
import path from "node:path";
import { CsvParseError, parseSalesCsv } from "../utils/csv.parser";
import {
  ExcelParseError,
  inspectSalesExcel,
  parseSalesExcel,
} from "../utils/excel.parser";
import {
  createDatasetFromCsv,
  deleteDataset,
  getDatasetById,
  getDatasetRecords,
  getDatasets,
} from "../services/dataset.service";
import {
  importReferenceData,
  isReferenceUniqueConflict,
  ReferenceDatasetNotFoundError,
  ReferenceDataConflictError,
} from "../services/reference-data.service";
import {
  parseDatasetRecordFilters,
  parsePaginationParams,
} from "../utils/dataset.query";
import { DatasetValidationError } from "../utils/dataset.validation";
import {
  parseReferenceWorkbook,
  ReferenceDataParseError,
} from "../utils/reference-data.parser";
import {
  parseSalesTransactionWorkbook,
  SalesTransactionParseError,
} from "../utils/sales-transaction.parser";
import {
  ConcurrentSalesImportError,
  DuplicateSalesImportError,
  importSalesTransactions,
  SalesTransactionImportError,
} from "../services/sales-transaction.service";
import {
  CampaignConflictError,
  importCampaigns,
  isCampaignUniqueConflict,
} from "../services/campaign.service";
import {
  CampaignParseError,
  parseCampaignWorkbook,
} from "../utils/campaign.parser";
import { validateDataset } from "../services/dataset.validation.service";
import { DatasetNotFoundError } from "../services/analytics.service";

function getDatasetId(req: Request, res: Response): string | undefined {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    res.status(400).json({
      status: "error",
      message: "A valid dataset ID is required.",
    });
    return undefined;
  }

  return id;
}

export async function uploadDataset(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({
      status: "error",
      message: "A CSV or Excel file is required in the 'file' field.",
    });
  }

  try {
    const extension = path.extname(req.file.originalname).toLowerCase();
    const rows =
      extension === ".csv"
        ? parseSalesCsv(req.file.buffer.toString("utf8"))
        : parseSalesExcel(req.file.buffer, req.file.originalname);
    const dataset = await createDatasetFromCsv(req.file.originalname, rows);

    return res.status(201).json({
      status: "success",
      message: "Dataset uploaded successfully.",
      dataset,
    });
  } catch (error) {
    if (
      error instanceof CsvParseError ||
      error instanceof ExcelParseError ||
      error instanceof DatasetValidationError
    ) {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    console.error("Dataset upload error:", error);
    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred while uploading the dataset.",
    });
  }
}

export async function previewDatasetWorkbook(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({
      status: "error",
      message: "An Excel workbook is required in the 'file' field.",
    });
  }

  const extension = path.extname(req.file.originalname).toLowerCase();
  if (extension !== ".xlsx" && extension !== ".xls") {
    return res.status(415).json({
      status: "error",
      message: "Workbook preview supports .xlsx and .xls files only.",
    });
  }

  try {
    const preview = inspectSalesExcel(req.file.buffer, req.file.originalname);
    return res.status(200).json({
      status: "success",
      ...preview,
    });
  } catch (error) {
    if (error instanceof ExcelParseError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    console.error("Dataset workbook preview error:", error);
    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred while previewing the workbook.",
    });
  }
}

export async function importDatasetReferenceData(req: Request, res: Response) {
  const id = getDatasetId(req, res);
  if (!id) return;

  if (!req.file) {
    return res.status(400).json({
      status: "error",
      message: "An Excel workbook is required in the 'file' field.",
    });
  }

  const extension = path.extname(req.file.originalname).toLowerCase();
  if (extension !== ".xlsx" && extension !== ".xls") {
    return res.status(415).json({
      status: "error",
      message:
        "Products and Customers import supports .xlsx and .xls files only.",
    });
  }

  try {
    const parsed = parseReferenceWorkbook(
      req.file.buffer,
      req.file.originalname,
    );
    const result = await importReferenceData(id, parsed);
    return res.status(201).json({
      status: "success",
      message: "Reference data imported successfully.",
      ...result,
    });
  } catch (error) {
    if (error instanceof ExcelParseError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    if (error instanceof ReferenceDataParseError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        worksheets: error.worksheetErrors.map((worksheet) => ({
          worksheet: worksheet.worksheet,
          recordsCreated: 0,
          rejectedRows: worksheet.rejectedRows,
          errors: worksheet.errors,
        })),
      });
    }

    if (error instanceof ReferenceDataConflictError) {
      return res.status(409).json({
        status: "error",
        message: error.message,
        worksheets: error.conflicts.map((conflict) => ({
          worksheet: conflict.worksheet,
          recordsCreated: 0,
          rejectedRows: conflict.rejectedRows,
          errors: conflict.errors,
        })),
      });
    }

    if (error instanceof ReferenceDatasetNotFoundError) {
      return res.status(404).json({
        status: "error",
        message: error.message,
      });
    }

    if (isReferenceUniqueConflict(error)) {
      return res.status(409).json({
        status: "error",
        message:
          "A Product or Customer identifier already exists in this dataset. Existing records were not overwritten.",
      });
    }

    console.error("Dataset reference data import error:", error);
    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred while importing reference data.",
    });
  }
}

export async function importDatasetSalesTransactions(
  req: Request,
  res: Response,
) {
  const id = getDatasetId(req, res);
  if (!id) return;

  if (!req.file) {
    return res.status(400).json({
      status: "error",
      message: "An Excel workbook is required in the 'file' field.",
    });
  }

  const extension = path.extname(req.file.originalname).toLowerCase();
  if (extension !== ".xlsx" && extension !== ".xls") {
    return res.status(415).json({
      status: "error",
      message: "Sales Transactions import supports .xlsx and .xls files only.",
    });
  }

  try {
    const workbook = parseSalesTransactionWorkbook(
      req.file.buffer,
      req.file.originalname,
    );
    const result = await importSalesTransactions(
      id,
      workbook.worksheetName,
      workbook.rows,
    );
    return res.status(201).json({
      status: "success",
      message: "Sales Transactions imported successfully.",
      detectedWorksheets: workbook.worksheetNames,
      ...result,
    });
  } catch (error) {
    if (error instanceof SalesTransactionParseError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        worksheets: error.worksheetErrors,
      });
    }
    if (error instanceof SalesTransactionImportError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        worksheets: error.worksheetErrors,
      });
    }
    if (error instanceof DuplicateSalesImportError) {
      return res.status(409).json({
        status: "error",
        message: error.message,
        worksheets: error.issues,
      });
    }
    if (error instanceof ConcurrentSalesImportError) {
      return res.status(409).json({
        status: "error",
        message: error.message,
        worksheets: error.issues,
      });
    }
    if (error instanceof ReferenceDatasetNotFoundError) {
      return res.status(404).json({
        status: "error",
        message: error.message,
      });
    }

    console.error("Dataset sales transactions import error:", error);
    return res.status(500).json({
      status: "error",
      message:
        "An unexpected error occurred while importing sales transactions.",
    });
  }
}

export async function importDatasetCampaigns(req: Request, res: Response) {
  const id = getDatasetId(req, res);
  if (!id) return;

  if (!req.file) {
    return res.status(400).json({
      status: "error",
      message: "An Excel workbook is required in the 'file' field.",
    });
  }

  const extension = path.extname(req.file.originalname).toLowerCase();
  if (extension !== ".xlsx" && extension !== ".xls") {
    return res.status(415).json({
      status: "error",
      message: "Marketing Campaigns import supports .xlsx and .xls files only.",
    });
  }

  try {
    const workbook = parseCampaignWorkbook(
      req.file.buffer,
      req.file.originalname,
    );
    const result = await importCampaigns(
      id,
      workbook.worksheetName,
      workbook.campaigns,
    );
    return res.status(201).json({
      status: "success",
      message: "Marketing Campaigns imported successfully.",
      detectedWorksheets: workbook.worksheetNames,
      ...result,
    });
  } catch (error) {
    if (error instanceof CampaignParseError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        worksheets: error.worksheetErrors,
      });
    }
    if (error instanceof CampaignConflictError) {
      return res.status(409).json({
        status: "error",
        message: error.message,
        worksheets: error.conflicts,
      });
    }
    if (error instanceof ReferenceDatasetNotFoundError) {
      return res.status(404).json({
        status: "error",
        message: error.message,
      });
    }
    if (isCampaignUniqueConflict(error)) {
      return res.status(409).json({
        status: "error",
        message:
          "A campaign ID already exists in this dataset. Existing campaigns were not overwritten.",
      });
    }

    console.error("Dataset campaign import error:", error);
    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred while importing campaigns.",
    });
  }
}

export async function listDatasets(req: Request, res: Response) {
  try {
    const pagination = parsePaginationParams(req.query);
    const { datasets, total } = await getDatasets(
      pagination.page,
      pagination.pageSize,
    );

    return res.status(200).json({
      status: "success",
      datasets,
      pagination: {
        ...pagination,
        total,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    });
  } catch (error) {
    if (error instanceof DatasetValidationError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    console.error("Dataset listing error:", error);
    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred while retrieving datasets.",
    });
  }
}

export async function getDatasetDetails(req: Request, res: Response) {
  const id = getDatasetId(req, res);

  if (!id) {
    return;
  }

  try {
    const dataset = await getDatasetById(id);

    if (!dataset) {
      return res.status(404).json({
        status: "error",
        message: "Dataset not found.",
      });
    }

    const { _count, ...metadata } = dataset;

    return res.status(200).json({
      status: "success",
      dataset: {
        ...metadata,
        recordCount: _count.records,
      },
    });
  } catch (error) {
    console.error("Dataset detail error:", error);
    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred while retrieving the dataset.",
    });
  }
}

export async function validateDatasetData(req: Request, res: Response) {
  const id = getDatasetId(req, res);
  if (!id) return;

  try {
    const validation = await validateDataset(id);
    return res.status(200).json({
      status: "success",
      ...validation,
    });
  } catch (error) {
    if (error instanceof DatasetNotFoundError) {
      return res.status(404).json({
        status: "error",
        message: error.message,
      });
    }
    console.error("Dataset validation error:", error);
    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred while validating the dataset.",
    });
  }
}

export async function listDatasetRecords(req: Request, res: Response) {
  const id = getDatasetId(req, res);

  if (!id) {
    return;
  }

  try {
    const filters = parseDatasetRecordFilters(req.query);
    const dataset = await getDatasetById(id);

    if (!dataset) {
      return res.status(404).json({
        status: "error",
        message: "Dataset not found.",
      });
    }

    const { records, total } = await getDatasetRecords(id, filters);

    return res.status(200).json({
      status: "success",
      records,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize),
      },
    });
  } catch (error) {
    if (error instanceof DatasetValidationError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
      });
    }

    console.error("Dataset records error:", error);
    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred while retrieving dataset records.",
    });
  }
}

export async function removeDataset(req: Request, res: Response) {
  const id = getDatasetId(req, res);

  if (!id) {
    return;
  }

  try {
    const deleted = await deleteDataset(id);

    if (!deleted) {
      return res.status(404).json({
        status: "error",
        message: "Dataset not found.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Dataset deleted successfully.",
    });
  } catch (error) {
    console.error("Dataset deletion error:", error);
    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred while deleting the dataset.",
    });
  }
}
