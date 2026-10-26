import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import express from "express";
import { createServer, type Server } from "node:http";
import * as XLSX from "xlsx";
import { previewDatasetWorkbook } from "./dataset.controller";
import { handleUploadError } from "../routes/dataset.routes";
import { uploadDatasetFile } from "../middlewares/upload.middleware";

const salesHeaders = [
  "transactionId",
  "saleDate",
  "productName",
  "category",
  "quantity",
  "unitPrice",
  "totalAmount",
  "paymentMethod",
];

function workbookBuffer(): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      salesHeaders,
      ["T1", "2026-01-02", "Coffee", "Drinks", 1, 2.5, 2.5, "Cash"],
    ]),
    "Sales",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["productId", "productName"],
      ["P1", "Coffee"],
    ]),
    "Products",
  );

  return Buffer.from(
    XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }),
  );
}

describe("dataset workbook preview endpoint", () => {
  const app = express();
  const server: Server = createServer(app);
  let baseUrl: string;

  app.post(
    "/preview",
    uploadDatasetFile.single("file"),
    handleUploadError,
    previewDatasetWorkbook,
  );

  before(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Could not determine test server address.");
    }
    baseUrl = `http://127.0.0.1:${address.port}/preview`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns per-worksheet preview details without importing records", async () => {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(workbookBuffer())], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "business-data.xlsx",
    );

    const response = await fetch(baseUrl, { method: "POST", body: form });
    const payload = (await response.json()) as {
      status: string;
      worksheetCount: number;
      worksheets: Array<{
        name: string;
        rowCount: number;
        supportedBySalesImporter: boolean;
      }>;
    };

    assert.equal(response.status, 200);
    assert.equal(payload.status, "success");
    assert.equal(payload.worksheetCount, 2);
    assert.deepEqual(
      payload.worksheets.map((worksheet) => ({
        name: worksheet.name,
        rowCount: worksheet.rowCount,
        supportedBySalesImporter: worksheet.supportedBySalesImporter,
      })),
      [
        { name: "Sales", rowCount: 1, supportedBySalesImporter: true },
        { name: "Products", rowCount: 1, supportedBySalesImporter: false },
      ],
    );
  });

  it("rejects CSV files and malformed Excel workbooks", async () => {
    const csvForm = new FormData();
    csvForm.append("file", new Blob(["csv"]), "sales.csv");
    const csvResponse = await fetch(baseUrl, {
      method: "POST",
      body: csvForm,
    });
    assert.equal(csvResponse.status, 415);

    const malformedForm = new FormData();
    malformedForm.append(
      "file",
      new Blob(["not an Excel workbook"]),
      "broken.xlsx",
    );
    const malformedResponse = await fetch(baseUrl, {
      method: "POST",
      body: malformedForm,
    });
    assert.equal(malformedResponse.status, 400);
  });

  it("recognizes the relational Sales Transactions worksheet format", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        [
          "Transaction ID",
          "Sale Date",
          "Product ID",
          "Quantity",
          "Unit Price",
          "Total Amount",
          "Payment Method",
          "Customer ID",
        ],
        ["T-1", "2026-01-02", "P-1", 1, 25, 25, "Cash", ""],
      ]),
      "Sales Transactions",
    );
    const form = new FormData();
    form.append(
      "file",
      new Blob([
        new Uint8Array(
          Buffer.from(
            XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }),
          ),
        ),
      ]),
      "transactions.xlsx",
    );
    const response = await fetch(baseUrl, { method: "POST", body: form });
    const payload = (await response.json()) as {
      worksheets: Array<{
        supportedBySalesImporter: boolean;
        warnings: string[];
      }>;
    };

    assert.equal(response.status, 200);
    assert.equal(payload.worksheets[0].supportedBySalesImporter, true);
    assert.match(
      payload.worksheets[0].warnings.join(" "),
      /validated during import/,
    );
  });
});
