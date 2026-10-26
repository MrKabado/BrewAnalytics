import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import {
  parseSalesTransactionWorkbook,
  SalesTransactionParseError,
} from "./sales-transaction.parser";

const headers = [
  "Transaction ID",
  "Sale Date",
  "Product ID",
  "Quantity",
  "Unit Price",
  "Total Amount",
  "Payment Method",
  "Customer ID",
];

function workbookBuffer(
  sheets: Array<{ name: string; rows: unknown[][] }>,
): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(sheet.rows),
      sheet.name,
    );
  }
  return Buffer.from(
    XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }),
  );
}

describe("Sales Transactions workbook parser", () => {
  it("parses normalized headers, optional customer IDs, and repeated transaction IDs", () => {
    const parsed = parseSalesTransactionWorkbook(
      workbookBuffer([
        {
          name: "Products",
          rows: [["Product ID"], ["P-1"]],
        },
        {
          name: " Sales_Transactions ",
          rows: [
            [
              "transaction_id",
              "Transaction Date and Time",
              "productId",
              "quantity",
              "unit_price",
              "totalSales",
              "payment_method",
              "customer_id",
            ],
            ["T-1", "2026-02-01T14:30:00Z", "P-1", 2, 50, 100, "Cash", "C-1"],
            ["T-1", "2026-02-01", "P-1", 1, 50, 50, "Cash", ""],
          ],
        },
      ]),
      "transactions.xlsx",
    );

    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.rows[0].transactionId, "T-1");
    assert.equal(parsed.rows[0].customerId, "C-1");
    assert.equal(parsed.rows[1].customerId, null);
    assert.equal(
      parsed.rows[0].saleDate.toISOString(),
      "2026-02-01T00:00:00.000Z",
    );
    assert.equal(
      parsed.rows[0].saleDateTime?.toISOString(),
      "2026-02-01T14:30:00.000Z",
    );
    assert.deepEqual(parsed.worksheetNames, [
      "Products",
      " Sales_Transactions ",
    ]);
  });

  it("rejects missing or ambiguous headers", () => {
    assert.throws(
      () =>
        parseSalesTransactionWorkbook(
          workbookBuffer([
            { name: "Sales Transactions", rows: [["Transaction ID"]] },
          ]),
          "missing.xlsx",
        ),
      (error: unknown) =>
        error instanceof SalesTransactionParseError &&
        error.message.includes("missing required headers"),
    );

    assert.throws(
      () =>
        parseSalesTransactionWorkbook(
          workbookBuffer([
            {
              name: "Sales Transactions",
              rows: [
                [...headers, "transaction_id"],
                ["T-1", "2026-02-01", "P-1", 1, 10, 10, "Cash", "", "T-2"],
              ],
            },
          ]),
          "ambiguous.xlsx",
        ),
      /duplicate headers/,
    );

    assert.throws(
      () =>
        parseSalesTransactionWorkbook(
          workbookBuffer([
            {
              name: "Sales Transactions",
              rows: [
                [...headers, "Transaction Date"],
                [
                  "T-1",
                  "2026-02-01",
                  "P-1",
                  1,
                  10,
                  10,
                  "Cash",
                  "",
                  "2026-02-01",
                ],
              ],
            },
          ]),
          "multiple-date-headers.xlsx",
        ),
      /more than one header for saleDate/,
    );
  });

  it("reports invalid dates, quantities, monetary values, and total mismatches by row", () => {
    assert.throws(
      () =>
        parseSalesTransactionWorkbook(
          workbookBuffer([
            {
              name: "Sales Transactions",
              rows: [
                headers,
                ["T-1", "2026-02-30", "P-1", 0, -1, 99, "", ""],
                ["T-2", "2026-02-01", "P-1", 2, 10, 19, "Cash", ""],
              ],
            },
          ]),
          "invalid-rows.xlsx",
        ),
      (error: unknown) =>
        error instanceof SalesTransactionParseError &&
        error.worksheetErrors[0].rejectedRows.includes(2) &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("saleDate"),
        ) &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("quantity"),
        ) &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("unitPrice"),
        ) &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("must equal quantity multiplied by unitPrice"),
        ),
    );
  });

  it("rejects duplicate full sales lines but allows distinct lines with the same transaction ID", () => {
    const duplicateLine = ["T-1", "2026-02-01", "P-1", 1, 10, 10, "Cash", ""];
    assert.throws(
      () =>
        parseSalesTransactionWorkbook(
          workbookBuffer([
            {
              name: "Sales Transactions",
              rows: [headers, duplicateLine, duplicateLine],
            },
          ]),
          "duplicate-lines.xlsx",
        ),
      (error: unknown) =>
        error instanceof SalesTransactionParseError &&
        error.worksheetErrors[0].rejectedRows.length === 2 &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("duplicate sales lines"),
        ),
    );

    const parsed = parseSalesTransactionWorkbook(
      workbookBuffer([
        {
          name: "Sales Transactions",
          rows: [
            headers,
            duplicateLine,
            ["T-1", "2026-02-01", "P-2", 1, 10, 10, "Cash", ""],
          ],
        },
      ]),
      "multiple-lines.xlsx",
    );
    assert.equal(parsed.rows.length, 2);
  });

  it("rejects empty, malformed, and workbook-without-sales-worksheet inputs", () => {
    assert.throws(
      () =>
        parseSalesTransactionWorkbook(
          workbookBuffer([{ name: "Sales Transactions", rows: [] }]),
          "empty.xlsx",
        ),
      /empty/,
    );
    assert.throws(
      () =>
        parseSalesTransactionWorkbook(
          Buffer.from("not a workbook"),
          "broken.xlsx",
        ),
      /does not match a supported Excel workbook/,
    );
    assert.throws(
      () =>
        parseSalesTransactionWorkbook(
          workbookBuffer([{ name: "Products", rows: [headers] }]),
          "no-sales.xlsx",
        ),
      /must contain a Sales Transactions worksheet/,
    );
  });
});
