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
  title: "CallMap Analytics",
  description: "Internal admin dashboard for CallMap",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "android-chrome-192x192", url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { rel: "android-chrome-512x512", url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
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

