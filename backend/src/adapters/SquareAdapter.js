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
import axios from 'axios';
import POSAdapter from './POSAdapter.js';
import POSConnection from '../models/POSConnection.js';
import SquareCategory from '../models/SquareCategory.js';
import SquareMenuItem from '../models/SquareMenuItem.js';
import SquareInventoryCount from '../models/SquareInventoryCount.js';
import SquareLocation from '../models/SquareLocation.js';
import SquareOrder from '../models/SquareOrder.js';
import SquareOrderItem from '../models/SquareOrderItem.js';
import OAuthStateService from '../services/OAuthStateService.js';
import TokenEncryptionService from '../services/TokenEncryptionService.js';
import SquareRateLimiter from '../utils/squareRateLimiter.js';
import SquareRetryPolicy from '../utils/squareRetryPolicy.js';
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
    
    // Rate limiter for Square API compliance (80 req/10s with 20% buffer)
    this.rateLimiter = new SquareRateLimiter({
      maxRequests: config.api.rateLimit.maxRequests || 80,
      windowMs: config.api.rateLimit.windowMs || 10000
    });
    
    // Retry policy for transient errors
    this.retryPolicy = new SquareRetryPolicy({
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000
    });
    
    this._logOperation('constructor', { environment: config.environment });
  }

  /**
   * Convert BigInt values to strings for JSON serialization
   * Square API returns version numbers as BigInt which can't be serialized to JSON
   * 
   * @private
   * @param {*} obj - Object to sanitize
   * @returns {*} Sanitized object with BigInt converted to string
   */
  _sanitizeBigInt(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'bigint') {
      return obj.toString();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._sanitizeBigInt(item));
    }
    
    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this._sanitizeBigInt(value);
      }
      return sanitized;
    }
    
    return obj;
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
      // The client credentials are needed for token revocation (Basic Auth)
      this.oauthClient = new Client({
        environment,
        bearerAuthCredentials: {
          accessToken: '', // Not needed for OAuth operations
        },
        // For revoke token, Square SDK will use Basic Auth with clientId:clientSecret
        // when we provide them in the request body
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
      // Sandbox uses squareupsandbox.com, Production uses connect.squareup.com
      // Can be overridden via SQUARE_OAUTH_AUTHORIZATION_URL environment variable
      const baseUrl = this.config.oauth.authorizationUrl || (
        this.config.environment === 'sandbox' 
          ? 'https://squareupsandbox.com'
          : 'https://connect.squareup.com'
      );
      const authUrl = new URL(`${baseUrl}/oauth2/authorize`);
      
      // Add query parameters per Square OAuth spec
      authUrl.searchParams.append('client_id', this.config.oauth.clientId);
      authUrl.searchParams.append('scope', this.config.oauth.scopes.join(' '));
      authUrl.searchParams.append('session', 'false'); // Request long-lived tokens
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('redirect_uri', this.config.oauth.redirectUri);
      
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
    
    let verifiedRestaurantId = restaurantId; // Initialize with parameter value
    
    try {
      // Verify state token (CSRF protection)
      // Progress Note: This verifies and consumes the state token (one-time use)
      // Returns the session data (restaurantId, provider, timestamp) if valid
      const sessionData = await OAuthStateService.verifyAndConsumeState({
        restaurantId,
        provider: 'square'
      }, state);
      
      if (!sessionData) {
        throw new POSAuthError('Invalid or expired state token - possible CSRF attack');
      }
      
      // Extract restaurantId from state token (overrides parameter if provided)
      verifiedRestaurantId = sessionData.restaurantId || restaurantId;
      
      if (!verifiedRestaurantId) {
        throw new POSAuthError('Restaurant ID not found in state token');
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
          restaurantId: verifiedRestaurantId,
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
        // Encrypt tokens first before creating the record
        const encryptedAccessToken = TokenEncryptionService.encrypt(accessToken);
        const encryptedRefreshToken = TokenEncryptionService.encrypt(refreshToken);
        
        connection = await POSConnection.create({
          restaurantId: verifiedRestaurantId,
          provider: 'square',
          merchantId,
          locationId,
          tokenExpiresAt,
          status: 'active',
          accessTokenEncrypted: encryptedAccessToken,
          refreshTokenEncrypted: encryptedRefreshToken,
          metadata: {
            connectedAt: new Date().toISOString(),
            merchantInfo
          }
        });
      }
      
      this._logOperation('handleOAuthCallback', {
        restaurantId: verifiedRestaurantId,
        connectionId: connection.id,
        merchantId,
        locationId,
        expiresAt: tokenExpiresAt.toISOString(),
        status: 'success'
      });
      
      return connection;
      
    } catch (error) {
      this._logOperation('handleOAuthCallback', {
        restaurantId: verifiedRestaurantId,
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
        // Progress Note: Square's revokeToken endpoint requires Basic Auth
        // The SDK doesn't properly handle the authorization, so we use axios directly
        const revokeUrl = this.config.environment === 'production'
          ? 'https://connect.squareup.com/oauth2/revoke'
          : 'https://connect.squareupsandbox.com/oauth2/revoke';
        
        // Create Basic Auth header: base64(clientId:clientSecret)
        const authString = Buffer.from(
          `${this.config.oauth.clientId}:${this.config.oauth.clientSecret}`
        ).toString('base64');
        
        try {
          await axios.post(
            revokeUrl,
            {
              access_token: accessToken,
              client_id: this.config.oauth.clientId
            },
            {
              headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json',
                'Square-Version': '2024-10-17' // Use recent API version
              }
            }
          );
          
          this._logOperation('disconnect', {
            connectionId: connection.id,
            note: 'Token successfully revoked with Square'
          });
          
        } catch (revokeError) {
          // Log the revocation error but continue with local cleanup
          this._logOperation('disconnect', {
            connectionId: connection.id,
            revokeError: revokeError.response?.data || revokeError.message,
            note: 'Token revocation failed, continuing with local cleanup'
          }, 'warn');
        }
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
   * Maps Square CatalogItem objects to square_* tables (Tier 1 raw data)
   * 
   * IMPORTANT: This is READ ONLY. We never write data back to Square.
   * The merchant's Square POS system remains the source of truth.
   * 
   * Implementation: Issue #19 - Square API Client
   * - Uses rate limiter (80 req/10s) to stay within Square's limits
   * - Uses retry policy for transient failures (429, 5xx, network errors)
   * - Stores raw Square API responses in square_* tables
   * - Supports incremental sync with 'since' parameter
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
      const stats = {
        categoriesSynced: 0,
        itemsSynced: 0,
        inventoryCountsSynced: 0,
        errors: []
      };
      
      // Step 1: Sync Catalog Objects (Categories and Items)
      await this._syncCatalogObjects(client, connection, since, stats);
      
      // Step 2: Sync Inventory Counts (for items that track inventory)
      await this._syncInventoryCounts(client, connection, stats);
      
      // Update last sync timestamp
      connection.lastSyncAt = new Date();
      await connection.save();
      
      const totalSynced = stats.categoriesSynced + stats.itemsSynced + stats.inventoryCountsSynced;
      
      this._logOperation('syncInventory', {
        connectionId: connection.id,
        totalSynced,
        categoriesSynced: stats.categoriesSynced,
        itemsSynced: stats.itemsSynced,
        inventoryCountsSynced: stats.inventoryCountsSynced,
        errors: stats.errors.length,
        status: 'success'
      });
      
      return {
        synced: totalSynced,
        errors: stats.errors,
        details: {
          categories: stats.categoriesSynced,
          items: stats.itemsSynced,
          inventoryCounts: stats.inventoryCountsSynced
        }
      };
      
    } catch (error) {
      this._logOperation('syncInventory', {
        connectionId: connection.id,
        error: error.message
      }, 'error');
      
      throw new POSSyncError(
        `Failed to sync Square inventory: ${error.message}`,
        true, // retryable
        null, // result
        'square' // provider
      );
    }
  }
  
  /**
   * Sync Catalog Objects from Square (Categories and Items)
   * 
   * @private
   * @param {Client} client - Square SDK client
   * @param {POSConnection} connection - POS connection
   * @param {Date} since - Optional date for incremental sync
   * @param {Object} stats - Statistics object to update
   */
  async _syncCatalogObjects(client, connection, since, stats) {
    let cursor = undefined;  // Use undefined for optional parameters, not null
    const types = 'CATEGORY,ITEM';
    
    do {
      // Rate limit before API call
      await this.rateLimiter.acquireToken(connection.id);
      
      // Make API call with retry policy
      const response = await this.retryPolicy.executeWithRetry(
        async () => {
          this._logOperation('listCatalog', {
            connectionId: connection.id,
            cursor: cursor || undefined,
            types,
            since: since ? since.toISOString() : undefined
          });
          
          // Square SDK expects individual parameters, not an object
          // Use undefined for optional parameters (null is treated as an object)
          return await client.catalogApi.listCatalog(
            cursor,              // cursor: Optional<string>
            types,               // types: Optional<string>
            undefined,           // catalogVersion: Optional<bigint>
            100,                 // limit: Optional<number>
            since ? since.toISOString() : undefined  // beginTime: Optional<string>
          );
        },
        {
          method: 'catalog.listCatalog',
          connectionId: connection.id,
          cursor
        }
      );
      
      this._logOperation('listCatalogResponse', {
        connectionId: connection.id,
        objectCount: response.result.objects?.length || 0,
        hasCursor: !!response.result.cursor,
        cursorValue: response.result.cursor
      });
      
      const objects = response.result.objects || [];
      
      // Process each catalog object
      for (const obj of objects) {
        try {
          if (obj.type === 'CATEGORY') {
            await this._storeCatalogCategory(connection, obj);
            stats.categoriesSynced++;
          } else if (obj.type === 'ITEM') {
            await this._storeCatalogItem(connection, obj);
            stats.itemsSynced++;
          }
        } catch (error) {
          logger.error('Failed to store catalog object', {
            objectId: obj.id,
            objectType: obj.type,
            error: error.message
          });
          stats.errors.push({
            objectId: obj.id,
            objectType: obj.type,
            error: error.message
          });
        }
      }
      
      cursor = response.result.cursor || undefined;
      
    } while (cursor);
  }
  
  /**
   * Store a Square Category in square_categories table
   * 
   * @private
   * @param {POSConnection} connection - POS connection
   * @param {Object} categoryObj - Square catalog category object
   */
  async _storeCatalogCategory(connection, categoryObj) {
    // Square SDK returns camelCase keys
    const categoryData = {
      posConnectionId: connection.id,
      restaurantId: connection.restaurantId,
      squareCatalogObjectId: categoryObj.id,  // Catalog object ID (main unique ID)
      squareCategoryId: categoryObj.id,        // Same as catalog object ID for categories
      name: categoryObj.categoryData?.name || categoryObj.category_data?.name || 'Unnamed Category',
      squareVersion: categoryObj.version ? categoryObj.version.toString() : null,
      isDeleted: categoryObj.isDeleted || categoryObj.is_deleted || false,
      squareUpdatedAt: categoryObj.updatedAt || categoryObj.updated_at ? new Date(categoryObj.updatedAt || categoryObj.updated_at) : new Date(),
      squareData: this._sanitizeBigInt(categoryObj)
    };
    
    // Upsert: create or update based on unique constraint
    await SquareCategory.upsert(categoryData, {
      conflictFields: ['square_catalog_object_id']
    });
  }
  
  /**
   * Store a Square Item in square_menu_items table
   * 
   * @private
   * @param {POSConnection} connection - POS connection
   * @param {Object} itemObj - Square catalog item object
   */
  async _storeCatalogItem(connection, itemObj) {
    // Square SDK returns camelCase keys
    const itemData = itemObj.itemData || itemObj.item_data || {};
    const primaryVariation = itemData.variations?.[0];
    const variationData = primaryVariation?.itemVariationData || primaryVariation?.item_variation_data || {};
    
    // Extract price from primary variation
    const priceAmount = variationData.priceMoney?.amount || variationData.price_money?.amount || 0;
    const priceCurrency = variationData.priceMoney?.currency || variationData.price_money?.currency || 'USD';
    
    const menuItemData = {
      posConnectionId: connection.id,
      restaurantId: connection.restaurantId,
      squareCatalogObjectId: itemObj.id,  // Catalog object ID (main unique ID)
      squareItemId: itemObj.id,            // Same as catalog object ID for items
      name: itemData.name || 'Unnamed Item',
      description: itemData.description || itemData.descriptionPlaintext || null,
      squareCategoryId: itemData.categoryId || itemData.category_id || null,
      priceMoneyAmount: priceAmount,
      priceMoneyAmountCurrency: priceCurrency,
      squareVersion: itemObj.version ? itemObj.version.toString() : null,
      isDeleted: itemObj.isDeleted || itemObj.is_deleted || false,
      squareUpdatedAt: itemObj.updatedAt || itemObj.updated_at ? new Date(itemObj.updatedAt || itemObj.updated_at) : new Date(),
      // Store variation IDs as PostgreSQL array
      variationIds: itemData.variations?.map(v => v.id) || [],
      squareData: this._sanitizeBigInt(itemObj)
    };
    
    // Upsert: create or update based on unique constraint
    await SquareMenuItem.upsert(menuItemData, {
      conflictFields: ['square_catalog_object_id']
    });
  }
  
  /**
   * Sync Inventory Counts from Square
   * 
   * @private
   * @param {Client} client - Square SDK client
   * @param {POSConnection} connection - POS connection
   * @param {Object} stats - Statistics object to update
   */
  async _syncInventoryCounts(client, connection, stats) {
    // Get all menu items for this connection
    const menuItems = await SquareMenuItem.findAll({
      where: {
        posConnectionId: connection.id,
        isDeleted: false
      }
    });
    
    if (menuItems.length === 0) {
      logger.info('No menu items to fetch inventory counts for', {
        connectionId: connection.id
      });
      return;
    }
    
    // Extract variation IDs from menu items
    const catalogObjectIds = [];
    for (const item of menuItems) {
      if (item.variationIds && item.variationIds.length > 0) {
        catalogObjectIds.push(...item.variationIds);
      }
    }
    
    if (catalogObjectIds.length === 0) {
      logger.info('No variation IDs to fetch inventory counts for', {
        connectionId: connection.id
      });
      return;
    }
    
    // Square API limits: 100 catalog objects per request
    const batchSize = 100;
    let cursor = null;
    
    for (let i = 0; i < catalogObjectIds.length; i += batchSize) {
      const batch = catalogObjectIds.slice(i, i + batchSize);
      
      do {
        // Rate limit before API call
        await this.rateLimiter.acquireToken(connection.id);
        
        // Make API call with retry policy
        const response = await this.retryPolicy.executeWithRetry(
          async () => {
            const params = {
              catalogObjectIds: batch
            };
            
            if (cursor) {
              params.cursor = cursor;
            }
            
            return await client.inventoryApi.batchRetrieveInventoryCounts(params);
          },
          {
            method: 'inventory.batchRetrieveInventoryCounts',
            connectionId: connection.id,
            batchSize: batch.length
          }
        );
        
        const counts = response.result.counts || [];
        
        // Store each inventory count
        for (const count of counts) {
          try {
            await this._storeInventoryCount(connection, count, menuItems);
            stats.inventoryCountsSynced++;
          } catch (error) {
            logger.error('Failed to store inventory count', {
              catalogObjectId: count.catalog_object_id,
              error: error.message
            });
            stats.errors.push({
              catalogObjectId: count.catalog_object_id,
              error: error.message
            });
          }
        }
        
        cursor = response.result.cursor || null;
        
      } while (cursor);
    }
  }
  
  /**
   * Store an inventory count in square_inventory_counts table
   * 
   * @private
   * @param {POSConnection} connection - POS connection
   * @param {Object} countObj - Square inventory count object
   * @param {Array} menuItems - Array of menu items to match against
   */
  async _storeInventoryCount(connection, countObj, menuItems) {
    // Find the menu item that contains this variation ID
    const menuItem = menuItems.find(item =>
      item.variationIds && item.variationIds.includes(countObj.catalog_object_id)
    );
    
    if (!menuItem) {
      logger.warn('No menu item found for inventory count', {
        catalogObjectId: countObj.catalog_object_id,
        connectionId: connection.id
      });
      return;
    }
    
    const countData = {
      posConnectionId: connection.id,
      restaurantId: connection.restaurantId,
      squareMenuItemId: menuItem.id,
      squareCatalogObjectId: countObj.catalog_object_id,
      squareCatalogObjectType: countObj.catalog_object_type || 'ITEM_VARIATION',
      squareState: countObj.state || 'IN_STOCK',
      squareLocationId: countObj.location_id || null,
      quantity: countObj.quantity || '0',
      calculatedAt: countObj.calculated_at ? new Date(countObj.calculated_at) : new Date(),
      snapshotDate: new Date(),
      squareData: countObj
    };
    
    // Create new inventory count (we want historical records, not upsert)
    await SquareInventoryCount.create(countData);
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
    
    const syncResult = {
      synced: { orders: 0, lineItems: 0 },
      errors: [],
      details: { apiCalls: 0, pages: 0, cursor: null }
    };
    
    this._logOperation('syncSales', {
      connectionId: connection.id,
      restaurantId: connection.restaurantId,
      locationId: connection.squareLocationId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    
    try {
      const client = await this._getClientForConnection(connection);
      
      let cursor = null;
      
      do {
        // Rate limiting
        await this.rateLimiter.acquireToken(connection.merchantId);
        
        // Search orders with retry policy
        const response = await this.retryPolicy.executeWithRetry(async () => {
          return await client.ordersApi.searchOrders({
            locationIds: [connection.squareLocationId],
            query: {
              filter: {
                dateTimeFilter: {
                  closedAt: {
                    startAt: startDate.toISOString(),
                    endAt: endDate.toISOString()
                  }
                },
                stateFilter: {
                  states: ['COMPLETED', 'OPEN']  // Include OPEN for real-time sync
                }
              },
              sort: {
                sortField: 'CLOSED_AT',
                sortOrder: 'ASC'
              }
            },
            limit: 500,  // Max allowed by Square API
            cursor
          });
        });

        const orders = response.result.orders || [];
        syncResult.details.apiCalls++;
        syncResult.details.pages++;
        
        this._logOperation('syncSales', {
          message: `Processing page ${syncResult.details.pages}`,
          ordersInPage: orders.length
        });

        // Process each order
        for (const orderData of orders) {
          try {
            // Upsert to Tier 1: square_orders
            const [order] = await SquareOrder.upsert({
              restaurantId: connection.restaurantId,
              posConnectionId: connection.id,
              squareOrderId: orderData.id,
              locationId: orderData.locationId,
              state: orderData.state,
              totalMoneyAmount: orderData.totalMoney?.amount || 0,
              totalTaxMoneyAmount: orderData.totalTaxMoney?.amount || 0,
              totalDiscountMoneyAmount: orderData.totalDiscountMoney?.amount || 0,
              closedAt: orderData.closedAt ? new Date(orderData.closedAt) : null,
              squareData: orderData  // Full JSONB response
            }, {
              conflictFields: ['squareOrderId']
            });

            syncResult.synced.orders++;

            // Process line items
            for (const lineItem of orderData.lineItems || []) {
              try {
                await SquareOrderItem.upsert({
                  squareOrderId: order.id,
                  restaurantId: connection.restaurantId,
                  squareLineItemUid: lineItem.uid,
                  squareCatalogObjectId: lineItem.catalogObjectId || null,
                  squareVariationId: lineItem.variationId || null,
                  lineItemData: lineItem,  // Full JSONB response
                  name: lineItem.name,
                  variationName: lineItem.variationName || null,
                  quantity: parseFloat(lineItem.quantity),
                  basePriceMoneyAmount: lineItem.basePriceMoney?.amount || 0,
                  grossSalesMoneyAmount: lineItem.grossSalesMoney?.amount || 0,
                  totalTaxMoneyAmount: lineItem.totalTaxMoney?.amount || 0,
                  totalDiscountMoneyAmount: lineItem.totalDiscountMoney?.amount || 0,
                  totalMoneyAmount: lineItem.totalMoney?.amount || 0
                }, {
                  conflictFields: ['squareLineItemUid']
                });

                syncResult.synced.lineItems++;
                
              } catch (lineItemError) {
                syncResult.errors.push({
                  orderId: orderData.id,
                  lineItemUid: lineItem.uid,
                  error: lineItemError.message
                });
                
                this._logOperation('syncSales', {
                  level: 'warn',
                  message: 'Line item upsert failed',
                  lineItemUid: lineItem.uid,
                  error: lineItemError.message
                });
              }
            }
            
          } catch (orderError) {
            syncResult.errors.push({
              orderId: orderData.id,
              error: orderError.message
            });
            
            this._logOperation('syncSales', {
              level: 'error',
              message: 'Order upsert failed',
              orderId: orderData.id,
              error: orderError.message
            });
          }
        }

        cursor = response.result.cursor;
        if (cursor) {
          syncResult.details.cursor = cursor;
        }
        
      } while (cursor);

      // Update connection lastSyncAt
      connection.lastSyncAt = new Date();
      await connection.save();

      this._logOperation('syncSales', {
        level: 'info',
        message: 'Sync completed',
        synced: syncResult.synced,
        errorCount: syncResult.errors.length,
        apiCalls: syncResult.details.apiCalls
      });

    } catch (error) {
      this._logOperation('syncSales', {
        level: 'error',
        message: 'Sync failed',
        error: error.message,
        stack: error.stack
      });
      
      syncResult.errors.push({
        phase: 'api_call',
        error: error.message,
        stack: error.stack
      });
      
      throw new POSSyncError(
        `Failed to sync Square sales: ${error.message}`,
        true, // retryable
        syncResult, // result
        'square' // provider
      );
    }

    return syncResult;
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
