"use client"

import { usePathname } from "next/navigation"
import { Nav } from "./nav"

/**
 * Conditionally renders Nav component
 * Hides nav on login, setup-mfa, and access-revoked pages
 */
export function ConditionalNav() {
  const pathname = usePathname()
  
  // Pages where nav should be hidden
  const hideNavPages = ['/login', '/setup-mfa', '/access-revoked']
  
  if (hideNavPages.includes(pathname)) {
    return null
  }
  
  return <Nav />
}

