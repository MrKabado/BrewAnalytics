"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import { Bell, Menu, Search, X } from "lucide-react"

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/datasets": "Datasets",
  "/analytics/descriptive": "Descriptive analytics",
  "/analytics/predictive": "Predictive analytics",
  "/analytics/prescriptive": "Prescriptive analytics",
  "/settings": "Settings",
}

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname()
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const title = pathname.startsWith("/datasets/")
    ? "Dataset details"
    : (pageTitles[pathname] ?? "BrewAnalytics")

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-7 lg:px-9">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
        >
          <Menu className="size-5" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold sm:text-base">{title}</p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Good morning. Here&apos;s your business at a glance.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {searchOpen ? (
          <div className="hidden items-center gap-1 sm:flex">
            <label className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus aria-label="Search workspace" placeholder="Search workspace" className="h-9 w-48 rounded-lg border border-input bg-card pr-3 pl-9 text-sm" />
            </label>
            <button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Open workspace search"
            onClick={() => setSearchOpen(true)}
            className="hidden size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted sm:flex"
          >
            <Search className="size-4" />
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => {
              setNotificationsOpen((open) => !open)
              setAccountOpen(false)
            }}
            className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <Bell className="size-[18px]" />
            <span className="absolute top-2 right-2 size-1.5 rounded-full bg-primary" />
          </button>
          {notificationsOpen && (
            <div className="absolute top-11 right-0 z-50 w-64 rounded-xl border border-border bg-card p-4 shadow-lg">
              <p className="text-sm font-semibold">You&apos;re all caught up</p>
              <p className="mt-1 text-xs text-muted-foreground">There are no new sample notifications.</p>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label="Open account menu"
            aria-expanded={accountOpen}
            onClick={() => {
              setAccountOpen((open) => !open)
              setNotificationsOpen(false)
            }}
            className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary"
          >
            BA
          </button>
          {accountOpen && (
            <div className="absolute top-11 right-0 z-50 w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
              <div className="border-b border-border px-3 py-2">
                <p className="text-sm font-semibold">Brew Admin</p>
                <p className="text-xs text-muted-foreground">admin@brewco.com</p>
              </div>
              <Link href="/settings" onClick={() => setAccountOpen(false)} className="mt-1 block rounded-lg px-3 py-2 text-sm hover:bg-muted">Account settings</Link>
              <Link href="/login" onClick={() => setAccountOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted">Preview login screen</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}