import { useState, useEffect, useCallback } from 'react'

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

interface PaginationParams {
  page: number
  pageSize: number
  [key: string]: any
}

interface UsePaginatedApiResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  isLoading: boolean
  isError: boolean
  error: Error | null
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  setFilters: (filters: Partial<PaginationParams>) => void
  refetch: () => void
  hasData: boolean
  isEmpty: boolean
}

/**
 * usePaginatedApi hook
 * 
 * Manages paginated API data fetching with filters and pagination state.
 * 
 * @param fetcher Function that accepts params and returns Promise<PaginatedResponse<T>>
 * @param initialParams Initial pagination and filter parameters
 * @returns Paginated data with loading/error states and pagination controls
 */
export function usePaginatedApi<T>(
  fetcher: (params: PaginationParams) => Promise<{ data: T[]; total: number } | null>,
  initialParams: PaginationParams = { page: 1, pageSize: 20 }
): UsePaginatedApiResult<T> {
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPageState] = useState(initialParams.page || 1)
  const [pageSize, setPageSizeState] = useState(initialParams.pageSize || 20)
  const [filters, setFiltersState] = useState<Partial<PaginationParams>>(
    Object.fromEntries(
      Object.entries(initialParams).filter(([key]) => !['page', 'pageSize'].includes(key))
    )
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      setIsError(false)
      setError(null)

      const params: PaginationParams = {
        page,
        pageSize,
        ...filters,
      }

      const result = await fetcher(params)
      if (result) {
        setItems(result.data || [])
        setTotal(result.total || 0)
      } else {
        setItems([])
        setTotal(0)
      }
    } catch (err) {
      setIsError(true)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setItems([])
      setTotal(0)
      console.error('[usePaginatedApi] Error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [fetcher, page, pageSize, filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const setPage = useCallback((newPage: number) => {
    setPageState(newPage)
  }, [])

  const setPageSize = useCallback((newPageSize: number) => {
    setPageSizeState(newPageSize)
    setPageState(1) // Reset to first page when page size changes
  }, [])

  const setFilters = useCallback((newFilters: Partial<PaginationParams>) => {
    setFiltersState(newFilters)
    setPageState(1) // Reset to first page when filters change
  }, [])

  return {
    items,
    total,
    page,
    pageSize,
    isLoading,
    isError,
    error,
    setPage,
    setPageSize,
    setFilters,
    refetch: fetchData,
    hasData: items.length > 0,
    isEmpty: !isLoading && !isError && items.length === 0,
  }
}

