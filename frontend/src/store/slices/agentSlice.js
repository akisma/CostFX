import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  insights: [],
  recommendations: [],
  queryHistory: [],
  loading: false,
  error: null
}

const agentSlice = createSlice({
  name: 'agent',
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
    setInsights: (state, action) => {
      state.insights = action.payload
    },
    addInsight: (state, action) => {
      state.insights.unshift(action.payload)
    },
    setRecommendations: (state, action) => {
      state.recommendations = action.payload
    },
    addQueryToHistory: (state, action) => {
      state.queryHistory.unshift({
        ...action.payload,
        timestamp: new Date().toISOString()
      })
      // Keep only last 50 queries
      if (state.queryHistory.length > 50) {
        state.queryHistory = state.queryHistory.slice(0, 50)
      }
    },
    clearQueryHistory: (state) => {
      state.queryHistory = []
    }
  }
})

export const {
  setLoading,
  setError,
  clearError,
  setInsights,
  addInsight,
  setRecommendations,
  addQueryToHistory,
  clearQueryHistory
} = agentSlice.actions

export default agentSlice.reducer