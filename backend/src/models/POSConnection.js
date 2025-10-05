/**
 * POSConnection Model
 * 
 * Represents OAuth connections between restaurants and POS providers (Square, Toast, etc.)
 * 
 * Key Features:
 * 1. Encrypted token storage (never expose plaintext tokens)
 * 2. Automatic token expiration checking
 * 3. Connection health monitoring
 * 4. Provider-specific metadata storage
 * 
 * Security Design:
 * - Tokens stored encrypted in database (access_token_encrypted, refresh_token_encrypted)
 * - Helper methods (getAccessToken, setAccessToken) handle encryption/decryption
 * - toJSON() method NEVER exposes encrypted tokens (security by default)
 * 
 * Business Logic:
 * - isTokenExpired(): Check if token needs refresh (with buffer time)
 * - isActive(): Verify connection is active AND token is valid
 * - getHoursUntilExpiration(): For monitoring and alerting
 * 
 * Progress Note: Following established Sequelize patterns in codebase
 * Created: 2025-10-04
 */

import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import tokenEncryption from '../services/TokenEncryptionService.js';
import logger from '../utils/logger.js';

class POSConnection extends Model {
  /**
   * Define associations with other models
   * 
   * Relationships:
   * - belongsTo Restaurant: Each connection belongs to one restaurant
   * - hasMany SquareLocation: One connection can have multiple locations (for Square)
   * 
   * Progress Note: Association enables restaurant.getPOSConnections() queries
   * Issue #16: Added SquareLocation association for multi-location support
   */
  static associate(models) {
    POSConnection.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant',
      onDelete: 'CASCADE' // If restaurant deleted, delete its connections
    });
    
    // Square multi-location support (Issue #16)
    POSConnection.hasMany(models.SquareLocation, {
      foreignKey: 'posConnectionId',
      as: 'squareLocations',
      onDelete: 'CASCADE' // If connection deleted, delete its locations
    });
  }

  /**
   * Get decrypted access token
   * 
   * SECURITY: This is the ONLY way to access the plaintext token
   * - Token is decrypted on-demand (not stored in memory)
   * - Only use when making POS API calls
   * - Never log the returned value
   * 
   * @returns {string|null} Decrypted access token
   * 
   * Progress Note: Decryption happens here, not in controller
   */
  getAccessToken() {
    try {
      return tokenEncryption.decrypt(this.accessTokenEncrypted);
    } catch (error) {
      logger.error('[POSConnection] Failed to decrypt access token', {
        id: this.id,
        provider: this.provider,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get decrypted refresh token
   * 
   * SECURITY: Same security considerations as getAccessToken()
   * Used for token refresh operations
   * 
   * @returns {string|null} Decrypted refresh token
   * 
   * Progress Note: Some providers may not provide refresh tokens
   */
  getRefreshToken() {
    try {
      return tokenEncryption.decrypt(this.refreshTokenEncrypted);
    } catch (error) {
      logger.error('[POSConnection] Failed to decrypt refresh token', {
        id: this.id,
        provider: this.provider,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Set access token (will be automatically encrypted)
   * 
   * Usage:
   * connection.setAccessToken(plainTextToken);
   * await connection.save(); // Saves encrypted value
   * 
   * @param {string} token - Plaintext access token from OAuth response
   * 
   * Progress Note: Encryption happens automatically before database save
   */
  setAccessToken(token) {
    try {
      this.accessTokenEncrypted = tokenEncryption.encrypt(token);
    } catch (error) {
      logger.error('[POSConnection] Failed to encrypt access token', {
        id: this.id,
        provider: this.provider,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Set refresh token (will be automatically encrypted)
   * 
   * @param {string} token - Plaintext refresh token from OAuth response
   * 
   * Progress Note: Null tokens are handled gracefully (some providers don't use refresh tokens)
   */
  setRefreshToken(token) {
    if (!token) {
      this.refreshTokenEncrypted = null;
      return;
    }
    
    try {
      this.refreshTokenEncrypted = tokenEncryption.encrypt(token);
    } catch (error) {
      logger.error('[POSConnection] Failed to encrypt refresh token', {
        id: this.id,
        provider: this.provider,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if token is expired or about to expire
   * 
   * Uses buffer time (default 60 minutes) to proactively refresh tokens
   * before they actually expire. This prevents API calls with expired tokens.
   * 
   * Buffer time recommendations:
   * - 60 minutes (default): Safe for most operations
   * - 1440 minutes (24 hours): Background refresh job
   * - 0 minutes: Check actual expiration (not recommended for API calls)
   * 
   * @param {number} bufferMinutes - Minutes before expiration to consider "expired"
   * @returns {boolean} True if token is expired or will expire within buffer
   * 
   * Progress Note: Square tokens typically last 30 days, so 60-min buffer is safe
   */
  isTokenExpired(bufferMinutes = 60) {
    // No expiration timestamp means we should treat as expired
    if (!this.tokenExpiresAt) {
      return true;
    }
    
    const expiresAt = new Date(this.tokenExpiresAt);
    const now = new Date();
    const bufferMs = bufferMinutes * 60 * 1000;
    
    // Token is "expired" if expiration time minus buffer has passed
    // Example: Token expires at 3:00pm, buffer is 60 minutes
    // Token is considered expired at 2:00pm (1 hour before actual expiration)
    return (expiresAt.getTime() - now.getTime()) < bufferMs;
  }

  /**
   * Check if connection is active and token is valid
   * 
   * A connection is "active" if:
   * 1. Status is 'active' (not revoked, expired, or error)
   * 2. Token is not expired (using default buffer)
   * 
   * Use this before making API calls to ensure connection is healthy
   * 
   * @returns {boolean} True if connection is active and token is valid
   * 
   * Progress Note: Single method to check both status and token validity
   */
  isActive() {
    return this.status === 'active' && !this.isTokenExpired();
  }

  /**
   * Get time until token expiration in hours
   * 
   * Useful for:
   * - Monitoring dashboards
   * - Alert thresholds
   * - Prioritizing refresh operations
   * 
   * @returns {number} Hours until expiration (negative if already expired)
   * 
   * Progress Note: Returns negative values for expired tokens
   */
  getHoursUntilExpiration() {
    if (!this.tokenExpiresAt) {
      return 0;
    }
    
    const expiresAt = new Date(this.tokenExpiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    
    return Math.floor(diffMs / (1000 * 60 * 60));
  }

  /**
   * Override toJSON to prevent token exposure
   * 
   * SECURITY CRITICAL: This ensures encrypted tokens are NEVER
   * sent to clients or included in API responses.
   * 
   * Removed fields:
   * - accessTokenEncrypted
   * - refreshTokenEncrypted
   * 
   * Added fields:
   * - isExpired (computed boolean)
   * - hoursUntilExpiration (computed number)
   * 
   * Progress Note: Security by default - even encrypted tokens stay server-side
   */
  toJSON() {
    const values = { ...this.get() };
    
    // SECURITY: Remove encrypted tokens from JSON output
    // Even though they're encrypted, they should never leave the server
    delete values.accessTokenEncrypted;
    delete values.refreshTokenEncrypted;
    
    // Add computed fields that are safe to expose
    values.isExpired = this.isTokenExpired();
    values.hoursUntilExpiration = this.getHoursUntilExpiration();
    values.isActive = this.isActive();
    
    return values;
  }
}

/**
 * Initialize model schema
 * 
 * Field mapping matches database migration exactly:
 * - Camel case in JS (accessTokenEncrypted)
 * - Snake case in DB (access_token_encrypted)
 * - Sequelize handles transformation with underscored: true
 * 
 * Progress Note: Schema matches migration 1759612779000_create-pos-connections.js
 */
POSConnection.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  restaurantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'restaurant_id'
  },
  
  // POS provider identifier: 'square', 'toast', etc.
  provider: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: {
        args: [['square', 'toast']],
        msg: 'Provider must be one of: square, toast'
      }
    }
  },
  
  // POS provider's location/merchant ID
  locationId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'location_id'
  },
  
  // ENCRYPTED access token (never stored in plaintext)
  // Access via getAccessToken() and setAccessToken() methods
  accessTokenEncrypted: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'access_token_encrypted'
  },
  
  // ENCRYPTED refresh token (never stored in plaintext)
  // Access via getRefreshToken() and setRefreshToken() methods
  refreshTokenEncrypted: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'refresh_token_encrypted'
  },
  
  // Token expiration timestamp (ISO 8601 format)
  // Example: "2024-05-15T19:36:00Z"
  tokenExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'token_expires_at'
  },
  
  // POS provider's merchant/seller identifier
  merchantId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'merchant_id'
  },
  
  // Connection status: active, expired, revoked, error
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'active',
    validate: {
      isIn: {
        args: [['active', 'expired', 'revoked', 'error']],
        msg: 'Status must be one of: active, expired, revoked, error'
      }
    }
  },
  
  // Last successful data synchronization timestamp
  lastSyncAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_sync_at'
  },
  
  // Provider-specific metadata (JSONB)
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  }
}, {
  sequelize,
  modelName: 'POSConnection',
  tableName: 'pos_connections',
  underscored: true, // Converts camelCase to snake_case for DB
  timestamps: true   // Adds createdAt and updatedAt
});

export default POSConnection;

/**
 * Progress Note: POSConnection model complete
 * 
 * Features implemented:
 * ✅ Encrypted token storage with helper methods
 * ✅ Token expiration checking with buffer time
 * ✅ Connection health validation
 * ✅ Secure toJSON() that never exposes tokens
 * ✅ Comprehensive inline documentation
 * ✅ Validation for provider and status fields
 * ✅ JSONB metadata for provider flexibility
 * ✅ Association with Restaurant model
 * 
 * Next: Update Restaurant model to include POSConnection association
 */
