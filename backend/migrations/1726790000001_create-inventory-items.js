// Migration: Create inventory_items table
// Date: 2024-08-24
// Description: Core inventory items for restaurant inventory management

exports.up = async function(pgm) {
  // Create category enum type
  pgm.createType('inventory_category', ['produce', 'meat', 'dairy', 'dry_goods', 'beverages', 'other']);

  // Create inventory_items table
  pgm.createTable('inventory_items', {
    id: {
      type: 'serial',
      primaryKey: true,
      notNull: true
    },
    restaurant_id: {
      type: 'integer',
      notNull: true,
      references: 'restaurants(id)',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    supplier_id: {
      type: 'integer',
      notNull: true,
      references: 'suppliers(id)',
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    },
    name: {
      type: 'varchar',
      notNull: true
    },
    description: {
      type: 'text',
      notNull: false
    },
    category: {
      type: 'inventory_category',
      notNull: true
    },
    unit: {
      type: 'varchar',
      notNull: true
    },
    unit_cost: {
      type: 'decimal(10,2)',
      notNull: true
    },
    current_stock: {
      type: 'decimal(10,2)',
      notNull: true,
      default: 0
    },
    minimum_stock: {
      type: 'decimal(10,2)',
      notNull: true,
      default: 0
    },
    maximum_stock: {
      type: 'decimal(10,2)',
      notNull: true
    },
    expiration_date: {
      type: 'date',
      notNull: false
    },
    batch_number: {
      type: 'varchar',
      notNull: false
    },
    location: {
      type: 'varchar',
      notNull: false
    },
    last_order_date: {
      type: 'date',
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

  // Create indexes for better performance
  pgm.createIndex('inventory_items', 'restaurant_id');
  pgm.createIndex('inventory_items', 'supplier_id');
  pgm.createIndex('inventory_items', 'category');
  pgm.createIndex('inventory_items', 'expiration_date');
  pgm.createIndex('inventory_items', 'current_stock');
  pgm.createIndex('inventory_items', 'is_active');
  
  // Composite indexes for common queries
  pgm.createIndex('inventory_items', ['restaurant_id', 'category']);
  pgm.createIndex('inventory_items', ['restaurant_id', 'is_active']);
};

exports.down = async function(pgm) {
  pgm.dropTable('inventory_items');
  pgm.dropType('inventory_category');
};
