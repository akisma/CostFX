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

// Period Selection Operations
export const fetchPeriods = createAsyncThunk(
  'inventory/fetchPeriods',
  async ({ restaurantId, filters = {} }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams({ restaurantId });
      
      // Add filters to query params
      if (filters.periodTypes?.length) {
        queryParams.append('periodTypes', filters.periodTypes.join(','));
      }
      if (filters.statusFilter?.length) {
        queryParams.append('status', filters.statusFilter.join(','));
      }
      if (filters.limit) {
        queryParams.append('limit', filters.limit);
      }
      if (filters.page) {
        queryParams.append('page', filters.page);
      }
      
      const response = await api.get(`/periods?${queryParams}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch periods')
    }
  }
)

export const fetchPeriodById = createAsyncThunk(
  'inventory/fetchPeriodById',
  async (periodId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/periods/${periodId}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch period')
    }
  }
)

export const createPeriod = createAsyncThunk(
  'inventory/createPeriod',
  async (periodData, { rejectWithValue }) => {
    try {
      const response = await api.post('/periods', periodData)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to create period')
    }
  }
)

export const updatePeriod = createAsyncThunk(
  'inventory/updatePeriod',
  async ({ periodId, updateData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/periods/${periodId}`, updateData)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update period')
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
  
  // Period Selection State
  periodSelection: {
    periods: [],
    selectedPeriod: null,
    selectedDateRange: null,
    filters: {
      restaurantId: null,
      periodTypes: ['weekly', 'monthly', 'custom'],
      statusFilter: ['draft', 'active', 'closed'],
      searchTerm: ''
    },
    pagination: {
      page: 1,
      limit: 50,
      total: 0,
      pages: 0
    },
    loading: false,
    error: null,
    lastFetch: null
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
    dashboard: false,
    periods: false,
    periodCreate: false,
    periodUpdate: false
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
    },
    
    // Period Selection Actions
    setPeriodFilters: (state, action) => {
      state.periodSelection.filters = { ...state.periodSelection.filters, ...action.payload }
    },
    setSelectedPeriod: (state, action) => {
      state.periodSelection.selectedPeriod = action.payload
      // Clear date range when period is selected
      if (action.payload) {
        state.periodSelection.selectedDateRange = null
      }
    },
    setSelectedDateRange: (state, action) => {
      // Convert Date objects to ISO strings to maintain serialization
      const payload = action.payload;
      if (payload && typeof payload === 'object') {
        state.periodSelection.selectedDateRange = {
          from: payload.from instanceof Date ? payload.from.toISOString() : payload.from,
          to: payload.to instanceof Date ? payload.to.toISOString() : payload.to
        };
      } else {
        state.periodSelection.selectedDateRange = payload;
      }
      // Clear period when date range is selected
      if (action.payload) {
        state.periodSelection.selectedPeriod = null
      }
    },
    clearPeriodSelection: (state) => {
      state.periodSelection.selectedPeriod = null
      state.periodSelection.selectedDateRange = null
    },
    clearPeriodData: (state) => {
      state.periodSelection = initialState.periodSelection
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
    
    // Fetch Periods
    builder
      .addCase(fetchPeriods.pending, (state) => {
        state.loadingStates.periods = true
        state.periodSelection.loading = true
        state.periodSelection.error = null
      })
      .addCase(fetchPeriods.fulfilled, (state, action) => {
        state.loadingStates.periods = false
        state.periodSelection.loading = false
        state.periodSelection.periods = action.payload.periods || []
        state.periodSelection.pagination = action.payload.pagination || state.periodSelection.pagination
        state.periodSelection.lastFetch = new Date().toISOString()
      })
      .addCase(fetchPeriods.rejected, (state, action) => {
        state.loadingStates.periods = false
        state.periodSelection.loading = false
        state.periodSelection.error = action.payload
      })
    
    // Fetch Period By ID
    builder
      .addCase(fetchPeriodById.pending, (state) => {
        state.periodSelection.loading = true
        state.periodSelection.error = null
      })
      .addCase(fetchPeriodById.fulfilled, (state, action) => {
        state.periodSelection.loading = false
        // Update the period in the list if it exists
        const periodIndex = state.periodSelection.periods.findIndex(p => p.id === action.payload.id)
        if (periodIndex !== -1) {
          state.periodSelection.periods[periodIndex] = action.payload
        }
        // Set as selected if not already selected
        if (!state.periodSelection.selectedPeriod || state.periodSelection.selectedPeriod.id !== action.payload.id) {
          state.periodSelection.selectedPeriod = action.payload
        }
      })
      .addCase(fetchPeriodById.rejected, (state, action) => {
        state.periodSelection.loading = false
        state.periodSelection.error = action.payload
      })
    
    // Create Period
    builder
      .addCase(createPeriod.pending, (state) => {
        state.loadingStates.periodCreate = true
        state.periodSelection.error = null
      })
      .addCase(createPeriod.fulfilled, (state, action) => {
        state.loadingStates.periodCreate = false
        // Add new period to the beginning of the list
        state.periodSelection.periods.unshift(action.payload)
        state.periodSelection.selectedPeriod = action.payload
        // Update pagination
        state.periodSelection.pagination.total += 1
      })
      .addCase(createPeriod.rejected, (state, action) => {
        state.loadingStates.periodCreate = false
        state.periodSelection.error = action.payload
      })
    
    // Update Period
    builder
      .addCase(updatePeriod.pending, (state) => {
        state.loadingStates.periodUpdate = true
        state.periodSelection.error = null
      })
      .addCase(updatePeriod.fulfilled, (state, action) => {
        state.loadingStates.periodUpdate = false
        // Update the period in the list
        const periodIndex = state.periodSelection.periods.findIndex(p => p.id === action.payload.id)
        if (periodIndex !== -1) {
          state.periodSelection.periods[periodIndex] = action.payload
        }
        // Update selected period if it's the one being updated
        if (state.periodSelection.selectedPeriod?.id === action.payload.id) {
          state.periodSelection.selectedPeriod = action.payload
        }
      })
      .addCase(updatePeriod.rejected, (state, action) => {
        state.loadingStates.periodUpdate = false
        state.periodSelection.error = action.payload
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
  clearInventoryData,
  setPeriodFilters,
  setSelectedPeriod,
  setSelectedDateRange,
  clearPeriodSelection,
  clearPeriodData
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

// Period Selection Selectors
export const selectPeriodSelection = (state) => state.inventory.periodSelection
export const selectPeriods = (state) => state.inventory.periodSelection.periods
export const selectSelectedPeriod = (state) => state.inventory.periodSelection.selectedPeriod
export const selectSelectedDateRange = (state) => state.inventory.periodSelection.selectedDateRange
export const selectPeriodFilters = (state) => state.inventory.periodSelection.filters
export const selectPeriodPagination = (state) => state.inventory.periodSelection.pagination
export const selectPeriodLoading = (state) => state.inventory.periodSelection.loading
export const selectPeriodError = (state) => state.inventory.periodSelection.error

// Computed period selectors
export const selectFilteredPeriods = (state) => {
  const { periods, filters } = state.inventory.periodSelection
  let filtered = [...periods]
  
  // Filter by period types
  if (filters.periodTypes?.length) {
    filtered = filtered.filter(p => filters.periodTypes.includes(p.periodType))
  }
  
  // Filter by status
  if (filters.statusFilter?.length) {
    filtered = filtered.filter(p => filters.statusFilter.includes(p.status))
  }
  
  // Search filter
  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase()
    filtered = filtered.filter(p => 
      p.periodName.toLowerCase().includes(term) ||
      (p.description && p.description.toLowerCase().includes(term))
    )
  }
  
  return filtered
}

export const selectActivePeriod = (state) => {
  const periods = state.inventory.periodSelection.periods
  return periods.find(p => p.status === 'active') || null
}

export const selectPeriodStats = (state) => {
  const periods = state.inventory.periodSelection.periods
  return periods.reduce((stats, period) => {
    stats.total++
    stats.byStatus[period.status] = (stats.byStatus[period.status] || 0) + 1
    stats.byType[period.periodType] = (stats.byType[period.periodType] || 0) + 1
    return stats
  }, {
    total: 0,
    byStatus: { draft: 0, active: 0, closed: 0, locked: 0 },
    byType: { weekly: 0, monthly: 0, custom: 0 }
  })
}

// Legacy selectors for backward compatibility
export const selectCurrentInventory = (state) => state.inventory.currentInventory
export const selectLowStockItems = (state) => state.inventory.lowStockItems
export const selectWasteData = (state) => state.inventory.wasteData

export default inventorySlice.reducer