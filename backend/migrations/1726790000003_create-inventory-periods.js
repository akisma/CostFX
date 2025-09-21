/* eslint-disable camelcase */

export const up = async (pgm) => {
  // Create ENUM types first
  pgm.createType('inventory_period_status', ['draft', 'active', 'closed', 'locked']);
  pgm.createType('inventory_period_type', ['daily', 'weekly', 'monthly', 'custom']);

  // Create inventory_periods table for Dave's date range analysis
  pgm.createTable('inventory_periods', {
    id: {
      type: 'serial',
      primaryKey: true,
      notNull: true
    },
    restaurant_id: {
      type: 'integer',
      notNull: true,
      references: 'Restaurants(id)',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    period_name: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'Human-readable period name (e.g., "Week 38 2025", "September 2025")'
    },
    period_start: {
      type: 'date',
      notNull: true,
      comment: 'Start date of the inventory period (inclusive)'
    },
    period_end: {
      type: 'date',
      notNull: true,
      comment: 'End date of the inventory period (inclusive)'
    },
    status: {
      type: 'inventory_period_status',
      notNull: true,
      default: 'draft',
      comment: 'Period lifecycle: draft -> active -> closed -> locked'
    },
    period_type: {
      type: 'inventory_period_type',
      notNull: true,
      default: 'weekly',
      comment: 'Type of period for grouping and analysis'
    },
    beginning_snapshot_completed: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether beginning inventory snapshot has been taken'
    },
    ending_snapshot_completed: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether ending inventory snapshot has been taken'
    },
    variance_analysis_completed: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Whether variance analysis has been run for this period'
    },
    notes: {
      type: 'text',
      notNull: false,
      comment: 'Manager notes about the period (holidays, special events, etc.)'
    },
    created_by: {
      type: 'varchar(100)',
      notNull: false,
      comment: 'User who created this period'
    },
    closed_by: {
      type: 'varchar(100)',
      notNull: false,
      comment: 'User who closed this period'
    },
    closed_at: {
      type: 'timestamp',
      notNull: false,
      comment: 'When the period was closed'
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

  // Create indexes for efficient period queries
  pgm.createIndex('inventory_periods', ['restaurant_id', 'status'], {
    name: 'idx_inventory_periods_restaurant_status'
  });

  pgm.createIndex('inventory_periods', ['restaurant_id', 'period_start', 'period_end'], {
    name: 'idx_inventory_periods_restaurant_date_range'
  });

  pgm.createIndex('inventory_periods', ['period_start', 'period_end'], {
    name: 'idx_inventory_periods_date_range'
  });

  pgm.createIndex('inventory_periods', ['status', 'period_type'], {
    name: 'idx_inventory_periods_status_type'
  });

  // Add constraint to ensure period_start < period_end
  pgm.sql(`
    ALTER TABLE inventory_periods 
    ADD CONSTRAINT chk_period_dates 
    CHECK (period_start < period_end)
  `);

  // Add constraint to prevent overlapping periods for the same restaurant
  pgm.sql(`
    CREATE UNIQUE INDEX idx_inventory_periods_no_overlap 
    ON inventory_periods (restaurant_id, period_start, period_end)
    WHERE status IN ('active', 'closed', 'locked')
  `);

  // Note: Sample data removed - should be added via API after restaurant records exist
};

export const down = async (pgm) => {
  // Drop indexes first
  pgm.dropIndex('inventory_periods', [], { name: 'idx_inventory_periods_restaurant_status' });
  pgm.dropIndex('inventory_periods', [], { name: 'idx_inventory_periods_restaurant_date_range' });
  pgm.dropIndex('inventory_periods', [], { name: 'idx_inventory_periods_date_range' });
  pgm.dropIndex('inventory_periods', [], { name: 'idx_inventory_periods_status_type' });
  
  // Drop unique constraint index
  pgm.sql('DROP INDEX IF EXISTS idx_inventory_periods_no_overlap');
  
  // Drop the table
  pgm.dropTable('inventory_periods');
  
  // Drop ENUM types
  pgm.dropType('inventory_period_status');
  pgm.dropType('inventory_period_type');
};
