/**
 * POS Sync Service
 * 
 * API client for POS inventory synchronization endpoints.
 * Wraps the provider-agnostic sync API created in Phase 4.
 * 
 * Base Path: /api/v1/pos
 * 
 * Related:
 * - Backend: backend/src/routes/posSync.js
 * - Backend: backend/src/controllers/POSSyncController.js
 * 
 * Created: 2025-10-06
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

  const response = await api.post(`/pos/sync/${connectionId}`, {}, {
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

  const response = await api.post(`/pos/transform/${connectionId}`, {}, {
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
    const response = await api.get(`/pos/status/${connectionId}`)
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
    const response = await api.get(`/pos/stats/${restaurantId}`)
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
  const response = await api.post(`/pos/clear/${restaurantId}`)
  return response.data
}

/**
 * Validate transformation for a restaurant
 * 
 * @param {number} restaurantId - Restaurant ID
 * @returns {Promise<Object>} Validation result with success rate
 */
export const validateTransformation = async (restaurantId) => {
  const response = await api.get(`/pos/validate/${restaurantId}`)
  return response.data
}

/**
 * Trigger sales data sync for a POS connection
 * 
 * Fetches orders from Square Orders API and optionally transforms to unified sales_transactions format.
 * Requires date range parameters.
 * 
 * @param {number} connectionId - POS connection ID
 * @param {Object} options - Sync options
 * @param {string} options.startDate - Start date (ISO 8601 format, e.g., '2025-10-01')
 * @param {string} options.endDate - End date (ISO 8601 format, e.g., '2025-10-07')
 * @param {boolean} options.transform - Transform to sales_transactions (default: true)
 * @param {boolean} options.dryRun - Simulate without saving (default: false)
 * @returns {Promise<Object>} Sync result with orders/lineItems synced, transactions created, errors
 * @throws {Error} If startDate or endDate is missing
 */
export const syncSales = async (connectionId, options = {}) => {
  const {
    startDate,
    endDate,
    transform = true,
    dryRun = false
  } = options

  // Validate required parameters
  if (!startDate) {
    throw new Error('startDate is required for sales sync')
  }

  if (!endDate) {
    throw new Error('endDate is required for sales sync')
  }

  const response = await api.post(`/pos/sync-sales/${connectionId}`, {
    startDate,
    endDate,
    transform,
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
  const response = await api.get(`/pos/sales-status/${connectionId}`)
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
  const response = await api.post(`/pos/clear-sales/${restaurantId}`)
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
  getSalesStatus,
  clearSalesData
}
