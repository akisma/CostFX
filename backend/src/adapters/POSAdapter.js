/**
 * POSAdapter - Abstract Base Class for POS System Integrations
 * 
 * Progress Note: Day 2 - Adapter Architecture Implementation
 * This abstract base class defines the contract that all POS adapter implementations
 * must follow. It provides a consistent interface for the application to interact with
 * different POS systems (Square, Toast, etc.) without needing to know implementation details.
 * 
 * Design Pattern: Template Method + Strategy
 * - Template Method: This class defines the structure and validation
 * - Strategy: Each POS provider implements its own concrete strategy
 * 
 * Key Responsibilities:
 * 1. Define standard interface for all POS operations
 * 2. Provide common validation and error handling
 * 3. Enforce implementation requirements through abstract methods
 * 4. Standardize data formats returned to the application
 * 
 * Security Considerations:
 * - All authentication tokens are managed by POSConnection model (encrypted at rest)
 * - OAuth flows are handled with CSRF protection via OAuthStateService
 * - No sensitive data should be logged in this layer
 * 
 * @abstract
 */

import logger from '../utils/logger.js';
import { POSError, POSConfigError } from '../utils/posErrors.js';

class POSAdapter {
  /**
   * Constructor for POS adapter
   * 
   * @param {string} providerName - Name of the POS provider (e.g., 'square', 'toast')
   * @param {Object} config - Provider-specific configuration
   * @throws {POSConfigError} If configuration is invalid
   */
  constructor(providerName, config) {
    // Progress Note: Validate that subclass is properly calling super() with required params
    if (!providerName || typeof providerName !== 'string') {
      throw new POSConfigError('Provider name is required and must be a string');
    }
    
    if (!config || typeof config !== 'object') {
      throw new POSConfigError(`Configuration is required for ${providerName} adapter`);
    }

    this.providerName = providerName;
    this.config = config;
    this.initialized = false;
    
    logger.info(`POSAdapter created for provider: ${providerName}`);
  }

  /**
   * Initialize the adapter with configuration validation
   * Must be called before using any other methods
   * 
   * Progress Note: This is the lifecycle hook where adapters should:
   * - Validate their specific configuration
   * - Initialize SDK clients
   * - Set up any necessary state
   * 
   * @abstract
   * @returns {Promise<void>}
   * @throws {POSConfigError} If configuration is invalid
   */
  async initialize() {
    throw new POSError(
      `initialize() must be implemented by ${this.providerName} adapter`,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Initiate OAuth authentication flow
   * Generates authorization URL with proper state for CSRF protection
   * 
   * Progress Note: OAuth flows follow RFC 6749 with state parameter
   * State tokens are managed by OAuthStateService for CSRF protection
   * 
   * @abstract
   * @param {number} restaurantId - ID of restaurant initiating auth
   * @param {string} redirectUri - URI to redirect after authorization
   * @returns {Promise<{authorizationUrl: string, state: string}>} Authorization URL and state token
   * @throws {POSAuthError} If authentication initiation fails
   */
  async initiateOAuth(restaurantId, redirectUri) {
    throw new POSError(
      `initiateOAuth() must be implemented by ${this.providerName} adapter`,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Handle OAuth callback and exchange authorization code for tokens
   * Verifies state token and stores encrypted tokens in database
   * 
   * Progress Note: This completes the OAuth flow by:
   * 1. Verifying state token (CSRF protection)
   * 2. Exchanging auth code for access/refresh tokens
   * 3. Creating/updating POSConnection with encrypted tokens
   * 
   * @abstract
   * @param {Object} params - OAuth callback parameters
   * @param {string} params.code - Authorization code from POS provider
   * @param {string} params.state - State token for CSRF verification
   * @param {number} params.restaurantId - ID of restaurant completing auth
   * @returns {Promise<POSConnection>} Created or updated POSConnection record
   * @throws {POSAuthError} If callback handling fails or state is invalid
   */
  async handleOAuthCallback(params) {
    throw new POSError(
      `handleOAuthCallback() must be implemented by ${this.providerName} adapter`,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Refresh expired access token using refresh token
   * 
   * Progress Note: Token refresh should:
   * 1. Use refresh token from POSConnection.getRefreshToken()
   * 2. Call provider's token refresh endpoint
   * 3. Update POSConnection with new encrypted tokens
   * 4. Handle refresh token rotation if provider supports it (Square does)
   * 
   * @abstract
   * @param {POSConnection} connection - POS connection with refresh token
   * @returns {Promise<POSConnection>} Updated connection with new tokens
   * @throws {POSTokenError} If token refresh fails
   */
  async refreshAuth(connection) {
    throw new POSError(
      `refreshAuth() must be implemented by ${this.providerName} adapter`,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Revoke access tokens and disconnect POS integration
   * 
   * Progress Note: Clean disconnection should:
   * 1. Revoke tokens with POS provider if they support it
   * 2. Update POSConnection status to 'revoked'
   * 3. Clear encrypted tokens from database
   * 
   * @abstract
   * @param {POSConnection} connection - POS connection to disconnect
   * @returns {Promise<void>}
   * @throws {POSAuthError} If revocation fails
   */
  async disconnect(connection) {
    throw new POSError(
      `disconnect() must be implemented by ${this.providerName} adapter`,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Get list of locations from POS system
   * Required for multi-location restaurant chains
   * 
   * Progress Note: Location data helps map POS locations to our Restaurant records
   * 
   * @abstract
   * @param {POSConnection} connection - Authenticated POS connection
   * @returns {Promise<Array<{id: string, name: string, address: string}>>} List of locations
   * @throws {POSError} If location retrieval fails
   */
  async getLocations(connection) {
    throw new POSError(
      `getLocations() must be implemented by ${this.providerName} adapter`,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Sync inventory items from POS to CostFX (READ ONLY)
   * Maps POS items to our InventoryItem model
   * 
   * Progress Note: ONE-WAY SYNC - Imports inventory data into CostFX
   * This is READ ONLY - we never write data back to the POS system.
   * The POS system remains the authoritative source of truth.
   * 
   * @abstract
   * @param {POSConnection} connection - Authenticated POS connection
   * @param {Date} [since] - Optional date to sync changes since
   * @returns {Promise<{synced: number, errors: Array}>} Sync results
   * @throws {POSSyncError} If sync fails
   */
  async syncInventory(connection, since = null) {
    throw new POSError(
      `syncInventory() must be implemented by ${this.providerName} adapter`,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Sync sales data from POS to CostFX (READ ONLY)
   * Required for theoretical vs actual usage analysis
   * 
   * Progress Note: ONE-WAY SYNC - Imports sales data into CostFX
   * This is READ ONLY - we never write data back to the POS system.
   * Sales data will map to future Sales model when implemented.
   * 
   * @abstract
   * @param {POSConnection} connection - Authenticated POS connection
   * @param {Date} startDate - Start of date range to sync
   * @param {Date} endDate - End of date range to sync
   * @returns {Promise<{synced: number, errors: Array}>} Sync results
   * @throws {POSSyncError} If sync fails
   */
  async syncSales(connection, startDate, endDate) {
    throw new POSError(
      `syncSales() must be implemented by ${this.providerName} adapter`,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Check health of POS connection
   * Tests authentication and basic API connectivity
   * 
   * Progress Note: Health checks are used by:
   * - Monitoring dashboard to show connection status
   * - Background jobs to detect and alert on connection issues
   * - POSAdapterFactory.healthCheckAll() for system-wide status
   * 
   * @abstract
   * @param {POSConnection} connection - POS connection to test
   * @returns {Promise<{healthy: boolean, message: string, details: Object}>} Health status
   */
  async healthCheck(connection) {
    throw new POSError(
      `healthCheck() must be implemented by ${this.providerName} adapter`,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Verify webhook signature for incoming webhooks
   * Ensures webhook requests are genuinely from the POS provider
   * 
   * Progress Note: Webhook security is critical - we must verify every webhook
   * Each provider has its own signature algorithm (Square uses HMAC-SHA256)
   * 
   * @abstract
   * @param {Object} payload - Raw webhook payload
   * @param {string} signature - Signature header from webhook request
   * @param {string} [signatureKey] - Optional signature key override (defaults to config)
   * @returns {Promise<boolean>} True if signature is valid
   */
  async verifyWebhookSignature(payload, signature, signatureKey = null) {
    throw new POSError(
      `verifyWebhookSignature() must be implemented by ${this.providerName} adapter`,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Process incoming webhook from POS system
   * Handles real-time notifications of inventory/sales changes
   * 
   * Progress Note: Webhooks enable real-time sync without polling
   * Each provider sends different event types - this method normalizes them
   * 
   * @abstract
   * @param {Object} payload - Webhook payload from POS provider
   * @param {POSConnection} connection - POS connection that webhook is for
   * @returns {Promise<{processed: boolean, action: string, details: Object}>} Processing result
   * @throws {POSError} If webhook processing fails
   */
  async processWebhook(payload, connection) {
    throw new POSError(
      `processWebhook() must be implemented by ${this.providerName} adapter`,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Get adapter information
   * Returns metadata about this adapter instance
   * 
   * Progress Note: This is a concrete method (not abstract) that all adapters inherit
   * Useful for debugging and monitoring
   * 
   * @returns {Object} Adapter metadata
   */
  getInfo() {
    return {
      provider: this.providerName,
      initialized: this.initialized,
      configKeys: Object.keys(this.config),
      // Progress Note: Never return actual config values (may contain secrets)
      hasConfig: Object.keys(this.config).length > 0
    };
  }

  /**
   * Validate that adapter is initialized
   * Helper method to ensure initialization before operations
   * 
   * Progress Note: Concrete helper method for subclasses to use
   * Call this at the start of any method that requires initialization
   * 
   * @throws {POSError} If adapter is not initialized
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new POSError(
        `${this.providerName} adapter must be initialized before use. Call initialize() first.`,
        'NOT_INITIALIZED'
      );
    }
  }

  /**
   * Validate POS connection is active and tokens are not expired
   * Helper method to verify connection before API calls
   * 
   * Progress Note: Concrete helper method for subclasses to use
   * Checks both connection status and token expiration
   * 
   * @param {POSConnection} connection - Connection to validate
   * @throws {POSTokenError} If connection is invalid or tokens expired
   */
  async _validateConnection(connection) {
    if (!connection) {
      throw new POSError(
        'POS connection is required',
        'INVALID_CONNECTION'
      );
    }

    if (connection.provider !== this.providerName) {
      throw new POSError(
        `Connection provider '${connection.provider}' does not match adapter provider '${this.providerName}'`,
        'PROVIDER_MISMATCH'
      );
    }

    if (!connection.isActive()) {
      throw new POSError(
        `POS connection is not active (status: ${connection.status}, expired: ${connection.isTokenExpired()})`,
        'INACTIVE_CONNECTION'
      );
    }
  }

  /**
   * Log adapter operation
   * Standardized logging for adapter operations
   * 
   * Progress Note: Concrete helper method for consistent logging
   * Never log sensitive data like tokens or customer information
   * 
   * @param {string} operation - Name of operation being performed
   * @param {Object} metadata - Additional metadata to log
   * @param {string} [level='info'] - Log level (info, warn, error)
   */
  _logOperation(operation, metadata = {}, level = 'info') {
    const logData = {
      adapter: this.providerName,
      operation,
      ...metadata,
      timestamp: new Date().toISOString()
    };

    logger[level](`[${this.providerName}] ${operation}`, logData);
  }
}

export default POSAdapter;
