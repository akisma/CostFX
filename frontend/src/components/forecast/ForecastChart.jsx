import PropTypes from 'prop-types'
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react'

/**
 * ForecastChart - Displays forecast data in a simple visual format
 * Since we don't have a charting library, we'll create a simple bar representation
 */
const ForecastChart = ({ data, title, showTrend = true }) => {
  const chartData = Array.isArray(data) ? data : []

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <BarChart3 className="h-8 w-8 mr-2" />
        <span>No data available</span>
      </div>
    )
  }

  // Calculate max value for scaling
  const maxValue = Math.max(...chartData.map(item => item.value || item.demand || item.revenue || 0))
  
  // Calculate trend if showing trend
  const trend = showTrend && chartData.length > 1 ? 
    ((chartData[chartData.length - 1].value || 0) - (chartData[0].value || 0)) / (chartData[0].value || 1) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {showTrend && chartData.length > 1 && (
          <div className="flex items-center">
            {trend > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className={`text-sm font-medium ${
              trend > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {Math.abs(trend).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Simple bar chart representation */}
      <div className="space-y-2">
        {chartData.map((item, index) => {
          const value = item.value || item.demand || item.revenue || 0
          const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0
          
          return (
            <div key={index} className="flex items-center space-x-3">
              <div className="w-20 text-sm text-gray-600 text-right">
                {item.label || item.date || item.item || `Day ${index + 1}`}
              </div>
              <div className="flex-1">
                <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-sm font-medium text-gray-900 text-right">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </div>
              {item.confidence && (
                <div className="w-12 text-xs text-gray-500 text-right">
                  {Math.round(item.confidence * 100)}%
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">
            {chartData.reduce((sum, item) => sum + (item.value || item.demand || item.revenue || 0), 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">
            {Math.round(chartData.reduce((sum, item) => sum + (item.value || item.demand || item.revenue || 0), 0) / chartData.length).toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">Average</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">
            {maxValue.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">Peak</div>
        </div>
      </div>
    </div>
  )
}

ForecastChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object),
  title: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['bar', 'line']),
  showTrend: PropTypes.bool
}

export default ForecastChart
