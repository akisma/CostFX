/**
 * Migration: Create CSV upload metadata tables
 *
 * Purpose: Persist CSV upload validation results for multi-step transformation workflow
 * Related: Issue #47 - CSV Upload for Inventory & Sales Data Import
 */

export const up = async (pgm) => {
  pgm.createTable('csv_uploads', {
    id: { type: 'serial', primaryKey: true, notNull: true },
    restaurant_id: {
      type: 'integer',
      notNull: true,
      references: 'restaurants',
      onDelete: 'CASCADE'
    },
    upload_type: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'Inventory or sales CSV upload'
    },
    filename: { type: 'varchar(255)', notNull: true },
    file_size_bytes: { type: 'integer', notNull: true },
    mime_type: { type: 'varchar(100)', notNull: true },
    extension: { type: 'varchar(10)', notNull: true },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'uploaded',
      comment: 'uploaded | validated | failed | transformed'
    },
    rows_total: { type: 'integer', notNull: true, default: 0 },
    rows_valid: { type: 'integer', notNull: true, default: 0 },
    rows_invalid: { type: 'integer', notNull: true, default: 0 },
    validation_errors: {
      type: 'jsonb',
      notNull: false,
      comment: 'Aggregated validation error summary with counts'
    },
    metadata: {
      type: 'jsonb',
      notNull: false,
      comment: 'Optional metadata (e.g., column headers, sample rows)'
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
  });

  pgm.addConstraint('csv_uploads', 'csv_uploads_upload_type_check', {
    check: "upload_type IN ('inventory', 'sales')"
  });

  pgm.createTable('csv_upload_batches', {
    id: { type: 'serial', primaryKey: true, notNull: true },
    upload_id: {
      type: 'integer',
      notNull: true,
      references: 'csv_uploads',
      onDelete: 'CASCADE'
    },
    batch_index: { type: 'integer', notNull: true, comment: 'Zero-based batch index' },
    rows_total: { type: 'integer', notNull: true, default: 0 },
    rows_valid: { type: 'integer', notNull: true, default: 0 },
    rows_invalid: { type: 'integer', notNull: true, default: 0 },
    rows: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'[]'::jsonb"),
      comment: 'Validated CSV rows for this batch'
    },
    errors: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'[]'::jsonb"),
      comment: 'Row-level validation errors for this batch'
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') }
  });

  pgm.addConstraint('csv_upload_batches', 'csv_upload_batches_unique_batch', {
    unique: ['upload_id', 'batch_index']
  });

  pgm.createIndex('csv_uploads', ['restaurant_id', 'upload_type']);
  pgm.createIndex('csv_uploads', ['status']);
  pgm.createIndex('csv_uploads', ['created_at']);
};

export const down = async (pgm) => {
  pgm.dropTable('csv_upload_batches');
  pgm.dropTable('csv_uploads');
};
