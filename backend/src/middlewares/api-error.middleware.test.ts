import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import { createServer, type Server } from "node:http";
import { apiErrorHandler } from "./api-error.middleware";

describe("API error responses", () => {
  const app = express();
  const server: Server = createServer(app);
  let baseUrl: string;

  app.use(express.json());
  app.post("/fail", (_req, _res, next) => {
    next(new Error("private internal detail"));
  });
  app.use((_req, res) => {
    res.status(404).json({ status: "error", message: "API endpoint not found." });
  });
  app.use(apiErrorHandler);

  before(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Could not determine test server address.");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns JSON without parser details for malformed JSON", async () => {
    const response = await fetch(`${baseUrl}/fail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid",
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      status: "error",
      message: "Request body contains invalid JSON.",
    });
  });

  it("returns a safe JSON response for oversized request bodies", async () => {
    const response = await fetch(`${baseUrl}/fail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "x".repeat(110 * 1024) }),
    });

    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), {
      status: "error",
      message: "Request body is too large.",
    });
  });

  it("returns a generic JSON response for unexpected errors", async () => {
    const response = await fetch(`${baseUrl}/fail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    assert.equal(response.status, 500);
    const payload: unknown = await response.json();
    assert.deepEqual(payload, {
      status: "error",
      message: "An unexpected error occurred.",
    });
    assert.doesNotMatch(JSON.stringify(payload), /private internal detail/);
  });
});
