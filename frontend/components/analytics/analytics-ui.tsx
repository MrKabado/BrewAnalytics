import type { ReactNode } from "react"
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_oklch(0.2_0.02_50/0.04)] sm:p-6",
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-semibold tracking-tight">{title}</h2>}
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatCard({
  label,
  value,
  detail,
  change,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  change?: string
  icon: LucideIcon
}) {
  const isPositive = !change?.startsWith("-")

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_oklch(0.2_0.02_50/0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-[26px] leading-none font-semibold tracking-tight">{value}</p>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        {change && (
          <span
            className={cn(
              "inline-flex items-center font-semibold",
              isPositive ? "text-success" : "text-destructive",
            )}
          >
            {isPositive ? (
              <ArrowUpRight className="mr-0.5 size-3.5" />
            ) : (
              <ArrowDownRight className="mr-0.5 size-3.5" />
            )}
            {change}
          </span>
        )}
        <span>{detail}</span>
      </div>
    </div>
  )
}

export function SelectControl({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  className?: string
}) {
  return (
    <label className={cn("flex items-center gap-2", className)}>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-28 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function RevenueChart({
  data,
  comparison = false,
  className,
}: {
  data: Array<{ period: string; revenue: number; forecast?: number | null }>
  comparison?: boolean
  className?: string
}) {
  const width = 720
  const height = 250
  const pad = { top: 14, right: 14, bottom: 34, left: 48 }
  const labelStep = Math.max(1, Math.ceil(data.length / 8))
  const values = data.flatMap((item) => [
    item.revenue,
    ...(item.forecast === undefined || item.forecast === null
      ? []
      : [item.forecast]),
  ])
  const maximum = Math.max(...values, 1) * 1.12
  const x = (index: number) =>
    pad.left + (index * (width - pad.left - pad.right)) / Math.max(data.length - 1, 1)
  const y = (value: number) =>
    height - pad.bottom - (value / maximum) * (height - pad.top - pad.bottom)
  const actualPoints = data
    .map((item, index) => (item.revenue > 0 ? `${x(index)},${y(item.revenue)}` : ""))
    .filter(Boolean)
  const forecastIndexes = data
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.forecast !== undefined && item.forecast !== null)
  const forecastPoints = forecastIndexes.map(
    ({ item, index }) => `${x(index)},${y(item.forecast ?? 0)}`,
  )
  const gridValues = [0, 0.33, 0.66, 1].map((fraction) => maximum * fraction)
  const formatter = (value: number) =>
    value >= 1000
      ? `${formatCurrency(Math.round(value / 1000))}k`
      : formatCurrency(Math.round(value))

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-chart-1" /> Actual revenue
        </span>
        {comparison && (
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-chart-2" /> Forecast estimate
          </span>
        )}
      </div>
      <div className="overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Revenue over time chart"
          className="h-auto w-full"
        >
          {gridValues.map((value, index) => {
            const gridY = y(value)
            return (
              <g key={index}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={gridY}
                  y2={gridY}
                  className="stroke-border"
                  strokeDasharray="3 5"
                />
                <text
                  x={pad.left - 8}
                  y={gridY + 4}
                  textAnchor="end"
                  className="fill-muted-foreground"
                  fontSize="10"
                >
                  {formatter(value)}
                </text>
              </g>
            )
          })}
          {actualPoints.length > 1 && (
            <polyline
              points={actualPoints.join(" ")}
              fill="none"
              className="stroke-chart-1"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {forecastPoints.length > 0 && (
            <polyline
              points={forecastPoints.join(" ")}
              fill="none"
              className="stroke-chart-2"
              strokeWidth="3"
              strokeDasharray="6 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {data.map((item, index) => (
            <g key={item.period}>
              {item.revenue > 0 && (
                <circle
                  cx={x(index)}
                  cy={y(item.revenue)}
                  r="4"
                  className="fill-chart-1 stroke-card"
                  strokeWidth="2"
                >
                  <title>{`${item.period}: ${formatter(item.revenue)} actual`}</title>
                </circle>
              )}
              {item.forecast != null && (
                <circle
                  cx={x(index)}
                  cy={y(item.forecast)}
                  r="4"
                  className="fill-chart-2 stroke-card"
                  strokeWidth="2"
                >
                  <title>{`${item.period}: ${formatter(item.forecast)} estimated`}</title>
                </circle>
              )}
              {(index % labelStep === 0 || index === data.length - 1) && (
                <text
                  x={x(index)}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize="10"
                >
                  {item.period}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

export function HorizontalBars({
  items,
  valueLabel,
  formatValue,
}: {
  items: Array<{ label: string; value: number }>
  valueLabel: string
  formatValue?: (value: number) => string
}) {
  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
            <span className="min-w-0 truncate font-medium">{item.label}</span>
            <span className="shrink-0 text-muted-foreground">
              {formatValue ? formatValue(item.value) : item.value.toLocaleString()}
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-label={`${item.label} ${valueLabel}`}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={item.value}
          >
            <div
              className={cn(
                "h-full rounded-full",
                index % 2 === 0 ? "bg-chart-1" : "bg-chart-2",
              )}
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "success" | "warning" | "danger" | "accent"
}) {
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/10 text-destructive",
    accent: "bg-secondary text-primary",
  }

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  )
}

export function Field({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <input
        {...props}
        className={cn(
          "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm font-normal shadow-sm placeholder:text-muted-foreground",
          className,
        )}
      />
    </label>
  )
}
