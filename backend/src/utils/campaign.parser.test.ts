import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { CampaignParseError, parseCampaignWorkbook } from "./campaign.parser";

const headers = [
  "Campaign ID",
  "Campaign Name",
  "Promotion Type",
  "Marketing Channel",
  "Start Date",
  "End Date",
  "Marketing Cost",
  "Discount Type",
  "Discount Value",
  "Campaign Status",
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

describe("Marketing Campaigns workbook parser", () => {
  it("normalizes worksheet/header variations and parses optional metadata", () => {
    const parsed = parseCampaignWorkbook(
      workbookBuffer([
        { name: "Products", rows: [["Product ID"], ["P-1"]] },
        {
          name: " Marketing_Campaigns ",
          rows: [
            [
              "campaign_id",
              "campaignName",
              "promotion_type",
              "campaignChannel",
              "start_date",
              "endDate",
              "marketing_cost",
              "discount_type",
              "discount_value",
              "status",
            ],
            [
              " CAMP-1 ",
              "Latte Week",
              "Buy One Get One",
              "Social Media",
              "2026-01-01",
              "2026-01-07",
              1500,
              "percentage",
              15,
              "active",
            ],
          ],
        },
      ]),
      "campaigns.xlsx",
    );

    assert.equal(parsed.campaigns.length, 1);
    assert.deepEqual(parsed.campaigns[0], {
      campaignId: "CAMP-1",
      campaignName: "Latte Week",
      promotionType: "Buy One Get One",
      campaignChannel: "Social Media",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-07T00:00:00.000Z"),
      marketingCost: "1500.00",
      discountPercentage: "15.00",
      discountType: "PERCENTAGE",
      discountValue: "15.00",
      status: "ACTIVE",
      sourceRow: 2,
    });
    assert.deepEqual(parsed.worksheetNames, [
      "Products",
      " Marketing_Campaigns ",
    ]);
  });

  it("supports legacy discount percentage and optional discount/status fields", () => {
    const legacyHeaders = headers.slice(0, 7).concat("Discount Percentage");
    const parsed = parseCampaignWorkbook(
      workbookBuffer([
        {
          name: "Campaigns",
          rows: [
            legacyHeaders,
            ["C-1", "Weekend", "Discount", "In Store", 46023, 46024, 0, 10],
          ],
        },
      ]),
      "legacy-campaigns.xlsx",
    );

    assert.equal(parsed.campaigns[0].discountPercentage, "10.00");
    assert.equal(parsed.campaigns[0].discountType, "PERCENTAGE");
    assert.equal(parsed.campaigns[0].status, null);
  });

  it("recognizes campaign worksheets by their required headers when the name differs", () => {
    const parsed = parseCampaignWorkbook(
      workbookBuffer([
        {
          name: "Promotions 2026",
          rows: [
            headers.slice(0, 7),
            [
              "C-1",
              "Weekend",
              "Discount",
              "Online",
              "2026-01-01",
              "2026-01-02",
              100,
            ],
          ],
        },
      ]),
      "promotions.xlsx",
    );

    assert.equal(parsed.worksheetName, "Promotions 2026");
    assert.equal(parsed.campaigns.length, 1);
  });

  it("rejects missing/ambiguous headers, duplicate IDs, and required values", () => {
    assert.throws(
      () =>
        parseCampaignWorkbook(
          workbookBuffer([{ name: "Campaigns", rows: [["Campaign ID"]] }]),
          "missing-headers.xlsx",
        ),
      /missing required headers/,
    );

    assert.throws(
      () =>
        parseCampaignWorkbook(
          workbookBuffer([
            {
              name: "Campaigns",
              rows: [
                [...headers, "campaign_id"],
                [
                  "C-1",
                  "Name",
                  "Promotion",
                  "Online",
                  "2026-01-01",
                  "2026-01-02",
                  10,
                  "",
                  "",
                  "",
                  "C-2",
                ],
              ],
            },
          ]),
          "duplicate-headers.xlsx",
        ),
      /duplicate headers/,
    );

    assert.throws(
      () =>
        parseCampaignWorkbook(
          workbookBuffer([
            {
              name: "Campaigns",
              rows: [
                [...headers, "Campaign Channel"],
                [
                  "C-1",
                  "Name",
                  "Promotion",
                  "Online",
                  "2026-01-01",
                  "2026-01-02",
                  10,
                  "",
                  "",
                  "",
                  "Retail",
                ],
              ],
            },
          ]),
          "ambiguous-headers.xlsx",
        ),
      /ambiguous headers for campaignChannel/,
    );

    assert.throws(
      () =>
        parseCampaignWorkbook(
          workbookBuffer([
            {
              name: "Campaigns",
              rows: [
                [...headers, "Discount Percentage"],
                [
                  "C-1",
                  "Name",
                  "Promotion",
                  "Online",
                  "2026-01-01",
                  "2026-01-02",
                  10,
                  "PERCENTAGE",
                  10,
                  "",
                  10,
                ],
              ],
            },
          ]),
          "ambiguous-discount.xlsx",
        ),
      /both Discount Value and Discount Percentage/,
    );

    assert.throws(
      () =>
        parseCampaignWorkbook(
          workbookBuffer([
            {
              name: "Campaigns",
              rows: [headers, ["", "", "", "", "2026-01-01", "2026-01-02", 10]],
            },
          ]),
          "missing-values.xlsx",
        ),
      (error: unknown) =>
        error instanceof CampaignParseError &&
        error.worksheetErrors[0].rejectedRows.includes(2),
    );
  });

  it("rejects duplicate campaign IDs and invalid date ranges", () => {
    const first = [
      "C-1",
      "Name",
      "Promotion",
      "Online",
      "2026-01-01",
      "2026-01-02",
      10,
    ];
    assert.throws(
      () =>
        parseCampaignWorkbook(
          workbookBuffer([
            { name: "Campaigns", rows: [headers, first, first] },
          ]),
          "duplicate-campaigns.xlsx",
        ),
      (error: unknown) =>
        error instanceof CampaignParseError &&
        error.worksheetErrors[0].rejectedRows.length === 2 &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("duplicate campaignId"),
        ),
    );

    assert.throws(
      () =>
        parseCampaignWorkbook(
          workbookBuffer([
            {
              name: "Campaigns",
              rows: [
                headers,
                [
                  "C-2",
                  "Name",
                  "Promotion",
                  "Online",
                  "2026-02-02",
                  "2026-02-01",
                  10,
                ],
              ],
            },
          ]),
          "invalid-range.xlsx",
        ),
      (error: unknown) =>
        error instanceof CampaignParseError &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("endDate must not be earlier"),
        ),
    );
  });

  it("rejects invalid costs, discounts, and campaign statuses", () => {
    assert.throws(
      () =>
        parseCampaignWorkbook(
          workbookBuffer([
            {
              name: "Campaigns",
              rows: [
                headers,
                [
                  "C-1",
                  "Name",
                  "Promotion",
                  "Online",
                  "2026-01-01",
                  "2026-01-02",
                  -1,
                  "PERCENTAGE",
                  101,
                  "PLANNED",
                ],
              ],
            },
          ]),
          "invalid-values.xlsx",
        ),
      (error: unknown) =>
        error instanceof CampaignParseError &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("marketingCost"),
        ) &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("between 0 and 100"),
        ) &&
        error.worksheetErrors[0].errors.some((message) =>
          message.includes("campaignStatus"),
        ),
    );
  });

  it("rejects empty, malformed, and workbooks without campaign sheets", () => {
    assert.throws(
      () =>
        parseCampaignWorkbook(
          workbookBuffer([{ name: "Campaigns", rows: [] }]),
          "empty.xlsx",
        ),
      /empty/,
    );
    assert.throws(
      () => parseCampaignWorkbook(Buffer.from("bad workbook"), "broken.xlsx"),
      /does not match a supported Excel workbook/,
    );
    assert.throws(
      () =>
        parseCampaignWorkbook(
          workbookBuffer([
            { name: "Products", rows: [["Product ID", "Product Name"]] },
          ]),
          "no-campaigns.xlsx",
        ),
      /must contain a Marketing Campaigns worksheet/,
    );
  });
});
