import PropTypes from 'prop-types'

/**
 * StatCard Component
 * 
 * Displays a metric with label, value, and optional icon.
 * Used for showing sync/transform statistics.
 * 
 * Usage:
 * ```jsx
 * <StatCard
 *   label="Items Synced"
 *   value={150}
 *   icon={<CheckCircle className="w-5 h-5 text-green-500" />}
 *   variant="success"
 * />
 * ```
 */
const StatCard = ({ 
  label, 
  value, 
  icon, 
  variant = 'default',
  className = '' 
}) => {
  const variantClasses = {
    default: 'bg-gray-50 border-gray-200',
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200'
  }

  const textVariantClasses = {
    default: 'text-gray-900',
    success: 'text-green-900',
    error: 'text-red-900',
    warning: 'text-yellow-900',
    info: 'text-blue-900'
  }

  return (
    <div 
      className={`rounded-lg border p-4 ${variantClasses[variant]} ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${textVariantClasses[variant]}`}>
            {value !== null && value !== undefined ? value : '—'}
          </p>
        </div>
        {icon && (
          <div className="flex-shrink-0 ml-3">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  icon: PropTypes.element,
  variant: PropTypes.oneOf(['default', 'success', 'error', 'warning', 'info']),
  className: PropTypes.string
}

export default StatCard
