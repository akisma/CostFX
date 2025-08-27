import api from './api'

/**
 * Forecast Service - Handles all forecast-related API calls
 */
export const forecastService = {
  /**
   * Get demand forecast for menu items
   * @param {Object} params - Forecast parameters
   * @param {number} params.days - Number of days to forecast (default: 7)
   * @param {Array} params.menuItems - List of menu items to forecast
   * @param {number} params.restaurantId - Restaurant ID (default: 1)
   * @returns {Promise} Forecast data
   */
  async getDemandForecast(params = {}) {
    const defaultParams = {
      days: 7,
      menuItems: ['Classic Burger', 'Caesar Salad', 'Margherita Pizza'],
      restaurantId: 1
    }
    
    const response = await api.post('/agents/forecast/demand', { ...defaultParams, ...params })
    return response.data
  },

  /**
   * Get seasonal trends analysis
   * @param {Object} params - Analysis parameters
   * @param {string} params.period - Analysis period (default: 'quarterly')
   * @param {number} params.restaurantId - Restaurant ID (default: 1)
   * @returns {Promise} Seasonal analysis data
   */
  async getSeasonalTrends(params = {}) {
    const defaultParams = {
      period: 'quarterly',
      restaurantId: 1
    }
    
    const response = await api.post('/agents/forecast/seasonal', { ...defaultParams, ...params })
    return response.data
  },

  /**
   * Get revenue prediction
   * @param {Object} params - Prediction parameters
   * @param {number} params.days - Number of days to predict (default: 14)
   * @param {string} params.scenario - Scenario type (default: 'optimistic')
   * @param {number} params.restaurantId - Restaurant ID (default: 1)
   * @returns {Promise} Revenue prediction data
   */
  async getRevenuePrediction(params = {}) {
    const defaultParams = {
      days: 14,
      scenario: 'optimistic',
      restaurantId: 1
    }
    
    const response = await api.post('/agents/forecast/revenue', { ...defaultParams, ...params })
    return response.data
  },

  /**
   * Get capacity optimization recommendations
   * @param {Object} params - Optimization parameters
   * @param {number} params.currentCapacity - Current restaurant capacity
   * @param {number} params.restaurantId - Restaurant ID (default: 1)
   * @returns {Promise} Capacity optimization data
   */
  async getCapacityOptimization(params = {}) {
    const defaultParams = {
      currentCapacity: 100,
      restaurantId: 1
    }
    
    const response = await api.post('/agents/forecast/capacity', { ...defaultParams, ...params })
    return response.data
  },

  /**
   * Get ingredient forecasting
   * @param {Object} params - Forecasting parameters
   * @param {number} params.days - Number of days to forecast (default: 14)
   * @param {number} params.restaurantId - Restaurant ID (default: 1)
   * @returns {Promise} Ingredient forecast data
   */
  async getIngredientForecast(params = {}) {
    const defaultParams = {
      days: 14,
      restaurantId: 1
    }
    
    const response = await api.post('/agents/forecast/ingredients', { ...defaultParams, ...params })
    return response.data
  }
}

export default forecastService
