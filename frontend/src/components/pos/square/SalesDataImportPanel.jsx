import { useState } from 'react'
import { useSnackbar } from 'notistack'
import { Loader2, Download, AlertCircle, Calendar, Trash2, RefreshCw, CheckCircle } from 'lucide-react'
import PropTypes from 'prop-types'
import { syncSales, transformSales, clearSalesData } from '../../../services/posSyncService'

/**
 * SalesDataImportPanel Component
 * 
 * Purpose: UI for triggering Square sales data import with date range selection
 * 
 * Features:
 * - Date range picker (startDate, endDate)
 * - Import button to trigger sales sync
 * - Loading state during sync
 * - Display sync results (orders synced, line items, transformation stats)
 * - Clear sales data functionality
 * - Error handling
 * 
 * Created: 2025-01-24 (Issue #46)
 */
const SalesDataImportPanel = ({ connectionId, restaurantId, onSyncComplete }) => {
  const { enqueueSnackbar } = useSnackbar()
  
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dateError, setDateError] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [isTransforming, setIsTransforming] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [transformResult, setTransformResult] = useState(null)
  const [error, setError] = useState(null)

  /**
   * Validate date range
   */
  const isDateRangeValid = () => {
    if (!startDate || !endDate) return false
    return new Date(startDate) <= new Date(endDate)
  }

  /**
   * Validate and update date error message
   */
  const validateDateRange = () => {
    if (startDate && endDate && !isDateRangeValid()) {
      setDateError('End date must be after start date')
    } else {
      setDateError('')
    }
  }

  /**
   * Set last 7 days preset
   */
  const setLast7Days = () => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 7)
    
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
    setDateError('')
  }

  /**
   * Handle import sales from Square (sync only, no transform)
   */
  const handleImport = async () => {
    if (!isDateRangeValid()) {
      enqueueSnackbar('Please select a valid date range', { variant: 'warning' })
      return
    }

    try {
      setIsImporting(true)
      setError(null)
      
      enqueueSnackbar('Starting Square sales import...', { variant: 'info' })
      
      // Trigger sync WITHOUT transform (staged data)
      const result = await syncSales(connectionId, {
        startDate,
        endDate,
        dryRun: false
      })
      
      setSyncResult(result)
      
      enqueueSnackbar('Sales import completed successfully!', { variant: 'success' })
      
      // Notify parent component
      if (onSyncComplete) {
        onSyncComplete(result)
      }
      
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Import failed'
      setError(errorMessage)
      enqueueSnackbar(`Import failed: ${errorMessage}`, { variant: 'error' })
    } finally {
      setIsImporting(false)
    }
  }

  /**
   * Handle transform from Square sales data (Tier 1 -> Tier 2)
   */
  const handleTransform = async () => {
    try {
      setIsTransforming(true)
      setError(null)
      
      enqueueSnackbar('Starting sales data transformation...', { variant: 'info' })
      
      // Trigger transformation only
      const result = await transformSales(connectionId, {
        startDate,
        endDate,
        dryRun: false
      })
      
      setTransformResult(result)
      
      enqueueSnackbar('Transformation completed!', { variant: 'success' })
      
      // Notify parent component
      if (onSyncComplete) {
        onSyncComplete(result)
      }
      
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Transformation failed'
      setError(errorMessage)
      enqueueSnackbar(`Transform failed: ${errorMessage}`, { variant: 'error' })
    } finally {
      setIsTransforming(false)
    }
  }

  /**
   * Handle clear all sales data
   */
  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to delete all sales data? This will remove all imported Square orders, line items, and transformed sales transactions.')) {
      return
    }

    try {
      setIsClearing(true)
      setError(null)
      
      enqueueSnackbar('Clearing all Square sales data...', { variant: 'info' })
      
      // Call clear sales data API
      await clearSalesData(restaurantId)
      
      // Clear local state
      setSyncResult(null)
      setTransformResult(null)
      setStartDate('')
      setEndDate('')
      
      enqueueSnackbar('All Square sales data cleared successfully!', { variant: 'success' })
      
      // Notify parent
      if (onSyncComplete) {
        onSyncComplete(null)
      }
      
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to clear data'
      setError(errorMessage)
      enqueueSnackbar(`Clear failed: ${errorMessage}`, { variant: 'error' })
    } finally {
      setIsClearing(false)
    }
  }

  /**
   * Render import stats
   */
  const renderStats = () => {
    if (!syncResult && !transformResult) return null

    const { sync, transform } = syncResult || {}

    // Defensive: handle both backend formats (synced.orders vs ordersSynced)
    const ordersSynced = sync?.ordersSynced || sync?.synced?.orders || 0
    const lineItemsSynced = sync?.lineItemsSynced || sync?.synced?.lineItems || 0

    return (
      <div className="mt-4 space-y-4">
        {/* Sync Phase Stats */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            📥 Sales Data Imported from Square
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Orders Synced"
              value={ordersSynced}
              icon={<CheckCircle className="w-5 h-5 text-green-500" />}
            />
            <StatCard
              label="Line Items"
              value={lineItemsSynced}
              icon={<CheckCircle className="w-5 h-5 text-blue-500" />}
            />
          </div>
        </div>

        {/* Transform Phase Stats */}
        {(transform || transformResult) && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              🔄 Sales Transactions Created
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Created"
                value={(transformResult?.transform?.successCount || transformResult?.transform?.created || transform?.successCount || transform?.created || 0)}
                icon={<CheckCircle className="w-5 h-5 text-green-500" />}
              />
              <StatCard
                label="Failed"
                value={(transformResult?.transform?.errorCount || transformResult?.transform?.errors?.length || transform?.errorCount || transform?.errors?.length || 0)}
                icon={<AlertCircle className="w-5 h-5 text-red-500" />}
                variant={(transformResult?.transform?.errorCount || transformResult?.transform?.errors?.length || transform?.errorCount || transform?.errors?.length) > 0 ? 'error' : 'success'}
              />
              <StatCard
                label="Skipped"
                value={(transformResult?.transform?.skippedCount || transformResult?.transform?.skipped || transform?.skippedCount || transform?.skipped || 0)}
                icon={<AlertCircle className="w-5 h-5 text-yellow-500" />}
              />
            </div>
          </div>
        )}

        {/* Duration */}
        {syncResult && (
          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              ⏱️ Duration: {(syncResult.duration / 1000).toFixed(2)}s
            </p>
            <p className="text-xs text-gray-500">
              Status: <span className="font-semibold">{syncResult.status}</span>
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Square Sales Import
        </h3>
        
        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={isImporting || isTransforming || isClearing || !connectionId || !isDateRangeValid()}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium
              transition-colors duration-200
              ${isImporting || isTransforming || isClearing || !isDateRangeValid()
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
            `}
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Import Data
              </>
            )}
          </button>
          
          <button
            onClick={handleTransform}
            disabled={isTransforming || isImporting || isClearing || !connectionId || !syncResult}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium
              transition-colors duration-200
              ${isTransforming || isImporting || isClearing || !syncResult
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-green-600 hover:bg-green-700 text-white'
              }
            `}
            title={!syncResult ? 'Import data first' : 'Transform imported data to sales transactions'}
          >
            {isTransforming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Transforming...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Transform
              </>
            )}
          </button>

          <button
            onClick={handleClearData}
            disabled={isImporting || isTransforming || isClearing || !connectionId}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium
              transition-colors duration-200
              ${isImporting || isTransforming || isClearing
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-red-600 hover:bg-red-700 text-white'
              }
            `}
            title="Clear all sales data"
          >
            {isClearing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Clear Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-700">
              Select Date Range
            </h4>
          </div>
          
          <button
            onClick={setLast7Days}
            disabled={isImporting || isTransforming || isClearing}
            className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 
                       hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
          >
            Last 7 Days
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-xs font-medium text-gray-600 mb-1">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setDateError('')
              }}
              onBlur={validateDateRange}
              disabled={isImporting || isTransforming || isClearing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          
          <div>
            <label htmlFor="endDate" className="block text-xs font-medium text-gray-600 mb-1">
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setDateError('')
              }}
              onBlur={validateDateRange}
              disabled={isImporting || isTransforming || isClearing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>
        
        {/* Date Validation Error */}
        {dateError && (
          <div className="mt-2 text-xs text-red-600">
            {dateError}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Import Error</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isImporting && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Stats Display */}
      {!isImporting && renderStats()}

      {/* Empty State */}
      {!isImporting && !syncResult && !error && (
        <div className="py-8 text-center text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Select dates and click "Import"</p>
        </div>
      )}
    </div>
  )
}

/**
 * StatCard Component - Simple stat display
 */
const StatCard = ({ label, value, icon, variant = 'default' }) => {
  const bgColor = variant === 'error' ? 'bg-red-50' : 'bg-gray-50'
  
  return (
    <div className={`${bgColor} rounded-lg p-3`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

SalesDataImportPanel.propTypes = {
  connectionId: PropTypes.number,
  restaurantId: PropTypes.number.isRequired,
  onSyncComplete: PropTypes.func
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  icon: PropTypes.node,
  variant: PropTypes.oneOf(['default', 'error', 'success'])
}

export default SalesDataImportPanel
