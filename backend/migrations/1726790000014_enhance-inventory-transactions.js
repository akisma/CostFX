/* eslint-disable camelcase */

// Migration: Enhance inventory_transactions with period linkage and variance tracking
// Date: 2024-09-20
// Description: Add period management and variance analysis capabilities to transaction tracking

export const up = async function(pgm) {
  // Create variance category enum for better data integrity
  pgm.createType('variance_category', ['waste', 'theft', 'measurement_error', 'spoilage', 'transfer', 'adjustment', 'receiving_error', 'other']);

  // Add period linkage and variance tracking columns
  pgm.addColumns('inventory_transactions', {
    period_id: {
      type: 'integer',
      notNull: false,
      references: 'inventory_periods(id)',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'Links transaction to specific inventory period for Dave\'s variance analysis'
    },
    variance_reason: {
      type: 'varchar(255)',
      notNull: false,
      comment: 'Detailed explanation for variance adjustments'
    },
    variance_category: {
      type: 'variance_category',
      notNull: false,
      comment: 'Categorized reason for variance (waste, theft, measurement error, etc.)'
    },
    approved_by: {
      type: 'integer',
      notNull: false,
      comment: 'User ID who approved this variance transaction'
    },
    approval_date: {
      type: 'timestamp',
      notNull: false,
      comment: 'When the variance was approved'
    },
    cost_impact: {
      type: 'decimal(10,2)',
      notNull: false,
      comment: 'Dollar impact of this transaction for variance reporting'
    },
    requires_approval: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether this transaction requires management approval'
    }
  });

  // Add indexes for performance on new columns
  pgm.createIndex('inventory_transactions', 'period_id');
  pgm.createIndex('inventory_transactions', 'variance_category');
  pgm.createIndex('inventory_transactions', 'approved_by');
  pgm.createIndex('inventory_transactions', 'approval_date');
  pgm.createIndex('inventory_transactions', 'requires_approval');
  pgm.createIndex('inventory_transactions', 'cost_impact');
  
  // Composite indexes for Dave's variance analysis queries
  pgm.createIndex('inventory_transactions', ['period_id', 'variance_category']);
  pgm.createIndex('inventory_transactions', ['period_id', 'transaction_date']);
  pgm.createIndex('inventory_transactions', ['restaurant_id', 'period_id']);
  pgm.createIndex('inventory_transactions', ['variance_category', 'cost_impact']);
  
  // Add check constraint for approval logic
  pgm.addConstraint('inventory_transactions', 'check_approval_logic', {
    check: '(requires_approval = false) OR (requires_approval = true AND approved_by IS NOT NULL AND approval_date IS NOT NULL)'
  });
};

export const down = async function(pgm) {
  // Remove constraint first
  pgm.dropConstraint('inventory_transactions', 'check_approval_logic');
  
  // Remove the new columns
  pgm.dropColumns('inventory_transactions', [
    'period_id',
    'variance_reason', 
    'variance_category',
    'approved_by',
    'approval_date',
    'cost_impact',
    'requires_approval'
  ]);
  
  // Drop the enum type
  pgm.dropType('variance_category');
};
