'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('InventoryTransactions', {
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
      inventoryItemId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'InventoryItems',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      transactionType: {
        type: Sequelize.ENUM('purchase', 'usage', 'waste', 'adjustment', 'transfer'),
        allowNull: false
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Positive for additions (purchase, adjustments up), negative for reductions (usage, waste, adjustments down)'
      },
      unitCost: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Cost per unit at time of transaction'
      },
      transactionDate: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      reference: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Reference number (PO number, invoice number, etc.)'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      performedBy: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'User who performed the transaction'
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
    await queryInterface.addIndex('InventoryTransactions', ['restaurantId']);
    await queryInterface.addIndex('InventoryTransactions', ['inventoryItemId']);
    await queryInterface.addIndex('InventoryTransactions', ['transactionType']);
    await queryInterface.addIndex('InventoryTransactions', ['transactionDate']);
    await queryInterface.addIndex('InventoryTransactions', ['reference']);
    
    // Composite indexes for common queries
    await queryInterface.addIndex('InventoryTransactions', ['restaurantId', 'transactionType']);
    await queryInterface.addIndex('InventoryTransactions', ['restaurantId', 'transactionDate']);
    await queryInterface.addIndex('InventoryTransactions', ['inventoryItemId', 'transactionDate']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('InventoryTransactions');
  }
};
