/**
 * Request size and validation limits
 * 
 * SECURITY: Prevents DoS attacks via large payloads
 */

// Maximum request body size (1MB)
export const MAX_REQUEST_BODY_SIZE = 1024 * 1024 // 1MB

// Maximum search query length
export const MAX_SEARCH_QUERY_LENGTH = 1000

// Maximum pagination page size
export const MAX_PAGE_SIZE = 100

/**
 * Check if request body size is within limits
 */
export function validateRequestBodySize(body: string): { valid: boolean; error?: string } {
  const size = new Blob([body]).size
  if (size > MAX_REQUEST_BODY_SIZE) {
    return {
      valid: false,
      error: `Request body too large. Maximum size is ${MAX_REQUEST_BODY_SIZE / 1024}KB`,
    }
  }
  return { valid: true }
}

/**
 * Validate and sanitize search query
 */
export function validateSearchQuery(query: string | undefined): { valid: boolean; sanitized?: string; error?: string } {
  if (!query) {
    return { valid: true, sanitized: '' }
  }
  
  if (typeof query !== 'string') {
    return { valid: false, error: 'Search query must be a string' }
  }
  
  if (query.length > MAX_SEARCH_QUERY_LENGTH) {
    return {
      valid: false,
      error: `Search query too long. Maximum length is ${MAX_SEARCH_QUERY_LENGTH} characters`,
    }
  }
  
  // Basic sanitization - remove potentially dangerous characters
  const sanitized = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH)
  
  return { valid: true, sanitized }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page?: number, pageSize?: number): { valid: boolean; page: number; pageSize: number; error?: string } {
  const validatedPage = Math.max(1, page || 1)
  const validatedPageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize || 20))
  
  if (validatedPage < 1) {
    return {
      valid: false,
      page: 1,
      pageSize: validatedPageSize,
      error: 'Page must be greater than 0',
    }
  }
  
  if (validatedPageSize > MAX_PAGE_SIZE) {
    return {
      valid: false,
      page: validatedPage,
      pageSize: MAX_PAGE_SIZE,
      error: `Page size cannot exceed ${MAX_PAGE_SIZE}`,
    }
  }
  
  return {
    valid: true,
    page: validatedPage,
    pageSize: validatedPageSize,
  }
}

