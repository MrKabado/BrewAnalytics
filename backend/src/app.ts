
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import datasetRoutes from "./routes/dataset.routes";
import analyticsRoutes from "./routes/analytics.routes";
import aiRoutes from "./routes/ai.routes";
import { apiErrorHandler } from "./middlewares/api-error.middleware";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({
    message: "BrewAnalytics Backend API is running successfully.",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "API is healthy and running.",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ai", aiRoutes);

app.use((_req, res) => {
  res.status(404).json({
    status: "error",
    message: "API endpoint not found.",
  });
});
app.use(apiErrorHandler);

export default app;
