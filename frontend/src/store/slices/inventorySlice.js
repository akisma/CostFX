import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  transactions: [],
  currentInventory: [],
  lowStockItems: [],
  wasteData: [],
  loading: false,
  error: null
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
    }
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
  setWasteData
} = inventorySlice.actions

export default inventorySlice.reducer