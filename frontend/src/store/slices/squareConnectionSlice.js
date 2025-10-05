import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../services/api'

/**
 * Square Connection Redux Slice
 * 
 * Purpose: Manage Square OAuth authentication and connection state
 * Issue: #30 - Square OAuth Connection UI
 * 
 * State Management:
 * - OAuth flow initiation and callback handling
 * - Connection status tracking
 * - Location management (list, select, sync)
 * - Error handling and loading states
 * 
 * Note: Restaurant ID is determined server-side by authentication middleware
 * For MVP: Backend defaults to restaurant ID 1 in development mode
 */

// ============================================================================
// Async Thunks - API Calls
// ============================================================================

/**
 * Initiate Square OAuth connection flow
 * POST /api/v1/pos/square/connect
 */
export const initiateSquareConnection = createAsyncThunk(
  'squareConnection/initiate',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post('/pos/square/connect')
      return response.data.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to initiate Square connection'
      )
    }
  }
)

/**
 * Handle OAuth callback from Square
 * GET /api/v1/pos/square/callback
 */
export const handleSquareCallback = createAsyncThunk(
  'squareConnection/callback',
  async ({ code, state }, { rejectWithValue }) => {
    try {
      const response = await api.get('/pos/square/callback', {
        params: { code, state }
      })
      return response.data.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to complete Square authentication'
      )
    }
  }
)

/**
 * Fetch current Square connection status
 * GET /api/v1/pos/square/status
 */
export const fetchSquareStatus = createAsyncThunk(
  'squareConnection/fetchStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/pos/square/status')
      return response.data.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch connection status'
      )
    }
  }
)

/**
 * Fetch available Square locations
 * GET /api/v1/pos/square/locations
 */
export const fetchSquareLocations = createAsyncThunk(
  'squareConnection/fetchLocations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/pos/square/locations')
      return response.data.data.locations
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to fetch Square locations'
      )
    }
  }
)

/**
 * Select Square locations for sync
 * POST /api/v1/pos/square/locations/select
 */
export const selectSquareLocations = createAsyncThunk(
  'squareConnection/selectLocations',
  async (locationIds, { rejectWithValue }) => {
    try {
      const response = await api.post('/pos/square/locations/select', {
        locationIds
      })
      return response.data.data.locations
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to select locations'
      )
    }
  }
)

/**
 * Disconnect Square integration
 * POST /api/v1/pos/square/disconnect
 */
export const disconnectSquare = createAsyncThunk(
  'squareConnection/disconnect',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post('/pos/square/disconnect')
      return response.data.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to disconnect Square'
      )
    }
  }
)

/**
 * Check Square connection health
 * GET /api/v1/pos/square/health
 */
export const checkSquareHealth = createAsyncThunk(
  'squareConnection/checkHealth',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/pos/square/health')
      return response.data.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || 'Failed to check connection health'
      )
    }
  }
)

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  // Connection status
  isConnected: false,
  connectionStatus: null, // 'active' | 'disconnected' | 'error'
  connection: null, // POSConnection object
  
  // Locations
  availableLocations: [],
  selectedLocations: [],
  
  // OAuth state
  oauthState: null,
  authorizationUrl: null,
  
  // Health check
  health: null,
  lastHealthCheck: null,
  
  // Loading states
  loading: {
    connect: false,
    callback: false,
    status: false,
    locations: false,
    select: false,
    disconnect: false,
    health: false
  },
  
  // Error handling
  error: null,
  lastError: null,
  
  // UI state
  showLocationSelector: false,
  callbackProcessed: false
}

// ============================================================================
// Slice Definition
// ============================================================================

const squareConnectionSlice = createSlice({
  name: 'squareConnection',
  initialState,
  reducers: {
    // Clear errors
    clearError: (state) => {
      state.error = null
    },
    
    // Reset connection state
    resetConnectionState: () => {
      return { ...initialState }
    },
    
    // Toggle location selector visibility
    toggleLocationSelector: (state, action) => {
      state.showLocationSelector = action.payload ?? !state.showLocationSelector
    },
    
    // Mark callback as processed
    markCallbackProcessed: (state) => {
      state.callbackProcessed = true
    },
    
    // Update selected locations (local state)
    updateLocalSelectedLocations: (state, action) => {
      state.selectedLocations = action.payload
    }
  },
  extraReducers: (builder) => {
    // ========================================================================
    // Initiate Connection
    // ========================================================================
    builder
      .addCase(initiateSquareConnection.pending, (state) => {
        state.loading.connect = true
        state.error = null
      })
      .addCase(initiateSquareConnection.fulfilled, (state, action) => {
        state.loading.connect = false
        state.authorizationUrl = action.payload.authorizationUrl
        state.oauthState = action.payload.state
        state.error = null
      })
      .addCase(initiateSquareConnection.rejected, (state, action) => {
        state.loading.connect = false
        state.error = action.payload
        state.lastError = action.payload
      })
    
    // ========================================================================
    // Handle OAuth Callback
    // ========================================================================
    builder
      .addCase(handleSquareCallback.pending, (state) => {
        state.loading.callback = true
        state.error = null
      })
      .addCase(handleSquareCallback.fulfilled, (state, action) => {
        state.loading.callback = false
        state.connection = action.payload.connection
        state.availableLocations = action.payload.locations || []
        state.isConnected = true
        state.connectionStatus = 'active'
        state.showLocationSelector = true
        state.callbackProcessed = true
        state.error = null
      })
      .addCase(handleSquareCallback.rejected, (state, action) => {
        state.loading.callback = false
        state.error = action.payload
        state.lastError = action.payload
        state.callbackProcessed = true
      })
    
    // ========================================================================
    // Fetch Status
    // ========================================================================
    builder
      .addCase(fetchSquareStatus.pending, (state) => {
        state.loading.status = true
        state.error = null
      })
      .addCase(fetchSquareStatus.fulfilled, (state, action) => {
        state.loading.status = false
        state.connection = action.payload.connection
        state.selectedLocations = action.payload.selectedLocations || []
        state.isConnected = action.payload.isConnected || false
        state.connectionStatus = action.payload.status || 'disconnected'
        state.error = null
      })
      .addCase(fetchSquareStatus.rejected, (state, action) => {
        state.loading.status = false
        state.error = action.payload
        state.lastError = action.payload
        state.isConnected = false
        state.connectionStatus = 'error'
      })
    
    // ========================================================================
    // Fetch Locations
    // ========================================================================
    builder
      .addCase(fetchSquareLocations.pending, (state) => {
        state.loading.locations = true
        state.error = null
      })
      .addCase(fetchSquareLocations.fulfilled, (state, action) => {
        state.loading.locations = false
        state.availableLocations = action.payload
        state.error = null
      })
      .addCase(fetchSquareLocations.rejected, (state, action) => {
        state.loading.locations = false
        state.error = action.payload
        state.lastError = action.payload
      })
    
    // ========================================================================
    // Select Locations
    // ========================================================================
    builder
      .addCase(selectSquareLocations.pending, (state) => {
        state.loading.select = true
        state.error = null
      })
      .addCase(selectSquareLocations.fulfilled, (state, action) => {
        state.loading.select = false
        state.selectedLocations = action.payload
        state.showLocationSelector = false
        state.error = null
      })
      .addCase(selectSquareLocations.rejected, (state, action) => {
        state.loading.select = false
        state.error = action.payload
        state.lastError = action.payload
      })
    
    // ========================================================================
    // Disconnect
    // ========================================================================
    builder
      .addCase(disconnectSquare.pending, (state) => {
        state.loading.disconnect = true
        state.error = null
      })
      .addCase(disconnectSquare.fulfilled, (state) => {
        state.loading.disconnect = false
        state.isConnected = false
        state.connectionStatus = 'disconnected'
        state.connection = null
        state.availableLocations = []
        state.selectedLocations = []
        state.error = null
      })
      .addCase(disconnectSquare.rejected, (state, action) => {
        state.loading.disconnect = false
        state.error = action.payload
        state.lastError = action.payload
      })
    
    // ========================================================================
    // Health Check
    // ========================================================================
    builder
      .addCase(checkSquareHealth.pending, (state) => {
        state.loading.health = true
      })
      .addCase(checkSquareHealth.fulfilled, (state, action) => {
        state.loading.health = false
        state.health = action.payload
        state.lastHealthCheck = new Date().toISOString()
      })
      .addCase(checkSquareHealth.rejected, (state, action) => {
        state.loading.health = false
        state.health = { status: 'error', message: action.payload }
        state.lastHealthCheck = new Date().toISOString()
      })
  }
})

// ============================================================================
// Export Actions and Reducer
// ============================================================================

export const {
  clearError,
  resetConnectionState,
  toggleLocationSelector,
  markCallbackProcessed,
  updateLocalSelectedLocations
} = squareConnectionSlice.actions

export default squareConnectionSlice.reducer

// ============================================================================
// Selectors
// ============================================================================

export const selectIsConnected = (state) => state.squareConnection.isConnected
export const selectConnectionStatus = (state) => state.squareConnection.connectionStatus
export const selectConnection = (state) => state.squareConnection.connection
export const selectAvailableLocations = (state) => state.squareConnection.availableLocations
export const selectSelectedLocations = (state) => state.squareConnection.selectedLocations
export const selectAuthorizationUrl = (state) => state.squareConnection.authorizationUrl
export const selectLoading = (state) => state.squareConnection.loading
export const selectError = (state) => state.squareConnection.error
export const selectShowLocationSelector = (state) => state.squareConnection.showLocationSelector
export const selectCallbackProcessed = (state) => state.squareConnection.callbackProcessed
export const selectHealth = (state) => state.squareConnection.health
