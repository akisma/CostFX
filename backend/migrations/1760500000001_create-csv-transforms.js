/* eslint-disable camelcase */

// Migration: Create csv_transforms table and expand source POS provider constraint
// Date: 2024-10-15
// Related to Issue #47 - CSV Import Pipeline (Transformation Phase)

export const up = async function(pgm) {
  // Create csv_transforms table to track transformation runs
  pgm.createTable('csv_transforms', {
    id: {
      type: 'serial',
      primaryKey: true,
      notNull: true
    },
    upload_id: {
      type: 'integer',
      notNull: true,
      references: 'csv_uploads(id)',
      onDelete: 'CASCADE'
    },
    restaurant_id: {
      type: 'integer',
      notNull: true,
      references: 'restaurants(id)',
      onDelete: 'CASCADE'
    },
    transform_type: {
      type: 'varchar(50)',
      notNull: true
    },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'processing'
    },
    dry_run: {
      type: 'boolean',
      notNull: true,
      default: false
    },
    processed_count: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    created_count: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    updated_count: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    skipped_count: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    error_count: {
      type: 'integer',
      notNull: true,
      default: 0
    },
    error_rate: {
      type: 'numeric(6,3)',
      notNull: true,
      default: 0
    },
    summary: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func('jsonb_build_object()')
    },
    errors: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func('jsonb_build_array()')
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
    },
    completed_at: {
      type: 'timestamp',
      notNull: false
    }
  });

  pgm.createIndex('csv_transforms', ['upload_id']);
  pgm.createIndex('csv_transforms', ['restaurant_id']);
  pgm.createIndex('csv_transforms', ['transform_type']);
  pgm.createIndex('csv_transforms', ['status']);

  // Update valid_pos_provider constraint to allow CSV sourced items
  pgm.dropConstraint('inventory_items', 'valid_pos_provider', { ifExists: true });
  pgm.addConstraint('inventory_items', 'valid_pos_provider', {
    check: "source_pos_provider IN ('square', 'toast', 'clover', 'csv') OR source_pos_provider IS NULL"
  });
};

export const down = async function(pgm) {
  pgm.dropConstraint('inventory_items', 'valid_pos_provider', { ifExists: true });
  pgm.addConstraint('inventory_items', 'valid_pos_provider', {
    check: "source_pos_provider IN ('square', 'toast', 'clover') OR source_pos_provider IS NULL"
  });

  pgm.dropTable('csv_transforms');
};
