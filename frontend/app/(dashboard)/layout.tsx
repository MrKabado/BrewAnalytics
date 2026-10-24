"use client"

import { useState } from "react"
import { Header } from "@/components/layouts/header"
import { Sidebar } from "@/components/layouts/sidebar"

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-svh bg-background">
      <Sidebar
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <div className="min-h-svh md:pl-[252px]">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">
          {children}
        </main>
      </div>
    </div>
  )
}