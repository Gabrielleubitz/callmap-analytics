/**
 * Billing calculation utilities
 * 
 * Centralizes all billing calculations (MRR, revenue, etc.) to ensure consistency.
 * All routes should use these functions instead of calculating inline.
 */

import { adminDb } from '../firebase-admin'
import { FIRESTORE_COLLECTIONS } from '../config'
import { getPlanMRR, isPayingPlan } from '../config'
import { toDate, toFirestoreTimestamp } from './date'
import { Plan } from '../types'

/**
 * Calculate MRR (Monthly Recurring Revenue)
 * 
 * Formula: Sum of PLAN_PRICES[plan] for all workspaces where plan !== 'free'
 * Field: workspaces.plan
 * Uses: lib/config.ts PLAN_PRICES
 */
export async function calculateMRR(): Promise<number> {
  if (!adminDb) return 0
  const db = adminDb
  const workspacesSnapshot = await db.collection(FIRESTORE_COLLECTIONS.teams).get()
  
  let mrr = 0
  for (const doc of workspacesSnapshot.docs) {
    const plan = (doc.data().plan || 'free') as Plan
    mrr += getPlanMRR(plan)
  }
  
  return mrr
}

/**
 * Count paying teams (teams with plan !== 'free')
 * 
 * Formula: Count of workspaces where plan !== 'free'
 * Field: workspaces.plan
 */
export async function countPayingTeams(): Promise<number> {
  if (!adminDb) return 0
  const db = adminDb
  const workspacesSnapshot = await db.collection(FIRESTORE_COLLECTIONS.teams).get()
  
  let count = 0
  for (const doc of workspacesSnapshot.docs) {
    const plan = (doc.data().plan || 'free') as Plan
    if (isPayingPlan(plan)) {
      count++
    }
  }
  
  return count
}

/**
 * Calculate total revenue from payments within a date range
 * 
 * Formula: Sum of payments.amountUsd where createdAt is within date range
 * Fields: payments.amountUsd (or amount_usd), payments.createdAt
 */
export async function calculateRevenueFromPayments(
  start: Date,
  end: Date
): Promise<number> {
  let totalRevenue = 0
  
  if (!adminDb) return 0
  const db = adminDb
  
  try {
    const paymentsSnapshot = await db.collection(FIRESTORE_COLLECTIONS.payments).get()
    for (const doc of paymentsSnapshot.docs) {
      const data = doc.data()
      const createdAt = toDate(data.createdAt)
      if (createdAt && createdAt >= start && createdAt <= end) {
        totalRevenue += data.amountUsd || data.amount_usd || 0
      }
    }
  } catch (error) {
    console.warn('[Billing] Could not fetch payments:', error)
  }
  
  return totalRevenue
}

/**
 * Calculate total revenue from invoices within a date range
 * 
 * Formula: Sum of invoices.amountUsd where paidAt is within date range
 * Fields: invoices.amountUsd (or amount_usd), invoices.paidAt
 */
export async function calculateRevenueFromInvoices(
  start: Date,
  end: Date
): Promise<number> {
  let totalRevenue = 0
  
  if (!adminDb) return 0
  const db = adminDb
  
  try {
    const invoicesSnapshot = await db.collection(FIRESTORE_COLLECTIONS.invoices).get()
    for (const doc of invoicesSnapshot.docs) {
      const data = doc.data()
      const paidAt = toDate(data.paidAt || data.paid_at)
      if (paidAt && paidAt >= start && paidAt <= end) {
        totalRevenue += data.amountUsd || data.amount_usd || 0
      }
    }
  } catch (error) {
    console.warn('[Billing] Could not fetch invoices:', error)
  }
  
  return totalRevenue
}

/**
 * Calculate total revenue (from payments or invoices, whichever is available)
 * 
 * Prefers invoices if available, falls back to payments
 */
export async function calculateTotalRevenue(
  start: Date,
  end: Date
): Promise<number> {
  // Try invoices first
  const invoiceRevenue = await calculateRevenueFromInvoices(start, end)
  if (invoiceRevenue > 0) {
    return invoiceRevenue
  }
  
  // Fallback to payments
  return await calculateRevenueFromPayments(start, end)
}

/**
 * Calculate unpaid invoices total
 * 
 * Formula: Sum of invoices.amountUsd where status !== 'paid' && status !== 'void'
 * Fields: invoices.amountUsd, invoices.status
 */
export async function calculateUnpaidInvoices(): Promise<number> {
  let unpaidTotal = 0
  
  if (!adminDb) return 0
  const db = adminDb
  
  try {
    const invoicesSnapshot = await db.collection(FIRESTORE_COLLECTIONS.invoices).get()
    for (const doc of invoicesSnapshot.docs) {
      const data = doc.data()
      const status = data.status
      if (status !== 'paid' && status !== 'void') {
        unpaidTotal += data.amountUsd || data.amount_usd || 0
      }
    }
  } catch (error) {
    console.warn('[Billing] Could not fetch unpaid invoices:', error)
  }
  
  return unpaidTotal
}

/**
 * Calculate revenue by plan from payments/invoices
 * 
 * Groups revenue by the plan of the team that made the payment
 */
export async function calculateRevenueByPlan(
  start: Date,
  end: Date
): Promise<Map<Plan, number>> {
  if (!adminDb) return new Map<Plan, number>()
  const db = adminDb
  const planRevenue = new Map<Plan, number>()
  
  // Get all payments in range
  try {
    const paymentsSnapshot = await db.collection(FIRESTORE_COLLECTIONS.payments).get()
    for (const doc of paymentsSnapshot.docs) {
      const data = doc.data()
      const createdAt = toDate(data.createdAt)
      if (createdAt && createdAt >= start && createdAt <= end) {
        const workspaceId = data.workspaceId || data.teamId
        if (workspaceId) {
          try {
            const workspaceDoc = await db.collection(FIRESTORE_COLLECTIONS.teams).doc(workspaceId).get()
            if (workspaceDoc.exists) {
              const plan = (workspaceDoc.data()?.plan || 'free') as Plan
              const amount = data.amountUsd || data.amount_usd || 0
              planRevenue.set(plan, (planRevenue.get(plan) || 0) + amount)
            }
          } catch (error) {
            // Ignore individual workspace lookup errors
          }
        }
      }
    }
  } catch (error) {
    console.warn('[Billing] Could not fetch payments for revenue by plan:', error)
  }
  
  // Also check invoices
  
  try {
    const invoicesSnapshot = await db.collection(FIRESTORE_COLLECTIONS.invoices).get()
    for (const doc of invoicesSnapshot.docs) {
      const data = doc.data()
      const paidAt = toDate(data.paidAt || data.paid_at)
      if (paidAt && paidAt >= start && paidAt <= end) {
        const workspaceId = data.workspaceId || data.teamId
        if (workspaceId) {
          try {
            const workspaceDoc = await db.collection(FIRESTORE_COLLECTIONS.teams).doc(workspaceId).get()
            if (workspaceDoc.exists) {
              const plan = (workspaceDoc.data()?.plan || 'free') as Plan
              const amount = data.amountUsd || data.amount_usd || 0
              planRevenue.set(plan, (planRevenue.get(plan) || 0) + amount)
            }
          } catch (error) {
            // Ignore individual workspace lookup errors
          }
        }
      }
    }
  } catch (error) {
    console.warn('[Billing] Could not fetch invoices for revenue by plan:', error)
  }
  
  return planRevenue
}

/**
 * Calculate daily revenue from payments/invoices
 * Returns map of date string (YYYY-MM-DD) -> revenue
 */
export async function calculateDailyRevenue(
  start: Date,
  end: Date
): Promise<Map<string, number>> {
  if (!adminDb) return new Map<string, number>()
  const db = adminDb
  const dailyRevenue = new Map<string, number>()
  
  // Get payments
  try {
    const paymentsSnapshot = await db.collection(FIRESTORE_COLLECTIONS.payments).get()
    for (const doc of paymentsSnapshot.docs) {
      const data = doc.data()
      const createdAt = toDate(data.createdAt)
      if (createdAt && createdAt >= start && createdAt <= end) {
        const dateKey = createdAt.toISOString().split('T')[0]
        const amount = data.amountUsd || data.amount_usd || 0
        dailyRevenue.set(dateKey, (dailyRevenue.get(dateKey) || 0) + amount)
      }
    }
  } catch (error) {
    console.warn('[Billing] Could not fetch payments for daily revenue:', error)
  }
  
  // Also check invoices
  
  try {
    const invoicesSnapshot = await db.collection(FIRESTORE_COLLECTIONS.invoices).get()
    for (const doc of invoicesSnapshot.docs) {
      const data = doc.data()
      const paidAt = toDate(data.paidAt || data.paid_at)
      if (paidAt && paidAt >= start && paidAt <= end) {
        const dateKey = paidAt.toISOString().split('T')[0]
        const amount = data.amountUsd || data.amount_usd || 0
        dailyRevenue.set(dateKey, (dailyRevenue.get(dateKey) || 0) + amount)
      }
    }
  } catch (error) {
    console.warn('[Billing] Could not fetch invoices for daily revenue:', error)
  }
  
  return dailyRevenue
}

