import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { createDatasetFromCsv } from "../services/dataset.service";
import { DatasetValidationError } from "./dataset.validation";
import {
  CsvParseError,
  parseSalesCsv,
} from "./csv.parser";
import { ExcelParseError, parseSalesExcel } from "./excel.parser";

const headers = [
  "transactionId",
  "saleDate",
  "productName",
  "category",
  "quantity",
  "unitPrice",
  "totalAmount",
  "paymentMethod",
];

function workbookBuffer(
  bookType: "xlsx" | "xls",
  rows: unknown[][],
  addSecondSheet = false
): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    "Sales"
  );

  if (addSecondSheet) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["not", "the first sheet"]]),
      "Other"
    );
  }

  return Buffer.from(XLSX.write(workbook, { bookType, type: "buffer" }));
}

describe("Excel sales parser", () => {
  it("keeps the existing CSV parser working", () => {
    const csv = `${headers.join(",")}\nT1,2026-01-02,Coffee,Drinks,1,2.50,2.50,Cash`;

    assert.equal(parseSalesCsv(csv)[0].transactionId, "T1");
    assert.throws(() => parseSalesCsv("not,a,sales,csv"), CsvParseError);
  });

  for (const bookType of ["xlsx", "xls"] as const) {
    it(`parses .${bookType} values from the first worksheet`, () => {
      const buffer = workbookBuffer(
        bookType,
        [
          headers,
          [],
          [
            "T1",
            new Date(Date.UTC(2026, 0, 2)),
            "Coffee",
            "Drinks",
            2,
            2.5,
            5,
            "Cash",
          ],
        ],
        true
      );

      const rows = parseSalesExcel(buffer, `sales.${bookType}`);

      assert.equal(rows.length, 1);
      assert.deepEqual(rows[0], {
        transactionId: "T1",
        saleDate: "2026-01-02",
        productName: "Coffee",
        category: "Drinks",
        quantity: "2",
        unitPrice: "2.5",
        totalAmount: "5",
        paymentMethod: "Cash",
      });
    });
  }

  it("rejects an empty workbook and an empty first worksheet", () => {
    const emptySheet = workbookBuffer("xlsx", []);

    assert.throws(
      () => parseSalesExcel(emptySheet, "empty.xlsx"),
      ExcelParseError
    );
  });

  it("rejects missing and duplicate required headers", () => {
    assert.throws(
      () =>
        parseSalesExcel(
          workbookBuffer("xlsx", [["transactionId", "productName"]]),
          "missing.xlsx"
        ),
      /Missing required Excel headers/
    );

    assert.throws(
      () =>
        parseSalesExcel(
          workbookBuffer("xlsx", [[...headers, "productName"]]),
          "duplicate.xlsx"
        ),
      /duplicate headers/
    );
  });

  it("rejects unsupported extensions, mismatched content, and malformed files", () => {
    const validBuffer = workbookBuffer("xlsx", [headers]);

    assert.throws(
      () => parseSalesExcel(validBuffer, "sales.csv"),
      ExcelParseError
    );
    assert.throws(
      () => parseSalesExcel(validBuffer, "sales.xls"),
      ExcelParseError
    );
    assert.throws(
      () => parseSalesExcel(Buffer.from("not a workbook"), "sales.xlsx"),
      ExcelParseError
    );
  });

  it("rejects formula cells instead of importing formula results", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    worksheet["A2"] = { t: "n", f: "1+1", v: 2 };
    worksheet["!ref"] = "A1:H2";
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");
    const buffer = Buffer.from(
      XLSX.write(workbook, { bookType: "xlsx", type: "buffer" })
    );

    assert.throws(
      () => parseSalesExcel(buffer, "formula.xlsx"),
      /Formula cells are not supported/
    );
  });

  it("passes invalid Excel values to the existing row validation", async () => {
    const parsedRows = parseSalesExcel(
      workbookBuffer("xlsx", [
        headers,
        ["T1", "not-a-date", "Coffee", "Drinks", 1, 2.5, 2.5, "Cash"],
        ["T2", "2026-01-02", "Coffee", "Drinks", "not-a-number", 2.5, 2.5, "Cash"],
        ["T3", "2026-01-02", "Coffee", "Drinks", 1, "not-a-price", 2.5, "Cash"],
      ]),
      "invalid-values.xlsx"
    );

    await assert.rejects(
      createDatasetFromCsv("invalid-date.xlsx", [parsedRows[0]]),
      DatasetValidationError
    );
    await assert.rejects(
      createDatasetFromCsv("invalid-quantity.xlsx", [parsedRows[1]]),
      DatasetValidationError
    );
    await assert.rejects(
      createDatasetFromCsv("invalid-price.xlsx", [parsedRows[2]]),
      DatasetValidationError
    );
  });
});
