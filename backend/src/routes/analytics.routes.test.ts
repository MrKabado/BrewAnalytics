import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { createServer, type Server } from "node:http";
import analyticsRoutes from "./analytics.routes";

describe("analytics route authentication", () => {
  const app = express();
  const server: Server = createServer(app);
  let baseUrl: string;

  app.use(cookieParser());
  app.use("/api/analytics", analyticsRoutes);

  before(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Could not determine test server address.");
    }

    baseUrl = `http://127.0.0.1:${address.port}/api/analytics`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("requires authentication on every analytics endpoint", async () => {
    const responses = await Promise.all(
      ["overview", "products", "categories", "sales-trends"].map((endpoint) =>
        fetch(`${baseUrl}/${endpoint}`)
      )
    );

    assert.deepEqual(
      responses.map((response) => response.status),
      [401, 401, 401, 401]
    );
  });
});
