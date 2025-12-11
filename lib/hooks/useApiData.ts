import { useState, useEffect } from 'react'

interface UseApiDataResult<T> {
  data: T | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

/**
 * useApiData hook
 * 
 * Generic hook for fetching data from API endpoints.
 * Handles loading, error, and success states consistently.
 * 
 * @param fetcher Function that returns a Promise<T>
 * @param deps Optional dependency array to trigger refetch
 * @returns { data, isLoading, isError, error, refetch }
 */
export function useApiData<T>(
  fetcher: () => Promise<T | null>,
  deps: any[] = []
): UseApiDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setIsError(false)
      setError(null)
      
      const result = await fetcher()
      setData(result)
    } catch (err) {
      setIsError(true)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setData(null)
      console.error('[useApiData] Error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: fetchData,
  }
}

