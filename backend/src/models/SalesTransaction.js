/**
 * SalesTransaction Model
 * 
 * Tier 2 unified sales data (POS-agnostic)
 * 
 * Purpose: Store sales transactions from any POS provider (Square, Toast, Clover)
 *          in a unified format for recipe variance analysis.
 * 
 * Related: Issue #21 - Square Sales Data Synchronization
 * 
 * Data Flow:
 *   - Square Orders API → square_orders/square_order_items (Tier 1)
 *   - POSDataTransformer → sales_transactions (Tier 2)
 *   - Recipe variance queries → revenue impact calculations
 * 
 * Query Pattern:
 *   SELECT COUNT(*) as sales_count
 *   FROM sales_transactions
 *   WHERE inventory_item_id = ? AND transaction_date BETWEEN ? AND ?
 * 
 * Created: 2025-10-12 (Issue #21 Day 1)
 */

import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const SalesTransaction = sequelize.define('SalesTransaction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    
    // Foreign Keys
    restaurantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'restaurant_id',
      references: {
        model: 'restaurants',
        key: 'id'
      }
    },
    inventoryItemId: {
      type: DataTypes.INTEGER,
      allowNull: true,  // NULL for unmapped items (modifiers, ad-hoc)
      field: 'inventory_item_id',
      references: {
        model: 'inventory_items',
        key: 'id'
      }
    },
    
    // Transaction Details
    transactionDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'transaction_date',
      comment: 'Order closed_at timestamp from POS system'
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01
      },
      comment: 'Quantity sold (supports fractional: 2.5 lbs, 0.5 portions)'
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'unit_price',
      validate: {
        min: 0
      },
      comment: 'Base price per unit in dollars (converted from cents)'
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'total_amount',
      comment: 'Total line item amount in dollars (after tax/discount)'
    },
    
    // POS Source Tracking (Multi-Provider Support)
    sourcePosProvider: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'source_pos_provider',
      validate: {
        isIn: [['square', 'toast', 'clover']]
      },
      comment: 'POS provider identifier'
    },
    sourcePosOrderId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'source_pos_order_id',
      comment: 'Order ID from POS system'
    },
    sourcePosLineItemId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'source_pos_line_item_id',
      comment: 'Unique line item ID for deduplication'
    },
    sourcePosData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'source_pos_data',
      defaultValue: {},
      comment: 'Provider-specific data (modifiers, discounts, fulfillment)'
    }
  }, {
    tableName: 'sales_transactions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,  // No updatedAt - transactions are immutable
    
    indexes: [
      {
        unique: true,
        fields: ['source_pos_provider', 'source_pos_line_item_id'],
        name: 'unique_pos_line_item'
      },
      {
        fields: ['restaurant_id', 'transaction_date'],
        name: 'idx_sales_trans_restaurant_date'
      },
      {
        fields: ['inventory_item_id', 'transaction_date'],
        name: 'idx_sales_trans_item_date'
      },
      {
        fields: ['transaction_date'],
        name: 'idx_sales_trans_date'
      },
      {
        fields: ['source_pos_provider', 'source_pos_order_id'],
        name: 'idx_sales_trans_pos_source'
      }
    ],
    
    validate: {
      // Ensure either inventory_item_id is set OR it's a valid unmapped item
      validItemReference() {
        if (!this.inventoryItemId && !this.sourcePosLineItemId) {
          throw new Error('Either inventoryItemId or sourcePosLineItemId must be set');
        }
      }
    }
  });

  /**
   * Model Associations
   */
  SalesTransaction.associate = (models) => {
    // Belongs to Restaurant
    SalesTransaction.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant',
      onDelete: 'CASCADE'
    });
    
    // Belongs to InventoryItem (optional - NULL for unmapped items)
    SalesTransaction.belongsTo(models.InventoryItem, {
      foreignKey: 'inventoryItemId',
      as: 'inventoryItem',
      onDelete: 'SET NULL'
    });
  };

  /**
   * Instance Methods
   */
  
  /**
   * Check if transaction is mapped to inventory
   * @returns {boolean}
   */
  SalesTransaction.prototype.isMapped = function() {
    return this.inventoryItemId !== null;
  };

  /**
   * Get formatted transaction date
   * @returns {string} ISO 8601 date
   */
  SalesTransaction.prototype.getFormattedDate = function() {
    return this.transactionDate.toISOString().split('T')[0];
  };

  /**
   * Get revenue (quantity × unit_price)
   * @returns {number} Total revenue in dollars
   */
  SalesTransaction.prototype.getRevenue = function() {
    if (!this.quantity || !this.unitPrice) {
      return this.totalAmount || 0;
    }
    return parseFloat(this.quantity) * parseFloat(this.unitPrice);
  };

  /**
   * Get provider-specific metadata from JSONB
   * @param {string} key - Metadata key
   * @returns {any} Value from sourcePosData
   */
  SalesTransaction.prototype.getPosMetadata = function(key) {
    return this.sourcePosData?.[key];
  };

  /**
   * Class Methods
   */
  
  /**
   * Get sales count for inventory item in date range
   * @param {number} inventoryItemId 
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {Promise<number>}
   */
  SalesTransaction.getSalesCount = async function(inventoryItemId, startDate, endDate) {
    const { Op } = sequelize.Sequelize;
    
    return await this.count({
      where: {
        inventoryItemId,
        transactionDate: {
          [Op.between]: [startDate, endDate]
        }
      }
    });
  };

  /**
   * Get total revenue for inventory item in date range
   * @param {number} inventoryItemId 
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {Promise<number>}
   */
  SalesTransaction.getTotalRevenue = async function(inventoryItemId, startDate, endDate) {
    const { Op } = sequelize.Sequelize;
    
    const result = await this.sum('total_amount', {
      where: {
        inventoryItemId,
        transactionDate: {
          [Op.between]: [startDate, endDate]
        }
      }
    });
    
    return result || 0;
  };

  /**
   * Get sales summary by restaurant and date range
   * @param {number} restaurantId 
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {Promise<Object>}
   */
  SalesTransaction.getSalesSummary = async function(restaurantId, startDate, endDate) {
    const { Op } = sequelize.Sequelize;
    
    const transactions = await this.findAll({
      where: {
        restaurantId,
        transactionDate: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'inventoryItemId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'salesCount'],
        [sequelize.fn('SUM', sequelize.col('quantity')), 'totalQuantity'],
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'totalRevenue']
      ],
      group: ['inventoryItemId'],
      raw: true
    });
    
    return transactions;
  };

  return SalesTransaction;
};
