import type { Request, Response } from "express";
import {
  DatasetNotFoundError,
  getCategoryPerformance,
  getDailySalesSummary,
  getProductPerformance,
  getSalesOverview,
  getSalesTrends,
} from "../services/analytics.service";
import {
  parseAnalyticsFilters,
  parseProductFilters,
  parseSalesTrendFilters,
} from "../utils/analytics.query";
import { DatasetValidationError } from "../utils/dataset.validation";

function handleAnalyticsError(
  error: unknown,
  res: Response,
  operation: string,
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

export async function salesOverview(req: Request, res: Response) {
  try {
    const filters = parseAnalyticsFilters(req.query);
    const overview = await getSalesOverview(filters);

    return res.status(200).json({
      status: "success",
      ...overview,
    });
  } catch (error) {
    return handleAnalyticsError(error, res, "sales overview");
  }
}

export async function productPerformance(req: Request, res: Response) {
  try {
    const filters = parseProductFilters(req.query);
    const products = await getProductPerformance(filters);

    return res.status(200).json({
      status: "success",
      ...products,
    });
  } catch (error) {
    return handleAnalyticsError(error, res, "product performance");
  }
}

export async function categoryPerformance(req: Request, res: Response) {
  try {
    const filters = parseAnalyticsFilters(req.query);
    const categories = await getCategoryPerformance(filters);

    return res.status(200).json({
      status: "success",
      ...categories,
    });
  } catch (error) {
    return handleAnalyticsError(error, res, "category performance");
  }
}

export async function salesTrends(req: Request, res: Response) {
  try {
    const filters = parseSalesTrendFilters(req.query);
    const trends = await getSalesTrends(filters);

    return res.status(200).json({
      status: "success",
      ...trends,
    });
  } catch (error) {
    return handleAnalyticsError(error, res, "sales trends");
  }
}

export async function dailySalesSummary(req: Request, res: Response) {
  try {
    const filters = parseSalesTrendFilters(req.query);
    if (filters.aggregation !== "daily") {
      throw new DatasetValidationError(
        "aggregation must be 'daily' for the daily sales summary.",
      );
    }
    const summary = await getDailySalesSummary(filters);

    return res.status(200).json({
      status: "success",
      ...summary,
    });
  } catch (error) {
    return handleAnalyticsError(error, res, "daily sales summary");
  }
}
