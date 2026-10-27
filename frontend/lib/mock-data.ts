export type SalesPoint = {
  period: string
  revenue: number
  transactions: number
}

export type Dataset = {
  id: string
  name: string
  fileName: string
  uploadedAt: string
  records: number
  status: "Ready" | "Processing"
}

export const salesHistory: SalesPoint[] = [
  { period: "Jan 06", revenue: 3240, transactions: 186 },
  { period: "Jan 13", revenue: 3580, transactions: 204 },
  { period: "Jan 20", revenue: 3410, transactions: 196 },
  { period: "Jan 27", revenue: 3920, transactions: 223 },
  { period: "Feb 03", revenue: 3760, transactions: 215 },
  { period: "Feb 10", revenue: 4280, transactions: 246 },
  { period: "Feb 17", revenue: 4110, transactions: 238 },
  { period: "Feb 24", revenue: 4720, transactions: 269 },
  { period: "Mar 03", revenue: 4510, transactions: 258 },
  { period: "Mar 10", revenue: 5090, transactions: 291 },
  { period: "Mar 17", revenue: 4860, transactions: 278 },
  { period: "Mar 24", revenue: 5480, transactions: 312 },
]

export const datasetSnapshots: Record<
  string,
  { revenue: number; units: number; transactions: number; average: number; history: SalesPoint[] }
> = {
  all: {
    revenue: 42680,
    units: 8240,
    transactions: 4186,
    average: 10.2,
    history: salesHistory,
  },
  "ds-march": {
    revenue: 18740,
    units: 3640,
    transactions: 1842,
    average: 10.18,
    history: salesHistory.slice(-4),
  },
  "ds-q1": {
    revenue: 42680,
    units: 8240,
    transactions: 4186,
    average: 10.2,
    history: salesHistory,
  },
  "ds-feb": {
    revenue: 15240,
    units: 2940,
    transactions: 1486,
    average: 10.26,
    history: salesHistory.slice(4, 8),
  },
  "ds-jan": {
    revenue: 12860,
    units: 2480,
    transactions: 1225,
    average: 10.5,
    history: salesHistory.slice(0, 4),
  },
  "ds-holiday": {
    revenue: 31840,
    units: 6120,
    transactions: 3094,
    average: 10.29,
    history: salesHistory.slice(2, 11),
  },
}

export const products = [
  { name: "Oat Milk Latte", category: "Espresso", units: 1248, revenue: 6864 },
  { name: "Cappuccino", category: "Espresso", units: 986, revenue: 4930 },
  { name: "Cold Brew", category: "Cold drinks", units: 842, revenue: 4631 },
  { name: "Butter Croissant", category: "Bakery", units: 718, revenue: 2872 },
  { name: "Flat White", category: "Espresso", units: 642, revenue: 3210 },
  { name: "Matcha Latte", category: "Tea", units: 534, revenue: 3204 },
  { name: "Blueberry Muffin", category: "Bakery", units: 421, revenue: 1684 },
  { name: "Iced Americano", category: "Cold drinks", units: 398, revenue: 1791 },
]

export const categories = [
  { name: "Espresso", revenue: 15840, units: 2876, share: 42 },
  { name: "Cold drinks", revenue: 9720, units: 1842, share: 26 },
  { name: "Bakery", revenue: 6840, units: 1624, share: 18 },
  { name: "Tea", revenue: 5260, units: 918, share: 14 },
]

export const datasets: Dataset[] = [
  {
    id: "ds-march",
    name: "March 2026 Sales",
    fileName: "march-sales-2026.csv",
    uploadedAt: "Mar 25, 2026",
    records: 4286,
    status: "Ready",
  },
  {
    id: "ds-q1",
    name: "Q1 2026",
    fileName: "q1-sales-export.xlsx",
    uploadedAt: "Mar 20, 2026",
    records: 12843,
    status: "Ready",
  },
  {
    id: "ds-feb",
    name: "February 2026 Sales",
    fileName: "february-sales.csv",
    uploadedAt: "Mar 01, 2026",
    records: 3957,
    status: "Ready",
  },
  {
    id: "ds-jan",
    name: "January 2026 Sales",
    fileName: "january-sales.csv",
    uploadedAt: "Feb 01, 2026",
    records: 3721,
    status: "Ready",
  },
  {
    id: "ds-holiday",
    name: "Holiday Season 2025",
    fileName: "holiday-season.xlsx",
    uploadedAt: "Jan 04, 2026",
    records: 8892,
    status: "Ready",
  },
]

export const recordsPreview = [
  { transaction: "TX-10482", date: "Mar 24, 2026", product: "Oat Milk Latte", category: "Espresso", quantity: 2, amount: 11 },
  { transaction: "TX-10481", date: "Mar 24, 2026", product: "Butter Croissant", category: "Bakery", quantity: 1, amount: 4 },
  { transaction: "TX-10480", date: "Mar 24, 2026", product: "Cold Brew", category: "Cold drinks", quantity: 1, amount: 5.5 },
  { transaction: "TX-10479", date: "Mar 24, 2026", product: "Cappuccino", category: "Espresso", quantity: 2, amount: 10 },
  { transaction: "TX-10478", date: "Mar 24, 2026", product: "Blueberry Muffin", category: "Bakery", quantity: 1, amount: 4 },
]

export const forecastHistory = [
  { period: "Jan", actual: 12600, forecast: null },
  { period: "Feb", actual: 14800, forecast: null },
  { period: "Mar", actual: 17200, forecast: null },
  { period: "Apr", actual: 0, forecast: 18100 },
  { period: "May", actual: 0, forecast: 19300 },
  { period: "Jun", actual: 0, forecast: 20500 },
]

export const recommendationSamples = [
  {
    id: "sample-1",
    title: "Keep Oat Milk Latte prominent",
    category: "Product performance",
    priority: "High" as const,
    text: "It leads both unit sales and recorded revenue. Maintain visibility and monitor its performance as the menu changes.",
    evidence: "1,248 units · ₱6,864 revenue · #1 by units",
    basis: "Historical",
  },
  {
    id: "sample-2",
    title: "Review preparation plans for Cold Brew",
    category: "Product demand",
    priority: "Medium" as const,
    text: "Estimated demand is trending above the recent average. Compare the estimate with actual sales as they arrive.",
    evidence: "Recent average 64 units/week · forecast 78 units/week · +22%",
    basis: "Historical + forecast",
  },
  {
    id: "sample-3",
    title: "Review bakery placement",
    category: "Category performance",
    priority: "Low" as const,
    text: "Bakery contributes a smaller share of revenue than Espresso. Consider testing placement or a targeted offer and evaluate results.",
    evidence: "18% revenue share · 1,624 units",
    basis: "Historical",
  },
]

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value)
