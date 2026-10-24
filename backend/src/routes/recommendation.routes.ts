import { Router } from "express";
import {
  businessRecommendationSummary,
  businessRecommendations,
} from "../controllers/recommendation.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/summary", businessRecommendationSummary);
router.get("/", businessRecommendations);

export default router;
