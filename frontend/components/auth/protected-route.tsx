"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"

export function ProtectedRoute({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { status, refresh } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [router, status])

  if (status === "unavailable") {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-6">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Can&apos;t verify your session</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The API could not verify your session. Check that it is running and try again.
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-5 h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <Link href="/login" className="ml-4 text-sm font-medium text-primary hover:underline">
            Go to sign in
          </Link>
        </section>
      </main>
    )
  }

  if (status !== "authenticated") {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <p role="status" className="text-sm text-muted-foreground">
          Checking your session…
        </p>
      </main>
    )
  }

  return children
}
