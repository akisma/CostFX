import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../services/api'

// Async thunks for inventory operations
export const fetchInventoryLevels = createAsyncThunk(
  'inventory/fetchLevels',
  async (restaurantId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/inventory/levels?restaurantId=${restaurantId}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch inventory levels')
    }
  }
)

export const fetchReorderNeeds = createAsyncThunk(
  'inventory/fetchReorderNeeds',
  async ({ restaurantId, forecastDays = 7 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/inventory/reorder-needs?restaurantId=${restaurantId}&forecastDays=${forecastDays}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch reorder needs')
    }
  }
)

export const fetchExpirationAlerts = createAsyncThunk(
  'inventory/fetchExpirationAlerts',
  async ({ restaurantId, warningDays = 5 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/inventory/expiration-alerts?restaurantId=${restaurantId}&warningDays=${warningDays}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch expiration alerts')
    }
  }
)

export const fetchWasteAnalysis = createAsyncThunk(
  'inventory/fetchWasteAnalysis',
  async ({ restaurantId, timeframeDays = 30 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/inventory/waste-analysis?restaurantId=${restaurantId}&timeframeDays=${timeframeDays}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch waste analysis')
    }
  }
)

export const fetchStockOptimization = createAsyncThunk(
  'inventory/fetchStockOptimization',
  async ({ restaurantId, optimizationGoal = 'balanced' }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/inventory/optimization?restaurantId=${restaurantId}&optimizationGoal=${optimizationGoal}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch stock optimization')
    }
  }
)

export const fetchInventoryDashboard = createAsyncThunk(
  'inventory/fetchDashboard',
  async (restaurantId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/inventory/dashboard?restaurantId=${restaurantId}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch inventory dashboard')
    }
  }
)

const initialState = {
  // Legacy state
  transactions: [],
  currentInventory: [],
  lowStockItems: [],
  wasteData: [],
  
  // New InventoryAgent state
  inventoryLevels: {
    inventoryItems: [],
    summary: {
      totalItems: 0,
      totalValue: 0,
      healthyItems: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      overstockItems: 0,
      expiringItems: 0,
      averageStockLevel: 0
    },
    generatedAt: null
  },
  
  reorderNeeds: {
    recommendations: [],
    summary: {
      totalItems: 0,
      itemsNeedingReorder: 0,
      highPriorityItems: 0,
      totalEstimatedCost: 0
    },
    forecastPeriod: '7 days',
    generatedAt: null
  },
  
  expirationAlerts: {
    alerts: [],
    summary: {
      totalAlertsGenerated: 0,
      criticalItems: 0,
      warningItems: 0,
      totalPotentialWasteValue: 0
    },
    warningThreshold: '5 days',
    generatedAt: null
  },
  
  wasteAnalysis: {
    wasteAnalysis: [],
    recommendations: [],
    summary: {
      totalTransactions: 0,
      totalWasteItems: 0,
      averageWastePercentage: 0,
      highWasteItems: 0
    },
    timeframe: '30 days',
    generatedAt: null
  },
  
  stockOptimization: {
    optimizations: [],
    summary: {
      totalItems: 0,
      totalAnnualSavings: 0,
      itemsWithReductions: 0,
      optimizationGoal: 'balanced'
    },
    generatedAt: null
  },
  
  dashboardData: {
    inventory: null,
    reorderNeeds: null,
    expirationAlerts: null,
    wasteAnalysis: null,
    summary: {
      totalItems: 0,
      totalValue: 0,
      urgentReorders: 0,
      criticalExpirations: 0,
      averageWastePercentage: 0
    },
    generatedAt: null
  },
  
  loading: false,
  error: null,
  
  // Loading states for individual operations
  loadingStates: {
    levels: false,
    reorderNeeds: false,
    expirationAlerts: false,
    wasteAnalysis: false,
    stockOptimization: false,
    dashboard: false
  }
}

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload
    },
    setError: (state, action) => {
      state.error = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    // Legacy reducers for backward compatibility
    setTransactions: (state, action) => {
      state.transactions = action.payload
    },
    addTransaction: (state, action) => {
      state.transactions.unshift(action.payload)
    },
    setCurrentInventory: (state, action) => {
      state.currentInventory = action.payload
    },
    setLowStockItems: (state, action) => {
      state.lowStockItems = action.payload
    },
    setWasteData: (state, action) => {
      state.wasteData = action.payload
    },
    // Clear specific data sections
    clearInventoryData: (state) => {
      state.inventoryLevels = initialState.inventoryLevels
      state.reorderNeeds = initialState.reorderNeeds
      state.expirationAlerts = initialState.expirationAlerts
      state.wasteAnalysis = initialState.wasteAnalysis
      state.stockOptimization = initialState.stockOptimization
      state.dashboardData = initialState.dashboardData
    }
  },
  extraReducers: (builder) => {
    // Fetch Inventory Levels
    builder
      .addCase(fetchInventoryLevels.pending, (state) => {
        state.loadingStates.levels = true
        state.error = null
      })
      .addCase(fetchInventoryLevels.fulfilled, (state, action) => {
        state.loadingStates.levels = false
        state.inventoryLevels = action.payload
        // Update legacy state for compatibility
        state.currentInventory = action.payload.inventoryItems
        state.lowStockItems = action.payload.inventoryItems.filter(item => item.status === 'low_stock' || item.status === 'out_of_stock')
      })
      .addCase(fetchInventoryLevels.rejected, (state, action) => {
        state.loadingStates.levels = false
        state.error = action.payload
      })
    
    // Fetch Reorder Needs
    builder
      .addCase(fetchReorderNeeds.pending, (state) => {
        state.loadingStates.reorderNeeds = true
        state.error = null
      })
      .addCase(fetchReorderNeeds.fulfilled, (state, action) => {
        state.loadingStates.reorderNeeds = false
        state.reorderNeeds = action.payload
      })
      .addCase(fetchReorderNeeds.rejected, (state, action) => {
        state.loadingStates.reorderNeeds = false
        state.error = action.payload
      })
    
    // Fetch Expiration Alerts
    builder
      .addCase(fetchExpirationAlerts.pending, (state) => {
        state.loadingStates.expirationAlerts = true
        state.error = null
      })
      .addCase(fetchExpirationAlerts.fulfilled, (state, action) => {
        state.loadingStates.expirationAlerts = false
        state.expirationAlerts = action.payload
      })
      .addCase(fetchExpirationAlerts.rejected, (state, action) => {
        state.loadingStates.expirationAlerts = false
        state.error = action.payload
      })
    
    // Fetch Waste Analysis
    builder
      .addCase(fetchWasteAnalysis.pending, (state) => {
        state.loadingStates.wasteAnalysis = true
        state.error = null
      })
      .addCase(fetchWasteAnalysis.fulfilled, (state, action) => {
        state.loadingStates.wasteAnalysis = false
        state.wasteAnalysis = action.payload
        // Update legacy state for compatibility
        state.wasteData = action.payload.wasteAnalysis
      })
      .addCase(fetchWasteAnalysis.rejected, (state, action) => {
        state.loadingStates.wasteAnalysis = false
        state.error = action.payload
      })
    
    // Fetch Stock Optimization
    builder
      .addCase(fetchStockOptimization.pending, (state) => {
        state.loadingStates.stockOptimization = true
        state.error = null
      })
      .addCase(fetchStockOptimization.fulfilled, (state, action) => {
        state.loadingStates.stockOptimization = false
        state.stockOptimization = action.payload
      })
      .addCase(fetchStockOptimization.rejected, (state, action) => {
        state.loadingStates.stockOptimization = false
        state.error = action.payload
      })
    
    // Fetch Dashboard Data
    builder
      .addCase(fetchInventoryDashboard.pending, (state) => {
        state.loadingStates.dashboard = true
        state.loading = true
        state.error = null
      })
      .addCase(fetchInventoryDashboard.fulfilled, (state, action) => {
        state.loadingStates.dashboard = false
        state.loading = false
        state.dashboardData = action.payload
        
        // Update individual sections with dashboard data
        if (action.payload.inventory) {
          state.inventoryLevels = action.payload.inventory
          state.currentInventory = action.payload.inventory.inventoryItems
          state.lowStockItems = action.payload.inventory.inventoryItems.filter(item => item.status === 'low_stock' || item.status === 'out_of_stock')
        }
        if (action.payload.reorderNeeds) {
          state.reorderNeeds = action.payload.reorderNeeds
        }
        if (action.payload.expirationAlerts) {
          state.expirationAlerts = action.payload.expirationAlerts
        }
        if (action.payload.wasteAnalysis) {
          state.wasteAnalysis = action.payload.wasteAnalysis
          state.wasteData = action.payload.wasteAnalysis.wasteAnalysis
        }
      })
      .addCase(fetchInventoryDashboard.rejected, (state, action) => {
        state.loadingStates.dashboard = false
        state.loading = false
        state.error = action.payload
      })
  }
})

export const {
  setLoading,
  setError,
  clearError,
  setTransactions,
  addTransaction,
  setCurrentInventory,
  setLowStockItems,
  setWasteData,
  clearInventoryData
} = inventorySlice.actions

// Selectors
export const selectInventoryLevels = (state) => state.inventory.inventoryLevels
export const selectReorderNeeds = (state) => state.inventory.reorderNeeds
export const selectExpirationAlerts = (state) => state.inventory.expirationAlerts
export const selectWasteAnalysis = (state) => state.inventory.wasteAnalysis
export const selectStockOptimization = (state) => state.inventory.stockOptimization
export const selectInventoryDashboard = (state) => state.inventory.dashboardData
export const selectInventoryLoading = (state) => state.inventory.loading
export const selectInventoryLoadingStates = (state) => state.inventory.loadingStates
export const selectInventoryError = (state) => state.inventory.error

// Legacy selectors for backward compatibility
export const selectCurrentInventory = (state) => state.inventory.currentInventory
export const selectLowStockItems = (state) => state.inventory.lowStockItems
export const selectWasteData = (state) => state.inventory.wasteData

export default inventorySlice.reducer