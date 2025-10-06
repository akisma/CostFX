/**
 * Migration: Create square_menu_items table
 * 
 * ⚠️ CRITICAL: ES Modules - Use `export const up/down` NOT `exports.up/down`
 * 
 * Purpose: Store Square Catalog items. Transforms to inventory_items via POSDataTransformer.
 * Architecture: Tier 1 (POS-Specific Raw Data)
 * Related: Issue #18 - Square-Focused Database Schema
 */

/* eslint-disable camelcase */

export const up = async (pgm) => {
  pgm.createTable('square_menu_items', {
    id: { type: 'serial', primaryKey: true, notNull: true },
    
    // Foreign Keys
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
    square_catalog_object_id: { type: 'varchar(255)', notNull: true, unique: true },
    square_item_id: { type: 'varchar(255)', notNull: true },
    square_location_uuid: { type: 'varchar(255)', notNull: false },
    
    // Raw API Response (CRITICAL)
    square_data: { type: 'jsonb', notNull: true },
    
    // Denormalized Fields
    name: { type: 'varchar(255)', notNull: true },
    sku: { type: 'varchar(100)', notNull: false },
    description: { type: 'text', notNull: false },
    product_type: { type: 'varchar(100)', notNull: false },
    is_taxable: { type: 'boolean', notNull: true, default: true },
    is_deleted: { type: 'boolean', notNull: true, default: false },
    
    // Pricing (cents)
    price_money_amount: { type: 'bigint', notNull: false },
    price_money_currency: { type: 'varchar(3)', notNull: true, default: 'USD' },
    
    // Categories (PostgreSQL array)
    category_ids: { type: 'text[]', notNull: false },
    
    // Sync Metadata
    last_synced_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    square_version: { type: 'bigint', notNull: false },
    
    // Timestamps
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
  });
  
  // Constraints
  pgm.addConstraint('square_menu_items', 'valid_price', {
    check: 'price_money_amount >= 0'
  });
  
  // Indexes
  pgm.createIndex('square_menu_items', 'square_catalog_object_id');
  pgm.createIndex('square_menu_items', 'pos_connection_id');
  pgm.createIndex('square_menu_items', 'restaurant_id');
  pgm.createIndex('square_menu_items', 'square_location_id');
  pgm.createIndex('square_menu_items', 'sku', { where: 'sku IS NOT NULL' });
  pgm.createIndex('square_menu_items', 'is_deleted', { where: 'is_deleted = false' });
  pgm.createIndex('square_menu_items', 'last_synced_at', { method: 'btree' });
  
  // JSONB index for efficient querying
  pgm.createIndex('square_menu_items', 'square_data', { method: 'gin' });
  
  // Documentation
  pgm.sql(`
    COMMENT ON TABLE square_menu_items IS 
    'Tier 1 (Raw POS Data): Square Catalog items. Transforms to inventory_items via POSDataTransformer.';
    
    COMMENT ON COLUMN square_menu_items.square_data IS 
    'Complete Square Catalog object. Example: { type: "ITEM", id: "...", item_data: { name, variations, ... } }';
    
    COMMENT ON COLUMN square_menu_items.square_catalog_object_id IS 
    'Square''s unique identifier. Used for inventory counts and order line items.';
  `);
};

export const down = async (pgm) => {
  pgm.dropTable('square_menu_items');
};
