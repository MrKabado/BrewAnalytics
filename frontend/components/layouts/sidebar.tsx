"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  ChevronLeft,
  Coffee,
  FileSpreadsheet,
  Gauge,
  Lightbulb,
  Settings2,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth/auth-provider"

const navigation = [
  { label: "Overview", href: "/dashboard", icon: Gauge },
  { label: "Datasets", href: "/datasets", icon: FileSpreadsheet },
]

const analytics = [
  { label: "Descriptive", href: "/analytics/descriptive", icon: BarChart3 },
  { label: "Predictive", href: "/analytics/predictive", icon: Sparkles },
  { label: "Prescriptive", href: "/analytics/prescriptive", icon: Lightbulb },
]

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const { user } = useAuth()
  const initials = (user?.name ?? user?.email ?? "BA")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()

  const links = (items: typeof navigation) =>
    items.map(({ label, href, icon: Icon }) => {
      const active =
        pathname === href ||
        (href !== "/dashboard" && pathname.startsWith(`${href}/`))

      return (
        <Link
          key={href}
          href={href}
          onClick={onClose}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-muted",
          )}
        >
          <Icon
            className={cn(
              "size-[18px]",
              active ? "text-primary" : "text-muted-foreground",
            )}
            aria-hidden="true"
          />
          {label}
          {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
        </Link>
      )
    })

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-foreground/25 md:hidden"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-[72px] items-center justify-between border-b border-sidebar-border px-5">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2.5"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Coffee className="size-[19px]" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-[15px] leading-5 font-semibold tracking-tight">
                BrewAnalytics
              </span>
              <span className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                Sales intelligence
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted md:hidden"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-7 overflow-y-auto px-3 py-6"
        >
          <div className="space-y-1">{links(navigation)}</div>
          <div>
            <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Analytics
            </p>
            <div className="space-y-1">{links(analytics)}</div>
          </div>
        </nav>
        <div className="border-t border-sidebar-border p-3">
          {links([
            { label: "Settings", href: "/settings", icon: Settings2 },
          ])}
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/70 px-3 py-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user?.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
            <ChevronLeft className="size-4 rotate-180 text-muted-foreground" />
          </div>
        </div>
      </aside>
    </>
  )
}