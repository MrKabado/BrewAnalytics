import multer from "multer";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export class UnsupportedUploadTypeError extends Error {
  constructor() {
    super("Only .csv files are accepted.");
    this.name = "UnsupportedUploadTypeError";
  }
}

export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith(".csv")) {
      callback(new UnsupportedUploadTypeError());
      return;
    }

    callback(null, true);
  },
});