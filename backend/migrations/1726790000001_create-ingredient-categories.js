/* eslint-disable camelcase */

export const up = async (pgm) => {
  // Enable ltree extension for hierarchical paths - must be outside transaction
  pgm.noTransaction = true;
  pgm.sql('CREATE EXTENSION IF NOT EXISTS ltree;');

  // Create ingredient_categories table with hierarchical support
  pgm.createTable('ingredient_categories', {
    id: {
      type: 'serial',
      primaryKey: true,
      notNull: true
    },
    name: {
      type: 'varchar(100)',
      notNull: true
    },
    path: {
      type: 'ltree',
      notNull: true,
      unique: true,
      comment: 'Hierarchical path using PostgreSQL ltree (e.g., produce.leafy_greens.romaine)'
    },
    description: {
      type: 'text',
      notNull: false
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true
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

  // Create indexes for efficient hierarchical queries
  pgm.createIndex('ingredient_categories', 'path', {
    method: 'gist',
    name: 'idx_ingredient_categories_path'
  });
  
  pgm.createIndex('ingredient_categories', 'path', {
    name: 'idx_ingredient_categories_path_ancestors'
  });
  
  pgm.createIndex('ingredient_categories', 'name', {
    name: 'idx_ingredient_categories_name'
  });

  // Add basic seed data for Dave's use case: produce → leafy_greens → romaine
  pgm.sql(`
    INSERT INTO ingredient_categories (name, path, description, created_at, updated_at) VALUES
      ('Produce', 'produce', 'Fresh fruits and vegetables', current_timestamp, current_timestamp),
      ('Leafy Greens', 'produce.leafy_greens', 'Lettuce, spinach, kale, and other leafy vegetables', current_timestamp, current_timestamp),
      ('Romaine Lettuce', 'produce.leafy_greens.romaine', 'Romaine lettuce - low value, high volume item', current_timestamp, current_timestamp),
      ('Spices & Seasonings', 'spices', 'Herbs, spices, and seasoning ingredients', current_timestamp, current_timestamp),
      ('Premium Spices', 'spices.premium', 'High-value specialty spices and seasonings', current_timestamp, current_timestamp),
      ('Saffron', 'spices.premium.saffron', 'Saffron threads - high value, low volume item', current_timestamp, current_timestamp);
  `);
};

export const down = async (pgm) => {
  // Drop the table first
  pgm.dropTable('ingredient_categories');
  
  // Drop the extension (only if no other tables use it) - must be outside transaction
  pgm.noTransaction = true;
  pgm.sql('DROP EXTENSION IF EXISTS ltree;');
};
