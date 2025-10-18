import PropTypes from 'prop-types'
import { Loader2 } from 'lucide-react'

/**
 * ActionButton Component
 * 
 * Reusable button with loading state and icon support.
 * Provides consistent styling and behavior across all sync/transform/clear actions.
 * 
 * Usage:
 * ```jsx
 * <ActionButton
 *   onClick={handleSync}
 *   loading={isLoading}
 *   icon={<Download />}
 *   variant="primary"
 * >
 *   Import Data
 * </ActionButton>
 * ```
 */
const ActionButton = ({ 
  children, 
  onClick, 
  loading = false, 
  disabled = false,
  icon,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 active:bg-gray-800',
    success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    warning: 'bg-yellow-600 text-white hover:bg-yellow-700 active:bg-yellow-800',
    outline: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Processing...</span>
        </>
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  )
}

ActionButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  icon: PropTypes.element,
  variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'danger', 'warning', 'outline']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string
}

export default ActionButton
