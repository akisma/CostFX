'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('InventoryItems', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      restaurantId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Restaurants',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      supplierId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Suppliers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      category: {
        type: Sequelize.ENUM('produce', 'meat', 'dairy', 'dry_goods', 'beverages', 'other'),
        allowNull: false
      },
      unit: {
        type: Sequelize.STRING,
        allowNull: false
      },
      unitCost: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      currentStock: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      minimumStock: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      maximumStock: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      expirationDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      batchNumber: {
        type: Sequelize.STRING,
        allowNull: true
      },
      location: {
        type: Sequelize.STRING,
        allowNull: true
      },
      lastOrderDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('InventoryItems', ['restaurantId']);
    await queryInterface.addIndex('InventoryItems', ['supplierId']);
    await queryInterface.addIndex('InventoryItems', ['category']);
    await queryInterface.addIndex('InventoryItems', ['expirationDate']);
    await queryInterface.addIndex('InventoryItems', ['currentStock']);
    await queryInterface.addIndex('InventoryItems', ['isActive']);
    
    // Composite index for common queries
    await queryInterface.addIndex('InventoryItems', ['restaurantId', 'category']);
    await queryInterface.addIndex('InventoryItems', ['restaurantId', 'isActive']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('InventoryItems');
  }
};
