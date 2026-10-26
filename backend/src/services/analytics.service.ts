import { Prisma } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "../lib/prisma";
import type {
  AnalyticsFilters,
  SalesTrendFilters,
} from "../utils/analytics.query";

interface OverviewRow {
  totalRevenue: Prisma.Decimal;
  totalUnitsSold: bigint;
  totalTransactions: bigint;
  totalSalesRecords: bigint;
}

interface ProductRow {
  productName: string;
  quantitySold: bigint;
  totalRevenue: Prisma.Decimal;
}

interface CategoryRow {
  category: string;
  totalRevenue: Prisma.Decimal;
  unitsSold: bigint;
  salesRecordCount: bigint;
}

interface TrendRow {
  period: string;
  revenue: Prisma.Decimal;
  unitsSold: bigint;
}

interface DailySalesRow {
  saleDate: string;
  totalRevenue: Prisma.Decimal;
  totalTransactions: bigint;
  totalUnitsSold: bigint;
  averageTransactionValue: Prisma.Decimal;
  averageSellingPricePerUnit: Prisma.Decimal;
  distinctProductsSold: bigint;
}

export class DatasetNotFoundError extends Error {
  constructor() {
    super("Dataset not found.");
    this.name = "DatasetNotFoundError";
  }
}

function datasetCondition(datasetId?: string) {
  return datasetId
    ? Prisma.sql`WHERE "datasetId" = ${datasetId}`
    : Prisma.empty;
}

function decimalString(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function safeCount(value: bigint): number {
  const number = Number(value);

  if (!Number.isSafeInteger(number)) {
    throw new Error("Analytics count exceeds the supported numeric range.");
  }

  return number;
}

async function requireDataset(
  datasetId?: string,
  client = prisma,
): Promise<void> {
  if (!datasetId) {
    return;
  }

  const dataset = await client.dataset.findUnique({
    where: { id: datasetId },
    select: { id: true },
  });

  if (!dataset) {
    throw new DatasetNotFoundError();
  }
}

export async function getSalesOverview(filters: AnalyticsFilters) {
  await requireDataset(filters.datasetId);
  const where = datasetCondition(filters.datasetId);
  const [row] = await prisma.$queryRaw<OverviewRow[]>(Prisma.sql`
    SELECT
      COALESCE(SUM("totalAmount"), 0)::numeric AS "totalRevenue",
      COALESCE(SUM("quantity"), 0)::bigint AS "totalUnitsSold",
      COUNT(DISTINCT "transactionId")::bigint AS "totalTransactions",
      COUNT(*)::bigint AS "totalSalesRecords"
    FROM "SalesRecord"
    ${where}
  `);
  const totalTransactions = safeCount(row.totalTransactions);
  const totalRevenue = row.totalRevenue;

  return {
    ...(filters.datasetId ? { datasetId: filters.datasetId } : {}),
    metrics: {
      totalRevenue: decimalString(totalRevenue),
      totalUnitsSold: safeCount(row.totalUnitsSold),
      totalTransactions,
      averageTransactionValue:
        totalTransactions === 0
          ? "0.00"
          : decimalString(totalRevenue.div(totalTransactions)),
      totalSalesRecords: safeCount(row.totalSalesRecords),
    },
  };
}

async function getProductRanking(
  filters: AnalyticsFilters & { category?: string; topN: number },
  ranking: "quantity" | "revenue",
) {
  const conditions: Prisma.Sql[] = [];

  if (filters.datasetId) {
    conditions.push(Prisma.sql`"datasetId" = ${filters.datasetId}`);
  }
  if (filters.category) {
    conditions.push(
      Prisma.sql`LOWER(BTRIM("category")) = LOWER(BTRIM(${filters.category}))`,
    );
  }

  const where =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.empty;
  const ordering =
    ranking === "quantity"
      ? Prisma.sql`"quantitySold" DESC, "totalRevenue" DESC, LOWER(BTRIM("productName")) ASC`
      : Prisma.sql`"totalRevenue" DESC, "quantitySold" DESC, LOWER(BTRIM("productName")) ASC`;

  const rows = await prisma.$queryRaw<ProductRow[]>(Prisma.sql`
    SELECT
      MIN(BTRIM("productName")) AS "productName",
      SUM("quantity")::bigint AS "quantitySold",
      SUM("totalAmount")::numeric AS "totalRevenue"
    FROM "SalesRecord"
    ${where}
    GROUP BY LOWER(BTRIM("productName"))
    ORDER BY ${ordering}
    LIMIT ${filters.topN}
  `);

  return rows.map((row) => ({
    productName: row.productName,
    quantitySold: safeCount(row.quantitySold),
    totalRevenue: decimalString(row.totalRevenue),
  }));
}

export async function getProductPerformance(
  filters: AnalyticsFilters & { category?: string; topN: number },
) {
  await requireDataset(filters.datasetId);
  const [byQuantity, byRevenue] = await Promise.all([
    getProductRanking(filters, "quantity"),
    getProductRanking(filters, "revenue"),
  ]);

  return {
    ...(filters.datasetId ? { datasetId: filters.datasetId } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    topN: filters.topN,
    bestSellingProducts: byQuantity,
    topRevenueProducts: byRevenue,
  };
}

export async function getCategoryPerformance(filters: AnalyticsFilters) {
  await requireDataset(filters.datasetId);
  const where = datasetCondition(filters.datasetId);
  const [overall] = await prisma.$queryRaw<{ totalRevenue: Prisma.Decimal }[]>(
    Prisma.sql`
      SELECT COALESCE(SUM("totalAmount"), 0)::numeric AS "totalRevenue"
      FROM "SalesRecord"
      ${where}
    `,
  );
  const rows = await prisma.$queryRaw<CategoryRow[]>(Prisma.sql`
    SELECT
      MIN(BTRIM("category")) AS "category",
      SUM("totalAmount")::numeric AS "totalRevenue",
      SUM("quantity")::bigint AS "unitsSold",
      COUNT(*)::bigint AS "salesRecordCount"
    FROM "SalesRecord"
    ${where}
    GROUP BY LOWER(BTRIM("category"))
    ORDER BY "totalRevenue" DESC, LOWER(BTRIM("category")) ASC
  `);
  const totalRevenue = overall.totalRevenue;

  return {
    ...(filters.datasetId ? { datasetId: filters.datasetId } : {}),
    totalRevenue: decimalString(totalRevenue),
    categories: rows.map((row) => ({
      category: row.category,
      revenue: decimalString(row.totalRevenue),
      unitsSold: safeCount(row.unitsSold),
      salesRecordCount: safeCount(row.salesRecordCount),
      revenuePercentage: totalRevenue.isZero()
        ? "0.00"
        : row.totalRevenue.div(totalRevenue).mul(100).toFixed(2),
    })),
  };
}

export async function getSalesTrends(filters: SalesTrendFilters) {
  await requireDataset(filters.datasetId);
  const conditions: Prisma.Sql[] = [];

  if (filters.datasetId) {
    conditions.push(Prisma.sql`"datasetId" = ${filters.datasetId}`);
  }

  if (filters.startDate) {
    conditions.push(Prisma.sql`"saleDate" >= ${filters.startDate}`);
  }

  if (filters.endDate) {
    conditions.push(Prisma.sql`"saleDate" <= ${filters.endDate}`);
  }

  const where =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.empty;
  const dateFormat =
    filters.aggregation === "monthly" ? "YYYY-MM" : "YYYY-MM-DD";
  const truncatedDate =
    filters.aggregation === "monthly"
      ? Prisma.sql`DATE_TRUNC('month', "saleDate")`
      : Prisma.sql`DATE_TRUNC('day', "saleDate")`;
  const rows = await prisma.$queryRaw<TrendRow[]>(Prisma.sql`
    SELECT
      TO_CHAR(${truncatedDate}, ${dateFormat}) AS "period",
      SUM("totalAmount")::numeric AS "revenue",
      SUM("quantity")::bigint AS "unitsSold"
    FROM "SalesRecord"
    ${where}
    GROUP BY ${truncatedDate}
    ORDER BY ${truncatedDate} ASC
  `);

  return {
    ...(filters.datasetId ? { datasetId: filters.datasetId } : {}),
    aggregation: filters.aggregation,
    ...(filters.startDate
      ? { startDate: filters.startDate.toISOString().slice(0, 10) }
      : {}),
    ...(filters.endDate
      ? { endDate: filters.endDate.toISOString().slice(0, 10) }
      : {}),
    trends: rows.map((row) => ({
      period: row.period,
      revenue: decimalString(row.revenue),
      unitsSold: safeCount(row.unitsSold),
    })),
  };
}

export async function getDailySalesSummary(
  filters: SalesTrendFilters,
  client: PrismaClient = prisma,
) {
  await requireDataset(filters.datasetId, client);
  const conditions: Prisma.Sql[] = [];
  if (filters.datasetId) {
    conditions.push(Prisma.sql`"datasetId" = ${filters.datasetId}`);
  }
  if (filters.startDate) {
    conditions.push(Prisma.sql`"saleDate" >= ${filters.startDate}`);
  }
  if (filters.endDate) {
    conditions.push(Prisma.sql`"saleDate" <= ${filters.endDate}`);
  }
  const where =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.empty;

  const rows = await client.$queryRaw<DailySalesRow[]>(Prisma.sql`
    WITH daily_records AS (
      SELECT
        "saleDate",
        "transactionId",
        "totalAmount",
        "quantity",
        "productId",
        "productName"
      FROM "SalesRecord"
      ${where}
    ),
    daily_transaction_totals AS (
      SELECT "saleDate", "transactionId", SUM("totalAmount") AS transaction_total
      FROM daily_records
      GROUP BY "saleDate", "transactionId"
    ),
    daily_transaction_averages AS (
      SELECT "saleDate", AVG(transaction_total) AS average_transaction_value
      FROM daily_transaction_totals
      GROUP BY "saleDate"
    ),
    daily_metrics AS (
      SELECT
        r."saleDate",
        SUM(r."totalAmount")::numeric AS total_revenue,
        COUNT(DISTINCT r."transactionId")::bigint AS total_transactions,
        SUM(r."quantity")::bigint AS total_units_sold,
        (SUM(r."totalAmount") / NULLIF(SUM(r."quantity"), 0))::numeric
          AS average_selling_price_per_unit,
        COUNT(DISTINCT CASE
          WHEN r."productId" IS NOT NULL THEN 'id:' || r."productId"
          ELSE 'name:' || LOWER(BTRIM(r."productName"))
        END)::bigint AS distinct_products_sold
      FROM daily_records r
      GROUP BY r."saleDate"
    )
    SELECT
      TO_CHAR(m."saleDate", 'YYYY-MM-DD') AS "saleDate",
      m.total_revenue AS "totalRevenue",
      m.total_transactions AS "totalTransactions",
      m.total_units_sold AS "totalUnitsSold",
      a.average_transaction_value::numeric AS "averageTransactionValue",
      m.average_selling_price_per_unit AS "averageSellingPricePerUnit",
      m.distinct_products_sold AS "distinctProductsSold"
    FROM daily_metrics m
    JOIN daily_transaction_averages a ON a."saleDate" = m."saleDate"
    ORDER BY m."saleDate" ASC
  `);

  return {
    ...(filters.datasetId ? { datasetId: filters.datasetId } : {}),
    ...(filters.startDate
      ? { startDate: filters.startDate.toISOString().slice(0, 10) }
      : {}),
    ...(filters.endDate
      ? { endDate: filters.endDate.toISOString().slice(0, 10) }
      : {}),
    marketingSpend: null,
    marketingSpendNote:
      "Daily marketing spend is unavailable because campaign costs are not allocated to sales dates.",
    dailySummary: rows.map((row) => ({
      saleDate: row.saleDate,
      totalRevenue: decimalString(row.totalRevenue),
      totalTransactions: safeCount(row.totalTransactions),
      totalUnitsSold: safeCount(row.totalUnitsSold),
      averageTransactionValue: decimalString(row.averageTransactionValue),
      averageSellingPricePerUnit: decimalString(
        row.averageSellingPricePerUnit ?? new Prisma.Decimal(0),
      ),
      distinctProductsSold: safeCount(row.distinctProductsSold),
    })),
  };
}
