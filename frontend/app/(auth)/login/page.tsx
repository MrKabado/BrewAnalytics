"use client"

import Link from "next/link"
import { useState } from "react"
import { Coffee, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [message, setMessage] = useState("")

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("Demo only — authentication is not connected in this preview.")
  }

  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[1fr_0.85fr]">
      <section className="flex min-h-svh flex-col px-6 py-8 sm:px-12 lg:px-16">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Coffee className="size-[19px]" /></span>
          <span className="text-[15px] font-semibold tracking-tight">BrewAnalytics</span>
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Welcome back</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to your workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">Get a clearer view of your coffee business.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="grid gap-2 text-sm font-medium">
              Email address
              <span className="relative">
                <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input required type="email" autoComplete="email" placeholder="you@yourcoffee.com" className="h-11 w-full rounded-lg border border-input bg-card pr-3 pl-10 text-sm font-normal placeholder:text-muted-foreground" />
              </span>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Password
              <span className="relative">
                <LockKeyhole className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input required minLength={8} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" className="h-11 w-full rounded-lg border border-input bg-card pr-11 pl-10 text-sm font-normal placeholder:text-muted-foreground" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-4 accent-primary" />
                Remember me
              </label>
              <button type="button" onClick={() => setMessage("Password recovery will be available when authentication is connected.")} className="text-sm font-medium text-primary hover:underline">Forgot password?</button>
            </div>
            <button type="submit" className="h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90">Sign in</button>
            {message && <p role="status" className="rounded-lg bg-secondary px-3 py-2.5 text-sm text-secondary-foreground">{message}</p>}
            <p className="text-center text-xs leading-5 text-muted-foreground">Demo interface. No credentials are sent or checked.</p>
          </form>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 BrewAnalytics · Sales intelligence for independent coffee shops</p>
      </section>
      <aside className="relative hidden overflow-hidden border-l border-border bg-secondary/60 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-28 -right-20 size-[420px] rounded-full border border-primary/10" />
        <div className="absolute top-20 -right-5 size-[320px] rounded-full border border-primary/10" />
        <p className="relative max-w-xs text-sm font-medium text-primary">A thoughtful way to understand your numbers.</p>
        <div className="relative max-w-lg">
          <div className="mb-8 flex items-end gap-3">
            {[38, 55, 47, 72, 63, 88, 76, 100].map((height, index) => <span key={index} className={`flex-1 rounded-t-md ${index === 7 ? "bg-primary" : "bg-primary/25"}`} style={{ height: `${height * 2.2}px` }} />)}
          </div>
          <p className="text-3xl leading-tight font-semibold tracking-tight">Make each cup count.</p>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Bring sales history, product performance, and practical insights together in one calm, focused workspace.</p>
        </div>
        <p className="relative text-xs text-muted-foreground">Designed for the people behind the counter.</p>
      </aside>
    </main>
  )
}