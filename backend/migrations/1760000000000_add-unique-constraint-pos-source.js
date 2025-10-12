/**
 * Migration: Add Unique Constraint for POS Source Tracking
 * 
 * ⚠️ CRITICAL: ES Modules - Use `export const up/down` NOT `exports.up/down`
 * 
 * Purpose: Add UNIQUE constraint on (restaurant_id, source_pos_provider, source_pos_item_id)
 *          to enable Sequelize upsert operations for POS data transformation.
 * 
 * Context: The original migration 1759800000000 added an INDEX but not a UNIQUE constraint.
 *          Sequelize's upsert() requires a unique constraint on conflictFields.
 * 
 * Related: Issue #15 - Multi-POS Architecture, POSDataTransformer upsert operations
 */

/* eslint-disable camelcase */

export const up = async (pgm) => {
  // Add unique constraint for POS source tracking
  // This enables upsert operations: "Update if this POS item exists, otherwise insert"
  pgm.addConstraint('inventory_items', 'unique_pos_source', {
    unique: ['restaurant_id', 'source_pos_provider', 'source_pos_item_id']
  });
  
  pgm.sql(`
    COMMENT ON CONSTRAINT unique_pos_source ON inventory_items IS 
    'Ensures one inventory item per POS source. Enables upsert: (restaurant, provider, external_id) uniquely identifies an item.';
  `);
};

export const down = async (pgm) => {
  pgm.dropConstraint('inventory_items', 'unique_pos_source', { ifExists: true });
};
