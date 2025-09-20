'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create inventory_periods table for Dave's date range analysis
    await queryInterface.createTable('inventory_periods', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      restaurant_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Restaurants',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      period_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Human-readable period name (e.g., "Week 38 2025", "September 2025")'
      },
      period_start: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Start date of the inventory period (inclusive)'
      },
      period_end: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'End date of the inventory period (inclusive)'
      },
      status: {
        type: Sequelize.ENUM('draft', 'active', 'closed', 'locked'),
        allowNull: false,
        defaultValue: 'draft',
        comment: 'Period lifecycle: draft -> active -> closed -> locked'
      },
      period_type: {
        type: Sequelize.ENUM('daily', 'weekly', 'monthly', 'custom'),
        allowNull: false,
        defaultValue: 'weekly',
        comment: 'Type of period for grouping and analysis'
      },
      beginning_snapshot_completed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether beginning inventory snapshot has been taken'
      },
      ending_snapshot_completed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether ending inventory snapshot has been taken'
      },
      variance_analysis_completed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether variance analysis has been run for this period'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Manager notes about the period (holidays, special events, etc.)'
      },
      created_by: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'User who created this period'
      },
      closed_by: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'User who closed this period'
      },
      closed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the period was closed'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes for efficient period queries
    await queryInterface.addIndex('inventory_periods', {
      fields: ['restaurant_id', 'status'],
      name: 'idx_inventory_periods_restaurant_status'
    });

    await queryInterface.addIndex('inventory_periods', {
      fields: ['restaurant_id', 'period_start', 'period_end'],
      name: 'idx_inventory_periods_restaurant_date_range'
    });

    await queryInterface.addIndex('inventory_periods', {
      fields: ['period_start', 'period_end'],
      name: 'idx_inventory_periods_date_range'
    });

    await queryInterface.addIndex('inventory_periods', {
      fields: ['status', 'period_type'],
      name: 'idx_inventory_periods_status_type'
    });

    // Add constraint to ensure period_start < period_end
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_periods 
      ADD CONSTRAINT chk_period_dates 
      CHECK (period_start < period_end)
    `);

    // Add constraint to prevent overlapping periods for the same restaurant
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_inventory_periods_no_overlap 
      ON inventory_periods (restaurant_id, period_start, period_end)
      WHERE status IN ('active', 'closed', 'locked')
    `);

    // Add some sample periods for testing Dave's scenarios
    await queryInterface.bulkInsert('inventory_periods', [
      {
        restaurant_id: 1,
        period_name: 'Week 38 2025',
        period_start: '2025-09-15',
        period_end: '2025-09-21',
        status: 'closed',
        period_type: 'weekly',
        beginning_snapshot_completed: true,
        ending_snapshot_completed: true,
        variance_analysis_completed: true,
        notes: 'Normal week - good for baseline comparison',
        created_by: 'system',
        closed_by: 'dave_manager',
        closed_at: new Date('2025-09-22T08:00:00Z'),
        created_at: new Date('2025-09-14T12:00:00Z'),
        updated_at: new Date('2025-09-22T08:00:00Z')
      },
      {
        restaurant_id: 1,
        period_name: 'Week 39 2025',
        period_start: '2025-09-22',
        period_end: '2025-09-28',
        status: 'active',
        period_type: 'weekly',
        beginning_snapshot_completed: true,
        ending_snapshot_completed: false,
        variance_analysis_completed: false,
        notes: 'Current week - high saffron usage expected for special menu',
        created_by: 'dave_manager',
        created_at: new Date('2025-09-21T16:00:00Z'),
        updated_at: new Date('2025-09-21T16:00:00Z')
      },
      {
        restaurant_id: 1,
        period_name: 'September 2025',
        period_start: '2025-09-01',
        period_end: '2025-09-30',
        status: 'active',
        period_type: 'monthly',
        beginning_snapshot_completed: true,
        ending_snapshot_completed: false,
        variance_analysis_completed: false,
        notes: 'Monthly analysis for executive reporting',
        created_by: 'system',
        created_at: new Date('2025-08-31T23:00:00Z'),
        updated_at: new Date('2025-09-01T00:00:00Z')
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Drop indexes first
    await queryInterface.removeIndex('inventory_periods', 'idx_inventory_periods_restaurant_status');
    await queryInterface.removeIndex('inventory_periods', 'idx_inventory_periods_restaurant_date_range');
    await queryInterface.removeIndex('inventory_periods', 'idx_inventory_periods_date_range');
    await queryInterface.removeIndex('inventory_periods', 'idx_inventory_periods_status_type');
    
    // Drop unique constraint index
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_inventory_periods_no_overlap');
    
    // Drop the table
    await queryInterface.dropTable('inventory_periods');
    
    // Drop ENUM types
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_inventory_periods_status"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_inventory_periods_period_type"');
  }
};
