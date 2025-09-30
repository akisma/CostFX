import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { 
  DollarSign, 
  TrendingDown, 
  Package, 
  AlertTriangle,
  TrendingUp,
  Calendar
} from 'lucide-react'
import MetricCard from './MetricCard'
import ChartContainer from './ChartContainer'
import PeriodSelector from '../inventory/PeriodSelector'
import { 
  selectSelectedPeriod,
  selectSelectedDateRange
} from '../../store/slices/inventorySlice'

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    costSavings: 0,
    inventoryValue: 0,
    wastePercentage: 0,
    loading: true
  })

  const [recentActivity, setRecentActivity] = useState([])
  const [alerts, setAlerts] = useState([])
  const [showPeriodSelector, setShowPeriodSelector] = useState(false)
  
  // Redux selectors for period selection
  const selectedPeriod = useSelector(selectSelectedPeriod)
  const selectedDateRange = useSelector(selectSelectedDateRange)
  
  // For demo purposes, using restaurant ID 1
  const restaurantId = 1

  const getCurrentPeriodDisplay = () => {
    if (selectedPeriod) {
      return selectedPeriod.periodName
    }
    if (selectedDateRange?.from && selectedDateRange?.to) {
      return 'Custom Range'
    }
    return 'All Time'
  }

  const handlePeriodSelect = (period) => {
    console.log('Dashboard period selected:', period)
    setShowPeriodSelector(false)
    // Here you could trigger dashboard data refresh for the selected period
  }

  const handleDateRangeSelect = (dateRange) => {
    console.log('Dashboard date range selected:', dateRange)
    setShowPeriodSelector(false)
    // Here you could trigger dashboard data refresh for the selected date range
  }

  useEffect(() => {
    // Simulate API calls
    const fetchDashboardData = async () => {
      // Simulated data - replace with actual API calls
      setTimeout(() => {
        setMetrics({
          totalRevenue: 45650,
          costSavings: 2340,
          inventoryValue: 8900,
          wastePercentage: 6.2,
          loading: false
        })

        setRecentActivity([
          { id: 1, type: 'inventory', message: 'Chicken breast running low', time: '2 hours ago' },
          { id: 2, type: 'cost', message: 'Tomato prices increased by 15%', time: '4 hours ago' },
          { id: 3, type: 'waste', message: 'Lettuce waste exceeded 10%', time: '6 hours ago' }
        ])

        setAlerts([
          { id: 1, type: 'warning', message: 'Order more olive oil by tomorrow', priority: 'medium' },
          { id: 2, type: 'error', message: 'High waste detected in produce', priority: 'high' }
        ])
      }, 1000)
    }

    fetchDashboardData()
  }, [])

  if (metrics.loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
          </div>
          
          {/* Period Selection Widget */}
          <div className="relative">
            <button
              onClick={() => setShowPeriodSelector(!showPeriodSelector)}
              className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-gray-700">Period: {getCurrentPeriodDisplay()}</span>
            </button>
            
            {showPeriodSelector && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-80">
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-gray-900">Select Analysis Period</h3>
                  <p className="text-xs text-gray-500">Choose a period for dashboard analytics</p>
                </div>
                <PeriodSelector
                  restaurantId={restaurantId}
                  selectedPeriod={selectedPeriod}
                  selectedDateRange={selectedDateRange}
                  onPeriodSelect={handlePeriodSelect}
                  onDateRangeSelect={handleDateRangeSelect}
                  placeholder="All time data..."
                  showCreateButton={false}
                  showDateRangePicker={true}
                  className="w-full"
                />
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => setShowPeriodSelector(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Period Context Display */}
      {(selectedPeriod || selectedDateRange) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            📊 <strong>Dashboard showing data for:</strong> {getCurrentPeriodDisplay()}
            {selectedPeriod && (
              <span className="text-blue-600 ml-2">
                ({selectedPeriod.periodStart} - {selectedPeriod.periodEnd})
              </span>
            )}
          </p>
        </div>
      )}

      {/* Value Proposition */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Smart Restaurant Operations</h2>
            <p className="text-gray-700 leading-relaxed">
              CostFX transforms your restaurant system from reactive management to proactive waste prevention, 
              creating a complete solution that not only tracks and analyzes inventory but actively generates 
              solutions to minimize waste while maintaining profitability and quality.
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border-l-4 ${
                alert.priority === 'high' 
                  ? 'bg-red-50 border-red-500 text-red-800'
                  : 'bg-yellow-50 border-yellow-500 text-yellow-800'
              }`}
            >
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                {alert.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={`$${metrics.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: 8.2, isPositive: true }}
          color="blue"
        />
        <MetricCard
          title="Cost Savings"
          value={`$${metrics.costSavings.toLocaleString()}`}
          icon={TrendingUp}
          trend={{ value: 12.5, isPositive: true }}
          color="green"
        />
        <MetricCard
          title="Inventory Value"
          value={`$${metrics.inventoryValue.toLocaleString()}`}
          icon={Package}
          trend={{ value: 3.1, isPositive: false }}
          color="purple"
        />
        <MetricCard
          title="Waste Percentage"
          value={`${metrics.wastePercentage}%`}
          icon={TrendingDown}
          trend={{ value: 1.8, isPositive: false }}
          color="red"
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Trends Chart */}
        <ChartContainer
          title="Cost Trends (Last 7 Days)"
          data={[
            { name: 'Mon', costs: 420, revenue: 680 },
            { name: 'Tue', costs: 380, revenue: 720 },
            { name: 'Wed', costs: 450, revenue: 650 },
            { name: 'Thu', costs: 390, revenue: 780 },
            { name: 'Fri', costs: 520, revenue: 890 },
            { name: 'Sat', costs: 480, revenue: 950 },
            { name: 'Sun', costs: 460, revenue: 820 }
          ]}
        />

        {/* Recent Activity */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                  activity.type === 'inventory' ? 'bg-blue-500' :
                  activity.type === 'cost' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <div>
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="btn btn-primary">
            Add Inventory Transaction
          </button>
          <button className="btn btn-secondary">
            Create New Recipe
          </button>
          <button className="btn btn-secondary">
            Generate Cost Report
          </button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard