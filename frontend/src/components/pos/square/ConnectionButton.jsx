import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSnackbar } from 'notistack'
import { Loader2 } from 'lucide-react'
import PropTypes from 'prop-types'
import {
  initiateSquareConnection,
  selectLoading
} from '../../../store/slices/squareConnectionSlice'

/**
 * ConnectionButton Component
 * 
 * Purpose: Initiate Square OAuth connection flow
 * Issue: #30 - Square OAuth Connection UI
 * 
 * Features:
 * - Handles OAuth initiation
 * - Loading states during API calls
 * - Error handling with notifications
 * - Redirects to Square authorization page
 */
const ConnectionButton = ({ 
  variant = 'primary',
  size = 'md',
  className = '',
  onConnectionStart,
  onConnectionError,
  disabled = false
}) => {
  const dispatch = useDispatch()
  const { enqueueSnackbar } = useSnackbar()
  
  const loading = useSelector(selectLoading)
  
  const [isInitiating, setIsInitiating] = useState(false)

  /**
   * Handle Square connection initiation
   */
  const handleConnect = async () => {
    try {
      setIsInitiating(true)
      
      // Notify parent component
      if (onConnectionStart) {
        onConnectionStart()
      }

      // Dispatch Redux action to initiate OAuth
      const result = await dispatch(initiateSquareConnection()).unwrap()

      // Success - show notification
      enqueueSnackbar('Redirecting to Square authorization...', { variant: 'info' })

      // Redirect to Square OAuth page
      if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl
      } else {
        throw new Error('No authorization URL received from server')
      }

    } catch (err) {
      // Error handling
      const errorMessage = err?.message || err || 'Failed to initiate Square connection'
      
      enqueueSnackbar(errorMessage, { variant: 'error' })
      
      // Notify parent component
      if (onConnectionError) {
        onConnectionError(errorMessage)
      }
      
      setIsInitiating(false)
    }
  }

  // Determine loading state
  const isLoading = loading.connect || isInitiating

  // Button size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }

  // Button variant classes
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
  }

  const baseClasses = 'font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <button
      onClick={handleConnect}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      aria-label="Connect Square POS"
    >
      {isLoading ? (
        <>
          <Loader2 className="animate-spin" size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Square logo icon */}
            <path d="M4.01 4v16h16V4H4.01zM3 2.01h18c.55 0 1 .45 1 1v18c0 .55-.45 1-1 1H3c-.55 0-1-.45-1-1v-18c0-.55.45-1 1-1z" />
            <path d="M12 6.5c-3.04 0-5.5 2.46-5.5 5.5s2.46 5.5 5.5 5.5 5.5-2.46 5.5-5.5-2.46-5.5-5.5-5.5zm0 9c-1.93 0-3.5-1.57-3.5-3.5S10.07 8.5 12 8.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
          </svg>
          <span>Connect Square</span>
        </>
      )}
    </button>
  )
}

ConnectionButton.propTypes = {
  variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'outline']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  onConnectionStart: PropTypes.func,
  onConnectionError: PropTypes.func,
  disabled: PropTypes.bool
}

export default ConnectionButton
