import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSnackbar } from 'notistack'
import PropTypes from 'prop-types'
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  MapPin,
  X
} from 'lucide-react'
import {
  fetchSquareStatus,
  disconnectSquare,
  selectIsConnected,
  selectConnectionStatus,
  selectConnection,
  selectSelectedLocations,
  selectLoading,
  selectError
} from '../../../store/slices/squareConnectionSlice'

/**
 * ConnectionStatus Component
 * 
 * Purpose: Display Square connection health and status
 * Issue: #30 - Square OAuth Connection UI
 * 
 * Features:
 * - Visual status indicators (connected/disconnected/error)
 * - Display selected locations
 * - Disconnect functionality
 * - Auto-refresh connection status
 */
const ConnectionStatus = ({
  showLocations = true,
  showDisconnectButton = true,
  refreshInterval = 30000,
  onDisconnect,
  className = ''
}) => {
  const dispatch = useDispatch()
  const { enqueueSnackbar } = useSnackbar()
  
  const isConnected = useSelector(selectIsConnected)
  const connectionStatus = useSelector(selectConnectionStatus)
  const connection = useSelector(selectConnection)
  const selectedLocations = useSelector(selectSelectedLocations)
  const loading = useSelector(selectLoading)
  const error = useSelector(selectError)

  /**
   * Fetch connection status on mount and at intervals
   */
  useEffect(() => {
    dispatch(fetchSquareStatus())

    // Set up auto-refresh
    const intervalId = setInterval(() => {
      dispatch(fetchSquareStatus())
    }, refreshInterval)

    return () => clearInterval(intervalId)
  }, [refreshInterval, dispatch])

  /**
   * Handle disconnect action
   */
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Square? This will stop syncing data.')) {
      return
    }

    try {
      setIsDisconnecting(true)

      await dispatch(disconnectSquare()).unwrap()
      
      enqueueSnackbar('Square disconnected successfully', { variant: 'success' })
      
      if (onDisconnect) {
        onDisconnect()
      }
    } catch (err) {
      const errorMessage = err?.message || err || 'Failed to disconnect Square'
      enqueueSnackbar(errorMessage, { variant: 'error' })
    }
  }

  /**
   * Get status icon and color based on connection state
   */
  const getStatusDisplay = () => {
    if (loading.status) {
      return {
        icon: <Loader2 className="animate-spin" size={24} />,
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        text: 'Checking connection...',
        label: 'checking'
      }
    }

    if (connectionStatus === 'error' || error) {
      return {
        icon: <XCircle size={24} />,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        text: 'Connection error',
        label: 'error'
      }
    }

    if (isConnected && connectionStatus === 'active') {
      return {
        icon: <CheckCircle2 size={24} />,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        text: 'Connected',
        label: 'connected'
      }
    }

    return {
      icon: <AlertCircle size={24} />,
      color: 'text-gray-400',
      bgColor: 'bg-gray-100',
      text: 'Not connected',
      label: 'disconnected'
    }
  }

  const status = getStatusDisplay()

  // Don't render if loading initially
  if (loading.status && !connection) {
    return (
      <div className={`flex items-center gap-2 p-4 rounded-lg border border-gray-200 ${className}`}>
        <Loader2 className="animate-spin text-gray-500" size={20} />
        <span className="text-sm text-gray-600">Loading connection status...</span>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Status Card */}
      <div className={`p-4 rounded-lg border-2 ${status.bgColor} ${status.color} border-current`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status.icon}
            <div>
              <p className="font-semibold text-lg">{status.text}</p>
              {connection && (
                <p className="text-sm opacity-75">
                  Provider: {connection.provider || 'Square'}
                </p>
              )}
            </div>
          </div>

          {/* Disconnect Button */}
          {showDisconnectButton && isConnected && connectionStatus === 'active' && (
            <button
              onClick={handleDisconnect}
              disabled={loading.disconnect}
              className="px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-600 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              aria-label="Disconnect Square"
            >
              {loading.disconnect ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Disconnecting...</span>
                </>
              ) : (
                <>
                  <X size={16} />
                  <span>Disconnect</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Selected Locations */}
      {showLocations && isConnected && selectedLocations.length > 0 && (
        <div className="p-4 bg-white rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <MapPin size={16} />
            Synced Locations ({selectedLocations.length})
          </h3>
          <ul className="space-y-2">
            {selectedLocations.map((location) => (
              <li
                key={location.id}
                className="flex items-center gap-2 text-sm text-gray-600 p-2 bg-gray-50 rounded"
              >
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="font-medium">{location.name}</span>
                {location.address && (
                  <span className="text-gray-400">
                    • {location.address.city || location.address.locality}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No Locations Selected */}
      {showLocations && isConnected && selectedLocations.length === 0 && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 flex items-center gap-2">
            <AlertCircle size={16} />
            No locations selected for syncing. Please select locations to start data sync.
          </p>
        </div>
      )}
    </div>
  )
}

ConnectionStatus.propTypes = {
  showLocations: PropTypes.bool,
  showDisconnectButton: PropTypes.bool,
  refreshInterval: PropTypes.number,
  onDisconnect: PropTypes.func,
  className: PropTypes.string
}

export default ConnectionStatus
