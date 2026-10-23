import type { Request, Response } from "express";
import { CsvParseError, parseSalesCsv } from "../utils/csv.parser";
import {
  DatasetValidationError,
  createDatasetFromCsv,
  getDatasets,
} from "../services/dataset.service";

export async function uploadDataset(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({
      status: "error",
      message: "A CSV file is required in the 'file' field.",
    });
  }

  try {
    const csv = req.file.buffer.toString("utf8");
    const rows = parseSalesCsv(csv);
    const dataset = await createDatasetFromCsv(req.file.originalname, rows);

    return res.status(201).json({
      status: "success",
      message: "Dataset uploaded successfully.",
      dataset,
    });
  } catch (error) {
    if (error instanceof CsvParseError || error instanceof DatasetValidationError) {
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

export async function listDatasets(_req: Request, res: Response) {
  try {
    const datasets = await getDatasets();

    return res.status(200).json({
      status: "success",
      datasets,
    });
  } catch (error) {
    console.error("Dataset listing error:", error);
    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred while retrieving datasets.",
    });
  }
}