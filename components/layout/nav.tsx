"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LogoutButton } from "@/components/auth/logout-button"

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/teams", label: "Teams" },
  { href: "/users", label: "Users" },
  { href: "/usage", label: "Usage & Tokens" },
  { href: "/billing", label: "Billing" },
  { href: "/ops", label: "Ops" },
  { href: "/explorer", label: "Data Explorer" },
  { href: "/journeys", label: "Journeys" },
  { href: "/diagnostics", label: "Diagnostics" },
  { href: "/settings", label: "Settings" },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-soft flex items-center justify-center text-xs font-bold text-white">
                CM
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
              <div className="flex items-center gap-1 rounded-full bg-slate-100/70 px-1 py-1 shadow-soft">
                {navItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname?.startsWith(item.href))

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-smooth",
                        isActive
                          ? "bg-white text-slate-900 shadow-soft"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
                      )}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 md:inline-flex">
              Secure admin
            </span>
            <LogoutButton />
          </div>
        </div>

        {/* Mobile nav (horizontal scroll) */}
        <div className="md:hidden pb-2 -mb-2">
          <div className="flex gap-1 overflow-x-auto no-scrollbar pt-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-smooth",
                    isActive
                      ? "bg-white text-slate-900 shadow-soft"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/70"
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

