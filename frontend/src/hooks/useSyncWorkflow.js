import { useState } from 'react'
import { useSnackbar } from 'notistack'

/**
 * useSyncWorkflow Hook
 * 
 * Shared state management logic for sync/transform/clear workflows.
 * Eliminates code duplication between DataImportPanel and SalesDataImportPanel.
 * 
 * Usage:
 * ```js
 * const workflow = useSyncWorkflow({
 *   syncFn: syncSales,
 *   transformFn: transformSales,
 *   clearFn: clearSalesData,
 *   dataTypeName: 'sales',
 *   connectionId,
 *   restaurantId,
 *   onComplete: handleComplete
 * })
 * ```
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.syncFn - Async function to sync data (e.g., syncSales, syncInventory)
 * @param {Function} options.transformFn - Async function to transform data
 * @param {Function} options.clearFn - Async function to clear data
 * @param {string} options.dataTypeName - Display name for snackbar messages (e.g., "sales", "inventory")
 * @param {number} options.connectionId - POS connection ID
 * @param {number} options.restaurantId - Restaurant ID (for clear operation)
 * @param {Function} [options.onComplete] - Optional callback after sync/transform/clear
 * @param {Object} [options.syncParams] - Optional extra params for sync (e.g., {startDate, endDate})
 * 
 * @returns {Object} Workflow state and methods
 */
export const useSyncWorkflow = ({
  syncFn,
  transformFn,
  clearFn,
  dataTypeName = 'data',
  connectionId,
  restaurantId,
  onComplete,
  syncParams = {}
}) => {
  const { enqueueSnackbar } = useSnackbar()

  const [isImporting, setIsImporting] = useState(false)
  const [isTransforming, setIsTransforming] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [transformResult, setTransformResult] = useState(null)
  const [error, setError] = useState(null)

  /**
   * Execute sync operation
   */
  const handleSync = async (additionalParams = {}) => {
    try {
      setIsImporting(true)
      setError(null)

      enqueueSnackbar(`Starting ${dataTypeName} import...`, { variant: 'info' })

      const result = await syncFn(connectionId, {
        ...syncParams,
        ...additionalParams,
        dryRun: false
      })

      setSyncResult(result)
      enqueueSnackbar(`${dataTypeName.charAt(0).toUpperCase() + dataTypeName.slice(1)} import completed successfully!`, { variant: 'success' })

      if (onComplete) {
        onComplete(result)
      }

      return result
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Import failed'
      setError(errorMessage)
      enqueueSnackbar(`Import failed: ${errorMessage}`, { variant: 'error' })
      throw err
    } finally {
      setIsImporting(false)
    }
  }

  /**
   * Execute transform operation
   */
  const handleTransform = async (additionalParams = {}) => {
    try {
      setIsTransforming(true)
      setError(null)

      enqueueSnackbar(`Starting ${dataTypeName} transformation...`, { variant: 'info' })

      const result = await transformFn(connectionId, {
        ...syncParams,
        ...additionalParams,
        dryRun: false
      })

      setTransformResult(result)
      enqueueSnackbar('Transformation completed!', { variant: 'success' })

      if (onComplete) {
        onComplete(result)
      }

      return result
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Transformation failed'
      setError(errorMessage)
      enqueueSnackbar(`Transform failed: ${errorMessage}`, { variant: 'error' })
      throw err
    } finally {
      setIsTransforming(false)
    }
  }

  /**
   * Execute clear operation
   */
  const handleClear = async (confirmMessage) => {
    const defaultMessage = `Are you sure you want to delete all ${dataTypeName} data? This action cannot be undone.`
    
    if (!window.confirm(confirmMessage || defaultMessage)) {
      return null
    }

    try {
      setIsClearing(true)
      setError(null)

      enqueueSnackbar(`Clearing ${dataTypeName} data...`, { variant: 'info' })

      const result = await clearFn(restaurantId)

      // Clear local state
      setSyncResult(null)
      setTransformResult(null)

      enqueueSnackbar(`${dataTypeName.charAt(0).toUpperCase() + dataTypeName.slice(1)} data cleared successfully!`, { variant: 'success' })

      if (onComplete) {
        onComplete(null)
      }

      return result
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Clear failed'
      setError(errorMessage)
      enqueueSnackbar(`Clear failed: ${errorMessage}`, { variant: 'error' })
      throw err
    } finally {
      setIsClearing(false)
    }
  }

  /**
   * Reset all state
   */
  const reset = () => {
    setSyncResult(null)
    setTransformResult(null)
    setError(null)
  }

  return {
    // State
    isImporting,
    isTransforming,
    isClearing,
    syncResult,
    transformResult,
    error,
    
    // Methods
    handleSync,
    handleTransform,
    handleClear,
    reset,
    
    // Setters (for advanced use cases)
    setSyncResult,
    setTransformResult,
    setError
  }
}

export default useSyncWorkflow
