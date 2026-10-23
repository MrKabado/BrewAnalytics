import path from "node:path";
import multer from "multer";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export class UnsupportedUploadTypeError extends Error {
  constructor() {
    super("Only .csv, .xlsx, and .xls files are accepted.");
    this.name = "UnsupportedUploadTypeError";
  }
}

export const uploadDatasetFile = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (![".csv", ".xlsx", ".xls"].includes(path.extname(file.originalname).toLowerCase())) {
      callback(new UnsupportedUploadTypeError());
      return;
    }

    callback(null, true);
  },
});