import { useState } from 'react'
import { useSnackbar } from 'notistack'
import { Loader2, Download, CheckCircle, AlertCircle, RefreshCw, Trash2 } from 'lucide-react'
import PropTypes from 'prop-types'
import { syncInventory, transformInventory, getSyncStatus, clearPOSData } from '../../../services/posSyncService'

/**
 * DataImportPanel Component
 * 
 * Purpose: Quick & dirty UI for triggering Square data import and showing raw counts
 * 
 * Features:
 * - Import button to trigger sync
 * - Loading state during sync
 * - Display raw counts from Square (categories, items, inventory)
 * - Error handling
 * 
 * Created: 2025-10-06
 */
const DataImportPanel = ({ connectionId, restaurantId, onSyncComplete }) => {
  const { enqueueSnackbar } = useSnackbar()
  
  const [isImporting, setIsImporting] = useState(false)
  const [isTransforming, setIsTransforming] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [transformResult, setTransformResult] = useState(null)
  const [error, setError] = useState(null)

  /**
   * Handle import from Square
   */
  const handleImport = async () => {
    try {
      setIsImporting(true)
      setError(null)
      
      enqueueSnackbar('Starting Square data import...', { variant: 'info' })
      
      // Trigger sync with default options (incremental)
      const result = await syncInventory(connectionId, {
        incremental: true,
        dryRun: false,
        clearBeforeSync: false
      })
      
      setSyncResult(result)
      
      enqueueSnackbar('Import completed successfully!', { variant: 'success' })
      
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
   * Handle transform from Square data
   */
  const handleTransform = async () => {
    try {
      setIsTransforming(true)
      setError(null)
      
      enqueueSnackbar('Starting data transformation...', { variant: 'info' })
      
      // Trigger transformation
      const result = await transformInventory(connectionId, {
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
   * Handle clear all POS data
   */
  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to clear all Square data? This will remove imported items and transformed inventory items.')) {
      return
    }

    try {
      setIsClearing(true)
      setError(null)
      
      enqueueSnackbar('Clearing all Square data...', { variant: 'info' })
      
      // Call clear API via service
      await clearPOSData(restaurantId)
      
      // Clear local state
      setSyncResult(null)
      setTransformResult(null)
      
      enqueueSnackbar('All Square data cleared successfully!', { variant: 'success' })
      
      // Notify parent
      if (onSyncComplete) {
        onSyncComplete(null)
      }
      
    } catch (err) {
      const errorMessage = err.message || 'Failed to clear data'
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

    return (
      <div className="mt-4 space-y-4">
        {/* Sync Phase Stats */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            📥 Data Imported from Square
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Items Synced"
              value={sync?.synced || 0}
              icon={<CheckCircle className="w-5 h-5 text-green-500" />}
            />
            <StatCard
              label="Sync Errors"
              value={sync?.errors?.length || 0}
              icon={<AlertCircle className="w-5 h-5 text-red-500" />}
              variant={sync?.errors?.length > 0 ? 'error' : 'success'}
            />
          </div>
        </div>

        {/* Transform Phase Stats */}
        {(transform || transformResult) && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              🔄 Data Transformation
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Transformed"
                value={(transformResult?.transform?.successCount || transform?.successCount || 0)}
                icon={<CheckCircle className="w-5 h-5 text-green-500" />}
              />
              <StatCard
                label="Failed"
                value={(transformResult?.transform?.errorCount || transform?.errorCount || 0)}
                icon={<AlertCircle className="w-5 h-5 text-red-500" />}
                variant={(transformResult?.transform?.errorCount || transform?.errorCount) > 0 ? 'error' : 'success'}
              />
              <StatCard
                label="Skipped"
                value={(transformResult?.transform?.skippedCount || transform?.skippedCount || 0)}
                icon={<AlertCircle className="w-5 h-5 text-yellow-500" />}
              />
            </div>
          </div>
        )}

        {/* Duration */}
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            ⏱️ Duration: {(syncResult.duration / 1000).toFixed(2)}s
          </p>
          <p className="text-xs text-gray-500">
            Status: <span className="font-semibold">{syncResult.status}</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Square Data Import
        </h3>
        
        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={isImporting || isTransforming || isClearing || !connectionId}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium
              transition-colors duration-200
              ${isImporting || isTransforming || isClearing
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
            title={!syncResult ? 'Import data first' : 'Transform imported data to inventory items'}
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
            title="Clear all imported and transformed data"
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
          <Download className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Click "Import Data" to sync from Square</p>
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

DataImportPanel.propTypes = {
  connectionId: PropTypes.number,
  restaurantId: PropTypes.number.isRequired,
  onSyncComplete: PropTypes.func
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  icon: PropTypes.node,
  variant: PropTypes.oneOf(['default', 'error'])
}

export default DataImportPanel
