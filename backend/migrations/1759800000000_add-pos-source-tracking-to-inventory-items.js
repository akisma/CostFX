/**
 * Migration: Add POS Source Tracking to inventory_items
 * 
 * ⚠️ CRITICAL: ES Modules - Use `export const up/down` NOT `exports.up/down`
 * 
 * Purpose: Enable tracking which POS system (Square, Toast, etc.) each inventory
 *          item originated from. Links Tier 2 (unified) ↔ Tier 1 (POS-specific).
 * 
 * Related: Issue #18 - Square-Focused Database Schema
 */

/* eslint-disable camelcase */

export const up = async (pgm) => {
  // Add POS source tracking columns
  pgm.addColumns('inventory_items', {
    source_pos_provider: {
      type: 'varchar(50)',
      notNull: false
    },
    source_pos_item_id: {
      type: 'varchar(255)',
      notNull: false
    },
    source_pos_data: {
      type: 'jsonb',
      notNull: false
    }
  });
  
  // Add constraint for valid POS providers
  pgm.addConstraint('inventory_items', 'valid_pos_provider', {
    check: "source_pos_provider IN ('square', 'toast', 'clover') OR source_pos_provider IS NULL"
  });
  
  // Index for POS source lookups: "Find inventory item by Square catalog_object_id"
  pgm.createIndex('inventory_items', 
    ['restaurant_id', 'source_pos_provider', 'source_pos_item_id'],
    {
      name: 'idx_inventory_items_pos_source',
      where: 'source_pos_provider IS NOT NULL'
    }
  );
  
  // Index for variance queries with POS filtering
  pgm.createIndex('inventory_items',
    ['restaurant_id', 'high_value_flag', 'updated_at'],
    { name: 'idx_inventory_items_variance' }
  );
  
  // Document the architecture
  pgm.sql(`
    COMMENT ON COLUMN inventory_items.source_pos_provider IS 
    'POS system this item originated from (square, toast, clover). Part of Two-Tier Architecture.';
    
    COMMENT ON COLUMN inventory_items.source_pos_item_id IS 
    'External identifier in POS system (e.g., Square catalog_object_id). Links Tier 2 → Tier 1.';
    
    COMMENT ON COLUMN inventory_items.source_pos_data IS 
    'Minimal JSONB snapshot of POS data for reference. Full data stored in POS-specific tables.';
  `);
};

export const down = async (pgm) => {
  pgm.dropIndex('inventory_items', [], { name: 'idx_inventory_items_pos_source', ifExists: true });
  pgm.dropIndex('inventory_items', [], { name: 'idx_inventory_items_variance', ifExists: true });
  pgm.dropConstraint('inventory_items', 'valid_pos_provider', { ifExists: true });
  pgm.dropColumns('inventory_items', ['source_pos_provider', 'source_pos_item_id', 'source_pos_data']);
};
