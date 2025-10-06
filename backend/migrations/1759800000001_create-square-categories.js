/**
 * Migration: Create square_categories table
 * 
 * ⚠️ CRITICAL: ES Modules - Use `export const up/down` NOT `exports.up/down`
 * 
 * Purpose: Store Square Catalog categories. Maps to ingredient_categories via POSDataTransformer.
 * Architecture: Tier 1 (POS-Specific Raw Data)
 * Related: Issue #18 - Square-Focused Database Schema
 */

/* eslint-disable camelcase */

export const up = async (pgm) => {
  pgm.createTable('square_categories', {
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
    
    // Square API Identifiers
    square_catalog_object_id: { type: 'varchar(255)', notNull: true, unique: true },
    square_category_id: { type: 'varchar(255)', notNull: true },
    
    // Raw API Response (CRITICAL)
    square_data: { type: 'jsonb', notNull: true },
    
    // Denormalized Fields
    name: { type: 'varchar(255)', notNull: true },
    is_deleted: { type: 'boolean', notNull: true, default: false },
    
    // Sync Metadata
    last_synced_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    square_version: { type: 'bigint', notNull: false },
    
    // Timestamps
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
  });
  
  // Indexes
  pgm.createIndex('square_categories', 'square_catalog_object_id');
  pgm.createIndex('square_categories', 'pos_connection_id');
  pgm.createIndex('square_categories', 'restaurant_id');
  pgm.createIndex('square_categories', 'name');
  pgm.createIndex('square_categories', 'is_deleted', { where: 'is_deleted = false' });
  
  // Documentation
  pgm.sql(`
    COMMENT ON TABLE square_categories IS 
    'Tier 1 (Raw POS Data): Square Catalog categories. Maps to ingredient_categories via POSDataTransformer.';
    
    COMMENT ON COLUMN square_categories.square_data IS 
    'Complete Square API response. Example: { type: "CATEGORY", id: "...", category_data: { name: "Proteins" } }';
  `);
};

export const down = async (pgm) => {
  pgm.dropTable('square_categories');
};
