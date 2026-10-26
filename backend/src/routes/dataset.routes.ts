import { Router, type ErrorRequestHandler } from "express";
import multer from "multer";
import {
  getDatasetDetails,
  importDatasetReferenceData,
  importDatasetSalesTransactions,
  listDatasetRecords,
  listDatasets,
  previewDatasetWorkbook,
  removeDataset,
  uploadDataset,
} from "../controllers/dataset.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  UnsupportedUploadTypeError,
  uploadDatasetFile,
} from "../middlewares/upload.middleware";

const router = Router();

export const handleUploadError: ErrorRequestHandler = (
  error,
  _req,
  res,
  next,
) => {
  if (error instanceof UnsupportedUploadTypeError) {
    return res.status(415).json({
      status: "error",
      message: error.message,
    });
  }

  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "The uploaded file must be 10 MB or smaller."
        : error.code === "LIMIT_FILE_COUNT"
          ? "Only one file can be uploaded at a time."
          : error.code === "LIMIT_UNEXPECTED_FILE"
            ? "Upload exactly one file using the 'file' field."
            : error.message;

    return res.status(status).json({
      status: "error",
      message,
    });
  }

  next(error);
};

router.post(
  "/preview",
  requireAuth,
  uploadDatasetFile.single("file"),
  handleUploadError,
  previewDatasetWorkbook,
);
router.post(
  "/:id/reference-data",
  requireAuth,
  uploadDatasetFile.single("file"),
  handleUploadError,
  importDatasetReferenceData,
);
router.post(
  "/:id/sales-transactions",
  requireAuth,
  uploadDatasetFile.single("file"),
  handleUploadError,
  importDatasetSalesTransactions,
);
router.post(
  "/upload",
  requireAuth,
  uploadDatasetFile.single("file"),
  handleUploadError,
  uploadDataset,
);
router.get("/", requireAuth, listDatasets);
router.get("/:id/records", requireAuth, listDatasetRecords);
router.get("/:id", requireAuth, getDatasetDetails);
router.delete("/:id", requireAuth, removeDataset);

export default router;
