/**
 * Migration: Create square_order_items table
 * 
 * ⚠️ CRITICAL: ES Modules - Use `export const up/down` NOT `exports.up/down`
 * 
 * Purpose: Store individual line items from Square orders (denormalized for performance).
 * Architecture: Tier 1 (POS-Specific Raw Data)
 * Related: Issue #18 - Square-Focused Database Schema, Issue #21 - Sales Data Sync
 */

/* eslint-disable camelcase */

export const up = async (pgm) => {
  pgm.createTable('square_order_items', {
    id: { type: 'serial', primaryKey: true, notNull: true },
    
    // Foreign Keys
    square_order_id: {
      type: 'integer',
      notNull: true,
      references: 'square_orders',
      onDelete: 'CASCADE'
    },
    square_menu_item_id: {
      type: 'integer',
      notNull: false,
      references: 'square_menu_items',
      onDelete: 'SET NULL'
    },
    restaurant_id: {
      type: 'integer',
      notNull: true,
      references: 'restaurants',
      onDelete: 'CASCADE'
    },
    
    // Square API Identifiers
    square_line_item_uid: { type: 'varchar(255)', notNull: true },
    square_catalog_object_id: { type: 'varchar(255)', notNull: false },
    square_variation_id: { type: 'varchar(255)', notNull: false },
    
    // Raw Line Item Data
    line_item_data: { type: 'jsonb', notNull: true },
    
    // Denormalized Fields
    name: { type: 'varchar(255)', notNull: true },
    variation_name: { type: 'varchar(255)', notNull: false },
    quantity: { type: 'decimal(10,3)', notNull: true },
    
    // Pricing (in cents)
    base_price_money_amount: { type: 'bigint', notNull: false },
    gross_sales_money_amount: { type: 'bigint', notNull: false },
    total_tax_money_amount: { type: 'bigint', notNull: false },
    total_discount_money_amount: { type: 'bigint', notNull: false },
    total_money_amount: { type: 'bigint', notNull: true },
    
    // Timestamps
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
  });
  
  // Constraints
  pgm.addConstraint('square_order_items', 'valid_quantity', {
    check: 'quantity > 0'
  });
  
  pgm.addConstraint('square_order_items', 'valid_total', {
    check: 'total_money_amount >= 0'
  });
  
  // Indexes
  pgm.createIndex('square_order_items', 'square_order_id');
  pgm.createIndex('square_order_items', 'square_menu_item_id');
  pgm.createIndex('square_order_items', 'restaurant_id');
  pgm.createIndex('square_order_items', 'square_catalog_object_id');
  pgm.createIndex('square_order_items', 'square_line_item_uid');
  
  // Composite index for sales analysis
  pgm.createIndex('square_order_items',
    ['restaurant_id', 'square_catalog_object_id', 'created_at'],
    { name: 'idx_square_order_items_sales' }
  );
  
  // Documentation
  pgm.sql(`
    COMMENT ON TABLE square_order_items IS 
    'Tier 1 (Raw POS Data): Denormalized Square order line items. Transforms to sales_transactions via POSDataTransformer.';
    
    COMMENT ON COLUMN square_order_items.square_catalog_object_id IS 
    'Links to square_menu_items.square_catalog_object_id. NULL for ad-hoc items (e.g., custom discounts).';
    
    COMMENT ON COLUMN square_order_items.quantity IS 
    'Quantity sold. Supports fractional values (e.g., 0.5 for half portion, 2.5 for 2.5 lbs).';
  `);
};

export const down = async (pgm) => {
  pgm.dropTable('square_order_items');
};
