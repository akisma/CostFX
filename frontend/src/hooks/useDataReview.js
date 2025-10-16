import { useState, useEffect, useCallback, useMemo } from 'react'

/**
 * useDataReview Hook
 * 
 * Shared state management logic for reviewing raw vs transformed data.
 * Eliminates code duplication between DataReviewPanel and SalesDataReviewPanel.
 * 
 * Usage:
 * ```js
 * const review = useDataReview({
 *   connectionId: 1,
 *   fetchRawFn: getRawSalesData,
 *   fetchTransformedFn: getTransformedSalesData,
 *   autoFetch: true
 * })
 * ```
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.connectionId - POS connection ID
 * @param {Function} options.fetchRawFn - Async function to fetch Tier 1 (raw) data
 * @param {Function} options.fetchTransformedFn - Async function to fetch Tier 2 (transformed) data
 * @param {boolean} [options.autoFetch=true] - Auto-fetch on mount and when connectionId changes
 * @param {Object} [options.fetchOptions] - Optional params to pass to fetch functions
 * 
 * @returns {Object} Review state and methods
 */
export const useDataReview = ({
  connectionId,
  fetchRawFn,
  fetchTransformedFn,
  autoFetch = true,
  fetchOptions = {}
}) => {
  const [rawData, setRawData] = useState(null)
  const [transformedData, setTransformedData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Memoize fetchOptions to prevent infinite loop from object recreation
  const stableFetchOptions = useMemo(() => fetchOptions, [JSON.stringify(fetchOptions)])

  /**
   * Fetch both raw and transformed data
   */
  const fetchData = useCallback(async () => {
    if (!connectionId) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch both in parallel for better performance
      const [rawResult, transformedResult] = await Promise.all([
        fetchRawFn(connectionId, stableFetchOptions),
        fetchTransformedFn(connectionId, stableFetchOptions)
      ])

      setRawData(rawResult)
      setTransformedData(transformedResult)
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch data'
      setError(errorMessage)
      console.error('Error fetching review data:', err)
    } finally {
      setLoading(false)
    }
  }, [connectionId, fetchRawFn, fetchTransformedFn, stableFetchOptions])

  /**
   * Auto-fetch on mount and when connectionId changes
   */
  useEffect(() => {
    if (autoFetch && connectionId) {
      fetchData()
    }
  }, [autoFetch, connectionId, fetchData])

  /**
   * Manually refresh data
   */
  const refresh = () => {
    return fetchData()
  }

  /**
   * Reset all state
   */
  const reset = () => {
    setRawData(null)
    setTransformedData(null)
    setError(null)
  }

  /**
   * Get statistics about the data
   */
  const getStats = () => {
    if (!rawData || !transformedData) {
      return null
    }

    // These will be customized per data type, but provide defaults
    return {
      raw: {
        count: Array.isArray(rawData) ? rawData.length : rawData.count || 0
      },
      transformed: {
        count: Array.isArray(transformedData) ? transformedData.length : transformedData.count || 0
      }
    }
  }

  return {
    // State
    rawData,
    transformedData,
    loading,
    error,
    
    // Methods
    fetchData,
    refresh,
    reset,
    getStats,
    
    // Setters (for advanced use cases)
    setRawData,
    setTransformedData,
    setError
  }
}

export default useDataReview
