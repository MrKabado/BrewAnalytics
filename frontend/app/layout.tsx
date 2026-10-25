import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth/auth-provider"
import { cn } from "@/lib/utils"
import type { Metadata } from "next"
import { Toaster } from "sonner"

const geist = Geist({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "BrewAnalytics | Sales intelligence",
  description: "Sales analytics and business intelligence for coffee shops.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider>
          <AuthProvider>
            <Toaster richColors position="top-right" />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
