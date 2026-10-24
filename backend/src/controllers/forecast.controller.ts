import type { Request, Response } from "express";
import {
  DatasetNotFoundError,
} from "../services/analytics.service";
import {
  evaluateRevenueForecast,
  forecastProductDemand,
  forecastSales,
} from "../services/forecast.service";
import {
  parseEvaluationFilters,
  parseForecastFilters,
  parseProductForecastFilters,
} from "../utils/forecast.query";
import { DatasetValidationError } from "../utils/dataset.validation";

function handleForecastError(
  error: unknown,
  res: Response,
  operation: string
) {
  if (error instanceof DatasetValidationError) {
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }

  if (error instanceof DatasetNotFoundError) {
    return res.status(404).json({
      status: "error",
      message: error.message,
    });
  }

  console.error(`${operation} error:`, error);
  return res.status(500).json({
    status: "error",
    message: `An unexpected error occurred while retrieving ${operation}.`,
  });
}

export async function salesForecast(req: Request, res: Response) {
  try {
    const filters = parseForecastFilters(req.query);
    const result = await forecastSales(filters);

    return res.status(200).json({
      ...result,
      status: "success",
    });
  } catch (error) {
    return handleForecastError(error, res, "sales forecast");
  }
}

export async function productDemandForecast(req: Request, res: Response) {
  try {
    const filters = parseProductForecastFilters(req.query);
    const result = await forecastProductDemand(filters);

    return res.status(200).json({
      ...result,
      status: "success",
    });
  } catch (error) {
    return handleForecastError(error, res, "product demand forecast");
  }
}

export async function forecastEvaluation(req: Request, res: Response) {
  try {
    const filters = parseEvaluationFilters(req.query);
    const result = await evaluateRevenueForecast(filters);

    return res.status(200).json({
      ...result,
      status: "success",
    });
  } catch (error) {
    return handleForecastError(error, res, "forecast evaluation");
  }
}
