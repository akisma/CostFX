import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useSnackbar } from 'notistack'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  ConnectionButton,
  ConnectionStatus,
  LocationSelector,
  DataImportPanel,
  TransformationPanel,
  DataReviewPanel,
  SalesDataImportPanel,
  SalesDataReviewPanel
} from '../components/pos/square'
import {
  selectSquareLocations,
  fetchSquareStatus,
  selectIsConnected,
  selectShowLocationSelector,
  selectConnection,
  toggleLocationSelector
} from '../store/slices/squareConnectionSlice'

/**
 * SquareConnectionPage Component
 * 
 * Purpose: Main orchestration component for Square OAuth flow
 * Issue: #30 - Square OAuth Connection UI
 * 
 * Features:
 * - Orchestrates OAuth flow start to finish
 * - Handles OAuth callback from Square
 * - Manages location selection workflow
 * - Displays connection status
 * - Handles both initial setup and management views
 * 
 * Routes:
 * - /settings/integrations/square - Main connection page
 * - /settings/integrations/square/callback - OAuth callback handler
 */
const SquareConnectionPage = () => {
  const dispatch = useDispatch()
  const { enqueueSnackbar } = useSnackbar()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const isConnected = useSelector(selectIsConnected)
  const showLocationSelector = useSelector(selectShowLocationSelector)
  const connection = useSelector(selectConnection)

  const [view, setView] = useState('status') // 'status' | 'connect' | 'locations'
  const [isHandlingCallback, setIsHandlingCallback] = useState(false)
  const [callbackProcessedLocal, setCallbackProcessed] = useState(false)
  const [syncRefreshTrigger, setSyncRefreshTrigger] = useState(0)
  const [activeTab, setActiveTab] = useState('inventory') // 'inventory' | 'sales'

  /**
   * Handle OAuth callback from Square
   * This runs when user is redirected back from Square OAuth page
   */
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    
    // Handle successful OAuth callback
    if (success === 'true' && !callbackProcessedLocal) {
      setIsHandlingCallback(true)
      setCallbackProcessed(true)
      
      // Fetch the connection status to get the new connection
      dispatch(fetchSquareStatus())
        .unwrap()
        .then(() => {
          enqueueSnackbar('Square connected successfully! Please select locations to sync.', { 
            variant: 'success' 
          })
          // Show location selector
          dispatch(toggleLocationSelector(true))
          setView('locations')
        })
        .catch((err) => {
          const errorMessage = err?.message || 'Failed to load Square connection'
          enqueueSnackbar(errorMessage, { variant: 'error' })
        })
        .finally(() => {
          // Clean up URL parameters
          searchParams.delete('success')
          setSearchParams(searchParams, { replace: true })
          setIsHandlingCallback(false)
        })
    }
    
    // Handle OAuth error
    if (error && !callbackProcessedLocal) {
      setCallbackProcessed(true)
      const errorMessage = decodeURIComponent(error)
      enqueueSnackbar(`Connection failed: ${errorMessage}`, { variant: 'error' })
      
      // Clean up URL parameters
      searchParams.delete('error')
      setSearchParams(searchParams, { replace: true })
      setView('connect')
      setIsHandlingCallback(false)
    }
  }, [searchParams, callbackProcessedLocal, dispatch, enqueueSnackbar, setSearchParams])

  /**
   * Load connection status on mount
   */
  useEffect(() => {
    dispatch(fetchSquareStatus())
  }, [dispatch])

  /**
   * Determine initial view based on connection state
   */
  useEffect(() => {
    if (!isHandlingCallback) {
      if (showLocationSelector) {
        setView('locations')
      } else if (isConnected) {
        setView('status')
      } else {
        setView('connect')
      }
    }
  }, [isConnected, showLocationSelector, isHandlingCallback])

  /**
   * Handle successful location selection
   */
  const handleLocationsSelected = async (locationIds) => {
    try {
      await dispatch(selectSquareLocations(locationIds)).unwrap()

      enqueueSnackbar('Locations saved successfully', { variant: 'success' })

      // Refresh connection status to get updated data
      await dispatch(fetchSquareStatus()).unwrap()

      // Hide location selector and show status
      dispatch(toggleLocationSelector(false))
      setView('status')

    } catch (err) {
      const errorMessage = err?.message || err || 'Failed to save location selection'
      enqueueSnackbar(errorMessage, { variant: 'error' })
      throw err
    }
  }

  /**
   * Handle cancel location selection
   */
  const handleCancelLocationSelection = () => {
    dispatch(toggleLocationSelector(false))
    setView('status')
  }

  /**
   * Handle changing location selection
   */
  const handleChangeLocations = () => {
    setView('locations')
    dispatch(toggleLocationSelector(true))
  }

  /**
   * Handle going back
   */
  const handleGoBack = () => {
    navigate('/settings')
  }

  /**
   * Handle disconnect callback
   */
  const handleDisconnected = () => {
    setView('connect')
  }

  /**
   * Handle sync completion
   * Triggers refresh of transformation panel
   */
  const handleSyncComplete = () => {
    setSyncRefreshTrigger(prev => prev + 1)
  }

  // Callback processing state
  if (isHandlingCallback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-semibold text-gray-900">Completing Square Connection...</h2>
          <p className="text-gray-600 mt-2">Please wait while we set up your integration</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleGoBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Settings</span>
          </button>

          <h1 className="text-3xl font-bold text-gray-900">Square Integration</h1>
          <p className="text-gray-600 mt-2">
            Connect your Square POS to sync inventory, sales, and menu data
          </p>
        </div>

        {/* Content based on view */}
        <div className="space-y-6">
          {view === 'connect' && (
            <div className="bg-white rounded-lg shadow-sm p-8">
              <div className="text-center max-w-md mx-auto">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-blue-600"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M4.01 4v16h16V4H4.01zM3 2.01h18c.55 0 1 .45 1 1v18c0 .55-.45 1-1 1H3c-.55 0-1-.45-1-1v-18c0-.55.45-1 1-1z" />
                    <path d="M12 6.5c-3.04 0-5.5 2.46-5.5 5.5s2.46 5.5 5.5 5.5 5.5-2.46 5.5-5.5-2.46-5.5-5.5-5.5zm0 9c-1.93 0-3.5-1.57-3.5-3.5S10.07 8.5 12 8.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
                  </svg>
                </div>

                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Connect to Square
                </h2>
                <p className="text-gray-600 mb-6">
                  Authorize CostFX to access your Square data. You&apos;ll be redirected to
                  Square to grant permissions.
                </p>

                <ConnectionButton
                  size="lg"
                  className="w-full justify-center"
                />

                <div className="mt-6 p-4 bg-blue-50 rounded-lg text-left">
                  <h3 className="font-semibold text-blue-900 mb-2">What we&apos;ll sync:</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Inventory items and stock levels</li>
                    <li>• Sales transactions and revenue data</li>
                    <li>• Menu items and pricing</li>
                    <li>• Customer data (optional)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {view === 'status' && (
            <>
              <ConnectionStatus
                showLocations={true}
                showDisconnectButton={true}
                onDisconnect={handleDisconnected}
              />

              {isConnected && (
                <>
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Manage Integration
                    </h3>
                    <div className="space-y-3">
                      <button
                        onClick={handleChangeLocations}
                        className="w-full px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium text-gray-900">Change Synced Locations</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Select different Square locations to sync data from
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Tab Navigation */}
                  <div className="mb-6">
                    <div className="border-b border-gray-200">
                      <nav className="-mb-px flex space-x-8">
                        <button
                          onClick={() => setActiveTab('inventory')}
                          className={`
                            py-4 px-1 border-b-2 font-medium text-sm transition-colors
                            ${activeTab === 'inventory'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }
                          `}
                        >
                          Inventory Data
                        </button>
                        <button
                          onClick={() => setActiveTab('sales')}
                          className={`
                            py-4 px-1 border-b-2 font-medium text-sm transition-colors
                            ${activeTab === 'sales'
                              ? 'border-blue-500 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }
                          `}
                        >
                          Sales Data
                        </button>
                      </nav>
                    </div>
                  </div>

                  {/* Inventory Tab Content */}
                  {activeTab === 'inventory' && (
                    <>
                      {/* Data Import Panel */}
                      <DataImportPanel
                        connectionId={connection?.id}
                        restaurantId={1} // Default restaurant ID for MVP
                        onSyncComplete={handleSyncComplete}
                      />

                      {/* Transformation Panel */}
                      <TransformationPanel
                        connectionId={connection?.id}
                        restaurantId={1} // Default restaurant ID for MVP
                        refreshTrigger={syncRefreshTrigger}
                      />

                      {/* Data Review Panel - Shows Tier 1 vs Tier 2 */}
                      <DataReviewPanel
                        connectionId={connection?.id}
                      />
                    </>
                  )}

                  {/* Sales Tab Content */}
                  {activeTab === 'sales' && (
                    <>
                      {/* Sales Data Import Panel */}
                      <SalesDataImportPanel
                        connectionId={connection?.id}
                        restaurantId={1} // Default restaurant ID for MVP
                      />

                      {/* Sales Data Review Panel - Shows Tier 1 vs Tier 2 */}
                      <SalesDataReviewPanel
                        connectionId={connection?.id}
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}

          {view === 'locations' && (
            <LocationSelector
              onLocationsSelected={handleLocationsSelected}
              onCancel={handleCancelLocationSelection}
              required={true}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default SquareConnectionPage
