
import { Router } from "express";
import { testGeminiConnection } from "../modules/ai-insights/gemini.service";

const router = Router();

router.get("/test", async (_req, res) => {
  try {
    const message = await testGeminiConnection();
    res.json({ success: true, message });
  } catch (error) {
    console.error("Gemini test failed:", error);
    res.status(500).json({
      success: false,
      message: "Gemini connection failed.",
    });
  }
});

export default router;
