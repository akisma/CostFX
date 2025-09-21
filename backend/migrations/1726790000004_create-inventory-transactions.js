/* eslint-disable camelcase */

// Migration: Create inventory_transactions table
// Date: 2024-08-24
// Description: Core inventory transaction tracking for restaurant inventory management

export const up = async function(pgm) {
  // Create transaction type enum
  pgm.createType('transaction_type', ['purchase', 'usage', 'waste', 'adjustment', 'transfer']);

  // Create inventory_transactions table
  pgm.createTable('inventory_transactions', {
    id: {
      type: 'serial',
      primaryKey: true,
      notNull: true
    },
    restaurant_id: {
      type: 'integer',
      notNull: true,
      references: 'restaurants(id)',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    inventory_item_id: {
      type: 'integer',
      notNull: true,
      references: 'inventory_items(id)',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    transaction_type: {
      type: 'transaction_type',
      notNull: true
    },
    quantity: {
      type: 'decimal(10,2)',
      notNull: true,
      comment: 'Positive for additions (purchase, adjustments up), negative for reductions (usage, waste, adjustments down)'
    },
    unit_cost: {
      type: 'decimal(10,2)',
      notNull: false,
      comment: 'Cost per unit at time of transaction'
    },
    transaction_date: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    reference: {
      type: 'varchar',
      notNull: false,
      comment: 'Reference number (PO number, invoice number, etc.)'
    },
    notes: {
      type: 'text',
      notNull: false
    },
    performed_by: {
      type: 'varchar',
      notNull: false,
      comment: 'User who performed the transaction'
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Create indexes for better performance
  pgm.createIndex('inventory_transactions', 'restaurant_id');
  pgm.createIndex('inventory_transactions', 'inventory_item_id');
  pgm.createIndex('inventory_transactions', 'transaction_type');
  pgm.createIndex('inventory_transactions', 'transaction_date');
  pgm.createIndex('inventory_transactions', 'reference');
  
  // Composite indexes for common queries
  pgm.createIndex('inventory_transactions', ['restaurant_id', 'transaction_type']);
  pgm.createIndex('inventory_transactions', ['restaurant_id', 'transaction_date']);
  pgm.createIndex('inventory_transactions', ['inventory_item_id', 'transaction_date']);
};

export const down = async function(pgm) {
  pgm.dropTable('inventory_transactions');
  pgm.dropType('transaction_type');
};
