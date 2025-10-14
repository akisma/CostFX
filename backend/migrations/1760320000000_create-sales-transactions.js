/**
 * Migration: Create sales_transactions table
 * 
 * ⚠️ CRITICAL: ES Modules - Use `export const up/down` NOT `exports.up/down`
 * 
 * Purpose: Tier 2 unified sales data table (POS-agnostic)
 * Architecture: Multi-provider support (Square, Toast, Clover)
 * Related: Issue #21 - Square Sales Data Synchronization
 * 
 * Data Flow:
 *   Square Orders API → square_orders + square_order_items (Tier 1)
 *   → POSDataTransformer → sales_transactions (Tier 2)
 *   → Recipe variance analysis (Issues #41-43)
 * 
 * Query Pattern (Dave's halibut example):
 *   SELECT COUNT(*) as sales_count
 *   FROM sales_transactions
 *   WHERE inventory_item_id = ? AND transaction_date BETWEEN ? AND ?
 *   
 *   revenue_loss = variance_per_plate × sales_count
 */

/* eslint-disable camelcase */

export const up = async (pgm) => {
  pgm.createTable('sales_transactions', {
    id: { type: 'serial', primaryKey: true, notNull: true },
    
    // Foreign Keys
    restaurant_id: {
      type: 'integer',
      notNull: true,
      references: 'restaurants',
      onDelete: 'CASCADE'
    },
    inventory_item_id: {
      type: 'integer',
      notNull: false,  // NULL for unmapped items (modifiers, ad-hoc items)
      references: 'inventory_items',
      onDelete: 'SET NULL'
    },
    
    // Transaction Details
    transaction_date: { 
      type: 'timestamptz', 
      notNull: true,
      comment: 'Order closed_at timestamp from POS system'
    },
    quantity: { 
      type: 'decimal(10,2)', 
      notNull: true,
      comment: 'Quantity sold (supports fractional: 2.5 lbs, 0.5 portions)'
    },
    unit_price: { 
      type: 'decimal(10,2)', 
      notNull: false,
      comment: 'Base price per unit in dollars (converted from cents)'
    },
    total_amount: { 
      type: 'decimal(10,2)', 
      notNull: false,
      comment: 'Total line item amount in dollars (after tax/discount)'
    },
    
    // POS Source Tracking (Multi-Provider Support)
    source_pos_provider: { 
      type: 'varchar(50)', 
      notNull: true,
      comment: 'POS provider: square, toast, clover'
    },
    source_pos_order_id: { 
      type: 'varchar(255)', 
      notNull: true,
      comment: 'Order ID from POS system'
    },
    source_pos_line_item_id: { 
      type: 'varchar(255)', 
      notNull: false,
      comment: 'Unique line item ID: square-{uid}, toast-{check_id}-{item_id}'
    },
    source_pos_data: { 
      type: 'jsonb', 
      notNull: false,
      comment: 'JSONB escape hatch for provider-specific fields (modifiers, discounts, fulfillment)'
    },
    
    // Timestamps
    created_at: { 
      type: 'timestamptz', 
      notNull: true, 
      default: pgm.func('NOW()') 
    }
  });
  
  // Constraints
  pgm.addConstraint('sales_transactions', 'unique_pos_line_item', {
    unique: ['source_pos_provider', 'source_pos_line_item_id'],
    comment: 'Prevent duplicate transactions from re-sync'
  });
  
  pgm.addConstraint('sales_transactions', 'valid_quantity', {
    check: 'quantity > 0',
    comment: 'Quantity must be positive (refunds handled separately)'
  });
  
  pgm.addConstraint('sales_transactions', 'valid_amounts', {
    check: 'unit_price IS NULL OR unit_price >= 0',
    comment: 'Prices cannot be negative'
  });
  
  // Performance Indexes (Recipe Variance Query Pattern)
  
  // Primary query pattern: Filter by restaurant + date range
  pgm.createIndex('sales_transactions', 
    ['restaurant_id', 'transaction_date'],
    { 
      name: 'idx_sales_trans_restaurant_date',
      comment: 'Optimize restaurant-level date range queries'
    }
  );
  
  // Recipe variance query: Filter by inventory item + date range
  pgm.createIndex('sales_transactions',
    ['inventory_item_id', 'transaction_date'],
    { 
      name: 'idx_sales_trans_item_date',
      comment: 'Optimize item-level sales count aggregation'
    }
  );
  
  // Global date sorting/filtering
  pgm.createIndex('sales_transactions',
    'transaction_date',
    { 
      name: 'idx_sales_trans_date',
      comment: 'Optimize global date-based queries'
    }
  );
  
  // POS source tracking lookup
  pgm.createIndex('sales_transactions',
    ['source_pos_provider', 'source_pos_order_id'],
    { 
      name: 'idx_sales_trans_pos_source',
      comment: 'Optimize lookups by POS order ID'
    }
  );
  
  // Documentation
  pgm.sql(`
    COMMENT ON TABLE sales_transactions IS 
    'Tier 2: Unified sales data for recipe variance analysis. POS-agnostic format supports Square, Toast, Clover.';
    
    COMMENT ON COLUMN sales_transactions.inventory_item_id IS 
    'Links to inventory_items via source_pos_item_id mapping. NULL for unmapped items (modifiers, custom line items).';
    
    COMMENT ON COLUMN sales_transactions.source_pos_line_item_id IS 
    'Unique identifier for deduplication across syncs. Format: square-{line_item_uid}, toast-{check_id}-{item_id}.';
    
    COMMENT ON COLUMN sales_transactions.source_pos_data IS 
    'JSONB escape hatch preserves provider-specific data not in core schema (modifiers, discounts, fulfillment details).';
  `);
};

export const down = async (pgm) => {
  pgm.dropTable('sales_transactions');
};
