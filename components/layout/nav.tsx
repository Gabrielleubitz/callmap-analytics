"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LogoutButton } from "@/components/auth/logout-button"
import { ErrorNotificationBell } from "@/components/support/error-notification-bell"

const primaryNavItems = [
  { href: "/", label: "Overview" },
  { href: "/monitoring", label: "Monitoring" },
  { href: "/teams", label: "Teams" },
  { href: "/users", label: "Users" },
  { href: "/analytics", label: "Analytics" },
  { href: "/ops", label: "Ops" },
  { href: "/ai-assistant", label: "AI Assistant" },
  { href: "/support/errors", label: "Support" },
]

const secondaryNavItems = [
  { href: "/insights", label: "Insights" },
  { href: "/users/health", label: "User Health" },
  { href: "/predictions", label: "Predictions" },
  { href: "/dashboards", label: "Dashboards" },
  { href: "/reports", label: "Reports" },
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/explorer", label: "Data Explorer" },
  { href: "/journeys", label: "Journeys" },
  { href: "/diagnostics", label: "Diagnostics" },
  { href: "/settings", label: "Settings" },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-40 border-b border-white/30 bg-gradient-to-r from-white/90 via-white/85 to-white/90 backdrop-blur-2xl shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-8 w-8 overflow-hidden rounded-md bg-white shadow-soft">
                <img
                  src="/callmap-logo.png"
                  alt="CallMap"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight gradient-text">
                  CallMap Analytics
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">
                  Admin Dashboard
                </span>
              </div>
            </Link>

            {/* Navigation links */}
            <div className="hidden md:flex items-center">
              <div className="flex items-center gap-1 rounded-full bg-white/40 backdrop-blur-xl border border-white/30 px-1 py-1 shadow-lg">
                {primaryNavItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname?.startsWith(item.href)) ||
                    (item.href === "/monitoring" && (pathname?.startsWith("/monitoring/live") || pathname?.startsWith("/monitoring/alerts"))) ||
                    (item.href === "/predictions" && pathname?.startsWith("/predictions/")) ||
                    (item.href === "/analytics" && (pathname?.startsWith("/usage") || pathname?.startsWith("/billing") || pathname?.startsWith("/revenue/optimization"))) ||
                    (item.href === "/ai-assistant" && (pathname?.startsWith("/admin/ai-agents") || pathname?.startsWith("/analytics/chat")))

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all duration-300",
                        isActive
                          ? "bg-gradient-to-r from-cyan-500/90 to-blue-500/90 text-white shadow-lg shadow-cyan-500/25 backdrop-blur-md"
                          : "text-slate-700 hover:text-slate-900 hover:bg-white/60 backdrop-blur-sm"
                      )}
                    >
                      {item.label}
                    </Link>
                  )
                })}

                {/* More dropdown for secondary items */}
                <div className="relative group">
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-smooth flex items-center gap-1",
                      secondaryNavItems.some(
                        (item) =>
                          pathname === item.href ||
                          (item.href !== "/" && pathname?.startsWith(item.href))
                      )
                        ? "bg-white text-slate-900 shadow-soft"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
                    )}
                  >
                    More
                    <span className="text-[10px]">▾</span>
                  </button>
                  <div className="invisible absolute left-0 top-full z-50 mt-2 w-48 rounded-2xl border border-white/30 bg-gradient-to-br from-white/95 via-white/90 to-white/95 backdrop-blur-2xl py-2 text-xs shadow-2xl opacity-0 transition-all duration-300 group-hover:visible group-hover:opacity-100">
                    {secondaryNavItems.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== "/" && pathname?.startsWith(item.href))

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex w-full px-4 py-2 text-left whitespace-nowrap transition-all duration-200 rounded-lg mx-1",
                            isActive
                              ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-slate-900 border border-cyan-400/30"
                              : "text-slate-700 hover:bg-white/60 hover:text-slate-900"
                          )}
                        >
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            <ErrorNotificationBell />
            <span className="hidden text-xs text-slate-500 md:inline-flex">
              Secure admin
            </span>
            <LogoutButton />
          </div>
        </div>

        {/* Mobile nav (horizontal scroll) */}
        <div className="md:hidden pb-2 -mb-2">
          <div className="flex gap-1 overflow-x-auto no-scrollbar pt-1">
            {[...primaryNavItems, ...secondaryNavItems].map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all duration-300",
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/90 to-blue-500/90 text-white shadow-lg shadow-cyan-500/25 backdrop-blur-md"
                      : "text-slate-700 hover:text-slate-900 hover:bg-white/60 backdrop-blur-sm"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}


