/**
 * Distributed rate limiting using Upstash Redis
 * 
 * SECURITY: This replaces the in-memory rate limiting with a distributed solution
 * that works across multiple Vercel serverless functions.
 * 
 * Falls back to in-memory rate limiting if Redis is not configured (for local dev).
 */

import { Redis } from '@upstash/redis'

// Initialize Redis client (lazy initialization)
let redisClient: Redis | null = null

function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient
  }

  const url = process.env.REDIS_KV_REST_API_URL || process.env.KV_REST_API_URL
  const token = process.env.REDIS_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN

  if (url && token) {
    try {
      redisClient = new Redis({
        url,
        token,
      })
      return redisClient
    } catch (error) {
      console.warn('[Rate Limit] Failed to initialize Redis:', error)
      return null
    }
  }

  return null
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// Fallback in-memory store for local development
const fallbackStore = new Map<string, RateLimitEntry>()

/**
 * Get rate limit key with improved fingerprinting
 * SECURITY: Uses IP + user-agent + path for better identification
 */
function getRateLimitKey(
  identifier: string,
  request?: { headers?: Headers; url?: string }
): string {
  let key = identifier

  // Add request fingerprinting for better rate limiting
  if (request) {
    const userAgent = request.headers?.get('user-agent') || ''
    const path = request.url ? new URL(request.url).pathname : ''
    // Use a hash of user-agent + path to avoid storing sensitive data
    const fingerprint = `${userAgent.slice(0, 20)}:${path.slice(0, 50)}`
    key = `${identifier}:${Buffer.from(fingerprint).toString('base64').slice(0, 16)}`
  }

  return key
}

/**
 * Check if a request should be rate limited using Vercel KV
 * Falls back to in-memory if KV is not available
 * 
 * @param key Unique identifier for the rate limit (e.g., IP address, user ID)
 * @param maxRequests Maximum number of requests allowed
 * @param windowMs Time window in milliseconds
 * @param request Optional request object for fingerprinting
 * @returns { rateLimited: boolean; remaining: number; resetTime: number }
 */
export async function checkRateLimitKV(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 15 * 60 * 1000,
  request?: { headers?: Headers; url?: string }
): Promise<{ rateLimited: boolean; remaining: number; resetTime: number }> {
  const rateLimitKey = getRateLimitKey(key, request)
  const now = Date.now()
  const resetTime = now + windowMs

  try {
    // Try to use Upstash Redis if available
    const redis = getRedisClient()
    if (redis) {
      const redisKey = `ratelimit:${rateLimitKey}`
      
      // Get current count
      const current = await redis.get<RateLimitEntry>(redisKey)
      
      if (!current || now > current.resetTime) {
        // Create new entry
        const entry: RateLimitEntry = {
          count: 1,
          resetTime,
        }
        // Set with TTL in seconds
        await redis.set(redisKey, entry, { ex: Math.ceil(windowMs / 1000) })
        return {
          rateLimited: false,
          remaining: maxRequests - 1,
          resetTime,
        }
      }

      // Increment count
      const newCount = current.count + 1
      const entry: RateLimitEntry = {
        count: newCount,
        resetTime: current.resetTime,
      }
      // Update with remaining TTL
      await redis.set(redisKey, entry, { ex: Math.ceil((current.resetTime - now) / 1000) })

      if (newCount > maxRequests) {
        return {
          rateLimited: true,
          remaining: 0,
          resetTime: current.resetTime,
        }
      }

      return {
        rateLimited: false,
        remaining: maxRequests - newCount,
        resetTime: current.resetTime,
      }
    }
  } catch (error) {
    // If Redis fails, fall back to in-memory
    console.warn('[Rate Limit] Redis unavailable, using fallback:', error)
  }

  // Fallback to in-memory rate limiting (for local dev)
  const entry = fallbackStore.get(rateLimitKey)

  if (!entry || now > entry.resetTime) {
    fallbackStore.set(rateLimitKey, {
      count: 1,
      resetTime,
    })
    return {
      rateLimited: false,
      remaining: maxRequests - 1,
      resetTime,
    }
  }

  entry.count++

  if (entry.count > maxRequests) {
    return {
      rateLimited: true,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  return {
    rateLimited: false,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Get remaining requests for a key
 */
export async function getRemainingRequestsKV(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 15 * 60 * 1000,
  request?: { headers?: Headers; url?: string }
): Promise<number> {
  const result = await checkRateLimitKV(key, maxRequests, windowMs, request)
  return result.remaining
}

/**
 * Clear rate limit for a key (useful for testing)
 */
export async function clearRateLimitKV(
  key: string,
  request?: { headers?: Headers; url?: string }
): Promise<void> {
  const rateLimitKey = getRateLimitKey(key, request)
  
  try {
    const redis = getRedisClient()
    if (redis) {
      await redis.del(`ratelimit:${rateLimitKey}`)
    }
  } catch (error) {
    console.warn('[Rate Limit] Failed to clear Redis:', error)
  }
  
  fallbackStore.delete(rateLimitKey)
}

/**
 * Get client identifier from request
 * SECURITY: Improved IP extraction with fingerprinting
 */
export function getClientIdentifier(request: {
  headers: Headers
  url?: string
}): string {
  // Try to get real IP from Vercel headers
  const ip =
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown'

  // Add user-agent hash for better fingerprinting
  const userAgent = request.headers.get('user-agent') || ''
  const uaHash = Buffer.from(userAgent.slice(0, 50)).toString('base64').slice(0, 16)

  return `${ip}:${uaHash}`
}

