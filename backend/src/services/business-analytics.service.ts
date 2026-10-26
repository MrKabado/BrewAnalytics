import { Prisma } from "@/generated/prisma/client";
import { prisma } from "../lib/prisma";
import { DatasetNotFoundError } from "./analytics.service";
import { DatasetValidationError } from "../utils/dataset.validation";

interface ProductCatalogRow {
  productId: string;
  productName: string;
  category: string;
  status: string;
  unitPrice: Prisma.Decimal;
  unitCost: Prisma.Decimal | null;
  unitsSold: bigint;
  recordedRevenue: Prisma.Decimal;
  salesRecordCount: bigint;
  transactionCount: bigint;
}

interface CampaignPeriodRow {
  datasetId: string;
  campaignId: string;
  campaignName: string;
  promotionType: string;
  campaignChannel: string;
  startDate: string;
  endDate: string;
  marketingCost: Prisma.Decimal;
  discountPercentage: Prisma.Decimal;
  discountType: string | null;
  discountValue: Prisma.Decimal | null;
  status: string | null;
  periodDays: number;
  coverageStart: string | null;
  coverageEnd: string | null;
  beforeRevenue: Prisma.Decimal;
  beforeTransactions: bigint;
  beforeUnitsSold: bigint;
  beforeActiveDays: bigint;
  duringRevenue: Prisma.Decimal;
  duringTransactions: bigint;
  duringUnitsSold: bigint;
  duringActiveDays: bigint;
  afterRevenue: Prisma.Decimal;
  afterTransactions: bigint;
  afterUnitsSold: bigint;
  afterActiveDays: bigint;
  linkedRevenue: Prisma.Decimal;
  linkedTransactions: bigint;
  linkedSalesRecords: bigint;
  beforePeriodCovered: boolean;
  afterPeriodCovered: boolean;
}

interface CustomerSegmentRow {
  customerType: string;
  ageGroup: string;
  customers: bigint;
  repeatCustomers: bigint;
  distinctTransactions: bigint;
  unitsSold: bigint;
  recordedRevenue: Prisma.Decimal;
}

interface CustomerUnlinkedRow {
  salesRecords: bigint;
  distinctTransactions: bigint;
  unitsSold: bigint;
  recordedRevenue: Prisma.Decimal;
}

interface CustomerLinkedSummaryRow {
  customers: bigint;
  distinctTransactions: bigint;
  unitsSold: bigint;
  recordedRevenue: Prisma.Decimal;
}

function safeCount(value: bigint): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count)) {
    throw new Error("Business analytics count exceeds the supported numeric range.");
  }
  return count;
}

function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

async function requireDataset(datasetId: string): Promise<void> {
  const exists = await prisma.dataset.findUnique({
    where: { id: datasetId },
    select: { id: true },
  });
  if (!exists) throw new DatasetNotFoundError();
}

export async function getProductCatalogPerformance(datasetId?: string) {
  if (!datasetId) {
    throw new DatasetValidationError(
      "datasetId is required for product catalog performance.",
    );
  }
  await requireDataset(datasetId);

  const rows = await prisma.$queryRaw<ProductCatalogRow[]>(Prisma.sql`
    SELECT
      p."productId",
      p."productName",
      p."category",
      p."status"::text AS "status",
      p."unitPrice",
      p."unitCost",
      COALESCE(SUM(s."quantity"), 0)::bigint AS "unitsSold",
      COALESCE(SUM(s."totalAmount"), 0)::numeric AS "recordedRevenue",
      COUNT(s."id")::bigint AS "salesRecordCount",
      COUNT(DISTINCT s."transactionId")::bigint AS "transactionCount"
    FROM "Product" p
    LEFT JOIN "SalesRecord" s
      ON s."datasetId" = p."datasetId"
      AND s."productId" = p."productId"
    WHERE p."datasetId" = ${datasetId}
    GROUP BY p."datasetId", p."productId", p."productName", p."category",
      p."status", p."unitPrice", p."unitCost"
    ORDER BY SUM(s."totalAmount") DESC NULLS LAST, LOWER(BTRIM(p."productName"))
  `);

  return {
    datasetId,
    products: rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      category: row.category,
      status: row.status,
      currentUnitPrice: money(row.unitPrice),
      unitCost: row.unitCost ? money(row.unitCost) : null,
      unitsSold: safeCount(row.unitsSold),
      recordedRevenue: money(row.recordedRevenue),
      salesRecordCount: safeCount(row.salesRecordCount),
      distinctTransactions: safeCount(row.transactionCount),
      hasSales: row.salesRecordCount > 0n,
    })),
    definitions: {
      recordedRevenue: "Sum of SalesRecord.totalAmount.",
      unitsSold: "Sum of SalesRecord.quantity.",
      catalogProductsWithNoSales:
        "Products in this dataset with no linked SalesRecord rows are included with zero sales metrics.",
    },
  };
}

export async function getCampaignPeriodAnalytics(
  datasetId?: string,
  includeDailyTrends = true,
) {
  if (datasetId) await requireDataset(datasetId);
  const filter = datasetId
    ? Prisma.sql`WHERE c."datasetId" = ${datasetId}`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<CampaignPeriodRow[]>(Prisma.sql`
    SELECT
      c."datasetId",
      c."campaignId",
      c."campaignName",
      c."promotionType",
      c."campaignChannel",
      TO_CHAR(c."startDate", 'YYYY-MM-DD') AS "startDate",
      TO_CHAR(c."endDate", 'YYYY-MM-DD') AS "endDate",
      c."marketingCost",
      c."discountPercentage",
      c."discountType",
      c."discountValue",
      c."status",
      (c."endDate" - c."startDate" + 1)::int AS "periodDays",
      TO_CHAR(coverage.first_sale_date, 'YYYY-MM-DD') AS "coverageStart",
      TO_CHAR(coverage.last_sale_date, 'YYYY-MM-DD') AS "coverageEnd",
      before_period.revenue AS "beforeRevenue",
      before_period.transactions AS "beforeTransactions",
      before_period.units AS "beforeUnitsSold",
      before_period.active_days AS "beforeActiveDays",
      during_period.revenue AS "duringRevenue",
      during_period.transactions AS "duringTransactions",
      during_period.units AS "duringUnitsSold",
      during_period.active_days AS "duringActiveDays",
      after_period.revenue AS "afterRevenue",
      after_period.transactions AS "afterTransactions",
      after_period.units AS "afterUnitsSold",
      after_period.active_days AS "afterActiveDays",
      linked.revenue AS "linkedRevenue",
      linked.transactions AS "linkedTransactions",
      linked.sales_records AS "linkedSalesRecords",
      CASE
        WHEN coverage.first_sale_date <= c."startDate" - (c."endDate" - c."startDate" + 1)
          AND coverage.last_sale_date >= c."startDate" - 1 THEN TRUE
        ELSE FALSE
      END AS "beforePeriodCovered",
      CASE
        WHEN coverage.first_sale_date <= c."endDate" + 1
          AND coverage.last_sale_date >= c."endDate" + (c."endDate" - c."startDate" + 1) THEN TRUE
        ELSE FALSE
      END AS "afterPeriodCovered"
    FROM "MarketingCampaign" c
    LEFT JOIN LATERAL (
      SELECT MIN(s."saleDate") AS first_sale_date, MAX(s."saleDate") AS last_sale_date
      FROM "SalesRecord" s
      WHERE s."datasetId" = c."datasetId"
    ) coverage ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(s."totalAmount"), 0)::numeric AS revenue,
        COUNT(DISTINCT s."transactionId")::bigint AS transactions,
        COALESCE(SUM(s."quantity"), 0)::bigint AS units,
        COUNT(DISTINCT s."saleDate")::bigint AS active_days
      FROM "SalesRecord" s
      WHERE s."datasetId" = c."datasetId"
        AND s."saleDate" >= c."startDate" - (c."endDate" - c."startDate" + 1)
        AND s."saleDate" < c."startDate"
    ) before_period ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(s."totalAmount"), 0)::numeric AS revenue,
        COUNT(DISTINCT s."transactionId")::bigint AS transactions,
        COALESCE(SUM(s."quantity"), 0)::bigint AS units,
        COUNT(DISTINCT s."saleDate")::bigint AS active_days
      FROM "SalesRecord" s
      WHERE s."datasetId" = c."datasetId"
        AND s."saleDate" BETWEEN c."startDate" AND c."endDate"
    ) during_period ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(s."totalAmount"), 0)::numeric AS revenue,
        COUNT(DISTINCT s."transactionId")::bigint AS transactions,
        COALESCE(SUM(s."quantity"), 0)::bigint AS units,
        COUNT(DISTINCT s."saleDate")::bigint AS active_days
      FROM "SalesRecord" s
      WHERE s."datasetId" = c."datasetId"
        AND s."saleDate" > c."endDate"
        AND s."saleDate" <= c."endDate" + (c."endDate" - c."startDate" + 1)
    ) after_period ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(s."totalAmount"), 0)::numeric AS revenue,
        COUNT(DISTINCT s."transactionId")::bigint AS transactions,
        COUNT(s."id")::bigint AS sales_records
      FROM "SalesRecord" s
      WHERE s."datasetId" = c."datasetId"
        AND s."campaignId" = c."campaignId"
    ) linked ON TRUE
    ${filter}
    ORDER BY c."datasetId", c."campaignId"
  `);

  const campaignFilter = datasetId
    ? Prisma.sql`WHERE c."datasetId" = ${datasetId}`
    : Prisma.empty;
  const dailyRows = includeDailyTrends && rows.length
    ? await prisma.$queryRaw<
        Array<{
          datasetId: string;
          campaignId: string;
          period: string;
          phase: "before" | "during" | "after";
          revenue: Prisma.Decimal;
          transactions: bigint;
        }>
      >(Prisma.sql`
        WITH campaign_windows AS (
          SELECT
            c."datasetId",
            c."campaignId",
            c."startDate",
            c."endDate",
            (c."endDate" - c."startDate" + 1)::int AS duration
          FROM "MarketingCampaign" c
          ${campaignFilter}
        ),
        expanded_days AS (
          SELECT "datasetId", "campaignId", 'before'::text AS phase,
            generate_series(
              "startDate" - duration,
              "startDate" - 1,
              INTERVAL '1 day'
            )::date AS period_date
          FROM campaign_windows
          UNION ALL
          SELECT "datasetId", "campaignId", 'during'::text AS phase,
            generate_series("startDate", "endDate", INTERVAL '1 day')::date
          FROM campaign_windows
          UNION ALL
          SELECT "datasetId", "campaignId", 'after'::text AS phase,
            generate_series(
              "endDate" + 1,
              "endDate" + duration,
              INTERVAL '1 day'
            )::date
          FROM campaign_windows
        )
        SELECT
          d."datasetId",
          d."campaignId",
          TO_CHAR(d.period_date, 'YYYY-MM-DD') AS period,
          d.phase,
          COALESCE(SUM(s."totalAmount"), 0)::numeric AS revenue,
          COUNT(DISTINCT s."transactionId")::bigint AS transactions
        FROM expanded_days d
        LEFT JOIN "SalesRecord" s
          ON s."datasetId" = d."datasetId"
          AND s."saleDate" = d.period_date
        GROUP BY d."datasetId", d."campaignId", d.phase, d.period_date
        ORDER BY d."datasetId", d."campaignId", d.period_date
      `)
    : [];
  const trendsByCampaign = new Map<
    string,
    Array<{
      date: string;
      phase: "before" | "during" | "after";
      revenue: string;
      distinctTransactions: number;
    }>
  >();
  for (const row of dailyRows) {
    const key = `${row.datasetId}\u0000${row.campaignId}`;
    const trends = trendsByCampaign.get(key) ?? [];
    trends.push({
      date: row.period,
      phase: row.phase,
      revenue: money(row.revenue),
      distinctTransactions: safeCount(row.transactions),
    });
    trendsByCampaign.set(key, trends);
  }

  const campaigns = rows.map((row) => ({
    datasetId: row.datasetId,
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    promotionType: row.promotionType,
    campaignChannel: row.campaignChannel,
    startDate: row.startDate,
    endDate: row.endDate,
    marketingCost: money(row.marketingCost),
    discountPercentage: money(row.discountPercentage),
    discountType: row.discountType,
    discountValue: row.discountValue ? money(row.discountValue) : null,
    status: row.status,
    activePeriod: {
      days: row.periodDays,
      revenue: money(row.duringRevenue),
      distinctTransactions: safeCount(row.duringTransactions),
      unitsSold: safeCount(row.duringUnitsSold),
      daysWithSales: safeCount(row.duringActiveDays),
    },
    observedSalesCoverage: {
      startDate: row.coverageStart,
      endDate: row.coverageEnd,
    },
    priorComparablePeriod: {
      coveredByObservedHistory: row.beforePeriodCovered,
      revenue: money(row.beforeRevenue),
      distinctTransactions: safeCount(row.beforeTransactions),
      unitsSold: safeCount(row.beforeUnitsSold),
      daysWithSales: safeCount(row.beforeActiveDays),
    },
    followingComparablePeriod: {
      coveredByObservedHistory: row.afterPeriodCovered,
      revenue: money(row.afterRevenue),
      distinctTransactions: safeCount(row.afterTransactions),
      unitsSold: safeCount(row.afterUnitsSold),
      daysWithSales: safeCount(row.afterActiveDays),
    },
    dailyTrends:
      trendsByCampaign.get(`${row.datasetId}\u0000${row.campaignId}`) ?? [],
    explicitCampaignLinkedSales: {
      revenue: money(row.linkedRevenue),
      distinctTransactions: safeCount(row.linkedTransactions),
      salesRecordCount: safeCount(row.linkedSalesRecords),
    },
    comparisonStatus:
      row.beforePeriodCovered && row.afterPeriodCovered
        ? "comparable_periods_available"
        : "insufficient_observed_history",
  }));
  const ranking = [...campaigns].sort(
    (a, b) =>
      Number(b.activePeriod.revenue) - Number(a.activePeriod.revenue) ||
      a.campaignId.localeCompare(b.campaignId),
  );
  const rankByCampaign = new Map(
    ranking.map((campaign, index) => [
      `${campaign.datasetId}\u0000${campaign.campaignId}`,
      index + 1,
    ]),
  );

  return {
    ...(datasetId ? { datasetId } : {}),
    campaignCount: rows.length,
    attributionAvailable: rows.some((row) => row.linkedSalesRecords > 0n),
    attributionNote:
      "Active-date sales are period-based observations, not campaign-attributed sales. Only rows with an explicit SalesRecord.campaignId are included in the separately reported linked metrics. No causal or ROI conclusion is supported.",
    comparisonDefinition:
      "Before and after windows are the same inclusive calendar-day length as the campaign. Revenue and units use stored SalesRecord totals. A window is comparable only when it lies inside the dataset's observed first/last sale-date range; this does not prove complete source coverage.",
    rankingDefinition:
      "Campaigns are ranked by recorded revenue during their active dates. Rankings are not adjusted for campaign duration and do not measure attributed revenue, effectiveness, or profit.",
    campaigns: campaigns.map((campaign) => ({
      ...campaign,
      activePeriodRevenueRank:
        rankByCampaign.get(
          `${campaign.datasetId}\u0000${campaign.campaignId}`,
        ) ?? null,
    })),
  };
}

export async function getCustomerPurchaseAnalytics(datasetId?: string) {
  if (datasetId) await requireDataset(datasetId);
  const filter = datasetId
    ? Prisma.sql`WHERE s."datasetId" = ${datasetId}`
    : Prisma.empty;
  const segments = await prisma.$queryRaw<CustomerSegmentRow[]>(Prisma.sql`
    WITH customer_totals AS (
      SELECT
        c."datasetId",
        c."customerId",
        c."customerType",
        c."ageGroup",
        COUNT(DISTINCT s."transactionId")::bigint AS transactions
      FROM "Customer" c
      JOIN "SalesRecord" s
        ON s."datasetId" = c."datasetId" AND s."customerId" = c."customerId"
      ${filter}
      GROUP BY c."datasetId", c."customerId", c."customerType", c."ageGroup"
    ),
    customer_segments AS (
      SELECT
        "customerType",
        "ageGroup",
        COUNT(*)::bigint AS customers,
        COUNT(*) FILTER (WHERE transactions > 1)::bigint AS "repeatCustomers"
      FROM customer_totals
      GROUP BY "customerType", "ageGroup"
    ),
    segment_activity AS (
      SELECT
        c."customerType",
        c."ageGroup",
        COUNT(DISTINCT s."transactionId")::bigint AS "distinctTransactions",
        SUM(s."quantity")::bigint AS "unitsSold",
        SUM(s."totalAmount")::numeric AS "recordedRevenue"
      FROM "Customer" c
      JOIN "SalesRecord" s
        ON s."datasetId" = c."datasetId" AND s."customerId" = c."customerId"
      ${filter}
      GROUP BY c."customerType", c."ageGroup"
    )
    SELECT
      customer_segments."customerType",
      customer_segments."ageGroup",
      customer_segments.customers,
      customer_segments."repeatCustomers",
      segment_activity."distinctTransactions",
      segment_activity."unitsSold",
      segment_activity."recordedRevenue"
    FROM customer_segments
    JOIN segment_activity
      ON segment_activity."customerType" = customer_segments."customerType"
      AND segment_activity."ageGroup" = customer_segments."ageGroup"
    ORDER BY segment_activity."recordedRevenue" DESC,
      LOWER(customer_segments."customerType"),
      LOWER(customer_segments."ageGroup")
  `);
  const unlinkedWhere = datasetId
    ? Prisma.sql`WHERE s."datasetId" = ${datasetId} AND s."customerId" IS NULL`
    : Prisma.sql`WHERE s."customerId" IS NULL`;
  const [unlinked] = await prisma.$queryRaw<CustomerUnlinkedRow[]>(Prisma.sql`
    SELECT
      COUNT(s."id")::bigint AS "salesRecords",
      COUNT(DISTINCT s."transactionId")::bigint AS "distinctTransactions",
      COALESCE(SUM(s."quantity"), 0)::bigint AS "unitsSold",
      COALESCE(SUM(s."totalAmount"), 0)::numeric AS "recordedRevenue"
    FROM "SalesRecord" s
    ${unlinkedWhere}
  `);
  const [linkedSummary] =
    await prisma.$queryRaw<CustomerLinkedSummaryRow[]>(Prisma.sql`
      SELECT
        COUNT(DISTINCT s."customerId")::bigint AS customers,
        COUNT(DISTINCT s."transactionId")::bigint AS "distinctTransactions",
        COALESCE(SUM(s."quantity"), 0)::bigint AS "unitsSold",
        COALESCE(SUM(s."totalAmount"), 0)::numeric AS "recordedRevenue"
      FROM "SalesRecord" s
      ${datasetId
        ? Prisma.sql`WHERE s."datasetId" = ${datasetId} AND s."customerId" IS NOT NULL`
        : Prisma.sql`WHERE s."customerId" IS NOT NULL`}
  `);

  const linkedCustomers = segments.reduce(
    (total, row) => total + safeCount(row.customers),
    0,
  );
  return {
    ...(datasetId ? { datasetId } : {}),
    linkedCustomerCount: linkedCustomers,
    linkedTransactionCount: safeCount(linkedSummary.distinctTransactions),
    linkedRecordedRevenue: money(linkedSummary.recordedRevenue),
    linkedUnitsSold: safeCount(linkedSummary.unitsSold),
    repeatCustomerCount: segments.reduce(
      (total, row) => total + safeCount(row.repeatCustomers),
      0,
    ),
    unlinkedSales: {
      salesRecordCount: safeCount(unlinked.salesRecords),
      distinctTransactions: safeCount(unlinked.distinctTransactions),
      unitsSold: safeCount(unlinked.unitsSold),
      recordedRevenue: money(unlinked.recordedRevenue),
    },
    segments: segments.map((row) => ({
      customerType: row.customerType,
      ageGroup: row.ageGroup,
      customers: safeCount(row.customers),
      repeatCustomers: safeCount(row.repeatCustomers),
      distinctTransactions: safeCount(row.distinctTransactions),
      unitsSold: safeCount(row.unitsSold),
      recordedRevenue: money(row.recordedRevenue),
      averageRevenuePerTransaction:
        row.distinctTransactions === 0n
          ? "0.00"
          : money(row.recordedRevenue.div(safeCount(row.distinctTransactions))),
    })),
    definitions: {
      linkedTransactions:
        "Distinct transaction IDs among sales records linked to a Customer in the same dataset.",
      repeatCustomer:
        "A customer with more than one distinct transaction ID in the available dataset history.",
      unlinkedSales:
        "SalesRecord rows whose customerId is null; they are excluded from customer segments, not assigned to a customer.",
      limitations:
        "The response excludes synthetic customer IDs. First-time purchase relative to real-world customer history cannot be established from this dataset alone.",
    },
  };
}
