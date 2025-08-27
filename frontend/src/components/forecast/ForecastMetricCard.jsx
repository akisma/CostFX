import PropTypes from 'prop-types'
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react'

/**
 * ForecastMetricCard - Displays key forecast metrics with status indicators
 */
const ForecastMetricCard = ({ 
  title, 
  value, 
  subValue = null,
  confidence = null, 
  trend = null, 
  status = 'neutral',
  icon = null,
  description = null 
}) => {
  const statusConfig = {
    positive: {
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      borderColor: 'border-green-200'
    },
    negative: {
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
      borderColor: 'border-red-200'
    },
    warning: {
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
      borderColor: 'border-yellow-200'
    },
    neutral: {
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200'
    }
  }

  const config = statusConfig[status] || statusConfig.neutral

  // Default icon based on status
  const defaultIcon = {
    positive: CheckCircle,
    negative: AlertCircle,
    warning: Clock,
    neutral: DollarSign
  }[status] || DollarSign

  const IconComponent = icon || defaultIcon

  return (
    <div className={`card p-6 border-l-4 ${config.borderColor}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-600">{title}</h3>
            {confidence && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                confidence > 0.8 ? 'bg-green-100 text-green-800' :
                confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {Math.round(confidence * 100)}% confidence
              </span>
            )}
          </div>
          
          <div className="mt-2">
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            {subValue && (
              <div className="text-sm text-gray-500 mt-1">{subValue}</div>
            )}
          </div>

          {trend && (
            <div className="flex items-center mt-3">
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend.value}%
              </span>
              <span className="text-sm text-gray-500 ml-1">
                {trend.period || 'vs last period'}
              </span>
            </div>
          )}

          {description && (
            <p className="text-sm text-gray-600 mt-3">{description}</p>
          )}
        </div>

        <div className={`p-3 rounded-lg ${config.bgColor}`}>
          <IconComponent className={`h-6 w-6 ${config.iconColor}`} />
        </div>
      </div>
    </div>
  )
}

ForecastMetricCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  subValue: PropTypes.string,
  confidence: PropTypes.number,
  trend: PropTypes.shape({
    isPositive: PropTypes.bool.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    period: PropTypes.string
  }),
  status: PropTypes.oneOf(['positive', 'negative', 'warning', 'neutral']),
  icon: PropTypes.elementType,
  description: PropTypes.string
}

export default ForecastMetricCard
