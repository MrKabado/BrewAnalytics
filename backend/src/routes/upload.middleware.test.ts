import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "node:http";
import { handleUploadError } from "./dataset.routes";
import { uploadDatasetFile } from "../middlewares/upload.middleware";

describe("dataset upload file middleware", () => {
  const app = express();
  const server: Server = createServer(app);
  let baseUrl: string;

  app.post(
    "/upload",
    uploadDatasetFile.single("file"),
    handleUploadError,
    (req: Request, res: Response) =>
      res.status(200).json({ filename: req.file?.originalname })
  );

  before(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Could not determine test server address.");
    }

    baseUrl = `http://127.0.0.1:${address.port}/upload`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function upload(contents: Buffer, fileName: string) {
    const form = new FormData();
    const bytes = new Uint8Array(contents.length);
    bytes.set(contents);
    form.append(
      "file",
      new Blob([bytes], { type: "application/octet-stream" }),
      fileName
    );
    return fetch(baseUrl, { method: "POST", body: form });
  }

  it("accepts CSV and Excel extensions without relying on MIME type", async () => {
    for (const fileName of ["sales.csv", "sales.xlsx", "sales.xls"]) {
      const response = await upload(Buffer.from("contents"), fileName);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { filename: fileName });
    }
  });

  it("rejects unsupported extensions", async () => {
    const response = await upload(Buffer.from("contents"), "sales.pdf");

    assert.equal(response.status, 415);
    assert.deepEqual(await response.json(), {
      status: "error",
      message: "Only .csv, .xlsx, and .xls files are accepted.",
    });
  });

  it("rejects files larger than 10 MB", async () => {
    const response = await upload(
      Buffer.alloc(10 * 1024 * 1024 + 1),
      "large.xlsx"
    );

    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), {
      status: "error",
      message: "The uploaded file must be 10 MB or smaller.",
    });
  });
});
