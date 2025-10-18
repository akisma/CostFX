import { useState, useEffect, useCallback } from 'react'
import { useSnackbar } from 'notistack'
import { Loader2, BarChart3, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import PropTypes from 'prop-types'
import { getTransformationStats } from '../../../services/posSyncService'

/**
 * TransformationPanel Component
 * 
 * Purpose: Quick & dirty UI for showing transformation statistics
 * 
 * Features:
 * - Tier distribution (Tier 1/2/3/Unclassified)
 * - Category mapping breakdown
 * - Unit mapping breakdown
 * - Success rate
 * - Auto-refresh capability
 * 
 * Created: 2025-10-06
 */
const TransformationPanel = ({ restaurantId, refreshTrigger }) => {
  const { enqueueSnackbar } = useSnackbar()
  
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  /**
   * Fetch transformation statistics
   */
  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Fetch stats (includes tier counts, category/unit distribution)
      const statsData = await getTransformationStats(restaurantId)
      
      setStats(statsData)
      
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load stats'
      setError(errorMessage)
      enqueueSnackbar(`Failed to load transformation stats: ${errorMessage}`, { variant: 'error' })
    } finally {
      setIsLoading(false)
    }
  }, [enqueueSnackbar, restaurantId])

  /**
   * Load stats on mount and when refresh trigger changes
   */
  useEffect(() => {
    if (restaurantId) {
      fetchStats()
    }
  }, [restaurantId, refreshTrigger, fetchStats])

  /**
   * Render tier distribution
   */
  const renderTierDistribution = () => {
    if (!stats) return null

    const { tier1Count = 0, tier2Count = 0, tier3Count = 0, unclassifiedCount = 0 } = stats
    const total = tier1Count + tier2Count + tier3Count + unclassifiedCount

    if (total === 0) {
      return (
        <div className="text-center py-4 text-gray-500 text-sm">
          No items transformed yet
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <TierBar label="Tier 1" count={tier1Count} total={total} color="green" />
        <TierBar label="Tier 2" count={tier2Count} total={total} color="blue" />
        <TierBar label="Tier 3" count={tier3Count} total={total} color="yellow" />
        <TierBar label="Unclassified" count={unclassifiedCount} total={total} color="gray" />
      </div>
    )
  }

  /**
   * Render category mapping stats
   */
  const renderCategoryStats = () => {
    if (!stats?.byCategory || stats.byCategory.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500 text-sm">
          No category data available
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {stats.byCategory.slice(0, 5).map((item, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <span className="text-gray-700 truncate flex-1">{item.category}</span>
            <span className="font-semibold text-gray-900 ml-2">{item.count}</span>
          </div>
        ))}
        {stats.byCategory.length > 5 && (
          <p className="text-xs text-gray-500 pt-2">
            +{stats.byCategory.length - 5} more categories
          </p>
        )}
      </div>
    )
  }

  /**
   * Render unit mapping stats
   */
  const renderUnitStats = () => {
    if (!stats?.byUnit || stats.byUnit.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500 text-sm">
          No unit data available
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {stats.byUnit.slice(0, 5).map((item, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <span className="text-gray-700 truncate flex-1">{item.unit}</span>
            <span className="font-semibold text-gray-900 ml-2">{item.count}</span>
          </div>
        ))}
        {stats.byUnit.length > 5 && (
          <p className="text-xs text-gray-500 pt-2">
            +{stats.byUnit.length - 5} more units
          </p>
        )}
      </div>
    )
  }

  /**
   * Calculate success rate
   */
  const getSuccessRate = () => {
    if (!stats) return 0
    
    const { tier1Count = 0, tier2Count = 0, tier3Count = 0, unclassifiedCount = 0 } = stats
    const total = tier1Count + tier2Count + tier3Count + unclassifiedCount
    const classified = tier1Count + tier2Count + tier3Count
    
    if (total === 0) return 0
    return ((classified / total) * 100).toFixed(1)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Transformation Results
        </h3>
        
        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh stats"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Error Loading Stats</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !stats && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Stats Display */}
      {!isLoading && stats && (
        <div className="space-y-6">
          {/* Success Rate */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {getSuccessRate()}%
                </p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Items successfully classified into tiers
            </p>
          </div>

          {/* Tier Distribution */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Tier Distribution
            </h4>
            {renderTierDistribution()}
          </div>

          {/* Category Mapping */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              📦 Top Categories
            </h4>
            {renderCategoryStats()}
          </div>

          {/* Unit Mapping */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              📏 Top Units
            </h4>
            {renderUnitStats()}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !stats && !error && (
        <div className="py-8 text-center text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No transformation data available</p>
          <p className="text-xs text-gray-400 mt-1">Import data first to see results</p>
        </div>
      )}
    </div>
  )
}

/**
 * TierBar Component - Visual tier distribution bar
 */
const TierBar = ({ label, count, total, color }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0
  
  const colorClasses = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    gray: 'bg-gray-400'
  }

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-600">
          {count} <span className="text-gray-400">({percentage.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${colorClasses[color]} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

TransformationPanel.propTypes = {
  restaurantId: PropTypes.number.isRequired,
  refreshTrigger: PropTypes.any
}

TierBar.propTypes = {
  label: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  color: PropTypes.oneOf(['green', 'blue', 'yellow', 'gray']).isRequired
}

export default TransformationPanel
