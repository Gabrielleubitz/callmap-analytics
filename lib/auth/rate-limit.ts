/**
 * Simple in-memory rate limiting
 * 
 * DEPRECATED: Use rate-limit-kv.ts for production (distributed rate limiting).
 * This is kept for backward compatibility and as a fallback.
 * 
 * For production, use checkRateLimitKV from rate-limit-kv.ts
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Check if a request should be rate limited
 * 
 * @param key Unique identifier for the rate limit (e.g., IP address, user ID)
 * @param maxRequests Maximum number of requests allowed
 * @param windowMs Time window in milliseconds
 * @returns true if rate limited, false otherwise
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return false
  }

  // Increment count
  entry.count++

  // Check if limit exceeded
  if (entry.count > maxRequests) {
    return true
  }

  return false
}

/**
 * Get remaining requests for a key
 */
export function getRemainingRequests(key: string): number {
  const entry = rateLimitStore.get(key)
  if (!entry) return 5 // Default max requests
  
  const now = Date.now()
  if (now > entry.resetTime) {
    return 5 // Reset window expired
  }
  
  return Math.max(0, 5 - entry.count) // Assuming maxRequests = 5
}

/**
 * Clear rate limit for a key (useful for testing)
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key)
}

