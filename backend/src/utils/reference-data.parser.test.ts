import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { ProductStatus } from "@/generated/prisma/client";
import {
  parseReferenceWorkbook,
  ReferenceDataParseError,
} from "./reference-data.parser";

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

const productHeaders = [
  "Product ID",
  "Product Name",
  "Category",
  "Unit Price",
  "Unit Cost",
  "Product Status",
];
const customerHeaders = [
  "Customer ID",
  "Customer Type",
  "Age Group",
  "Gender",
  "Registration Date",
];

describe("Products and Customers workbook parser", () => {
  it("parses normalized worksheet names, headers, optional values, and blank rows", () => {
    const parsed = parseReferenceWorkbook(
      workbookBuffer([
        {
          name: " products ",
          rows: [
            productHeaders,
            [" P-1 ", " Latte ", " Coffee ", 125.5, "", "active"],
            [],
            ["P-2", "Muffin", "Bakery", 80, 32, "DISCONTINUED"],
          ],
        },
        {
          name: "CUSTOMERS",
          rows: [
            customerHeaders,
            ["C-1", "Loyalty", "Adult", "", new Date("2026-01-15T00:00:00Z")],
          ],
        },
      ]),
      "reference-data.xlsx",
    );

    assert.equal(parsed.products?.length, 2);
    assert.deepEqual(parsed.products?.[0], {
      productId: "P-1",
      productName: "Latte",
      category: "Coffee",
      unitPrice: "125.50",
      unitCost: null,
      status: ProductStatus.ACTIVE,
      sourceRow: 2,
    });
    assert.equal(parsed.products?.[1].status, ProductStatus.DISCONTINUED);
    assert.equal(parsed.products?.[1].sourceRow, 4);
    assert.equal(parsed.customers?.[0].gender, null);
    assert.equal(
      parsed.customers?.[0].registrationDate.toISOString(),
      "2026-01-15T00:00:00.000Z",
    );
    assert.deepEqual(parsed.worksheetNames, [" products ", "CUSTOMERS"]);
  });

  it("rejects missing headers with worksheet-level diagnostics", () => {
    assert.throws(
      () =>
        parseReferenceWorkbook(
          workbookBuffer([
            { name: "Products", rows: [["Product Name"], ["Coffee"]] },
          ]),
          "missing-headers.xlsx",
        ),
      (error: unknown) =>
        error instanceof ReferenceDataParseError &&
        error.worksheetErrors[0].worksheet === "Products" &&
        error.message.includes("productId"),
    );
  });

  it("rejects duplicate IDs in a worksheet and reports source rows", () => {
    assert.throws(
      () =>
        parseReferenceWorkbook(
          workbookBuffer([
            {
              name: "Products",
              rows: [
                productHeaders,
                ["P-1", "Coffee", "Drinks", 100],
                ["P-1", "Tea", "Drinks", 80],
              ],
            },
          ]),
          "duplicates.xlsx",
        ),
      (error: unknown) =>
        error instanceof ReferenceDataParseError &&
        error.worksheetErrors[0].rejectedRows.includes(2) &&
        error.worksheetErrors[0].rejectedRows.includes(3) &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes('duplicate ID "P-1"'),
        ),
    );

    assert.throws(
      () =>
        parseReferenceWorkbook(
          workbookBuffer([
            {
              name: "Customers",
              rows: [
                customerHeaders,
                ["C-1", "Regular", "Adult", "", "2026-01-01"],
                ["C-1", "New", "Adult", "", "2026-01-02"],
              ],
            },
          ]),
          "duplicate-customers.xlsx",
        ),
      (error: unknown) =>
        error instanceof ReferenceDataParseError &&
        error.worksheetErrors[0].rejectedRows.length === 2 &&
        error.message.includes("Customers worksheet"),
    );
  });

  it("rejects invalid prices, status values, and registration dates with row numbers", () => {
    assert.throws(
      () =>
        parseReferenceWorkbook(
          workbookBuffer([
            {
              name: "Products",
              rows: [
                productHeaders,
                ["P-1", "Coffee", "Drinks", -2, "not-money", "AVAILABLE"],
              ],
            },
          ]),
          "invalid-products.xlsx",
        ),
      (error: unknown) =>
        error instanceof ReferenceDataParseError &&
        error.worksheetErrors[0].rejectedRows.includes(2) &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("unitPrice"),
        ) &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("unitCost"),
        ) &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("productStatus"),
        ),
    );

    assert.throws(
      () =>
        parseReferenceWorkbook(
          workbookBuffer([
            {
              name: "Customers",
              rows: [
                customerHeaders,
                ["C-1", "Loyalty", "Adult", "Other", "2026-02-30"],
              ],
            },
          ]),
          "invalid-customers.xlsx",
        ),
      (error: unknown) =>
        error instanceof ReferenceDataParseError &&
        error.worksheetErrors[0].rejectedRows.includes(2) &&
        error.worksheetErrors[0].errors[0].includes("registrationDate"),
    );
  });

  it("rejects duplicate normalized headers, empty sheets, and unrecognized workbooks", () => {
    assert.throws(
      () =>
        parseReferenceWorkbook(
          workbookBuffer([
            {
              name: "Products",
              rows: [
                [...productHeaders, "product_id"],
                ["P-1", "Coffee", "Drinks", 100, "", "ACTIVE", "P-2"],
              ],
            },
          ]),
          "duplicate-headers.xlsx",
        ),
      /duplicate headers/,
    );
    assert.throws(
      () =>
        parseReferenceWorkbook(
          workbookBuffer([{ name: "Products", rows: [] }]),
          "empty.xlsx",
        ),
      /empty or has no header row/,
    );
    assert.throws(
      () =>
        parseReferenceWorkbook(
          workbookBuffer([
            { name: "Sales Transactions", rows: [productHeaders] },
          ]),
          "sales-only.xlsx",
        ),
      /must contain a Products worksheet/,
    );
  });

  it("rejects formula and Excel error cells with worksheet row details", () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      productHeaders,
      ["P-1", "Coffee", "Drinks", 100, "", "ACTIVE"],
    ]);
    worksheet.B2 = { t: "n", f: "50+50", v: 100 };
    worksheet.C2 = { t: "e", v: 0x07 };
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    const buffer = Buffer.from(
      XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }),
    );

    assert.throws(
      () => parseReferenceWorkbook(buffer, "invalid-cells.xlsx"),
      (error: unknown) =>
        error instanceof ReferenceDataParseError &&
        error.worksheetErrors[0].rejectedRows.includes(2) &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("B2: formula cells are not supported"),
        ) &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("C2: Excel error cells are not supported"),
        ),
    );
  });
});
