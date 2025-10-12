/**
 * SquareOrderItem Model
 * 
 * Tier 1 (POS-Specific Raw Data): Denormalized Square order line items
 * 
 * Key Features:
 * 1. Denormalizes line items from square_orders for query performance
 * 2. Enables fast "top selling items" queries without JSONB parsing
 * 3. Links to SquareMenuItem via catalog_object_id
 * 4. Transforms to sales_transactions via POSDataTransformer (Issue #21)
 * 5. All monetary values stored in cents
 * 
 * Rationale: Denormalization enables:
 * - Fast sales analysis without parsing JSONB
 * - Efficient joins with square_menu_items
 * - Better indexing for revenue queries
 * - Simpler transformation logic
 * 
 * Architecture:
 * - This is Tier 1 (raw POS data) - agents NEVER query this directly
 * - POSDataTransformer maps square_order_items → sales_transactions
 * - Nested within SquareOrder but extracted for performance
 * 
 * Related: Issue #18 - Square-Focused Database Schema, Issue #21 - Sales Data Sync
 * Created: 2025-10-05
 */

import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class SquareOrderItem extends Model {
  /**
   * Define associations with other models
   * 
   * Relationships:
   * - belongsTo SquareOrder
   * - belongsTo SquareMenuItem (optional, NULL for ad-hoc items)
   * - belongsTo Restaurant
   */
  static associate(models) {
    SquareOrderItem.belongsTo(models.SquareOrder, {
      foreignKey: 'squareOrderId',
      as: 'order',
      onDelete: 'CASCADE'
    });
    
    SquareOrderItem.belongsTo(models.SquareMenuItem, {
      foreignKey: 'squareMenuItemId',
      as: 'menuItem',
      onDelete: 'SET NULL' // NULL if menu item deleted, but keep order item
    });
    
    SquareOrderItem.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant',
      onDelete: 'CASCADE'
    });
  }
  
  /**
   * Helper: Get total in dollars (converts from cents)
   */
  getTotalInDollars() {
    return this.totalMoneyAmount / 100;
  }
  
  /**
   * Helper: Get base price in dollars
   */
  getBasePriceInDollars() {
    if (!this.basePriceMoneyAmount) return 0;
    return this.basePriceMoneyAmount / 100;
  }
  
  /**
   * Helper: Get quantity as float
   */
  getQuantity() {
    return parseFloat(this.quantity) || 0;
  }
  
  /**
   * Helper: Check if this item has a catalog object (not ad-hoc)
   */
  hasCatalogObject() {
    return this.squareCatalogObjectId !== null;
  }
}

SquareOrderItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    
    // Foreign Keys
    squareOrderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'square_order_id',
      references: {
        model: 'square_orders',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    squareMenuItemId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'square_menu_item_id',
      references: {
        model: 'square_menu_items',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    restaurantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'restaurant_id',
      references: {
        model: 'restaurants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    
    // Square API Identifiers
    squareLineItemUid: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'square_line_item_uid',
      comment: 'Square\'s unique line item ID within order'
    },
    squareCatalogObjectId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'square_catalog_object_id',
      comment: 'NULL for ad-hoc items (e.g., custom discounts)'
    },
    squareVariationId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'square_variation_id'
    },
    
    // Raw Line Item Data
    lineItemData: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'line_item_data',
      validate: {
        isValidJSON(value) {
          if (!value || typeof value !== 'object') {
            throw new Error('line_item_data must be a valid JSON object');
          }
        }
      }
    },
    
    // Denormalized Fields
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Item name is required'
        }
      }
    },
    variationName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'variation_name'
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: 'Quantity must be greater than 0'
        }
      },
      comment: 'Supports fractional values (e.g., 0.5 for half portion, 2.5 for 2.5 lbs)'
    },
    
    // Pricing (in cents)
    basePriceMoneyAmount: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'base_price_money_amount'
    },
    grossSalesMoneyAmount: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'gross_sales_money_amount'
    },
    totalTaxMoneyAmount: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'total_tax_money_amount'
    },
    totalDiscountMoneyAmount: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'total_discount_money_amount'
    },
    totalMoneyAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'total_money_amount',
      validate: {
        min: {
          args: [0],
          msg: 'Total amount cannot be negative'
        }
      }
    },
    
    // Timestamps
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  },
  {
    sequelize,
    modelName: 'SquareOrderItem',
    tableName: 'square_order_items',
    timestamps: false, // No updatedAt for immutable order items
    underscored: true
  }
);

export default SquareOrderItem;
