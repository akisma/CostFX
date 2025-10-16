/**
 * POS Sync Service
 * 
 * API client for POS synchronization endpoints (inventory and sales).
 * Uses RESTful structure: /api/v1/pos/square/{resource}/{action}
 * 
 * New Base Path (v1.1+): /api/v1/pos/square
 * Old Base Path (DEPRECATED): /api/v1/pos
 * 
 * Related:
 * - Backend: backend/src/routes/pos/square/inventory.js
 * - Backend: backend/src/routes/pos/square/sales.js
 * - Backend: backend/src/controllers/POSSyncController.js
 * 
 * Created: 2025-10-06
 * Updated: 2025-10-14 (REST API restructure)
 */

import api from './api'
/**
 * Trigger inventory sync for a POS connection (raw data only, no transformation)
 * 
 * @param {number} connectionId - POS connection ID
 * @param {Object} options - Sync options
 * @param {boolean} options.incremental - Use incremental sync (default: true)
 * @param {boolean} options.dryRun - Simulate without saving (default: false)
 * @param {boolean} options.clearBeforeSync - Clear existing data first (default: false)
 * @returns {Promise<Object>} Sync result with status, counts, duration
 */
export const syncInventory = async (connectionId, options = {}) => {
  const {
    incremental = true,
    dryRun = false,
    clearBeforeSync = false
  } = options

  const response = await api.post(`/pos/square/inventory/sync/${connectionId}`, {}, {
    params: { incremental, dryRun, clearBeforeSync }
  })
  
  return response.data
}

/**
 * Transform synced POS data to inventory items
 * 
 * @param {number} connectionId - POS connection ID
 * @param {Object} options - Transform options
 * @param {boolean} options.dryRun - Simulate without saving (default: false)
 * @returns {Promise<Object>} Transform result with counts, errors
 */
export const transformInventory = async (connectionId, options = {}) => {
  const {
    dryRun = false
  } = options

  const response = await api.post(`/pos/square/inventory/transform/${connectionId}`, {}, {
    params: { dryRun }
  })
  
  return response.data
}

/**
 * Get sync status for a POS connection
 * 
 * @param {number} connectionId - POS connection ID
 * @returns {Promise<Object>} Status with tier counts, last sync time, etc.
 */
export const getSyncStatus = async (connectionId) => {
  try {
    const response = await api.get(`/pos/square/inventory/status/${connectionId}`)
    return response.data
  } catch (error) {
    // Log the full error for debugging
    console.error('getSyncStatus error:', {
      connectionId,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    })
    throw error
  }
}

/**
 * Get transformation statistics for a restaurant
 * 
 * @param {number} restaurantId - Restaurant ID
 * @returns {Promise<Object>} Stats with category/unit distribution
 */
export const getTransformationStats = async (restaurantId) => {
  try {
    const response = await api.get(`/pos/square/inventory/stats/${restaurantId}`)
    return response.data
  } catch (error) {
    // Log the full error for debugging
    console.error('getTransformationStats error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    })
    throw error
  }
}

/**
 * Clear POS data for a restaurant
 * 
 * @param {number} restaurantId - Restaurant ID
 * @returns {Promise<Object>} Result with deletion counts
 */
export const clearPOSData = async (restaurantId) => {
  const response = await api.delete(`/pos/square/inventory/${restaurantId}`)
  return response.data
}

/**
 * Validate transformation for a restaurant
 * 
 * @param {number} restaurantId - Restaurant ID
 * @returns {Promise<Object>} Validation result with success rate
 */
export const validateTransformation = async (restaurantId) => {
  const response = await api.get(`/pos/square/inventory/validate/${restaurantId}`)
  return response.data
}

/**
 * Sync sales data from Square (Tier 1 only - raw data)
 * 
 * Fetches Square orders and order items for the specified date range and stores
 * them in square_orders/square_order_items tables (Tier 1 raw data).
 * Does NOT transform to sales_transactions - use transformSales() separately.
 * 
 * @param {number} connectionId - POS connection ID (must be Square)
 * @param {Object} options - Sync options
 * @param {string} options.startDate - Start date (ISO 8601, e.g., '2023-10-01')
 * @param {string} options.endDate - End date (ISO 8601, e.g., '2023-10-31')
 * @param {boolean} [options.dryRun=false] - Simulate without saving to database
 * @returns {Promise<Object>} Sync result with orders/lineItems synced
 * @throws {Error} If startDate or endDate is missing
 */
export const syncSales = async (connectionId, options = {}) => {
  const {
    startDate,
    endDate,
    dryRun = false
  } = options

  // Validate required parameters
  if (!startDate) {
    throw new Error('startDate is required for sales sync')
  }

  if (!endDate) {
    throw new Error('endDate is required for sales sync')
  }

  const response = await api.post(`/pos/square/sales/sync/${connectionId}`, {
    startDate,
    endDate,
    dryRun
  })
  
  return response.data
}

/**
 * Transform synced sales data to sales transactions (Tier 2)
 * 
 * Transforms square_order_items (Tier 1) to sales_transactions (Tier 2)
 * for the specified date range. Must call syncSales() first to populate Tier 1 data.
 * 
 * @param {number} connectionId - POS connection ID (must be Square)
 * @param {Object} options - Transform options
 * @param {string} options.startDate - Start date (ISO 8601, e.g., '2023-10-01')
 * @param {string} options.endDate - End date (ISO 8601, e.g., '2023-10-31')
 * @param {boolean} [options.dryRun=false] - Simulate without saving to database
 * @returns {Promise<Object>} Transform result with transactions created, errors
 * @throws {Error} If startDate or endDate is missing
 */
export const transformSales = async (connectionId, options = {}) => {
  const {
    startDate,
    endDate,
    dryRun = false
  } = options

  // Validate required parameters
  if (!startDate) {
    throw new Error('startDate is required for sales transformation')
  }

  if (!endDate) {
    throw new Error('endDate is required for sales transformation')
  }

  const response = await api.post(`/pos/square/sales/transform/${connectionId}`, {
    startDate,
    endDate,
    dryRun
  })
  
  return response.data
}

/**
 * Get sales sync status for a POS connection
 * 
 * Returns counts for both Tier 1 (square_orders/square_order_items) 
 * and Tier 2 (sales_transactions) data.
 * 
 * @param {number} connectionId - POS connection ID
 * @returns {Promise<Object>} Status with tier counts, last sync time, etc.
 */
export const getSalesStatus = async (connectionId) => {
  const response = await api.get(`/pos/square/sales/status/${connectionId}`)
  return response.data
}

/**
 * Clear sales data for a restaurant
 * 
 * Deletes all sales-related data:
 * - Tier 1: square_orders, square_order_items
 * - Tier 2: sales_transactions
 * 
 * @param {number} restaurantId - Restaurant ID
 * @returns {Promise<Object>} Result with deletion counts
 */
export const clearSalesData = async (restaurantId) => {
  const response = await api.delete(`/pos/square/sales/${restaurantId}`)
  return response.data
}

/**
 * Get raw sales data (Tier 1) for a connection
 * 
 * Returns square_orders and square_order_items. Useful for reviewing
 * what was synced before transformation.
 * 
 * @param {number} connectionId - POS connection ID
 * @param {Object} options - Query options
 * @param {number} [options.limit=100] - Max records to return
 * @returns {Promise<Object>} Raw sales data with orders and items
 */
export const getRawSalesData = async (connectionId, options = {}) => {
  const { limit = 100 } = options
  const response = await api.get(`/pos/square/sales/raw/${connectionId}`, {
    params: { limit }
  })
  return response.data
}

/**
 * Get transformed sales data (Tier 2) for a connection
 * 
 * Returns sales_transactions records. Useful for reviewing
 * transformed data before using in analysis.
 * 
 * @param {number} connectionId - POS connection ID
 * @param {Object} options - Query options
 * @param {number} [options.limit=500] - Max records to return
 * @returns {Promise<Object>} Transformed sales data
 */
export const getTransformedSalesData = async (connectionId, options = {}) => {
  const { limit = 500 } = options
  const response = await api.get(`/pos/square/sales/transformed/${connectionId}`, {
    params: { limit }
  })
  return response.data
}

export default {
  // Inventory sync methods
  syncInventory,
  transformInventory,
  getSyncStatus,
  getTransformationStats,
  clearPOSData,
  validateTransformation,
  
  // Sales sync methods
  syncSales,
  transformSales,
  getSalesStatus,
  clearSalesData,
  getRawSalesData,
  getTransformedSalesData
}
