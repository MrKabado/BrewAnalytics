import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { createServer, type Server } from "node:http";
import datasetRoutes from "./dataset.routes";

describe("dataset route authentication", () => {
  const app = express();
  const server: Server = createServer(app);
  let baseUrl: string;

  app.use(cookieParser());
  app.use("/api/datasets", datasetRoutes);

  before(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Could not determine test server address.");
    }

    baseUrl = `http://127.0.0.1:${address.port}/api/datasets`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("requires authentication for every dataset management endpoint", async () => {
    const responses = await Promise.all([
      fetch(baseUrl),
      fetch(`${baseUrl}/preview`, { method: "POST" }),
      fetch(`${baseUrl}/not-a-dataset/reference-data`, { method: "POST" }),
      fetch(`${baseUrl}/not-a-dataset/sales-transactions`, { method: "POST" }),
      fetch(`${baseUrl}/not-a-dataset/campaigns`, { method: "POST" }),
      fetch(`${baseUrl}/not-a-dataset/validation`),
      fetch(`${baseUrl}/unknown-id`),
      fetch(`${baseUrl}/unknown-id/records`),
      fetch(`${baseUrl}/unknown-id`, { method: "DELETE" }),
    ]);

    assert.deepEqual(
      responses.map((response) => response.status),
      [401, 401, 401, 401, 401, 401, 401, 401, 401],
    );

    for (const response of responses) {
      assert.deepEqual(await response.json(), {
        status: "error",
        message: "Authentication required.",
      });
    }
  });
});
