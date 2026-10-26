import { Router } from "express";
import {
  categoryPerformance,
  dailySalesSummary,
  productPerformance,
  salesOverview,
  salesTrends,
} from "../controllers/analytics.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import forecastRoutes from "./forecast.routes";
import recommendationRoutes from "./recommendation.routes";

const router = Router();

router.use(requireAuth);
router.get("/overview", salesOverview);
router.get("/products", productPerformance);
router.get("/categories", categoryPerformance);
router.get("/sales-trends", salesTrends);
router.get("/daily-summary", dailySalesSummary);
router.use("/forecasts", forecastRoutes);
router.use("/recommendations", recommendationRoutes);

export default router;
