/* eslint-disable camelcase */

// Migration: Create suppliers table
// Date: 2024-08-24
// Description: Core supplier management for restaurant inventory system

export const up = async function(pgm) {
  // Create status enum type
  pgm.createType('supplier_status', ['active', 'inactive', 'pending']);

  // Create suppliers table
  pgm.createTable('suppliers', {
    id: {
      type: 'serial',
      primaryKey: true,
      notNull: true
    },
    name: {
      type: 'varchar',
      notNull: true
    },
    contact_email: {
      type: 'varchar',
      notNull: false
    },
    contact_phone: {
      type: 'varchar',
      notNull: false
    },
    address: {
      type: 'text',
      notNull: false
    },
    rating: {
      type: 'decimal(3,2)',
      notNull: false,
      default: 0.0
    },
    status: {
      type: 'supplier_status',
      notNull: true,
      default: 'active'
    },
    lead_time_min_days: {
      type: 'integer',
      notNull: true,
      default: 1
    },
    lead_time_max_days: {
      type: 'integer',
      notNull: true,
      default: 7
    },
    minimum_order_value: {
      type: 'decimal(10,2)',
      notNull: true,
      default: 0.00
    },
    payment_terms: {
      type: 'varchar',
      notNull: false
    },
    notes: {
      type: 'text',
      notNull: false
    },
    restaurant_id: {
      type: 'integer',
      notNull: true,
      references: 'restaurants(id)',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
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

  // Create indexes
  pgm.createIndex('suppliers', 'restaurant_id');
  pgm.createIndex('suppliers', 'status');
};

export const down = async function(pgm) {
  pgm.dropTable('suppliers');
  pgm.dropType('supplier_status');
};
