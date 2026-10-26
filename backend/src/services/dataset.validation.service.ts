import { Prisma } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "../lib/prisma";
import { DatasetNotFoundError } from "./analytics.service";

interface DatasetValidationRow {
  storedRowCount: number;
  inspectedRecords: bigint;
  recordsWithErrors: bigint;
  missingRequiredRecords: bigint;
  invalidQuantityRecords: bigint;
  invalidMoneyRecords: bigint;
  revenueMismatchRecords: bigint;
  invalidProductReferences: bigint;
  invalidCustomerReferences: bigint;
  invalidCampaignReferences: bigint;
  duplicateCandidateRecords: bigint;
  duplicateCandidateLines: bigint;
  unusuallyLargeRecords: bigint;
  recordsWithWarnings: bigint;
  totalQuantity: bigint;
  recordedRevenue: Prisma.Decimal;
  expectedRevenue: Prisma.Decimal;
  absoluteRevenueDiscrepancy: Prisma.Decimal;
  distinctTransactions: bigint;
  distinctProducts: bigint;
  distinctCategories: bigint;
  distinctPaymentMethods: bigint;
}

function safeCount(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new Error(
      "Dataset validation count exceeds the supported numeric range.",
    );
  }
  return number;
}

function amount(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

export async function validateDataset(
  datasetId: string,
  client: PrismaClient = prisma,
) {
  const [result] = await client.$queryRaw<DatasetValidationRow[]>(Prisma.sql`
    WITH dataset_info AS (
      SELECT "id", "rowCount" AS stored_row_count
      FROM "Dataset"
      WHERE "id" = ${datasetId}
    ),
    records AS (
      SELECT
        s.*,
        (BTRIM(COALESCE(s."transactionId", '')) = ''
          OR BTRIM(COALESCE(s."productName", '')) = ''
          OR BTRIM(COALESCE(s."category", '')) = ''
          OR BTRIM(COALESCE(s."paymentMethod", '')) = '') AS has_missing_required,
        (s."quantity" <= 0) AS has_invalid_quantity,
        (s."unitPrice" < 0 OR s."totalAmount" < 0
          OR (s."unitCost" IS NOT NULL AND s."unitCost" < 0)) AS has_invalid_money,
        (s."totalAmount" <> ROUND(s."unitPrice" * s."quantity", 2)) AS has_revenue_mismatch,
        (s."productId" IS NOT NULL AND p."productId" IS NULL) AS has_invalid_product,
        (s."customerId" IS NOT NULL AND c."customerId" IS NULL) AS has_invalid_customer,
        (s."campaignId" IS NOT NULL AND m."campaignId" IS NULL) AS has_invalid_campaign,
        (s."quantity" > 1000 OR s."unitPrice" > 1000000
          OR s."totalAmount" > 1000000) AS has_unusually_large_value,
        ROW_NUMBER() OVER (
          PARTITION BY
            s."transactionId",
            s."saleDate",
            COALESCE('id:' || s."productId", 'name:' || LOWER(BTRIM(s."productName"))),
            COALESCE(s."customerId", ''),
            s."quantity",
            s."unitPrice",
            s."totalAmount",
            LOWER(BTRIM(s."paymentMethod"))
          ORDER BY s."id"
        ) AS duplicate_rank,
        COUNT(*) OVER (
          PARTITION BY
            s."transactionId",
            s."saleDate",
            COALESCE('id:' || s."productId", 'name:' || LOWER(BTRIM(s."productName"))),
            COALESCE(s."customerId", ''),
            s."quantity",
            s."unitPrice",
            s."totalAmount",
            LOWER(BTRIM(s."paymentMethod"))
        ) AS duplicate_group_count
      FROM "SalesRecord" s
      LEFT JOIN "Product" p
        ON p."datasetId" = s."datasetId" AND p."productId" = s."productId"
      LEFT JOIN "Customer" c
        ON c."datasetId" = s."datasetId" AND c."customerId" = s."customerId"
      LEFT JOIN "MarketingCampaign" m
        ON m."datasetId" = s."datasetId" AND m."campaignId" = s."campaignId"
      WHERE s."datasetId" = ${datasetId}
    ),
    record_flags AS (
      SELECT
        *,
        (
          has_missing_required OR has_invalid_quantity OR has_invalid_money
          OR has_revenue_mismatch OR has_invalid_product
          OR has_invalid_customer OR has_invalid_campaign
        ) AS has_error
      FROM records
    )
    SELECT
      d.stored_row_count AS "storedRowCount",
      COUNT(r."id")::bigint AS "inspectedRecords",
      COUNT(r."id") FILTER (WHERE r.has_error)::bigint AS "recordsWithErrors",
      COUNT(r."id") FILTER (WHERE r.has_missing_required)::bigint AS "missingRequiredRecords",
      COUNT(r."id") FILTER (WHERE r.has_invalid_quantity)::bigint AS "invalidQuantityRecords",
      COUNT(r."id") FILTER (WHERE r.has_invalid_money)::bigint AS "invalidMoneyRecords",
      COUNT(r."id") FILTER (WHERE r.has_revenue_mismatch)::bigint AS "revenueMismatchRecords",
      COUNT(r."id") FILTER (WHERE r.has_invalid_product)::bigint AS "invalidProductReferences",
      COUNT(r."id") FILTER (WHERE r.has_invalid_customer)::bigint AS "invalidCustomerReferences",
      COUNT(r."id") FILTER (WHERE r.has_invalid_campaign)::bigint AS "invalidCampaignReferences",
      COUNT(r."id") FILTER (WHERE r.duplicate_group_count > 1)::bigint AS "duplicateCandidateRecords",
      COUNT(r."id") FILTER (WHERE r.duplicate_rank > 1)::bigint AS "duplicateCandidateLines",
      COUNT(r."id") FILTER (WHERE r.has_unusually_large_value)::bigint AS "unusuallyLargeRecords",
      COUNT(r."id") FILTER (
        WHERE r.duplicate_group_count > 1 OR r.has_unusually_large_value
      )::bigint AS "recordsWithWarnings",
      COALESCE(SUM(r."quantity"), 0)::bigint AS "totalQuantity",
      COALESCE(SUM(r."totalAmount"), 0)::numeric AS "recordedRevenue",
      COALESCE(SUM(ROUND(r."unitPrice" * r."quantity", 2)), 0)::numeric AS "expectedRevenue",
      COALESCE(SUM(ABS(r."totalAmount" - ROUND(r."unitPrice" * r."quantity", 2))), 0)::numeric
        AS "absoluteRevenueDiscrepancy",
      COUNT(DISTINCT r."transactionId")::bigint AS "distinctTransactions",
      COUNT(DISTINCT COALESCE(
        'id:' || r."productId",
        'name:' || LOWER(BTRIM(r."productName"))
      ))::bigint AS "distinctProducts",
      COUNT(DISTINCT NULLIF(LOWER(BTRIM(r."category")), ''))::bigint AS "distinctCategories",
      COUNT(DISTINCT NULLIF(LOWER(BTRIM(r."paymentMethod")), ''))::bigint AS "distinctPaymentMethods"
    FROM dataset_info d
    LEFT JOIN record_flags r ON TRUE
    GROUP BY d.stored_row_count
  `);

  if (!result) throw new DatasetNotFoundError();
  const inspectedRecords = safeCount(result.inspectedRecords);
  const recordsWithErrors = safeCount(result.recordsWithErrors);
  const duplicateCandidateRecords = safeCount(result.duplicateCandidateRecords);
  const unusuallyLargeRecords = safeCount(result.unusuallyLargeRecords);
  const recordsWithWarnings = safeCount(result.recordsWithWarnings);
  const rowCountMatches = result.storedRowCount === inspectedRecords;

  const errors: Array<{ code: string; count: number; description: string }> =
    [];
  const addError = (code: string, count: bigint, description: string) => {
    if (count > 0n) errors.push({ code, count: safeCount(count), description });
  };
  addError(
    "missing_required_fields",
    result.missingRequiredRecords,
    "Required transaction text fields are blank.",
  );
  addError(
    "invalid_quantity",
    result.invalidQuantityRecords,
    "Quantity must be a positive whole number.",
  );
  addError(
    "invalid_monetary_values",
    result.invalidMoneyRecords,
    "Recorded unit price, total amount, or unit cost is negative.",
  );
  addError(
    "revenue_mismatch",
    result.revenueMismatchRecords,
    "Total amount does not equal quantity multiplied by unit price, rounded to cents.",
  );
  addError(
    "invalid_product_reference",
    result.invalidProductReferences,
    "Product ID does not reference a Product in this dataset.",
  );
  addError(
    "invalid_customer_reference",
    result.invalidCustomerReferences,
    "Customer ID does not reference a Customer in this dataset.",
  );
  addError(
    "invalid_campaign_reference",
    result.invalidCampaignReferences,
    "Campaign ID does not reference a Marketing Campaign in this dataset.",
  );

  const warnings: Array<{ code: string; count: number; description: string }> =
    [];
  if (duplicateCandidateRecords > 0) {
    warnings.push({
      code: "duplicate_sales_lines",
      count: duplicateCandidateRecords,
      description:
        "Exact line matches share transaction, date, product, customer, quantity, prices, and payment method; these are candidates for review, not confirmed duplicates.",
    });
  }
  if (unusuallyLargeRecords > 0) {
    warnings.push({
      code: "unusually_large_values",
      count: unusuallyLargeRecords,
      description:
        "Records exceed review thresholds (quantity > 1,000 or unit price/total amount > 1,000,000). They were not modified.",
    });
  }
  if (!rowCountMatches) {
    warnings.push({
      code: "dataset_row_count_mismatch",
      count: 1,
      description: `Dataset rowCount is ${result.storedRowCount}, but ${inspectedRecords} sales records exist.`,
    });
  }

  return {
    datasetId,
    inspectedRecords,
    validRecords: inspectedRecords - recordsWithErrors,
    recordsWithErrors,
    recordsWithWarnings,
    errors,
    warnings,
    informational: {
      rowCountMatches,
      storedRowCount: result.storedRowCount,
      totalQuantity: safeCount(result.totalQuantity),
      recordedRevenue: amount(result.recordedRevenue),
      expectedRevenue: amount(result.expectedRevenue),
      absoluteRevenueDiscrepancy: amount(result.absoluteRevenueDiscrepancy),
      distinctTransactions: safeCount(result.distinctTransactions),
      distinctProducts: safeCount(result.distinctProducts),
      distinctCategories: safeCount(result.distinctCategories),
      distinctPaymentMethods: safeCount(result.distinctPaymentMethods),
      duplicateCandidateRecords,
      duplicateCandidateLines: safeCount(result.duplicateCandidateLines),
    },
  };
}
