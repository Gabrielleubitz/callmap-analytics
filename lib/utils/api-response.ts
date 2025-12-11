/**
 * Standardized API response utilities
 * 
 * Ensures all API routes return consistent response shapes and error formats.
 */

import { NextResponse } from 'next/server'

/**
 * Standard paginated response shape
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/**
 * Standard metric/aggregate response shape
 */
export interface MetricResponse<T> {
  data: T
  meta?: {
    dateRange?: { start: string; end: string }
    generatedAt?: string
  }
}

/**
 * Standard error response shape
 */
export interface ErrorResponse {
  error: string
  details?: unknown
  code?: string
}

/**
 * Create a successful paginated response
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
  })
}

/**
 * Create a successful metric response
 */
export function metricResponse<T>(
  data: T,
  meta?: MetricResponse<T>['meta']
): NextResponse<MetricResponse<T>> {
  return NextResponse.json({
    data,
    meta: meta || {},
  })
}

/**
 * Create an error response with proper HTTP status
 */
export function errorResponse(
  error: string,
  status: number = 500,
  details?: unknown,
  code?: string
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error,
      details,
      code,
    },
    { status }
  )
}

/**
 * Create a validation error response (400)
 */
export function validationError(details: unknown): NextResponse<ErrorResponse> {
  return errorResponse('Validation failed', 400, details, 'VALIDATION_ERROR')
}

/**
 * Create a not found error response (404)
 */
export function notFoundError(resource: string): NextResponse<ErrorResponse> {
  return errorResponse(`${resource} not found`, 404, undefined, 'NOT_FOUND')
}

/**
 * Create an internal server error response (500)
 */
export function serverError(message: string, details?: unknown): NextResponse<ErrorResponse> {
  return errorResponse(message, 500, details, 'INTERNAL_ERROR')
}

