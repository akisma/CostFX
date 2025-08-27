import { useState, useEffect } from 'react'
import { 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Package,
  RefreshCw,
  AlertCircle,
  BarChart3
} from 'lucide-react'
import ForecastChart from '../forecast/ForecastChart'
import ForecastMetricCard from '../forecast/ForecastMetricCard'
import forecastService from '../../services/forecastService'

const ForecastView = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('demand')
  const [forecastData, setForecastData] = useState({
    demand: null,
    seasonal: null,
    revenue: null,
    capacity: null,
    ingredients: null
  })

  const tabs = [
    { id: 'demand', name: 'Demand Forecast', icon: BarChart3 },
    { id: 'revenue', name: 'Revenue Prediction', icon: DollarSign },
    { id: 'seasonal', name: 'Seasonal Trends', icon: Calendar },
    { id: 'capacity', name: 'Capacity Planning', icon: Users },
    { id: 'ingredients', name: 'Ingredient Planning', icon: Package }
  ]

  const loadForecastData = async (type) => {
    setLoading(true)
    setError(null)
    
    try {
      let data
      switch (type) {
        case 'demand':
          data = await forecastService.getDemandForecast()
          break
        case 'seasonal':
          data = await forecastService.getSeasonalTrends()
          break
        case 'revenue':
          data = await forecastService.getRevenuePrediction()
          break
        case 'capacity':
          data = await forecastService.getCapacityOptimization()
          break
        case 'ingredients':
          data = await forecastService.getIngredientForecast()
          break
        default:
          throw new Error('Invalid forecast type')
      }
      
      setForecastData(prev => ({ ...prev, [type]: data }))
    } catch (err) {
      setError(`Failed to load ${type} forecast: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadForecastData(activeTab)
  }, [activeTab])

  const renderDemandForecast = () => {
    const data = forecastData.demand
    if (!data) return null

    const chartData = data.itemForecasts?.map((item, index) => ({
      label: item.itemName || `Item ${index + 1}`,
      value: item.forecastUnits || 0,
      confidence: item.confidence || 0
    })) || []

    return (
      <div className="space-y-6">
        {/* Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ForecastMetricCard
            title="Total Forecast"
            value={`${data.summary?.totalForecastUnits?.toLocaleString() || 0} units`}
            subValue={`${data.forecastPeriod?.days || 7} days`}
            confidence={data.metadata?.confidence}
            status="positive"
            icon={TrendingUp}
          />
          <ForecastMetricCard
            title="Daily Average"
            value={`${data.summary?.dailyAverageUnits?.toLocaleString() || 0} units`}
            subValue="per day"
            status="neutral"
            icon={BarChart3}
          />
          <ForecastMetricCard
            title="Total Items"
            value={`${data.summary?.totalItems || 0}`}
            subValue="forecasted items"
            status="warning"
            icon={AlertCircle}
          />
        </div>

        {/* Chart */}
        <div className="card p-6">
          <ForecastChart
            data={chartData}
            title={`${data.forecastPeriod?.days || 7}-Day Demand Forecast`}
            showTrend={true}
          />
        </div>

        {/* Recommendations */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Forecast Details</h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 p-1 rounded">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-sm text-gray-700">
                Forecast accuracy: {data.summary?.forecastAccuracy || 'Unknown'}
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-green-100 p-1 rounded">
                <BarChart3 className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-sm text-gray-700">
                Period: {new Date(data.forecastPeriod?.startDate).toLocaleDateString()} - {new Date(data.forecastPeriod?.endDate).toLocaleDateString()}
              </p>
            </div>
            {data.itemForecasts?.length === 0 && (
              <div className="flex items-start space-x-3">
                <div className="bg-yellow-100 p-1 rounded">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                </div>
                <p className="text-sm text-gray-700">
                  No specific item forecasts available. This may indicate insufficient historical data.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderRevenueForecast = () => {
    const data = forecastData.revenue
    if (!data) return null

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ForecastMetricCard
            title="Total Revenue"
            value={`$${data.totalProjections?.revenue?.toLocaleString() || 0}`}
            subValue={`${data.forecastPeriod?.days || 14} days`}
            status="positive"
            icon={DollarSign}
          />
          <ForecastMetricCard
            title="Daily Average"
            value={`$${Math.round(data.totalProjections?.dailyAverage || 0).toLocaleString()}`}
            subValue="per day"
            status="neutral"
            icon={TrendingUp}
          />
          <ForecastMetricCard
            title="Gross Margin"
            value={`${(data.profitabilityMetrics?.marginPercentage || 0).toFixed(1)}%`}
            subValue="profitability"
            status={data.profitabilityMetrics?.marginPercentage > 60 ? 'positive' : data.profitabilityMetrics?.marginPercentage > 40 ? 'warning' : 'negative'}
            icon={BarChart3}
          />
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Menu Item</h3>
          <div className="space-y-4">
            {data.itemRevenues?.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{item.itemName}</h4>
                  <p className="text-sm text-gray-500">{item.forecastUnits} units projected</p>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">${item.totalRevenue?.toLocaleString()}</div>
                  <div className="text-sm text-gray-500">
                    {((item.totalRevenue - item.totalCost) / item.totalRevenue * 100).toFixed(1)}% margin
                  </div>
                </div>
              </div>
            )) || (
              <p className="text-gray-500">No item breakdown available.</p>
            )}
          </div>
        </div>

        {/* Insights */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Insights</h3>
          <div className="space-y-3">
            {data.insights?.map((insight, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="bg-green-100 p-1 rounded">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-sm text-gray-700">{insight.message}</p>
              </div>
            )) || (
              <p className="text-gray-500">No revenue insights available.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderSeasonalAnalysis = () => {
    const data = forecastData.seasonal
    if (!data) return null

    const seasonalTrends = data.seasonalTrends || {}
    const trends = Object.entries(seasonalTrends).map(([season, trend]) => ({
      period: season.charAt(0).toUpperCase() + season.slice(1),
      growth: trend.averageGrowth || 0,
      confidence: trend.confidence || 0,
      description: `${trend.averageGrowth > 0 ? 'Growth' : 'Decline'} expected during ${season}`
    }))

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {trends.map((trend, index) => (
            <ForecastMetricCard
              key={index}
              title={trend.period}
              value={`${trend.growth > 0 ? '+' : ''}${trend.growth}%`}
              subValue={`${Math.round(trend.confidence * 100)}% confidence`}
              status={trend.growth > 0 ? 'positive' : trend.growth < 0 ? 'negative' : 'neutral'}
              description={trend.description}
            />
          ))}
          {trends.length === 0 && (
            <ForecastMetricCard
              title="Seasonal Analysis"
              value="No Data"
              status="neutral"
              description="Insufficient historical data for seasonal analysis"
            />
          )}
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h3>
          <div className="space-y-3">
            {data.recommendations?.map((rec, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="bg-green-100 p-1 rounded">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{rec.recommendation}</p>
                  <p className="text-xs text-gray-500">{rec.impact}</p>
                </div>
              </div>
            )) || (
              <p className="text-gray-500">No seasonal recommendations available.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderCapacityPlanning = () => {
    const data = forecastData.capacity
    if (!data) return null

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ForecastMetricCard
            title="Current Utilization"
            value={`${Math.round((data.capacityAnalysis?.utilizationRate || 0) * 100)}%`}
            status={data.capacityAnalysis?.utilizationRate > 0.85 ? 'warning' : data.capacityAnalysis?.utilizationRate > 0.70 ? 'positive' : 'neutral'}
            icon={Users}
          />
          <ForecastMetricCard
            title="Peak Demand"
            value={`${Math.round(data.capacityAnalysis?.peakDemand || 0).toLocaleString()} units`}
            subValue="expected maximum"
            status="warning"
            icon={TrendingUp}
          />
          <ForecastMetricCard
            title="Recommendation"
            value={data.capacityAnalysis?.recommendation || 'Maintain Current'}
            status="neutral"
            icon={AlertCircle}
          />
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Recommendations</h3>
          <div className="space-y-4">
            {data.recommendations?.map((rec, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                    rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {rec.priority} priority
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 mt-2">{rec.action}</p>
                <p className="text-sm text-gray-600">{rec.benefit}</p>
              </div>
            )) || (
              <p className="text-gray-500">Current capacity appears adequate for forecasted demand.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderIngredientPlanning = () => {
    const data = forecastData.ingredients
    if (!data) return null

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ForecastMetricCard
            title="Forecast Period"
            value={`${data.forecastPeriod?.days || 14} days`}
            status="neutral"
            icon={Calendar}
          />
          <ForecastMetricCard
            title="Safety Buffer"
            value={`${data.summary?.bufferPercentage || 15}%`}
            subValue="extra inventory"
            status="positive"
            icon={Package}
          />
          <ForecastMetricCard
            title="Est. Cost"
            value={`$${data.summary?.estimatedCost?.toLocaleString() || 500}`}
            subValue="procurement"
            status="neutral"
            icon={DollarSign}
          />
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ingredient Requirements</h3>
          <div className="space-y-4">
            {data.ingredientForecasts?.map((ingredient, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{ingredient.ingredient}</h4>
                  <p className="text-sm text-gray-500">Base need: {ingredient.totalNeeded} units</p>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{ingredient.finalQuantity} units</div>
                  <div className="text-sm text-gray-500">Including buffer</div>
                </div>
              </div>
            )) || (
              <p className="text-gray-500">No ingredient data available.</p>
            )}
          </div>
        </div>

        {data.procurementPlan && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Procurement Plan</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Order Frequency</p>
                <p className="text-lg text-gray-900">{data.procurementPlan.orderFrequency}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-lg text-gray-900">${data.procurementPlan.totalCost}</p>
              </div>
            </div>
            {data.procurementPlan.suppliers && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-600 mb-2">Suppliers</p>
                <div className="flex flex-wrap gap-2">
                  {data.procurementPlan.suppliers.map((supplier, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {supplier}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Forecast Intelligence</h1>
        <button
          onClick={() => loadForecastData(activeTab)}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading forecast data...</span>
        </div>
      ) : (
        <div>
          {activeTab === 'demand' && renderDemandForecast()}
          {activeTab === 'revenue' && renderRevenueForecast()}
          {activeTab === 'seasonal' && renderSeasonalAnalysis()}
          {activeTab === 'capacity' && renderCapacityPlanning()}
          {activeTab === 'ingredients' && renderIngredientPlanning()}
        </div>
      )}
    </div>
  )
}

export default ForecastView