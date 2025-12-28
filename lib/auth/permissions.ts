/**
 * Centralized Role-Based Access Control (RBAC) Helpers
 * 
 * This module provides a single source of truth for permission checks across the application.
 * All admin, analytics, and AI routes should use these helpers instead of inline role checks.
 * 
 * SECURITY: These functions verify session cookies and enforce role-based access control.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import * as admin from 'firebase-admin'
import { verifySessionCookie } from './session'

export type UserRole = 'superAdmin' | 'admin' | 'user'

export interface AuthResult {
  success: boolean
  decodedToken?: admin.auth.DecodedIdToken
  error?: string
  statusCode?: number
}

/**
 * Require authentication (any logged-in user)
 * Returns decoded token if valid, error response if not
 */
export async function requireAuth(request?: NextRequest): Promise<AuthResult> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('callmap_session')?.value

    if (!sessionCookie) {
      return {
        success: false,
        error: 'Unauthorized',
        statusCode: 401,
      }
    }

    const decodedToken = await verifySessionCookie(sessionCookie)

    return {
      success: true,
      decodedToken,
    }
  } catch (error: any) {
    return {
      success: false,
      error: 'Invalid session',
      statusCode: 401,
    }
  }
}

/**
 * Require admin or superAdmin role
 * Returns decoded token if user has admin access, error response if not
 */
export async function requireAdmin(request?: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(request)

  if (!authResult.success || !authResult.decodedToken) {
    return authResult
  }

  const { decodedToken } = authResult

  // Check if user has admin access
  if (!decodedToken.isAdmin) {
    return {
      success: false,
      error: 'Forbidden. Admin access required.',
      statusCode: 403,
    }
  }

  // Check if user has a valid role
  if (!decodedToken.role || (decodedToken.role !== 'admin' && decodedToken.role !== 'superAdmin')) {
    return {
      success: false,
      error: 'Forbidden. Invalid user role.',
      statusCode: 403,
    }
  }

  return {
    success: true,
    decodedToken,
  }
}

/**
 * Require superAdmin role only
 * Returns decoded token if user is superAdmin, error response if not
 */
export async function requireSuperAdmin(request?: NextRequest): Promise<AuthResult> {
  const authResult = await requireAdmin(request)

  if (!authResult.success || !authResult.decodedToken) {
    return authResult
  }

  const { decodedToken } = authResult

  if (decodedToken.role !== 'superAdmin') {
    return {
      success: false,
      error: 'Forbidden. SuperAdmin access required.',
      statusCode: 403,
    }
  }

  return {
    success: true,
    decodedToken,
  }
}

/**
 * Require specific role
 * Returns decoded token if user has the required role, error response if not
 */
export async function requireRole(role: UserRole, request?: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(request)

  if (!authResult.success || !authResult.decodedToken) {
    return authResult
  }

  const { decodedToken } = authResult

  if (decodedToken.role !== role) {
    return {
      success: false,
      error: `Forbidden. ${role} access required.`,
      statusCode: 403,
    }
  }

  return {
    success: true,
    decodedToken,
  }
}

/**
 * Check if user has permission for a specific resource and action
 * This is a placeholder for future resource-based permissions
 */
export async function checkPermission(
  resource: string,
  action: string,
  request?: NextRequest
): Promise<AuthResult> {
  // For now, delegate to requireAdmin
  // In the future, this could check workspace ownership, resource-level permissions, etc.
  return requireAdmin(request)
}

/**
 * Helper to create error response from AuthResult
 */
export function authErrorResponse(authResult: AuthResult): NextResponse {
  return NextResponse.json(
    { error: authResult.error || 'Unauthorized' },
    { status: authResult.statusCode || 401 }
  )
}

/**
 * Helper to verify user owns or has access to a workspace
 * Returns true if user is admin/superAdmin or owns the workspace
 */
export async function canAccessWorkspace(
  workspaceId: string,
  userId: string,
  request?: NextRequest
): Promise<boolean> {
  // Admin/superAdmin can access any workspace
  const adminResult = await requireAdmin(request)
  if (adminResult.success) {
    return true
  }

  // TODO: Check if user is owner/member of workspace
  // This requires querying the workspace members collection
  // For now, return false if not admin
  return false
}

/**
 * Helper to verify user can access another user's data
 * Returns true if user is admin/superAdmin or accessing their own data
 */
export async function canAccessUser(
  targetUserId: string,
  request?: NextRequest
): Promise<boolean> {
  const authResult = await requireAuth(request)
  
  if (!authResult.success || !authResult.decodedToken) {
    return false
  }

  const { decodedToken } = authResult

  // Admin/superAdmin can access any user
  if (decodedToken.isAdmin && (decodedToken.role === 'admin' || decodedToken.role === 'superAdmin')) {
    return true
  }

  // Users can access their own data
  return decodedToken.uid === targetUserId
}

