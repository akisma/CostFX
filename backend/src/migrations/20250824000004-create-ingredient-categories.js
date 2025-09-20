'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Enable ltree extension for hierarchical paths
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS ltree;');

    // Create ingredient_categories table with hierarchical support
    await queryInterface.createTable('ingredient_categories', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      path: {
        type: 'ltree',
        allowNull: false,
        unique: true,
        comment: 'Hierarchical path using PostgreSQL ltree (e.g., produce.leafy_greens.romaine)'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    // Create indexes for efficient hierarchical queries
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_ingredient_categories_path ON ingredient_categories USING GIST (path);
      CREATE INDEX idx_ingredient_categories_path_ancestors ON ingredient_categories (path);
      CREATE INDEX idx_ingredient_categories_name ON ingredient_categories (name);
    `);

    // Add basic seed data for Dave's use case: produce → leafy_greens → romaine
    await queryInterface.bulkInsert('ingredient_categories', [
      {
        name: 'Produce',
        path: 'produce',
        description: 'Fresh fruits and vegetables',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Leafy Greens',
        path: 'produce.leafy_greens',
        description: 'Lettuce, spinach, kale, and other leafy vegetables',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Romaine Lettuce',
        path: 'produce.leafy_greens.romaine',
        description: 'Romaine lettuce - low value, high volume item',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Spices & Seasonings',
        path: 'spices',
        description: 'Herbs, spices, and seasoning ingredients',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Premium Spices',
        path: 'spices.premium',
        description: 'High-value specialty spices and seasonings',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Saffron',
        path: 'spices.premium.saffron',
        description: 'Saffron threads - high value, low volume item',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Drop the table first
    await queryInterface.dropTable('ingredient_categories');
    
    // Drop the extension (only if no other tables use it)
    await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS ltree;');
  }
};
