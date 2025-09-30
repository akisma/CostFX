import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Calendar, Package, TrendingUp, AlertTriangle } from 'lucide-react'
import PeriodSelector from './PeriodSelector'
import { 
  fetchInventoryDashboard, 
  selectInventoryDashboard, 
  selectSelectedPeriod,
  selectSelectedDateRange,
  selectInventoryLoadingStates 
} from '../../store/slices/inventorySlice'

const InventoryList = () => {
  const dispatch = useDispatch()
  const dashboardData = useSelector(selectInventoryDashboard)
  const selectedPeriod = useSelector(selectSelectedPeriod)
  const selectedDateRange = useSelector(selectSelectedDateRange)
  const loadingStates = useSelector(selectInventoryLoadingStates)
  
  // For demo purposes, using restaurant ID 1
  const restaurantId = 1

  useEffect(() => {
    // Load initial dashboard data
    dispatch(fetchInventoryDashboard(restaurantId))
  }, [dispatch, restaurantId])

  const handlePeriodSelect = (period) => {
    console.log('Selected period:', period)
    // Here you could trigger period-specific inventory analysis
    // For now, we'll just show the period selection working
  }

  const handleDateRangeSelect = (dateRange) => {
    console.log('Selected date range:', dateRange)
    // Here you could trigger custom date range inventory analysis
  }

  const getCurrentPeriodDisplay = () => {
    if (selectedPeriod) {
      return `${selectedPeriod.periodName} (${selectedPeriod.periodStart} - ${selectedPeriod.periodEnd})`
    }
    if (selectedDateRange?.from && selectedDateRange?.to) {
      return `Custom Range: ${selectedDateRange.from.toLocaleDateString()} - ${selectedDateRange.to.toLocaleDateString()}`
    }
    return 'No period selected'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        <button className="btn btn-primary">
          Add Transaction
        </button>
      </div>

      {/* Period Selection Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Period Selection</h2>
          </div>
          <span className="text-sm text-gray-600">
            Current: {getCurrentPeriodDisplay()}
          </span>
        </div>
        
        <div className="max-w-md">
          <PeriodSelector
            restaurantId={restaurantId}
            selectedPeriod={selectedPeriod}
            selectedDateRange={selectedDateRange}
            onPeriodSelect={handlePeriodSelect}
            onDateRangeSelect={handleDateRangeSelect}
            placeholder="Select inventory period..."
            showCreateButton={true}
            showDateRangePicker={true}
            className="w-full"
          />
        </div>
      </div>

      {/* Inventory Dashboard */}
      {loadingStates?.dashboard ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : dashboardData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Inventory Summary Cards */}
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData?.summary?.totalItems || 0}
                </p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${dashboardData?.summary?.totalValue?.toLocaleString() || '0'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Urgent Reorders</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData?.summary?.urgentReorders || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical Expirations</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData?.summary?.criticalExpirations || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-6">
          <p className="text-gray-600">Loading inventory data...</p>
        </div>
      )}

      {/* Period-Specific Analysis Placeholder */}
      {(selectedPeriod || selectedDateRange) && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Period Analysis: {getCurrentPeriodDisplay()}
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800">
              🎉 <strong>PeriodSelector Integration Complete!</strong>
            </p>
            <p className="text-blue-700 mt-2">
              The PeriodSelector component is now successfully integrated and ready for period-based inventory analysis.
              Future enhancements will include:
            </p>
            <ul className="text-blue-700 mt-2 ml-4 list-disc">
              <li>Period-specific inventory variance analysis</li>
              <li>Theoretical vs actual usage tracking</li>
              <li>Period-over-period comparison</li>
              <li>Automated period creation and management</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default InventoryList