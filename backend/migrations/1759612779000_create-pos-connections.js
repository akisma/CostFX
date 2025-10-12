/**
 * Migration: Create POS Connections Infrastructure
 * 
 * Purpose: Establish database schema for storing POS provider OAuth connections
 * with encrypted token storage and comprehensive audit tracking.
 * 
 * Design Decisions:
 * 1. Separate table for POS connections (not embedded in restaurants)
 *    - Allows multiple POS connections per restaurant (future-proofing)
 *    - Keeps sensitive OAuth data isolated
 *    - Easier to manage token lifecycle independently
 * 
 * 2. Encrypted token storage
 *    - access_token_encrypted: AES-256-GCM encrypted access token
 *    - refresh_token_encrypted: AES-256-GCM encrypted refresh token
 *    - Never store tokens in plaintext
 * 
 * 3. Comprehensive metadata
 *    - token_expires_at: ISO 8601 timestamp (not duration)
 *    - last_sync_at: Track last successful data synchronization
 *    - metadata: JSONB for provider-specific data
 *    - status: Track connection health
 * 
 * 4. Indexing strategy
 *    - Primary index on restaurant_id (most common query)
 *    - Unique index on (restaurant_id, provider) - one provider per restaurant
 *    - Index on status for monitoring queries
 * 
 * Progress Note: Database schema follows Square OAuth best practices
 * Created: 2025-10-04
 * Timestamp: 1759612779
 */

/**
 * Apply migration (UP)
 * 
 * Creates:
 * 1. pos_connections table with encrypted token storage
 * 2. Appropriate indexes for query performance
 * 3. pos_provider column in restaurants table
 */
export const up = async (pgm) => {
  // Create POS connections table
  // This stores OAuth credentials and connection state for each restaurant's POS integration
  pgm.createTable('pos_connections', {
    // Primary key
    id: 'id',
    
    // Foreign key to restaurants
    // CASCADE delete: If restaurant is deleted, delete its POS connections
    restaurant_id: {
      type: 'integer',
      notNull: true,
      references: 'restaurants',
      onDelete: 'CASCADE',
      comment: 'Foreign key to restaurants table'
    },
    
    // POS provider identifier
    // Values: 'square', 'toast', etc.
    provider: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'POS provider name (square, toast, etc.)'
    },
    
    // POS provider's location/merchant identifier
    // Square calls this location_id, Toast may use different terminology
    location_id: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'POS provider location or merchant identifier'
    },
    
    // ENCRYPTED access token (never store plaintext!)
    // Encrypted using AES-256-GCM in TokenEncryptionService
    // Format: iv:authTag:ciphertext
    access_token_encrypted: {
      type: 'text',
      notNull: true,
      comment: 'AES-256-GCM encrypted OAuth access token'
    },
    
    // ENCRYPTED refresh token (never store plaintext!)
    // Some providers (like Square) provide refresh tokens
    // Others may use different token refresh mechanisms
    refresh_token_encrypted: {
      type: 'text',
      notNull: false,
      comment: 'AES-256-GCM encrypted OAuth refresh token (if provided by POS)'
    },
    
    // Token expiration timestamp
    // ISO 8601 format (e.g., "2024-05-15T19:36:00Z")
    // Square provides this in OAuth response as 'expires_at'
    // We store as timestamp to enable queries like "tokens expiring in 24 hours"
    token_expires_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'Token expiration timestamp (ISO 8601 format from POS provider)'
    },
    
    // POS provider's merchant/seller identifier
    // Square calls this merchant_id
    // Used for API calls and webhook verification
    merchant_id: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'POS provider merchant or seller identifier'
    },
    
    // Connection status tracking
    // Values:
    // - 'active': Connection working, token valid
    // - 'expired': Token expired, needs refresh
    // - 'revoked': Token revoked by merchant or system
    // - 'error': Connection error, manual intervention needed
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'active',
      comment: 'Connection status: active, expired, revoked, error'
    },
    
    // Last successful synchronization timestamp
    // Tracks when we last successfully pulled data from POS
    // Used for:
    // - Monitoring sync health
    // - Incremental sync queries (updatedAfter parameter)
    // - Alerting on stale data
    last_sync_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'Timestamp of last successful data synchronization'
    },
    
    // Provider-specific metadata (JSONB for flexibility)
    // Examples:
    // - Square: { scopes: [...], is_sandbox: false }
    // - Toast: { restaurant_guid: "...", management_group_guid: "..." }
    // - Custom sync settings, feature flags, etc.
    metadata: {
      type: 'jsonb',
      notNull: false,
      default: '{}',
      comment: 'Provider-specific metadata and configuration'
    },
    
    // Standard audit timestamps
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
      comment: 'Record creation timestamp'
    },
    
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
      comment: 'Record last update timestamp'
    }
  });

  // Create indexes for query performance
  
  // Index on restaurant_id (most common query: "get POS connections for restaurant")
  pgm.createIndex('pos_connections', 'restaurant_id', {
    name: 'idx_pos_connections_restaurant_id',
    comment: 'Fast lookups by restaurant'
  });
  
  // Unique index on (restaurant_id, provider)
  // Business rule: One connection per provider per restaurant
  // This prevents duplicate connections and enforces data integrity
  pgm.createIndex('pos_connections', ['restaurant_id', 'provider'], {
    unique: true,
    name: 'idx_pos_connections_restaurant_provider_unique',
    comment: 'Enforce one connection per provider per restaurant'
  });
  
  // Index on status for monitoring queries
  // Used for: "find all expired connections", "count active connections", etc.
  pgm.createIndex('pos_connections', 'status', {
    name: 'idx_pos_connections_status',
    comment: 'Fast filtering by connection status'
  });
  
  // Index on token_expires_at for proactive refresh
  // Used for: "find tokens expiring in next 24 hours"
  // This enables background job to proactively refresh tokens
  pgm.createIndex('pos_connections', 'token_expires_at', {
    name: 'idx_pos_connections_token_expires_at',
    comment: 'Find tokens needing refresh'
  });

  // Add pos_provider column to restaurants table
  // This denormalizes the provider for quick access without JOIN
  // Trade-off: Slight redundancy for significant query performance
  pgm.addColumn('restaurants', {
    pos_provider: {
      type: 'varchar(50)',
      notNull: false,
      comment: 'Active POS provider for this restaurant (denormalized for performance)'
    }
  });
  
  // Create index on restaurants.pos_provider for filtering
  pgm.createIndex('restaurants', 'pos_provider', {
    name: 'idx_restaurants_pos_provider',
    comment: 'Fast filtering of restaurants by POS provider'
  });

  // Add table comment
  pgm.sql(`
    COMMENT ON TABLE pos_connections IS 'OAuth connections to POS providers with encrypted token storage. Supports multiple POS providers per restaurant with automatic token refresh.'
  `);
};

/**
 * Rollback migration (DOWN)
 * 
 * Removes:
 * 1. pos_connections table (CASCADE drops indexes automatically)
 * 2. pos_provider column from restaurants table
 * 
 * WARNING: This destroys all POS connection data!
 * In production, consider archiving data before rollback.
 */
export const down = async (pgm) => {
  // Drop pos_provider column from restaurants
  pgm.dropColumn('restaurants', 'pos_provider');
  
  // Drop pos_connections table
  // This automatically drops all indexes on the table
  pgm.dropTable('pos_connections');
};

/**
 * Progress Note: Database migration complete
 * 
 * Schema features:
 * ✅ Encrypted token storage
 * ✅ Comprehensive audit fields
 * ✅ Performance-optimized indexes
 * ✅ Provider-agnostic design
 * ✅ Support for token refresh workflows
 * ✅ JSONB for provider-specific metadata
 * ✅ CASCADE deletes for data integrity
 * ✅ Extensive inline documentation
 * 
 * Next: Create POSConnection Sequelize model
 */
