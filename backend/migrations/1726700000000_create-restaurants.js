/* eslint-disable camelcase */

export const up = async (pgm) => {
  // Create restaurants table first - other tables depend on this
  pgm.createTable('restaurants', {
    id: {
      type: 'serial',
      primaryKey: true,
      notNull: true
    },
    name: {
      type: 'varchar(255)',
      notNull: true
    },
    location: {
      type: 'varchar(500)',
      notNull: false
    },
    cuisine_type: {
      type: 'varchar(100)',
      notNull: false
    },
    phone: {
      type: 'varchar(20)',
      notNull: false
    },
    email: {
      type: 'varchar(255)',
      notNull: false
    },
    settings: {
      type: 'jsonb',
      notNull: false,
      default: '{}'
    },
    is_active: {
      type: 'boolean',
      notNull: false,
      default: true
    },
    created_at: {
      type: 'timestamp',
      notNull: false,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'timestamp',
      notNull: false,
      default: pgm.func('current_timestamp')
    }
  });

  // Add indexes
  pgm.createIndex('restaurants', 'name');
  pgm.createIndex('restaurants', 'is_active');
};

export const down = async (pgm) => {
  // Drop indexes first
  pgm.dropIndex('restaurants', 'name');
  pgm.dropIndex('restaurants', 'is_active');
  
  // Drop the table
  pgm.dropTable('restaurants');
};
