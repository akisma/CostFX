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

export default {
  syncInventory,
  getSyncStatus,
  getTransformationStats,
  clearPOSData,
  validateTransformation
}
