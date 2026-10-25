export type TrendRange = "7d" | "30d" | "90d" | "12m"

export function getTrendDateRange(range: TrendRange, aggregation: "daily" | "monthly") {
  const end = new Date()
  const start = new Date(end)

  if (range === "12m" || aggregation === "monthly") {
    const months = range === "7d" ? 1 : range === "30d" ? 1 : range === "90d" ? 3 : 12
    start.setUTCMonth(start.getUTCMonth() - months)
  } else {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90
    start.setUTCDate(start.getUTCDate() - (days - 1))
  }

  const toIsoDate = (date: Date) => date.toISOString().slice(0, 10)
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) }
}
