import { Router } from "express";
import {
  forecastEvaluation,
  productDemandForecast,
  salesForecast,
} from "../controllers/forecast.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/sales", salesForecast);
router.get("/products", productDemandForecast);
router.get("/evaluation", forecastEvaluation);

export default router;
