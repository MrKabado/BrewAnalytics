import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { createServer, type Server } from "node:http";
import recommendationRoutes from "./recommendation.routes";

describe("recommendation route authentication", () => {
  const app = express();
  const server: Server = createServer(app);
  let baseUrl: string;

  app.use(cookieParser());
  app.use("/api/analytics/recommendations", recommendationRoutes);

  before(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Could not determine test server address.");
    }

    baseUrl = `http://127.0.0.1:${address.port}/api/analytics/recommendations`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("requires authentication for list and summary endpoints", async () => {
    const responses = await Promise.all([
      fetch(baseUrl),
      fetch(`${baseUrl}/summary`),
    ]);

    assert.deepEqual(
      responses.map((response) => response.status),
      [401, 401]
    );
  });
});
