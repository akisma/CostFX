/**
 * Migration: Create square_locations Table
 * 
 * Purpose: Store Square-specific location data for multi-location restaurant support
 * 
 * Progress Note: Issue #16 - Square OAuth Authentication Service
 * Extends pos_connections with Square location details for multi-location chains
 * 
 * Dependencies:
 * - pos_connections table (from 1759612779000_create-pos-connections.js)
 * 
 * Square Location Features:
 * - Links to pos_connections (one connection can have multiple locations)
 * - Stores Square location metadata (name, address, capabilities)
 * - Tracks sync status per location
 * - Enables location-specific inventory and sales sync
 */

/**
 * Create square_locations table
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE square_locations (
      id SERIAL PRIMARY KEY,
      
      -- Foreign key to pos_connections
      pos_connection_id INTEGER NOT NULL REFERENCES pos_connections(id) ON DELETE CASCADE,
      
      -- Square location identification
      location_id VARCHAR(255) NOT NULL,
      location_name VARCHAR(255) NOT NULL,
      
      -- Location details
      address JSONB,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      capabilities JSONB DEFAULT '[]'::jsonb,
      
      -- Sync control
      sync_enabled BOOLEAN NOT NULL DEFAULT true,
      last_sync_at TIMESTAMPTZ,
      
      -- Additional metadata from Square
      metadata JSONB DEFAULT '{}'::jsonb,
      
      -- Timestamps
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      
      -- Ensure unique location per connection
      CONSTRAINT unique_connection_location UNIQUE (pos_connection_id, location_id)
    );
    
    COMMENT ON TABLE square_locations IS 'Square POS location data - supports multi-location restaurant chains';
    COMMENT ON COLUMN square_locations.pos_connection_id IS 'Link to pos_connections table';
    COMMENT ON COLUMN square_locations.location_id IS 'Square location ID from Square API';
    COMMENT ON COLUMN square_locations.location_name IS 'Square location name (e.g., "Main Street Store")';
    COMMENT ON COLUMN square_locations.address IS 'Location address as JSON (street, city, state, zip, country)';
    COMMENT ON COLUMN square_locations.status IS 'Location status: active, inactive, suspended';
    COMMENT ON COLUMN square_locations.capabilities IS 'Square location capabilities (e.g., ["CREDIT_CARD_PROCESSING", "AUTOMATIC_TRANSFERS"])';
    COMMENT ON COLUMN square_locations.sync_enabled IS 'Whether to sync inventory/sales for this location';
    COMMENT ON COLUMN square_locations.last_sync_at IS 'Last successful data sync timestamp';
    COMMENT ON COLUMN square_locations.metadata IS 'Additional Square location metadata (business hours, timezone, etc.)';
  `);
  
  // Index: Find all locations for a connection (most common query)
  pgm.createIndex('square_locations', 'pos_connection_id', {
    name: 'idx_square_locations_connection'
  });
  
  // Index: Find locations by Square location ID
  pgm.createIndex('square_locations', 'location_id', {
    name: 'idx_square_locations_location_id'
  });
  
  // Index: Find active locations for sync
  pgm.createIndex('square_locations', ['status', 'sync_enabled'], {
    name: 'idx_square_locations_sync_status',
    where: 'sync_enabled = true AND status = \'active\''
  });
  
  // Index: Find locations needing sync (partial index for performance)
  pgm.createIndex('square_locations', 'last_sync_at', {
    name: 'idx_square_locations_last_sync',
    where: 'sync_enabled = true'
  });
};

/**
 * Drop square_locations table
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('square_locations', { cascade: true });
};
