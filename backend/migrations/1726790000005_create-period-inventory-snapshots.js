/* eslint-disable camelcase */

// Migration: Create period_inventory_snapshots table
// Date: 2024-09-20
// Description: Period inventory snapshots for Dave's beginning/ending inventory variance analysis

export const up = async function(pgm) {
  // Create snapshot type enum
  pgm.createType('snapshot_type', ['beginning', 'ending']);

  // Create period_inventory_snapshots table
  pgm.createTable('period_inventory_snapshots', {
    id: {
      type: 'serial',
      primaryKey: true,
      notNull: true
    },
    period_id: {
      type: 'integer',
      notNull: true,
      references: 'inventory_periods(id)',
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
    snapshot_type: {
      type: 'snapshot_type',
      notNull: true
    },
    
    // Quantity and cost tracking for Dave's variance analysis
    quantity: {
      type: 'decimal(10,2)',
      notNull: true,
      comment: 'Physical count quantity for this period snapshot'
    },
    unit_cost: {
      type: 'decimal(10,2)',
      notNull: true,
      comment: 'Cost per unit at time of snapshot'
    },
    total_value: {
      type: 'decimal(10,2)',
      notNull: true,
      comment: 'Calculated as quantity * unit_cost for variance analysis'
    },
    
    // Metadata for audit trail and verification
    counted_by: {
      type: 'integer',
      notNull: false,
      comment: 'User ID who performed the physical count'
    },
    counted_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    variance_notes: {
      type: 'text',
      notNull: false,
      comment: 'Notes about any discrepancies found during count'
    },
    adjustment_reason: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'Reason for any adjustments made to the count'
    },
    verified: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether this snapshot has been verified and locked'
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

  // Create unique constraint: one snapshot per item per type per period
  pgm.addConstraint('period_inventory_snapshots', 'unique_period_item_snapshot', {
    unique: ['period_id', 'inventory_item_id', 'snapshot_type']
  });

  // Create indexes for optimal query performance
  pgm.createIndex('period_inventory_snapshots', 'period_id');
  pgm.createIndex('period_inventory_snapshots', 'inventory_item_id');
  pgm.createIndex('period_inventory_snapshots', 'snapshot_type');
  pgm.createIndex('period_inventory_snapshots', 'verified');
  pgm.createIndex('period_inventory_snapshots', 'counted_at');
  
  // Composite indexes for Dave's common variance queries
  pgm.createIndex('period_inventory_snapshots', ['period_id', 'snapshot_type']);
  pgm.createIndex('period_inventory_snapshots', ['period_id', 'verified']);
  pgm.createIndex('period_inventory_snapshots', ['inventory_item_id', 'snapshot_type']);
};

export const down = async function(pgm) {
  pgm.dropTable('period_inventory_snapshots');
  pgm.dropType('snapshot_type');
};
