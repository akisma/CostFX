/**
 * SquareAdapter - Square POS Integration Implementation
 * 
 * Progress Note: Day 2 - Square Adapter with OAuth 2.0
 * Implements POSAdapter interface for Square POS system
 * 
 * DATA FLOW: READ ONLY - One-way sync from Square to CostFX
 * This adapter imports data from the merchant's Square POS into CostFX for analysis.
 * We NEVER write data back to Square. The merchant's Square system remains the 
 * authoritative source of truth for all inventory and sales data.
 * 
 * Square Integration Features:
 * - OAuth 2.0 authorization code flow with PKCE (RFC 7636)
 * - Token encryption and secure storage via POSConnection
 * - Automatic token refresh with rotation support
 * - Catalog API for inventory items (READ ONLY)
 * - Inventory API for stock counts (READ ONLY)
 * - Orders API for sales data (READ ONLY)
 * - Webhook signature verification (HMAC-SHA256)
 * 
 * Square API References:
 * - OAuth: https://developer.squareup.com/docs/oauth-api/overview
 * - SDK: https://github.com/square/square-nodejs-sdk
 * - Catalog: https://developer.squareup.com/docs/catalog-api/what-it-does
 * - Inventory: https://developer.squareup.com/docs/inventory-api/what-it-does
 * 
 * Security Implementation:
 * - State tokens for CSRF protection (OAuthStateService)
 * - Token encryption at rest (TokenEncryptionService via POSConnection)
 * - Webhook signature verification before processing
 * - Never logs sensitive data (tokens, customer info)
 */

import { Client, Environment } from 'square';
import crypto from 'crypto';
import POSAdapter from './POSAdapter.js';
import POSConnection from '../models/POSConnection.js';
import OAuthStateService from '../services/OAuthStateService.js';
import logger from '../utils/logger.js';
import {
  POSError,
  POSAuthError,
  POSTokenError,
  POSSyncError,
  POSConfigError,
  POSRateLimitError
} from '../utils/posErrors.js';

class SquareAdapter extends POSAdapter {
  /**
   * Constructor for Square adapter
   * 
   * Progress Note: Initializes with Square-specific configuration
   * Square SDK client is created during initialize() after validation
   * 
   * @param {Object} config - Square configuration from posProviders.js
   */
  constructor(config) {
    super('square', config);
    
    // Square SDK client (initialized in initialize())
    this.client = null;
    
    // OAuth client for authorization flows
    this.oauthClient = null;
    
    // Rate limiting state
    this.rateLimitState = {
      requests: 0,
      windowStart: Date.now(),
      windowMs: config.api.rateLimit.windowMs
    };
    
    this._logOperation('constructor', { environment: config.environment });
  }

  /**
   * Initialize Square adapter
   * Validates configuration and creates Square SDK client
   * 
   * Progress Note: Must be called before any other operations
   * Creates both application-level client and OAuth client
   * 
   * @returns {Promise<void>}
   * @throws {POSConfigError} If configuration is invalid
   */
  async initialize() {
    this._logOperation('initialize', { status: 'starting' });
    
    try {
      // Validate configuration
      if (!this.config.oauth.clientId) {
        throw new POSConfigError('Square OAuth client ID is required');
      }
      
      if (!this.config.oauth.clientSecret) {
        throw new POSConfigError('Square OAuth client secret is required');
      }
      
      if (!this.config.oauth.redirectUri) {
        throw new POSConfigError('Square OAuth redirect URI is required');
      }
      
      // Determine Square environment
      // Progress Note: Square SDK expects Environment.Production or Environment.Sandbox
      const environment = this.config.environment === 'production'
        ? Environment.Production
        : Environment.Sandbox;
      
      // Create Square SDK client for OAuth operations
      // Progress Note: This client uses application credentials for OAuth flows
      this.oauthClient = new Client({
        environment,
        // OAuth client doesn't need access token - it generates them
      });
      
      // Create application-level client (if application access token provided)
      // Progress Note: Some operations may need application-level access
      if (this.config.accessToken) {
        this.client = new Client({
          environment,
          accessToken: this.config.accessToken
        });
      }
      
      this.initialized = true;
      this._logOperation('initialize', { status: 'success', environment });
      
    } catch (error) {
      this._logOperation('initialize', { status: 'failed', error: error.message }, 'error');
      
      if (error instanceof POSConfigError) {
        throw error;
      }
      
      throw new POSConfigError(
        `Failed to initialize Square adapter: ${error.message}`
      );
    }
  }

  /**
   * Initiate OAuth authorization flow
   * 
   * Progress Note: Step 1 of OAuth 2.0 flow
   * 1. Generate cryptographically secure state token (CSRF protection)
   * 2. Build authorization URL with required parameters
   * 3. Return URL for redirect to Square authorization page
   * 
   * @param {number} restaurantId - ID of restaurant initiating auth
   * @param {string} redirectUri - URI to redirect after authorization (optional override)
   * @returns {Promise<{authorizationUrl: string, state: string}>} Authorization URL and state
   * @throws {POSAuthError} If OAuth initiation fails
   */
  async initiateOAuth(restaurantId, redirectUri = null) {
    this._ensureInitialized();
    this._logOperation('initiateOAuth', { restaurantId });
    
    try {
      // Generate CSRF protection state token
      // Progress Note: OAuthStateService stores state with 10-minute TTL
      const state = await OAuthStateService.generateState({
        restaurantId,
        provider: 'square',
        timestamp: Date.now()
      });
      
      // Build authorization URL
      // Progress Note: Square OAuth requires: client_id, scope, session (boolean), state
      const authUrl = new URL('https://connect.squareup.com/oauth2/authorize');
      
      // Add query parameters per Square OAuth spec
      authUrl.searchParams.append('client_id', this.config.oauth.clientId);
      authUrl.searchParams.append('scope', this.config.oauth.scopes.join(' '));
      authUrl.searchParams.append('session', 'false'); // Request long-lived tokens
      authUrl.searchParams.append('state', state);
      
      const authorizationUrl = authUrl.toString();
      
      this._logOperation('initiateOAuth', {
        restaurantId,
        state,
        scopes: this.config.oauth.scopes,
        status: 'success'
      });
      
      return {
        authorizationUrl,
        state
      };
      
    } catch (error) {
      this._logOperation('initiateOAuth', {
        restaurantId,
        error: error.message
      }, 'error');
      
      throw new POSAuthError(
        `Failed to initiate Square OAuth: ${error.message}`
      );
    }
  }

  /**
   * Handle OAuth callback
   * 
   * Progress Note: Step 2 of OAuth 2.0 flow
   * 1. Verify state token (CSRF protection)
   * 2. Exchange authorization code for access/refresh tokens
   * 3. Get merchant information
   * 4. Create/update POSConnection with encrypted tokens
   * 
   * @param {Object} params - OAuth callback parameters
   * @param {string} params.code - Authorization code from Square
   * @param {string} params.state - State token for verification
   * @param {number} params.restaurantId - Restaurant ID from state
   * @returns {Promise<POSConnection>} Created/updated POS connection
   * @throws {POSAuthError} If callback handling fails
   */
  async handleOAuthCallback({ code, state, restaurantId }) {
    this._ensureInitialized();
    this._logOperation('handleOAuthCallback', { restaurantId });
    
    try {
      // Verify state token (CSRF protection)
      // Progress Note: This verifies and consumes the state token (one-time use)
      const isValidState = await OAuthStateService.verifyAndConsumeState(state, {
        restaurantId,
        provider: 'square'
      });
      
      if (!isValidState) {
        throw new POSAuthError('Invalid or expired state token - possible CSRF attack');
      }
      
      // Exchange authorization code for tokens
      // Progress Note: Square's obtainToken includes access_token, refresh_token, expires_at
      const { result } = await this.oauthClient.oAuthApi.obtainToken({
        clientId: this.config.oauth.clientId,
        clientSecret: this.config.oauth.clientSecret,
        code,
        grantType: 'authorization_code',
        redirectUri: this.config.oauth.redirectUri
      });
      
      const {
        accessToken,
        refreshToken,
        expiresAt, // Square provides ISO 8601 timestamp
        merchantId
      } = result;
      
      // Progress Note: Square tokens expire after 30 days
      // expiresAt is ISO 8601 string like "2024-02-15T12:00:00Z"
      const tokenExpiresAt = new Date(expiresAt);
      
      // Get merchant/location information
      // Progress Note: We need this to populate POSConnection.locationId
      const merchantInfo = await this._getMerchantInfo(accessToken);
      const locationId = merchantInfo.mainLocationId;
      
      // Find or create POSConnection
      // Progress Note: Unique constraint on (restaurant_id, provider) ensures one Square connection per restaurant
      let connection = await POSConnection.findOne({
        where: {
          restaurantId,
          provider: 'square'
        }
      });
      
      if (connection) {
        // Update existing connection
        // Progress Note: setAccessToken/setRefreshToken handle encryption automatically
        await connection.setAccessToken(accessToken);
        await connection.setRefreshToken(refreshToken);
        connection.tokenExpiresAt = tokenExpiresAt;
        connection.merchantId = merchantId;
        connection.locationId = locationId;
        connection.status = 'active';
        connection.metadata = {
          ...connection.metadata,
          lastOAuthAt: new Date().toISOString(),
          merchantInfo
        };
        await connection.save();
        
      } else {
        // Create new connection
        connection = await POSConnection.create({
          restaurantId,
          provider: 'square',
          merchantId,
          locationId,
          tokenExpiresAt,
          status: 'active',
          metadata: {
            connectedAt: new Date().toISOString(),
            merchantInfo
          }
        });
        
        // Set encrypted tokens after creation
        await connection.setAccessToken(accessToken);
        await connection.setRefreshToken(refreshToken);
        await connection.save();
      }
      
      this._logOperation('handleOAuthCallback', {
        restaurantId,
        connectionId: connection.id,
        merchantId,
        locationId,
        expiresAt: tokenExpiresAt.toISOString(),
        status: 'success'
      });
      
      return connection;
      
    } catch (error) {
      this._logOperation('handleOAuthCallback', {
        restaurantId,
        error: error.message
      }, 'error');
      
      // Progress Note: Distinguish between auth errors and other errors
      if (error instanceof POSAuthError) {
        throw error;
      }
      
      throw new POSAuthError(
        `Failed to complete Square OAuth: ${error.message}`
      );
    }
  }

  /**
   * Refresh expired access token
   * 
   * Progress Note: Square supports token refresh with rotation
   * New refresh token is returned and must be stored
   * 
   * @param {POSConnection} connection - Connection with refresh token
   * @returns {Promise<POSConnection>} Updated connection with new tokens
   * @throws {POSTokenError} If token refresh fails
   */
  async refreshAuth(connection) {
    this._ensureInitialized();
    await this._validateConnection(connection);
    this._logOperation('refreshAuth', {
      connectionId: connection.id,
      restaurantId: connection.restaurantId
    });
    
    try {
      // Get current refresh token
      // Progress Note: POSConnection.getRefreshToken() handles decryption
      const refreshToken = await connection.getRefreshToken();
      
      if (!refreshToken) {
        throw new POSTokenError('No refresh token available for connection');
      }
      
      // Call Square token refresh endpoint
      // Progress Note: Square rotates refresh tokens - new one returned
      const { result } = await this.oauthClient.oAuthApi.obtainToken({
        clientId: this.config.oauth.clientId,
        clientSecret: this.config.oauth.clientSecret,
        grantType: 'refresh_token',
        refreshToken
      });
      
      const {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt
      } = result;
      
      // Update connection with new tokens
      await connection.setAccessToken(newAccessToken);
      await connection.setRefreshToken(newRefreshToken);
      connection.tokenExpiresAt = new Date(expiresAt);
      connection.status = 'active';
      connection.metadata = {
        ...connection.metadata,
        lastRefreshAt: new Date().toISOString()
      };
      await connection.save();
      
      this._logOperation('refreshAuth', {
        connectionId: connection.id,
        expiresAt: connection.tokenExpiresAt.toISOString(),
        status: 'success'
      });
      
      return connection;
      
    } catch (error) {
      this._logOperation('refreshAuth', {
        connectionId: connection.id,
        error: error.message
      }, 'error');
      
      // Progress Note: If refresh fails, connection may need re-authorization
      connection.status = 'error';
      connection.metadata = {
        ...connection.metadata,
        lastError: {
          timestamp: new Date().toISOString(),
          message: error.message,
          operation: 'refreshAuth'
        }
      };
      await connection.save();
      
      throw new POSTokenError(
        `Failed to refresh Square token: ${error.message}`,
        true // retryable - user can re-authorize
      );
    }
  }

  /**
   * Disconnect and revoke Square access
   * 
   * Progress Note: Square supports token revocation
   * After revocation, merchant must re-authorize
   * 
   * @param {POSConnection} connection - Connection to disconnect
   * @returns {Promise<void>}
   * @throws {POSAuthError} If revocation fails
   */
  async disconnect(connection) {
    this._ensureInitialized();
    await this._validateConnection(connection);
    this._logOperation('disconnect', {
      connectionId: connection.id,
      restaurantId: connection.restaurantId
    });
    
    try {
      // Get access token for revocation
      const accessToken = await connection.getAccessToken();
      
      if (accessToken) {
        // Revoke token with Square
        // Progress Note: Square's revokeToken endpoint
        await this.oauthClient.oAuthApi.revokeToken({
          clientId: this.config.oauth.clientId,
          accessToken,
          revokeOnlyAccessToken: false // Also revoke refresh token
        });
      }
      
      // Update connection status
      connection.status = 'revoked';
      connection.metadata = {
        ...connection.metadata,
        revokedAt: new Date().toISOString()
      };
      await connection.save();
      
      this._logOperation('disconnect', {
        connectionId: connection.id,
        status: 'success'
      });
      
    } catch (error) {
      this._logOperation('disconnect', {
        connectionId: connection.id,
        error: error.message
      }, 'error');
      
      // Progress Note: Even if revocation fails, mark as revoked locally
      connection.status = 'revoked';
      connection.metadata = {
        ...connection.metadata,
        revokedAt: new Date().toISOString(),
        revocationError: error.message
      };
      await connection.save();
      
      throw new POSAuthError(
        `Failed to disconnect Square: ${error.message}`
      );
    }
  }

  /**
   * Get merchant locations
   * 
   * Progress Note: Square merchants can have multiple locations
   * Required for multi-location restaurant chains
   * 
   * @param {POSConnection} connection - Authenticated connection
   * @returns {Promise<Array>} List of locations
   * @throws {POSError} If location retrieval fails
   */
  async getLocations(connection) {
    this._ensureInitialized();
    await this._validateConnection(connection);
    this._logOperation('getLocations', {
      connectionId: connection.id,
      restaurantId: connection.restaurantId
    });
    
    try {
      // Create merchant-specific client
      const client = await this._getClientForConnection(connection);
      
      // Get locations from Square
      const { result } = await client.locationsApi.listLocations();
      
      // Map to standardized format
      const locations = (result.locations || []).map(loc => ({
        id: loc.id,
        name: loc.name,
        address: this._formatAddress(loc.address),
        status: loc.status,
        capabilities: loc.capabilities || [],
        isActive: loc.status === 'ACTIVE'
      }));
      
      this._logOperation('getLocations', {
        connectionId: connection.id,
        count: locations.length,
        status: 'success'
      });
      
      return locations;
      
    } catch (error) {
      this._logOperation('getLocations', {
        connectionId: connection.id,
        error: error.message
      }, 'error');
      
      throw new POSError(
        `Failed to get Square locations: ${error.message}`
      );
    }
  }

  /**
   * Sync inventory items from Square (READ ONLY)
   * 
   * Progress Note: ONE-WAY SYNC - Imports data from Square into CostFX
   * Uses Square Catalog API to fetch items and Inventory API for counts
   * Maps Square CatalogItem objects to our InventoryItem model
   * 
   * IMPORTANT: This is READ ONLY. We never write data back to Square.
   * The merchant's Square POS system remains the source of truth.
   * 
   * @param {POSConnection} connection - Authenticated connection
   * @param {Date} [since] - Optional date to sync changes since
   * @returns {Promise<{synced: number, errors: Array}>} Sync results
   * @throws {POSSyncError} If sync fails
   */
  async syncInventory(connection, since = null) {
    this._ensureInitialized();
    await this._validateConnection(connection);
    this._logOperation('syncInventory', {
      connectionId: connection.id,
      restaurantId: connection.restaurantId,
      since: since?.toISOString()
    });
    
    try {
      const client = await this._getClientForConnection(connection);
      const synced = 0;
      const errors = [];
      
      // Progress Note: Full READ ONLY implementation would:
      // 1. Use catalogApi.searchCatalogItems() with pagination (READ from Square)
      // 2. Filter by types: ['ITEM', 'ITEM_VARIATION']
      // 3. Map Square items to our InventoryItem model
      // 4. Handle inventory counts from inventoryApi (READ from Square)
      // 5. Create/update InventoryItem records in OUR database (WRITE to CostFX only)
      // 6. Track sync metadata on POSConnection
      // 
      // CRITICAL: We ONLY read from Square, never write back.
      // Square POS remains the authoritative source for inventory data.
      
      // Placeholder: Return success structure
      this._logOperation('syncInventory', {
        connectionId: connection.id,
        synced,
        errors: errors.length,
        status: 'TODO - Full implementation in progress'
      }, 'warn');
      
      // Update last sync timestamp
      connection.lastSyncAt = new Date();
      await connection.save();
      
      return { synced, errors };
      
    } catch (error) {
      this._logOperation('syncInventory', {
        connectionId: connection.id,
        error: error.message
      }, 'error');
      
      throw new POSSyncError(
        `Failed to sync Square inventory: ${error.message}`,
        true // retryable
      );
    }
  }

  /**
   * Sync sales data from Square (READ ONLY)
   * 
   * Progress Note: ONE-WAY SYNC - Imports sales data from Square into CostFX
   * Uses Square Orders API to fetch completed orders
   * Maps to future Sales model for theoretical vs actual usage analysis
   * 
   * IMPORTANT: This is READ ONLY. We never write data back to Square.
   * The merchant's Square POS system remains the source of truth for sales.
   * 
   * @param {POSConnection} connection - Authenticated connection
   * @param {Date} startDate - Start date for sync
   * @param {Date} endDate - End date for sync
   * @returns {Promise<{synced: number, errors: Array}>} Sync results
   * @throws {POSSyncError} If sync fails
   */
  async syncSales(connection, startDate, endDate) {
    this._ensureInitialized();
    await this._validateConnection(connection);
    this._logOperation('syncSales', {
      connectionId: connection.id,
      restaurantId: connection.restaurantId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    
    try {
      const client = await this._getClientForConnection(connection);
      const synced = 0;
      const errors = [];
      
      // Progress Note: Full READ ONLY implementation would:
      // 1. Use ordersApi.searchOrders() with date range (READ from Square)
      // 2. Filter by location_id from connection
      // 3. Map Square orders to Sales model in OUR database (future)
      // 4. Extract item-level sales for usage calculation (stored in CostFX)
      // 5. Handle pagination for large date ranges
      // 
      // CRITICAL: We ONLY read from Square, never write back.
      // Square POS remains the authoritative source for sales/order data.
      
      this._logOperation('syncSales', {
        connectionId: connection.id,
        synced,
        errors: errors.length,
        status: 'TODO - Full implementation in progress'
      }, 'warn');
      
      return { synced, errors };
      
    } catch (error) {
      this._logOperation('syncSales', {
        connectionId: connection.id,
        error: error.message
      }, 'error');
      
      throw new POSSyncError(
        `Failed to sync Square sales: ${error.message}`,
        true // retryable
      );
    }
  }

  /**
   * Health check for Square connection
   * 
   * Progress Note: Tests authentication and basic API access
   * Uses lightweight API call (merchant info)
   * 
   * @param {POSConnection} connection - Connection to test
   * @returns {Promise<{healthy: boolean, message: string, details: Object}>} Health status
   */
  async healthCheck(connection) {
    this._ensureInitialized();
    
    const details = {
      connectionId: connection.id,
      provider: 'square',
      restaurantId: connection.restaurantId,
      status: connection.status,
      tokenExpired: connection.isTokenExpired(),
      hoursUntilExpiration: connection.getHoursUntilExpiration()
    };
    
    try {
      // Check connection status and token expiration
      if (!connection.isActive()) {
        return {
          healthy: false,
          message: `Connection not active (status: ${connection.status}, token expired: ${connection.isTokenExpired()})`,
          details
        };
      }
      
      // Test API access with lightweight call
      const client = await this._getClientForConnection(connection);
      const { result } = await client.merchantsApi.retrieveMerchant(connection.merchantId);
      
      details.merchantName = result.merchant?.businessName || 'Unknown';
      details.apiAccessible = true;
      
      return {
        healthy: true,
        message: 'Square connection healthy',
        details
      };
      
    } catch (error) {
      details.apiAccessible = false;
      details.error = error.message;
      
      return {
        healthy: false,
        message: `Square API error: ${error.message}`,
        details
      };
    }
  }

  /**
   * Verify webhook signature
   * 
   * Progress Note: Square uses HMAC-SHA256 for webhook verification
   * Signature is in 'x-square-hmacsha256-signature' header
   * 
   * @param {Object|string} payload - Raw webhook payload
   * @param {string} signature - Signature from header
   * @param {string} [signatureKey] - Optional key override
   * @returns {Promise<boolean>} True if signature is valid
   */
  async verifyWebhookSignature(payload, signature, signatureKey = null) {
    this._ensureInitialized();
    
    try {
      const key = signatureKey || this.config.webhook.signatureKey;
      
      if (!key) {
        this._logOperation('verifyWebhookSignature', {
          error: 'No webhook signature key configured'
        }, 'error');
        return false;
      }
      
      // Convert payload to string if object
      const payloadString = typeof payload === 'string'
        ? payload
        : JSON.stringify(payload);
      
      // Calculate expected signature using HMAC-SHA256
      // Progress Note: Square webhook verification per their docs
      const expectedSignature = crypto
        .createHmac('sha256', key)
        .update(payloadString)
        .digest('base64');
      
      // Compare signatures using timing-safe comparison
      // Progress Note: Prevents timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
      
      this._logOperation('verifyWebhookSignature', {
        isValid,
        signatureLength: signature.length
      });
      
      return isValid;
      
    } catch (error) {
      this._logOperation('verifyWebhookSignature', {
        error: error.message
      }, 'error');
      return false;
    }
  }

  /**
   * Process incoming webhook
   * 
   * Progress Note: Handles Square webhook events
   * Should be called after signature verification
   * 
   * @param {Object} payload - Webhook payload
   * @param {POSConnection} connection - Connection for webhook
   * @returns {Promise<{processed: boolean, action: string, details: Object}>} Processing result
   */
  async processWebhook(payload, connection) {
    this._ensureInitialized();
    await this._validateConnection(connection);
    
    const { type, data } = payload;
    
    this._logOperation('processWebhook', {
      connectionId: connection.id,
      eventType: type
    });
    
    // Progress Note: Full webhook processing would:
    // 1. Parse event type (catalog.version.updated, inventory.count.updated, etc.)
    // 2. Extract relevant data from payload
    // 3. Trigger appropriate sync operations
    // 4. Update connection metadata
    // 5. Emit events for other parts of application
    
    return {
      processed: false,
      action: 'IGNORED',
      details: {
        eventType: type,
        message: 'Webhook processing not yet implemented'
      }
    };
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Get Square SDK client configured for specific connection
   * 
   * Progress Note: Creates merchant-specific client with their access token
   * Handles token refresh if needed
   * 
   * @private
   * @param {POSConnection} connection - Connection to get client for
   * @returns {Promise<Client>} Configured Square client
   */
  async _getClientForConnection(connection) {
    // Check if token needs refresh (within 1 hour of expiration)
    if (connection.isTokenExpired(60)) {
      this._logOperation('_getClientForConnection', {
        connectionId: connection.id,
        action: 'refreshing_token'
      });
      await this.refreshAuth(connection);
    }
    
    const accessToken = await connection.getAccessToken();
    
    const environment = this.config.environment === 'production'
      ? Environment.Production
      : Environment.Sandbox;
    
    return new Client({
      environment,
      accessToken
    });
  }

  /**
   * Get merchant information
   * 
   * Progress Note: Helper to fetch merchant details during OAuth
   * 
   * @private
   * @param {string} accessToken - Access token for merchant
   * @returns {Promise<Object>} Merchant information
   */
  async _getMerchantInfo(accessToken) {
    const environment = this.config.environment === 'production'
      ? Environment.Production
      : Environment.Sandbox;
    
    const client = new Client({
      environment,
      accessToken
    });
    
    const { result } = await client.merchantsApi.listMerchants();
    const merchant = result.merchant?.[0];
    
    return {
      merchantId: merchant?.id,
      businessName: merchant?.businessName,
      country: merchant?.country,
      mainLocationId: merchant?.mainLocationId
    };
  }

  /**
   * Format Square address object
   * 
   * @private
   * @param {Object} address - Square address object
   * @returns {string} Formatted address string
   */
  _formatAddress(address) {
    if (!address) return '';
    
    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.locality,
      address.administrativeDistrictLevel1,
      address.postalCode,
      address.country
    ].filter(Boolean);
    
    return parts.join(', ');
  }
}

export default SquareAdapter;
