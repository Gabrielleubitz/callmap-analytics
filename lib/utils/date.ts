/**
 * Date utility functions for consistent date handling
 * 
 * Handles conversion between Firestore Timestamps, Date objects, and ISO strings
 * consistently across the application.
 */

import * as admin from 'firebase-admin'

/**
 * Convert a Firestore Timestamp, Date, or ISO string to a Date object
 * Returns null if the value is null/undefined
 */
export function toDate(dateOrTimestamp: any): Date | null {
  if (!dateOrTimestamp) return null
  if (dateOrTimestamp?.toDate) return dateOrTimestamp.toDate()
  if (dateOrTimestamp instanceof Date) return dateOrTimestamp
  if (typeof dateOrTimestamp === 'string') {
    const parsed = new Date(dateOrTimestamp)
    return isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

/**
 * Convert a Date to a Firestore Timestamp
 */
export function toFirestoreTimestamp(date: Date): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromDate(date)
}

/**
 * Convert a Date to an ISO string (for API responses)
 */
export function toISOString(date: Date | null): string | null {
  return date ? date.toISOString() : null
}

/**
 * Check if a date is within a date range (inclusive)
 */
export function isDateInRange(date: Date | null, start: Date, end: Date): boolean {
  if (!date) return false
  return date >= start && date <= end
}

/**
 * Get the start of a day (00:00:00)
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get the end of a day (23:59:59.999)
 */
export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Format a date for display (YYYY-MM-DD)
 */
export function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

