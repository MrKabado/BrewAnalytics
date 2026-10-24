import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { createServer, type Server } from "node:http";
import forecastRoutes from "./forecast.routes";

describe("forecast route authentication", () => {
  const app = express();
  const server: Server = createServer(app);
  let baseUrl: string;

  app.use(cookieParser());
  app.use("/api/analytics/forecasts", forecastRoutes);

  before(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Could not determine test server address.");
    }

    baseUrl = `http://127.0.0.1:${address.port}/api/analytics/forecasts`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("requires authentication on all forecast endpoints", async () => {
    const responses = await Promise.all(
      ["sales", "products", "evaluation"].map((endpoint) =>
        fetch(`${baseUrl}/${endpoint}`)
      )
    );

    assert.deepEqual(
      responses.map((response) => response.status),
      [401, 401, 401]
    );

    for (const response of responses) {
      assert.deepEqual(await response.json(), {
        status: "error",
        message: "Authentication required.",
      });
    }
  });
});
