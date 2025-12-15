import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import "./globals.css"
import { ConditionalNav } from "@/components/layout/conditional-nav"

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
})

export const metadata: Metadata = {
  title: "CallMap Admin",
  description: "Internal admin dashboard for CallMap",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={outfit.variable} suppressHydrationWarning>
      <body className={outfit.className} suppressHydrationWarning>
        <ConditionalNav />
        {/* 
          Global app shell background
          - Soft radial gradients to make the dashboard feel more premium
          - Kept light for readability of existing cards and components
        */}
        <main className="min-h-screen bg-gray-50 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.10),_transparent_55%)]">
          {children}
        </main>
      </body>
    </html>
  )
}

