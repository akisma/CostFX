/**
 * SquareOrder Model
 * 
 * Tier 1 (POS-Specific Raw Data): Stores complete Square order data
 * 
 * Key Features:
 * 1. Preserves exact Square API responses in JSONB (square_data)
 * 2. Denormalizes totals for fast sales reporting
 * 3. Transforms to sales_transactions via POSDataTransformer (Issue #21)
 * 4. Tracks order state (OPEN, COMPLETED, CANCELED)
 * 5. All monetary values stored in cents (Square's smallest currency unit)
 * 
 * Architecture:
 * - This is Tier 1 (raw POS data) - agents NEVER query this directly
 * - POSDataTransformer maps square_orders → sales_transactions
 * - SquareOrderItem contains denormalized line items for performance
 * 
 * Square API:
 * - Endpoint: POST /v2/orders/search
 * - Docs: https://developer.squareup.com/reference/square/orders-api
 * 
 * Related: Issue #18 - Square-Focused Database Schema, Issue #21 - Sales Data Sync
 * Created: 2025-10-05
 */

import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class SquareOrder extends Model {
  /**
   * Define associations with other models
   * 
   * Relationships:
   * - belongsTo POSConnection
   * - belongsTo Restaurant
   * - belongsTo SquareLocation (optional)
   * - hasMany SquareOrderItem
   */
  static associate(models) {
    SquareOrder.belongsTo(models.POSConnection, {
      foreignKey: 'posConnectionId',
      as: 'posConnection',
      onDelete: 'CASCADE'
    });
    
    SquareOrder.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant',
      onDelete: 'CASCADE'
    });
    
    SquareOrder.belongsTo(models.SquareLocation, {
      foreignKey: 'squareLocationId',
      as: 'squareLocation',
      onDelete: 'SET NULL'
    });
    
    SquareOrder.hasMany(models.SquareOrderItem, {
      foreignKey: 'squareOrderId',
      as: 'orderItems',
      onDelete: 'CASCADE'
    });
  }
  
  /**
   * Helper: Check if order is completed
   */
  isCompleted() {
    return this.state === 'COMPLETED';
  }
  
  /**
   * Helper: Get total in dollars (converts from cents)
   */
  getTotalInDollars() {
    if (!this.totalMoneyAmount) return 0;
    return this.totalMoneyAmount / 100;
  }
  
  /**
   * Helper: Get net amount in dollars
   */
  getNetAmountInDollars() {
    if (!this.netAmountDueMoneyAmount) return 0;
    return this.netAmountDueMoneyAmount / 100;
  }
  
  /**
   * Helper: Check if order is closed (has closed_at timestamp)
   */
  isClosed() {
    return this.closedAt !== null;
  }
}

SquareOrder.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    
    // Foreign Keys
    posConnectionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'pos_connection_id',
      references: {
        model: 'pos_connections',
        key: 'id'
      },
      onDelete: 'CASCADE'
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
    squareLocationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'square_location_id',
      references: {
        model: 'square_locations',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    
    // Square API Identifiers
    squareOrderId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'square_order_id',
      validate: {
        notEmpty: {
          msg: 'Square order ID is required'
        }
      }
    },
    squareLocationUuid: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'square_location_uuid'
    },
    
    // Raw API Response (CRITICAL)
    squareData: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'square_data',
      validate: {
        isValidJSON(value) {
          if (!value || typeof value !== 'object') {
            throw new Error('square_data must be a valid JSON object');
          }
        }
      }
    },
    
    // Denormalized Fields
    state: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        isIn: {
          args: [['OPEN', 'COMPLETED', 'CANCELED']],
          msg: 'Invalid order state'
        }
      }
    },
    sourceName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'source_name'
    },
    
    // Timestamps (from Square)
    openedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'opened_at'
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'closed_at',
      comment: 'When order was completed/paid. Used for sales reporting.'
    },
    squareCreatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'square_created_at'
    },
    squareUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'square_updated_at'
    },
    
    // Totals (in cents)
    totalMoneyAmount: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'total_money_amount'
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
    totalTipMoneyAmount: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'total_tip_money_amount'
    },
    totalServiceChargeMoneyAmount: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'total_service_charge_money_amount'
    },
    netAmountDueMoneyAmount: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'net_amount_due_money_amount'
    },
    
    // Sync Metadata
    lastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_synced_at'
    },
    squareVersion: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'square_version'
    },
    
    // Timestamps
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  },
  {
    sequelize,
    modelName: 'SquareOrder',
    tableName: 'square_orders',
    timestamps: true,
    underscored: true,
    
    hooks: {
      beforeUpdate: (order) => {
        order.lastSyncedAt = new Date();
      }
    }
  }
);

export default SquareOrder;
