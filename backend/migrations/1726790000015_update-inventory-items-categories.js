/* eslint-disable camelcase */

// Migration: Update inventory_items table for hierarchical categories and variance thresholds
// Date: 2024-09-20
// Description: Integrate hierarchical categories and Dave's variance threshold system

export const up = async function(pgm) {
  // Add new columns for hierarchical categorization and variance management
  pgm.addColumns('inventory_items', {
    category_id: {
      type: 'integer',
      notNull: false,
      references: 'ingredient_categories(id)',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
      comment: 'Links to hierarchical category system (replaces old category enum)'
    },
    variance_threshold_quantity: {
      type: 'decimal(10,2)',
      notNull: true,
      default: 0,
      comment: 'Quantity threshold for Dave\'s variance alerts (pounds, pieces, etc.)'
    },
    variance_threshold_dollar: {
      type: 'decimal(10,2)',
      notNull: true,
      default: 50.00,
      comment: 'Dollar threshold for Dave\'s variance alerts ($50 default)'
    },
    high_value_flag: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Marks high-value items like saffron for special attention'
    },
    theoretical_yield_factor: {
      type: 'decimal(4,3)',
      notNull: true,
      default: 1.000,
      comment: 'Recipe yield efficiency factor for accurate cost calculations'
    },
    cost_per_unit_variance_pct: {
      type: 'decimal(5,2)',
      notNull: true,
      default: 10.00,
      comment: 'Acceptable cost variance percentage before alert (10% default)'
    }
  });

  // Create indexes for performance on new columns
  pgm.createIndex('inventory_items', 'category_id');
  pgm.createIndex('inventory_items', 'high_value_flag');
  pgm.createIndex('inventory_items', 'variance_threshold_dollar');
  pgm.createIndex('inventory_items', 'variance_threshold_quantity');
  
  // Composite indexes for Dave's variance queries
  pgm.createIndex('inventory_items', ['restaurant_id', 'high_value_flag']);
  pgm.createIndex('inventory_items', ['category_id', 'high_value_flag']);
  pgm.createIndex('inventory_items', ['variance_threshold_dollar', 'high_value_flag']);
  
  // Add constraint to ensure reasonable threshold values
  pgm.addConstraint('inventory_items', 'check_positive_thresholds', {
    check: 'variance_threshold_quantity >= 0 AND variance_threshold_dollar >= 0'
  });
  
  // Add constraint for yield factor (should be between 0.1 and 2.0)
  pgm.addConstraint('inventory_items', 'check_yield_factor_range', {
    check: 'theoretical_yield_factor >= 0.100 AND theoretical_yield_factor <= 2.000'
  });
  
  // Add constraint for cost variance percentage (0-100%)
  pgm.addConstraint('inventory_items', 'check_cost_variance_pct', {
    check: 'cost_per_unit_variance_pct >= 0 AND cost_per_unit_variance_pct <= 100'
  });

  // Migration note: The old 'category' enum column will be deprecated in favor of category_id
  // This allows for a gradual migration where both can exist temporarily
  pgm.sql(`
    COMMENT ON COLUMN inventory_items.category IS 'DEPRECATED: Use category_id instead. Will be removed in future migration.';
  `);
};

export const down = async function(pgm) {
  // Remove constraints first
  pgm.dropConstraint('inventory_items', 'check_positive_thresholds');
  pgm.dropConstraint('inventory_items', 'check_yield_factor_range');
  pgm.dropConstraint('inventory_items', 'check_cost_variance_pct');
  
  // Remove the new columns
  pgm.dropColumns('inventory_items', [
    'category_id',
    'variance_threshold_quantity',
    'variance_threshold_dollar',
    'high_value_flag',
    'theoretical_yield_factor',
    'cost_per_unit_variance_pct'
  ]);
  
  // Remove the deprecation comment
  pgm.sql(`
    COMMENT ON COLUMN inventory_items.category IS NULL;
  `);
};
