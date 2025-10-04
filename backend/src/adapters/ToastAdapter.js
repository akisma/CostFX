/**
 * ToastAdapter - Toast POS Integration Stub
 * 
 * Progress Note: Day 2 - Toast Adapter Stub
 * This is a placeholder implementation for Toast POS integration
 * 
 * DATA FLOW: READ ONLY - One-way sync from Toast to CostFX (when implemented)
 * Future implementation will import data from Toast POS into CostFX for analysis.
 * We will NEVER write data back to Toast. The merchant's Toast system will remain 
 * the authoritative source of truth for all inventory and sales data.
 * 
 * Purpose:
 * - Satisfy the POSAdapter interface contract
 * - Provide clear error messages that Toast is not yet available
 * - Serve as template for future Toast implementation
 * - Allow POSAdapterFactory to load without errors
 * 
 * Implementation Status: STUB
 * All methods throw descriptive errors indicating Toast integration is not available
 * 
 * Future Implementation Notes:
 * When implementing Toast integration, refer to:
 * - Toast Partner API documentation
 * - Toast OAuth flow (may differ from Square's)
 * - Toast webhook signature verification
 * - Toast data models for menu items and orders
 * 
 * Follow the same patterns as SquareAdapter:
 * - READ ONLY data sync (Toast → CostFX)
 * - OAuth with state tokens (CSRF protection)
 * - Encrypted token storage via POSConnection
 * - Automatic token refresh
 * - Comprehensive error handling
 * - Rate limiting
 * - Webhook verification
 * - Request only READ permissions in OAuth scopes
 */

import POSAdapter from './POSAdapter.js';
import { POSError } from '../utils/posErrors.js';
import logger from '../utils/logger.js';

class ToastAdapter extends POSAdapter {
  /**
   * Constructor for Toast adapter stub
   * 
   * @param {Object} config - Toast configuration from posProviders.js
   */
  constructor(config) {
    super('toast', config);
    
    logger.warn('ToastAdapter initialized as STUB - Toast integration not yet implemented');
  }

  /**
   * Initialize Toast adapter - STUB
   * 
   * Progress Note: This stub implementation allows the adapter to be instantiated
   * but prevents actual operations from being attempted
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    this._logOperation('initialize', {
      status: 'stub',
      message: 'Toast integration not yet implemented'
    }, 'warn');
    
    // Mark as initialized to prevent initialization errors
    // But all operations will throw descriptive errors
    this.initialized = true;
  }

  /**
   * Initiate OAuth - NOT IMPLEMENTED
   * 
   * @throws {POSError} Toast integration not available
   */
  async initiateOAuth(restaurantId, redirectUri) {
    throw new POSError(
      'Toast POS integration is not yet available. Please contact support for information about Toast integration.',
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Handle OAuth callback - NOT IMPLEMENTED
   * 
   * @throws {POSError} Toast integration not available
   */
  async handleOAuthCallback(params) {
    throw new POSError(
      'Toast POS integration is not yet available. Please contact support for information about Toast integration.',
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Refresh authentication - NOT IMPLEMENTED
   * 
   * @throws {POSError} Toast integration not available
   */
  async refreshAuth(connection) {
    throw new POSError(
      'Toast POS integration is not yet available. Please contact support for information about Toast integration.',
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Disconnect - NOT IMPLEMENTED
   * 
   * @throws {POSError} Toast integration not available
   */
  async disconnect(connection) {
    throw new POSError(
      'Toast POS integration is not yet available. Please contact support for information about Toast integration.',
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Get locations - NOT IMPLEMENTED
   * 
   * @throws {POSError} Toast integration not available
   */
  async getLocations(connection) {
    throw new POSError(
      'Toast POS integration is not yet available. Please contact support for information about Toast integration.',
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Sync inventory - NOT IMPLEMENTED
   * 
   * @throws {POSError} Toast integration not available
   */
  async syncInventory(connection, since = null) {
    throw new POSError(
      'Toast POS integration is not yet available. Please contact support for information about Toast integration.',
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Sync sales - NOT IMPLEMENTED
   * 
   * @throws {POSError} Toast integration not available
   */
  async syncSales(connection, startDate, endDate) {
    throw new POSError(
      'Toast POS integration is not yet available. Please contact support for information about Toast integration.',
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Health check - STUB IMPLEMENTATION
   * 
   * Progress Note: Returns unhealthy status indicating Toast is not available
   * 
   * @returns {Promise<{healthy: boolean, message: string, details: Object}>}
   */
  async healthCheck(connection) {
    return {
      healthy: false,
      message: 'Toast POS integration is not yet implemented',
      details: {
        provider: 'toast',
        status: 'NOT_IMPLEMENTED',
        connectionId: connection?.id || null,
        restaurantId: connection?.restaurantId || null
      }
    };
  }

  /**
   * Verify webhook signature - NOT IMPLEMENTED
   * 
   * @throws {POSError} Toast integration not available
   */
  async verifyWebhookSignature(payload, signature, signatureKey = null) {
    throw new POSError(
      'Toast POS integration is not yet available. Please contact support for information about Toast integration.',
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Process webhook - NOT IMPLEMENTED
   * 
   * @throws {POSError} Toast integration not available
   */
  async processWebhook(payload, connection) {
    throw new POSError(
      'Toast POS integration is not yet available. Please contact support for information about Toast integration.',
      'NOT_IMPLEMENTED'
    );
  }
}

export default ToastAdapter;
