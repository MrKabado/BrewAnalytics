import type { Request, Response } from "express";
import { DatasetNotFoundError } from "../services/analytics.service";
import {
  getBusinessRecommendationSummary,
  getBusinessRecommendations,
} from "../services/recommendation.service";
import { parseRecommendationFilters } from "../utils/recommendation.query";
import { DatasetValidationError } from "../utils/dataset.validation";

function handleRecommendationError(error: unknown, res: Response) {
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

  console.error("Business recommendations error:", error);
  return res.status(500).json({
    status: "error",
    message: "An unexpected error occurred while generating recommendations.",
  });
}

export async function businessRecommendations(req: Request, res: Response) {
  try {
    const filters = parseRecommendationFilters(req.query);
    const recommendations = await getBusinessRecommendations(filters);

    return res.status(200).json({
      status: "success",
      datasetId: filters.datasetId ?? null,
      aggregation: filters.aggregation,
      recommendationCount: recommendations.length,
      message:
        recommendations.length === 0
          ? "No recommendation rules were triggered by the available evidence."
          : undefined,
      recommendations,
      notes: [
        "Recommendations are deterministic rule-based guidance and may change as sales data changes.",
        "Revenue is not profit; product costs and margins are not available.",
        "Inventory and staffing levels are not tracked, so recommendations do not assert stock shortages, excess inventory, or staffing problems.",
      ],
    });
  } catch (error) {
    return handleRecommendationError(error, res);
  }
}

export async function businessRecommendationSummary(
  req: Request,
  res: Response
) {
  try {
    const filters = parseRecommendationFilters(req.query);
    const summary = await getBusinessRecommendationSummary(filters);

    return res.status(200).json({
      status: "success",
      datasetId: filters.datasetId ?? null,
      ...summary,
    });
  } catch (error) {
    return handleRecommendationError(error, res);
  }
}
