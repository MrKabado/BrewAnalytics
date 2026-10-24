import { Prisma } from "@/generated/prisma/client";
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

async function requireDataset(datasetId?: string): Promise<void> {
  if (!datasetId) {
    return;
  }

  const dataset = await prisma.dataset.findUnique({
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
  ranking: "quantity" | "revenue"
) {
  const conditions: Prisma.Sql[] = [];

  if (filters.datasetId) {
    conditions.push(Prisma.sql`"datasetId" = ${filters.datasetId}`);
  }
  if (filters.category) {
    conditions.push(
      Prisma.sql`LOWER(BTRIM("category")) = LOWER(BTRIM(${filters.category}))`
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
  filters: AnalyticsFilters & { category?: string; topN: number }
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
    `
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
      revenuePercentage:
        totalRevenue.isZero()
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
  const dateFormat = filters.aggregation === "monthly" ? "YYYY-MM" : "YYYY-MM-DD";
  const truncUnit = filters.aggregation === "monthly" ? "month" : "day";
  const rows = await prisma.$queryRaw<TrendRow[]>(Prisma.sql`
    SELECT
      TO_CHAR(DATE_TRUNC(${truncUnit}, "saleDate"), ${dateFormat}) AS "period",
      SUM("totalAmount")::numeric AS "revenue",
      SUM("quantity")::bigint AS "unitsSold"
    FROM "SalesRecord"
    ${where}
    GROUP BY DATE_TRUNC(${truncUnit}, "saleDate")
    ORDER BY DATE_TRUNC(${truncUnit}, "saleDate") ASC
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
