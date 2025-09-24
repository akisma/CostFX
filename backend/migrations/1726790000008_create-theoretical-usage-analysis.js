/* eslint-disable camelcase */

// Migration: Create theoretical_usage_analysis table
// Date: 2024-09-20
// Description: Theoretical vs actual usage analysis for Dave's variance management system

export const up = async function(pgm) {
  // Create priority enum for Dave's variance classification
  pgm.createType('variance_priority', ['critical', 'high', 'medium', 'low']);
  
  // Create investigation status enum for workflow tracking
  pgm.createType('investigation_status', ['pending', 'investigating', 'resolved', 'accepted', 'escalated']);
  
  // Create calculation method enum
  pgm.createType('calculation_method', ['recipe_based', 'historical_average', 'manual', 'ai_predicted']);

  // Create theoretical_usage_analysis table
  pgm.createTable('theoretical_usage_analysis', {
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
      onUpdate: 'CASCADE',
      comment: 'Links to inventory period for Dave\'s date range analysis'
    },
    inventory_item_id: {
      type: 'integer',
      notNull: true,
      references: 'inventory_items(id)',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
      comment: 'Links to inventory item being analyzed'
    },
    
    // Usage calculations - core data for Dave's analysis
    theoretical_quantity: {
      type: 'decimal(10,2)',
      notNull: true,
      comment: 'Expected usage from recipes × sales data'
    },
    actual_quantity: {
      type: 'decimal(10,2)',
      notNull: true,
      comment: 'Actual usage from inventory movement between snapshots'
    },
    unit_cost: {
      type: 'decimal(10,2)',
      notNull: true,
      comment: 'Cost per unit for dollar variance calculations'
    },
    
    // Dave's dual-metric variance requirements
    variance_quantity: {
      type: 'decimal(10,2)',
      notNull: true,
      comment: 'Quantity variance (actual - theoretical)'
    },
    variance_percentage: {
      type: 'decimal(8,4)',
      notNull: false,
      comment: 'Percentage variance ((variance/theoretical) × 100)'
    },
    variance_dollar_value: {
      type: 'decimal(10,2)',
      notNull: true,
      comment: 'Dollar impact of variance (variance_quantity × unit_cost)'
    },
    
    // Dave's priority system - set by InventoryVarianceAgent business logic
    priority: {
      type: 'variance_priority',
      notNull: true,
      default: 'low',
      comment: 'Priority level determined by Dave\'s business rules'
    },
    is_significant: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether variance exceeds item-specific thresholds'
    },
    requires_investigation: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether this variance requires investigation'
    },
    
    // Investigation workflow for Dave's management process
    investigation_status: {
      type: 'investigation_status',
      notNull: true,
      default: 'pending',
      comment: 'Current investigation status'
    },
    explanation: {
      type: 'text',
      notNull: false,
      comment: 'Detailed explanation of variance causes'
    },
    assigned_to: {
      type: 'integer',
      notNull: false,
      references: 'users(id)',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'User assigned to investigate this variance'
    },
    investigated_by: {
      type: 'integer',
      notNull: false,
      references: 'users(id)',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'User who investigated this variance'
    },
    assigned_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'When investigation was assigned'
    },
    resolved_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'When investigation was resolved'
    },
    investigation_notes: {
      type: 'text',
      notNull: false,
      comment: 'Investigation findings and notes'
    },
    
    // Calculation metadata for audit trail
    calculation_method: {
      type: 'calculation_method',
      notNull: true,
      default: 'recipe_based',
      comment: 'Method used to calculate theoretical usage'
    },
    recipe_data: {
      type: 'jsonb',
      notNull: false,
      comment: 'Recipe and sales data used in calculation'
    },
    calculation_confidence: {
      type: 'decimal(3,2)',
      notNull: false,
      comment: 'Confidence score for theoretical calculation (0.0-1.0)'
    },
    calculated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
      comment: 'When theoretical usage was calculated'
    },
    
    // Standard audit fields
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

  // Create unique constraint: one analysis per item per period
  pgm.addConstraint('theoretical_usage_analysis', 'unique_period_item_analysis', {
    unique: ['period_id', 'inventory_item_id']
  });

  // Create indexes for Dave's performance queries
  pgm.createIndex('theoretical_usage_analysis', 'period_id');
  pgm.createIndex('theoretical_usage_analysis', 'inventory_item_id');
  pgm.createIndex('theoretical_usage_analysis', 'priority');
  pgm.createIndex('theoretical_usage_analysis', 'investigation_status');
  pgm.createIndex('theoretical_usage_analysis', 'variance_dollar_value');
  pgm.createIndex('theoretical_usage_analysis', 'is_significant');
  pgm.createIndex('theoretical_usage_analysis', 'requires_investigation');
  pgm.createIndex('theoretical_usage_analysis', 'assigned_to');
  pgm.createIndex('theoretical_usage_analysis', 'calculated_at');
  
  // Composite indexes for Dave's common variance analysis queries
  pgm.createIndex('theoretical_usage_analysis', ['period_id', 'priority']);
  pgm.createIndex('theoretical_usage_analysis', ['period_id', 'is_significant']);
  pgm.createIndex('theoretical_usage_analysis', ['period_id', 'investigation_status']);
  pgm.createIndex('theoretical_usage_analysis', ['priority', 'investigation_status']);
  pgm.createIndex('theoretical_usage_analysis', ['variance_dollar_value', 'priority']);
  pgm.createIndex('theoretical_usage_analysis', ['assigned_to', 'investigation_status']);
  
  // Index for Dave's high-value variance queries (absolute value)
  pgm.createIndex('theoretical_usage_analysis', 'abs(variance_dollar_value)', { 
    name: 'idx_theoretical_abs_dollar_variance' 
  });
  
  // Partial indexes for investigation workflow efficiency
  pgm.createIndex('theoretical_usage_analysis', ['period_id', 'assigned_to'], {
    name: 'idx_theoretical_pending_investigations',
    where: 'investigation_status IN (\'pending\', \'investigating\')'
  });
  
  pgm.createIndex('theoretical_usage_analysis', 'priority', {
    name: 'idx_theoretical_high_priority',
    where: 'priority IN (\'critical\', \'high\')'
  });
};

export const down = async function(pgm) {
  pgm.dropTable('theoretical_usage_analysis');
  pgm.dropType('variance_priority');
  pgm.dropType('investigation_status');
  pgm.dropType('calculation_method');
};
