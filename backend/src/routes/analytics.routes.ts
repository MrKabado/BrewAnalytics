import { Router } from "express";
import {
  categoryPerformance,
  productPerformance,
  salesOverview,
  salesTrends,
} from "../controllers/analytics.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/overview", salesOverview);
router.get("/products", productPerformance);
router.get("/categories", categoryPerformance);
router.get("/sales-trends", salesTrends);

export default router;
