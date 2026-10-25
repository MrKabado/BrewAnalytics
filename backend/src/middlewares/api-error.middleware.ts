import type { ErrorRequestHandler } from "express";

type RequestError = {
  status?: unknown;
  statusCode?: unknown;
  type?: unknown;
};

function isRequestError(error: unknown): error is RequestError {
  return typeof error === "object" && error !== null;
}

export const apiErrorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next
) => {
  if (isRequestError(error)) {
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({
        status: "error",
        message: "Request body contains invalid JSON.",
      });
    }

    if (error.type === "entity.too.large") {
      return res.status(413).json({
        status: "error",
        message: "Request body is too large.",
      });
    }

    const status =
      typeof error.status === "number"
        ? error.status
        : typeof error.statusCode === "number"
          ? error.statusCode
          : 500;

    if (status >= 400 && status < 500) {
      return res.status(status).json({
        status: "error",
        message: "The request could not be processed.",
      });
    }
  }

  console.error("Unhandled API request error:", error);
  return res.status(500).json({
    status: "error",
    message: "An unexpected error occurred.",
  });
};
