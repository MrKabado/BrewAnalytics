"use client"

import { useEffect, useState } from "react"
import { BarChart3, Users } from "lucide-react"
import { EmptyState, Panel } from "@/components/analytics/analytics-ui"
import {
  getCampaignPeriodAnalytics,
  getCustomerPurchaseAnalytics,
  getDailySalesSummary,
  getProductCatalogPerformance,
} from "@/lib/analytics-service"
import { formatCurrency } from "@/lib/format"
import type {
  CampaignPeriodAnalyticsResponse,
  CustomerPurchaseAnalyticsResponse,
  DailySalesSummaryResponse,
  ProductCatalogResponse,
} from "@/lib/business-analytics-types"

function money(value: string) {
  const amount = Number(value)
  return Number.isFinite(amount) ? formatCurrency(amount) : value
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date)
}

export function BusinessAnalyticsPanel({
  datasetId,
  startDate,
  endDate,
}: {
  datasetId?: string
  startDate: string
  endDate: string
}) {
  const [daily, setDaily] = useState<DailySalesSummaryResponse | null>(null)
  const [campaigns, setCampaigns] =
    useState<CampaignPeriodAnalyticsResponse | null>(null)
  const [customers, setCustomers] =
    useState<CustomerPurchaseAnalyticsResponse | null>(null)
  const [catalog, setCatalog] = useState<ProductCatalogResponse | null>(null)
  const [errors, setErrors] = useState({
    daily: "",
    campaigns: "",
    customers: "",
    catalog: "",
  })
  const [loadedKey, setLoadedKey] = useState("")
  const requestKey = JSON.stringify({ datasetId, startDate, endDate })

  useEffect(() => {
    let active = true
    void Promise.allSettled([
      getDailySalesSummary({ datasetId, startDate, endDate }),
      getCampaignPeriodAnalytics(datasetId),
      getCustomerPurchaseAnalytics(datasetId),
      datasetId
        ? getProductCatalogPerformance(datasetId)
        : Promise.resolve(null),
    ]).then((results) => {
      if (!active) return
      const nextErrors = {
        daily: "",
        campaigns: "",
        customers: "",
        catalog: "",
      }
      const [dailyResult, campaignResult, customerResult, catalogResult] =
        results
      if (dailyResult.status === "fulfilled") setDaily(dailyResult.value)
      else
        nextErrors.daily =
          dailyResult.reason instanceof Error
            ? dailyResult.reason.message
            : "Daily sales summary could not be loaded."
      if (campaignResult.status === "fulfilled")
        setCampaigns(campaignResult.value)
      else
        nextErrors.campaigns =
          campaignResult.reason instanceof Error
            ? campaignResult.reason.message
            : "Campaign analytics could not be loaded."
      if (customerResult.status === "fulfilled")
        setCustomers(customerResult.value)
      else
        nextErrors.customers =
          customerResult.reason instanceof Error
            ? customerResult.reason.message
            : "Customer analytics could not be loaded."
      if (catalogResult.status === "fulfilled") setCatalog(catalogResult.value)
      else
        nextErrors.catalog =
          catalogResult.reason instanceof Error
            ? catalogResult.reason.message
            : "Product catalog comparison could not be loaded."
      setErrors(nextErrors)
      setLoadedKey(requestKey)
    })
    return () => {
      active = false
    }
  }, [datasetId, endDate, requestKey, startDate])

  const loading = loadedKey !== requestKey
  const recentDays = daily?.dailySummary.slice(-7).reverse() ?? []
  const zeroSalesProducts =
    catalog?.products.filter((product) => !product.hasSales).length ?? 0
  const errorMessages = Object.values(errors).filter(Boolean)

  return (
    <div className="mt-5 space-y-5">
      {!loading && errorMessages.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {errorMessages.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
      <Panel
        title="Daily sales summary"
        description={`Database-derived daily metrics · ${startDate} through ${endDate}`}
      >
        {loading ? (
          <div
            aria-busy="true"
            className="h-36 animate-pulse rounded-lg bg-muted/70"
          />
        ) : errors.daily ? (
          <p role="alert" className="py-8 text-center text-sm text-destructive">
            {errors.daily}
          </p>
        ) : recentDays.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 text-right font-medium">Revenue</th>
                  <th className="pb-3 text-right font-medium">Transactions</th>
                  <th className="pb-3 text-right font-medium">Units</th>
                  <th className="pb-3 text-right font-medium">
                    Avg. transaction
                  </th>
                  <th className="pb-3 text-right font-medium">
                    Avg. price / unit
                  </th>
                  <th className="pb-3 text-right font-medium">Products</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentDays.map((day) => (
                  <tr key={day.saleDate}>
                    <td className="py-2.5 font-medium">
                      {dateLabel(day.saleDate)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {money(day.totalRevenue)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {day.totalTransactions.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {day.totalUnitsSold.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {money(day.averageTransactionValue)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {money(day.averageSellingPricePerUnit)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {day.distinctProductsSold.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              {daily?.marketingSpendNote} Days without transactions are omitted.
            </p>
          </div>
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No sales in this date range"
            description="The API returned no daily sales records for the selected scope and dates."
          />
        )}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Marketing campaign periods"
          description="Period-based sales observations; active dates do not establish campaign attribution."
        >
          {loading ? (
            <div
              aria-busy="true"
              className="h-40 animate-pulse rounded-lg bg-muted/70"
            />
          ) : errors.campaigns ? (
            <p
              role="alert"
              className="py-8 text-center text-sm text-destructive"
            >
              {errors.campaigns}
            </p>
          ) : campaigns?.campaigns.length ? (
            <div className="space-y-4">
              {campaigns.campaigns.slice(0, 5).map((campaign) => (
                <div
                  key={`${campaign.datasetId}-${campaign.campaignId}`}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">
                        {campaign.campaignName}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {campaign.promotionType} · {campaign.campaignChannel} ·{" "}
                        {dateLabel(campaign.startDate)} –{" "}
                        {dateLabel(campaign.endDate)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Marketing cost {money(campaign.marketingCost)}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Before</dt>
                      <dd className="mt-1 font-medium">
                        {money(campaign.priorComparablePeriod.revenue)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Active dates</dt>
                      <dd className="mt-1 font-medium">
                        {money(campaign.activePeriod.revenue)}
                        <span className="block font-normal text-muted-foreground">
                          {campaign.activePeriod.distinctTransactions.toLocaleString()}{" "}
                          transactions
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">After</dt>
                      <dd className="mt-1 font-medium">
                        {money(campaign.followingComparablePeriod.revenue)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {campaign.comparisonStatus ===
                    "comparable_periods_available"
                      ? "Equal-length comparison windows are inside observed history."
                      : "Insufficient observed history for a complete comparison."}{" "}
                    Explicitly linked sales:{" "}
                    {campaign.explicitCampaignLinkedSales.salesRecordCount.toLocaleString()}{" "}
                    records.
                  </p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {campaigns.attributionNote} {campaigns.rankingDefinition}
              </p>
            </div>
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No campaign records"
              description="Import a Marketing Campaigns worksheet into a dataset to see period comparisons."
            />
          )}
        </Panel>

        <Panel
          title="Customer and catalog context"
          description={
            datasetId
              ? "Linked purchases and catalog coverage for this dataset."
              : "Select a dataset to compare sales with its product catalog."
          }
        >
          {loading ? (
            <div
              aria-busy="true"
              className="h-40 animate-pulse rounded-lg bg-muted/70"
            />
          ) : errors.customers ? (
            <p
              role="alert"
              className="py-8 text-center text-sm text-destructive"
            >
              {errors.customers}
            </p>
          ) : customers ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Metric
                  label="Linked customers"
                  value={customers.linkedCustomerCount}
                />
                <Metric
                  label="Repeat customers"
                  value={customers.repeatCustomerCount}
                />
                <Metric
                  label="Linked transactions"
                  value={customers.linkedTransactionCount}
                />
                <Metric
                  label="Unlinked transactions"
                  value={customers.unlinkedSales.distinctTransactions}
                />
              </div>
              <p className="text-sm">
                Recorded revenue from linked customers:{" "}
                <span className="font-semibold">
                  {money(customers.linkedRecordedRevenue)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {customers.definitions.repeatCustomer}{" "}
                {customers.definitions.limitations}
              </p>
              {datasetId && catalog && (
                <p className="rounded-lg bg-muted/50 p-3 text-sm">
                  Product catalog: {catalog.products.length.toLocaleString()}{" "}
                  products · {zeroSalesProducts.toLocaleString()} with no linked
                  sales.
                </p>
              )}
              {datasetId && errors.catalog && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.catalog}
                </p>
              )}
              {customers.segments.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[380px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-2 font-medium">Customer segment</th>
                        <th className="pb-2 text-right font-medium">
                          Customers
                        </th>
                        <th className="pb-2 text-right font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {customers.segments.slice(0, 5).map((segment) => (
                        <tr key={`${segment.customerType}-${segment.ageGroup}`}>
                          <td className="py-2">
                            {segment.customerType} · {segment.ageGroup}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {segment.customers.toLocaleString()}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {money(segment.recordedRevenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {customers.segments.length === 0 && (
                <EmptyState
                  icon={Users}
                  title="No linked customer purchases"
                  description="Unlinked sales are reported separately and are not assigned to customer segments."
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Customer analytics are unavailable for this selection.
            </p>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  )
}
