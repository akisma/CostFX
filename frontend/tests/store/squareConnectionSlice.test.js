import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'

// Mock API module - must be hoisted before imports
vi.mock('../../src/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

import squareConnectionReducer, {
  initiateSquareConnection,
  handleSquareCallback,
  fetchSquareStatus,
  fetchSquareLocations,
  selectSquareLocations,
  disconnectSquare,
  checkSquareHealth,
  clearError,
  resetConnectionState,
  toggleLocationSelector,
  markCallbackProcessed,
  updateLocalSelectedLocations,
  selectIsConnected,
  selectConnectionStatus,
  selectConnection,
  selectAvailableLocations,
  selectSelectedLocations,
  selectAuthorizationUrl,
  selectLoading,
  selectError,
  selectShowLocationSelector,
  selectCallbackProcessed,
  selectHealth
} from '../../src/store/slices/squareConnectionSlice'

// Import mocked API to use in tests
import api from '../../src/services/api'

describe('squareConnectionSlice', () => {
  let store

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Create a fresh store for each test
    store = configureStore({
      reducer: {
        squareConnection: squareConnectionReducer
      }
    })
  })

  // =========================================================================
  // Initial State Tests
  // =========================================================================

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState().squareConnection

      expect(state.isConnected).toBe(false)
      expect(state.connectionStatus).toBe(null)
      expect(state.connection).toBe(null)
      expect(state.availableLocations).toEqual([])
      expect(state.selectedLocations).toEqual([])
      expect(state.oauthState).toBe(null)
      expect(state.authorizationUrl).toBe(null)
      expect(state.health).toBe(null)
      expect(state.lastHealthCheck).toBe(null)
      expect(state.loading).toEqual({
        connect: false,
        callback: false,
        status: false,
        locations: false,
        select: false,
        disconnect: false,
        health: false
      })
      expect(state.error).toBe(null)
      expect(state.lastError).toBe(null)
      expect(state.showLocationSelector).toBe(false)
      expect(state.callbackProcessed).toBe(false)
    })
  })

  // =========================================================================
  // Synchronous Actions Tests
  // =========================================================================

  describe('Synchronous Actions', () => {
    it('should clear error', () => {
      store.dispatch({ type: 'squareConnection/setError', payload: 'Test error' })
      store.dispatch(clearError())
      
      const state = store.getState().squareConnection
      expect(state.error).toBe(null)
    })

    it('should reset connection state', () => {
      // Set some state
      store = configureStore({
        reducer: {
          squareConnection: squareConnectionReducer
        },
        preloadedState: {
          squareConnection: {
            isConnected: true,
            connectionStatus: 'active',
            availableLocations: [{ id: '1', name: 'Test' }],
            error: 'Some error'
          }
        }
      })

      store.dispatch(resetConnectionState())
      
      const state = store.getState().squareConnection
      expect(state.isConnected).toBe(false)
      expect(state.connectionStatus).toBe(null)
      expect(state.availableLocations).toEqual([])
      expect(state.error).toBe(null)
    })

    it('should toggle location selector', () => {
      store.dispatch(toggleLocationSelector())
      let state = store.getState().squareConnection
      expect(state.showLocationSelector).toBe(true)

      store.dispatch(toggleLocationSelector())
      state = store.getState().squareConnection
      expect(state.showLocationSelector).toBe(false)

      store.dispatch(toggleLocationSelector(true))
      state = store.getState().squareConnection
      expect(state.showLocationSelector).toBe(true)
    })

    it('should mark callback as processed', () => {
      store.dispatch(markCallbackProcessed())
      
      const state = store.getState().squareConnection
      expect(state.callbackProcessed).toBe(true)
    })

    it('should update local selected locations', () => {
      const locations = [
        { id: 'loc1', name: 'Location 1' },
        { id: 'loc2', name: 'Location 2' }
      ]
      
      store.dispatch(updateLocalSelectedLocations(locations))
      
      const state = store.getState().squareConnection
      expect(state.selectedLocations).toEqual(locations)
    })
  })

  // =========================================================================
  // Async Thunk Tests - initiateSquareConnection
  // =========================================================================

  describe('initiateSquareConnection', () => {
    it('should handle successful connection initiation', async () => {
      const mockResponse = {
        data: {
          data: {
            authorizationUrl: 'https://connect.squareup.com/oauth2/authorize?...',
            state: 'abc123xyz'
          }
        }
      }

      api.post.mockResolvedValueOnce(mockResponse)

      await store.dispatch(initiateSquareConnection(1))

      const state = store.getState().squareConnection
      expect(state.authorizationUrl).toBe(mockResponse.data.data.authorizationUrl)
      expect(state.oauthState).toBe(mockResponse.data.data.state)
      expect(state.loading.connect).toBe(false)
      expect(state.error).toBe(null)
    })

    it('should handle connection initiation failure', async () => {
      const errorMessage = 'Failed to initiate Square connection'
      api.post.mockRejectedValueOnce({
        response: { data: { error: errorMessage } }
      })

      await store.dispatch(initiateSquareConnection(1))

      const state = store.getState().squareConnection
      expect(state.error).toBe(errorMessage)
      expect(state.loading.connect).toBe(false)
      expect(state.authorizationUrl).toBe(null)
    })

    it('should set loading state during connection initiation', () => {
      api.post.mockImplementationOnce(() => new Promise(() => {}))

      store.dispatch(initiateSquareConnection(1))

      const state = store.getState().squareConnection
      expect(state.loading.connect).toBe(true)
    })
  })

  // =========================================================================
  // Async Thunk Tests - handleSquareCallback
  // =========================================================================

  describe('handleSquareCallback', () => {
    it('should handle successful OAuth callback', async () => {
      const mockResponse = {
        data: {
          data: {
            connection: { id: 1, provider: 'square', status: 'active' },
            locations: [
              { id: 'L1', name: 'Main Location' },
              { id: 'L2', name: 'Second Location' }
            ]
          }
        }
      }

      api.get.mockResolvedValueOnce(mockResponse)

      await store.dispatch(handleSquareCallback({ code: 'auth_code', state: 'abc123' }))

      const state = store.getState().squareConnection
      expect(state.connection).toEqual(mockResponse.data.data.connection)
      expect(state.availableLocations).toEqual(mockResponse.data.data.locations)
      expect(state.isConnected).toBe(true)
      expect(state.connectionStatus).toBe('active')
      expect(state.showLocationSelector).toBe(true)
      expect(state.callbackProcessed).toBe(true)
      expect(state.loading.callback).toBe(false)
      expect(state.error).toBe(null)
    })

    it('should handle OAuth callback failure', async () => {
      const errorMessage = 'Invalid authorization code'
      api.get.mockRejectedValueOnce({
        response: { data: { error: errorMessage } }
      })

      await store.dispatch(handleSquareCallback({ code: 'bad_code', state: 'abc123' }))

      const state = store.getState().squareConnection
      expect(state.error).toBe(errorMessage)
      expect(state.callbackProcessed).toBe(true)
      expect(state.loading.callback).toBe(false)
      expect(state.isConnected).toBe(false)
    })
  })

  // =========================================================================
  // Async Thunk Tests - fetchSquareStatus
  // =========================================================================

  describe('fetchSquareStatus', () => {
    it('should handle successful status fetch', async () => {
      const mockResponse = {
        data: {
          data: {
            connection: { id: 1, provider: 'square', status: 'active' },
            locations: [{ id: 'L1', name: 'Location 1' }],
            connected: true
          }
        }
      }

      api.get.mockResolvedValueOnce(mockResponse)

      await store.dispatch(fetchSquareStatus(1))

      const state = store.getState().squareConnection
      expect(state.connection).toEqual(mockResponse.data.data.connection)
      expect(state.selectedLocations).toEqual(mockResponse.data.data.locations)
      expect(state.isConnected).toBe(true)
      expect(state.connectionStatus).toBe('active')
      expect(state.loading.status).toBe(false)
      expect(state.error).toBe(null)
    })

    it('should handle status fetch failure', async () => {
      const errorMessage = 'Connection not found'
      api.get.mockRejectedValueOnce({
        response: { data: { error: errorMessage } }
      })

      await store.dispatch(fetchSquareStatus(1))

      const state = store.getState().squareConnection
      expect(state.error).toBe(errorMessage)
      expect(state.isConnected).toBe(false)
      expect(state.connectionStatus).toBe('error')
      expect(state.loading.status).toBe(false)
    })
  })

  // =========================================================================
  // Async Thunk Tests - fetchSquareLocations
  // =========================================================================

  describe('fetchSquareLocations', () => {
    it('should handle successful locations fetch', async () => {
      const mockLocations = [
        { id: 'L1', name: 'Main Location', isActive: true },
        { id: 'L2', name: 'Branch Location', isActive: true }
      ]

      const mockResponse = {
        data: {
          data: { locations: mockLocations }
        }
      }

      api.get.mockResolvedValueOnce(mockResponse)

      await store.dispatch(fetchSquareLocations(1))

      const state = store.getState().squareConnection
      expect(state.availableLocations).toEqual(mockLocations)
      expect(state.loading.locations).toBe(false)
      expect(state.error).toBe(null)
    })

    it('should handle locations fetch failure', async () => {
      const errorMessage = 'Failed to fetch locations'
      api.get.mockRejectedValueOnce({
        response: { data: { error: errorMessage } }
      })

      await store.dispatch(fetchSquareLocations(1))

      const state = store.getState().squareConnection
      expect(state.error).toBe(errorMessage)
      expect(state.loading.locations).toBe(false)
    })
  })

  // =========================================================================
  // Async Thunk Tests - selectSquareLocations
  // =========================================================================

  describe('selectSquareLocations', () => {
    it('should handle successful location selection', async () => {
      const selectedLocs = [
        { id: 'L1', name: 'Main Location' }
      ]

      const mockResponse = {
        data: {
          data: { locations: selectedLocs }
        }
      }

      api.post.mockResolvedValueOnce(mockResponse)

      await store.dispatch(selectSquareLocations(['L1']))

      const state = store.getState().squareConnection
      expect(state.selectedLocations).toEqual(selectedLocs)
      expect(state.showLocationSelector).toBe(false)
      expect(state.loading.select).toBe(false)
      expect(state.error).toBe(null)
    })

    it('should handle location selection failure', async () => {
      const errorMessage = 'Invalid location ID'
      api.post.mockRejectedValueOnce({
        response: { data: { error: errorMessage } }
      })

      await store.dispatch(selectSquareLocations({
        restaurantId: 1,
        locationIds: ['invalid']
      }))

      const state = store.getState().squareConnection
      expect(state.error).toBe(errorMessage)
      expect(state.loading.select).toBe(false)
    })
  })

  // =========================================================================
  // Async Thunk Tests - disconnectSquare
  // =========================================================================

  describe('disconnectSquare', () => {
    it('should handle successful disconnect', async () => {
      // Setup initial connected state with complete state structure
      store = configureStore({
        reducer: {
          squareConnection: squareConnectionReducer
        },
        preloadedState: {
          squareConnection: {
            isConnected: true,
            connectionStatus: 'active',
            connection: { id: 1 },
            selectedLocations: [{ id: 'L1' }],
            availableLocations: [{ id: 'L1' }],
            oauthState: null,
            authorizationUrl: null,
            health: null,
            lastHealthCheck: null,
            loading: {
              connect: false,
              callback: false,
              status: false,
              locations: false,
              select: false,
              disconnect: false,
              health: false
            },
            error: null,
            lastError: null,
            showLocationSelector: false,
            callbackProcessed: false
          }
        }
      })

      const mockResponse = {
        data: {
          data: { success: true }
        }
      }

      api.post.mockResolvedValueOnce(mockResponse)

      await store.dispatch(disconnectSquare(1))

      const state = store.getState().squareConnection
      expect(state.isConnected).toBe(false)
      expect(state.connectionStatus).toBe('disconnected')
      expect(state.connection).toBe(null)
      expect(state.availableLocations).toEqual([])
      expect(state.selectedLocations).toEqual([])
      expect(state.loading.disconnect).toBe(false)
      expect(state.error).toBe(null)
    })

    it('should handle disconnect failure', async () => {
      const errorMessage = 'Failed to disconnect'
      api.post.mockRejectedValueOnce({
        response: { data: { error: errorMessage } }
      })

      await store.dispatch(disconnectSquare(1))

      const state = store.getState().squareConnection
      expect(state.error).toBe(errorMessage)
      expect(state.loading.disconnect).toBe(false)
    })
  })

  // =========================================================================
  // Async Thunk Tests - checkSquareHealth
  // =========================================================================

  describe('checkSquareHealth', () => {
    it('should handle successful health check', async () => {
      const mockHealth = {
        status: 'healthy',
        lastSync: '2025-10-04T12:00:00Z'
      }

      const mockResponse = {
        data: {
          data: mockHealth
        }
      }

      api.get.mockResolvedValueOnce(mockResponse)

      await store.dispatch(checkSquareHealth(1))

      const state = store.getState().squareConnection
      expect(state.health).toEqual(mockHealth)
      expect(state.lastHealthCheck).toBeTruthy()
      expect(state.loading.health).toBe(false)
    })

    it('should handle health check failure', async () => {
      const errorMessage = 'Health check failed'
      api.get.mockRejectedValueOnce({
        response: { data: { error: errorMessage } }
      })

      await store.dispatch(checkSquareHealth(1))

      const state = store.getState().squareConnection
      expect(state.health).toEqual({ status: 'error', message: errorMessage })
      expect(state.lastHealthCheck).toBeTruthy()
      expect(state.loading.health).toBe(false)
    })
  })

  // =========================================================================
  // Selector Tests
  // =========================================================================

  describe('Selectors', () => {
    it('should select isConnected', () => {
      const state = { squareConnection: { isConnected: true } }
      expect(selectIsConnected(state)).toBe(true)
    })

    it('should select connectionStatus', () => {
      const state = { squareConnection: { connectionStatus: 'active' } }
      expect(selectConnectionStatus(state)).toBe('active')
    })

    it('should select connection', () => {
      const connection = { id: 1, provider: 'square' }
      const state = { squareConnection: { connection } }
      expect(selectConnection(state)).toEqual(connection)
    })

    it('should select availableLocations', () => {
      const locations = [{ id: 'L1', name: 'Test' }]
      const state = { squareConnection: { availableLocations: locations } }
      expect(selectAvailableLocations(state)).toEqual(locations)
    })

    it('should select selectedLocations', () => {
      const locations = [{ id: 'L1', name: 'Selected' }]
      const state = { squareConnection: { selectedLocations: locations } }
      expect(selectSelectedLocations(state)).toEqual(locations)
    })

    it('should select authorizationUrl', () => {
      const url = 'https://connect.squareup.com/oauth2/authorize'
      const state = { squareConnection: { authorizationUrl: url } }
      expect(selectAuthorizationUrl(state)).toBe(url)
    })

    it('should select loading', () => {
      const loading = { connect: true, callback: false }
      const state = { squareConnection: { loading } }
      expect(selectLoading(state)).toEqual(loading)
    })

    it('should select error', () => {
      const error = 'Test error'
      const state = { squareConnection: { error } }
      expect(selectError(state)).toBe(error)
    })

    it('should select showLocationSelector', () => {
      const state = { squareConnection: { showLocationSelector: true } }
      expect(selectShowLocationSelector(state)).toBe(true)
    })

    it('should select callbackProcessed', () => {
      const state = { squareConnection: { callbackProcessed: true } }
      expect(selectCallbackProcessed(state)).toBe(true)
    })

    it('should select health', () => {
      const health = { status: 'healthy' }
      const state = { squareConnection: { health } }
      expect(selectHealth(state)).toEqual(health)
    })
  })
})
