/**
 * Migration: Create square_inventory_counts table
 * 
 * ⚠️ CRITICAL: ES Modules - Use `export const up/down` NOT `exports.up/down`
 * 
 * Purpose: Store inventory count snapshots from Square Inventory API.
 * Architecture: Tier 1 (POS-Specific Raw Data)
 * Related: Issue #18 - Square-Focused Database Schema
 */

/* eslint-disable camelcase */

export const up = async (pgm) => {
  pgm.createTable('square_inventory_counts', {
    id: { type: 'serial', primaryKey: true, notNull: true },
    
    // Foreign Keys
    square_menu_item_id: {
      type: 'integer',
      notNull: true,
      references: 'square_menu_items',
      onDelete: 'CASCADE'
    },
    pos_connection_id: {
      type: 'integer',
      notNull: true,
      references: 'pos_connections',
      onDelete: 'CASCADE'
    },
    restaurant_id: {
      type: 'integer',
      notNull: true,
      references: 'restaurants',
      onDelete: 'CASCADE'
    },
    square_location_id: {
      type: 'integer',
      notNull: false,
      references: 'square_locations',
      onDelete: 'SET NULL'
    },
    
    // Square API Identifiers
    square_catalog_object_id: { type: 'varchar(255)', notNull: true },
    square_state: { type: 'varchar(50)', notNull: true },
    square_location_uuid: { type: 'varchar(255)', notNull: false },
    
    // Raw API Response (CRITICAL)
    square_data: { type: 'jsonb', notNull: true },
    
    // Denormalized Fields
    quantity: { type: 'decimal(10,3)', notNull: true },
    calculated_at: { type: 'timestamptz', notNull: true },
    
    // Sync Metadata
    snapshot_date: { type: 'timestamptz', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
  });
  
  // Constraints
  pgm.addConstraint('square_inventory_counts', 'valid_quantity', {
    check: 'quantity >= 0'
  });
  
  pgm.addConstraint('square_inventory_counts', 'valid_state', {
    check: `square_state IN (
      'IN_STOCK', 'SOLD', 'RETURNED_BY_CUSTOMER', 'RESERVED_FOR_SALE',
      'SOLD_ONLINE', 'ORDERED_FROM_VENDOR', 'RECEIVED_FROM_VENDOR',
      'IN_TRANSIT_TO', 'WASTE', 'UNLINKED_RETURN', 'CUSTOM', 'COMPOSED_VARIATION_PARENT'
    )`
  });
  
  // Indexes
  pgm.createIndex('square_inventory_counts', 'square_menu_item_id');
  pgm.createIndex('square_inventory_counts', 'square_catalog_object_id');
  pgm.createIndex('square_inventory_counts', 'restaurant_id');
  pgm.createIndex('square_inventory_counts', 'square_location_id');
  pgm.createIndex('square_inventory_counts', 'square_state');
  pgm.createIndex('square_inventory_counts', 'snapshot_date', { method: 'btree' });
  pgm.createIndex('square_inventory_counts', 'calculated_at', { method: 'btree' });
  
  // Composite index for fetching latest counts
  pgm.createIndex('square_inventory_counts',
    ['square_catalog_object_id', 'square_state', 'calculated_at'],
    { name: 'idx_square_inventory_latest' }
  );
  
  // Documentation
  pgm.sql(`
    COMMENT ON TABLE square_inventory_counts IS 
    'Tier 1 (Raw POS Data): Square inventory count snapshots. Used to populate inventory_items.current_stock.';
    
    COMMENT ON COLUMN square_inventory_counts.square_state IS 
    'Square inventory state. IN_STOCK is most common. WASTE/SOLD used for usage tracking.';
    
    COMMENT ON COLUMN square_inventory_counts.calculated_at IS 
    'When Square calculated this count (from API). Different from snapshot_date (when we retrieved it).';
  `);
};

export const down = async (pgm) => {
  pgm.dropTable('square_inventory_counts');
};
