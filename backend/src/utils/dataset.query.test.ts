import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseDatasetRecordFilters,
  parsePaginationParams,
} from "./dataset.query";
import { DatasetValidationError } from "./dataset.validation";

describe("dataset query validation", () => {
  it("uses the default pagination values", () => {
    assert.deepEqual(parsePaginationParams({}), {
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("accepts valid pagination and filters", () => {
    const parsed = parseDatasetRecordFilters({
      page: "2",
      pageSize: "50",
      productName: "  Latte ",
      category: "Drinks",
      paymentMethod: "Card",
      saleDateFrom: "2026-01-01",
      saleDateTo: "2026-01-31",
    });

    assert.equal(parsed.page, 2);
    assert.equal(parsed.pageSize, 50);
    assert.equal(parsed.productName, "Latte");
    assert.equal(parsed.category, "Drinks");
    assert.equal(parsed.paymentMethod, "Card");
    assert.equal(parsed.saleDateFrom?.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(parsed.saleDateTo?.toISOString(), "2026-01-31T00:00:00.000Z");
  });

  it("allows the maximum page size", () => {
    assert.equal(
      parsePaginationParams({ pageSize: String(MAX_PAGE_SIZE) }).pageSize,
      MAX_PAGE_SIZE
    );
  });

  it("rejects invalid or excessive pagination values", () => {
    for (const query of [
      { page: "0" },
      { page: "-1" },
      { page: "1.5" },
      { page: "9007199254740991", pageSize: "100" },
      { pageSize: String(MAX_PAGE_SIZE + 1) },
      { page: ["1", "2"] },
    ]) {
      assert.throws(
        () => parsePaginationParams(query),
        DatasetValidationError
      );
    }
  });

  it("rejects malformed, impossible, and reversed date filters", () => {
    for (const query of [
      { saleDateFrom: "2026/01/01" },
      { saleDateFrom: "2026-02-30" },
      { saleDateFrom: "2026-02-02", saleDateTo: "2026-02-01" },
    ]) {
      assert.throws(
        () => parseDatasetRecordFilters(query),
        DatasetValidationError
      );
    }
  });

  it("rejects repeated and empty text filters", () => {
    assert.throws(
      () => parseDatasetRecordFilters({ productName: ["Latte", "Mocha"] }),
      DatasetValidationError
    );
    assert.throws(
      () => parseDatasetRecordFilters({ category: " " }),
      DatasetValidationError
    );
  });
});
