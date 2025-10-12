/**
 * Migration: Create square_orders table
 * 
 * ⚠️ CRITICAL: ES Modules - Use `export const up/down` NOT `exports.up/down`
 * 
 * Purpose: Store complete order data from Square Orders API.
 * Architecture: Tier 1 (POS-Specific Raw Data)
 * Related: Issue #18 - Square-Focused Database Schema, Issue #21 - Sales Data Sync
 */

/* eslint-disable camelcase */

export const up = async (pgm) => {
  pgm.createTable('square_orders', {
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
    square_order_id: { type: 'varchar(255)', notNull: true, unique: true },
    square_location_uuid: { type: 'varchar(255)', notNull: false },
    
    // Raw API Response (CRITICAL)
    square_data: { type: 'jsonb', notNull: true },
    
    // Denormalized Fields
    state: { type: 'varchar(50)', notNull: false },
    source_name: { type: 'varchar(100)', notNull: false },
    
    // Timestamps (from Square)
    opened_at: { type: 'timestamptz', notNull: false },
    closed_at: { type: 'timestamptz', notNull: false },
    square_created_at: { type: 'timestamptz', notNull: true },
    square_updated_at: { type: 'timestamptz', notNull: true },
    
    // Totals (in cents)
    total_money_amount: { type: 'bigint', notNull: false },
    total_tax_money_amount: { type: 'bigint', notNull: false },
    total_discount_money_amount: { type: 'bigint', notNull: false },
    total_tip_money_amount: { type: 'bigint', notNull: false },
    total_service_charge_money_amount: { type: 'bigint', notNull: false },
    net_amount_due_money_amount: { type: 'bigint', notNull: false },
    
    // Sync Metadata
    last_synced_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    square_version: { type: 'bigint', notNull: false },
    
    // Timestamps
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
  });
  
  // Constraints
  pgm.addConstraint('square_orders', 'valid_state', {
    check: "state IN ('OPEN', 'COMPLETED', 'CANCELED')"
  });
  
  // Indexes
  pgm.createIndex('square_orders', 'square_order_id');
  pgm.createIndex('square_orders', 'pos_connection_id');
  pgm.createIndex('square_orders', 'restaurant_id');
  pgm.createIndex('square_orders', 'square_location_id');
  pgm.createIndex('square_orders', 'state');
  pgm.createIndex('square_orders', 'closed_at', { where: 'closed_at IS NOT NULL', method: 'btree' });
  pgm.createIndex('square_orders', 'square_created_at', { method: 'btree' });
  pgm.createIndex('square_orders', 'last_synced_at', { method: 'btree' });
  
  // Composite index for sales reporting
  pgm.createIndex('square_orders',
    ['restaurant_id', 'state', 'closed_at'],
    {
      name: 'idx_square_orders_sales_report',
      where: "state = 'COMPLETED' AND closed_at IS NOT NULL"
    }
  );
  
  // Documentation
  pgm.sql(`
    COMMENT ON TABLE square_orders IS 
    'Tier 1 (Raw POS Data): Square orders. Transforms to sales_transactions via POSDataTransformer (Issue #21).';
    
    COMMENT ON COLUMN square_orders.state IS 
    'OPEN: Order in progress, COMPLETED: Order finished and paid, CANCELED: Order canceled.';
    
    COMMENT ON COLUMN square_orders.closed_at IS 
    'When order was completed/paid. Used for sales reporting. NULL for OPEN orders.';
  `);
};

export const down = async (pgm) => {
  pgm.dropTable('square_orders');
};
