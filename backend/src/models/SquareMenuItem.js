/**
 * SquareMenuItem Model
 * 
 * Tier 1 (POS-Specific Raw Data): Stores Square Catalog items
 * 
 * Key Features:
 * 1. Preserves exact Square API responses in JSONB (square_data)
 * 2. Denormalizes common fields for query performance
 * 3. Transforms to inventory_items via POSDataTransformer (Issue #20)
 * 4. Supports multi-location with square_locations
 * 5. Tracks pricing in cents (Square's smallest currency unit)
 * 
 * Architecture:
 * - This is Tier 1 (raw POS data) - agents NEVER query this directly
 * - POSDataTransformer maps square_menu_items → inventory_items
 * - Full Square API response preserved for audit trail and re-processing
 * 
 * Square API:
 * - Type: "ITEM"
 * - Docs: https://developer.squareup.com/reference/square/catalog-api
 * 
 * Related: Issue #18 - Square-Focused Database Schema
 * Created: 2025-10-05
 */

import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class SquareMenuItem extends Model {
  /**
   * Define associations with other models
   * 
   * Relationships:
   * - belongsTo POSConnection
   * - belongsTo Restaurant
   * - belongsTo SquareLocation (optional, for multi-location)
   * - hasMany SquareInventoryCount
   * - hasMany SquareOrderItem
   */
  static associate(models) {
    SquareMenuItem.belongsTo(models.POSConnection, {
      foreignKey: 'posConnectionId',
      as: 'posConnection',
      onDelete: 'CASCADE'
    });
    
    SquareMenuItem.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant',
      onDelete: 'CASCADE'
    });
    
    SquareMenuItem.belongsTo(models.SquareLocation, {
      foreignKey: 'squareLocationId',
      as: 'squareLocation',
      onDelete: 'SET NULL'
    });
    
    SquareMenuItem.hasMany(models.SquareInventoryCount, {
      foreignKey: 'squareMenuItemId',
      as: 'inventoryCounts',
      onDelete: 'CASCADE'
    });
    
    SquareMenuItem.hasMany(models.SquareOrderItem, {
      foreignKey: 'squareMenuItemId',
      as: 'orderItems',
      onDelete: 'SET NULL'
    });
  }
  
  /**
   * Helper: Get primary variation (usually first variation in Square's structure)
   */
  getPrimaryVariation() {
    try {
      return this.squareData?.item_data?.variations?.[0];
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Helper: Get price in dollars (converts from cents)
   */
  getPriceInDollars() {
    if (!this.priceMoneyAmount) return 0;
    return this.priceMoneyAmount / 100;
  }
  
  /**
   * Helper: Check if item is available (not deleted)
   */
  isAvailable() {
    return !this.isDeleted;
  }
  
  /**
   * Helper: Get latest inventory count
   */
  async getLatestInventoryCount() {
    const SquareInventoryCount = sequelize.models.SquareInventoryCount;
    return await SquareInventoryCount.findOne({
      where: {
        squareMenuItemId: this.id,
        squareState: 'IN_STOCK'
      },
      order: [['calculatedAt', 'DESC']],
      limit: 1
    });
  }
}

SquareMenuItem.init(
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
    squareCatalogObjectId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'square_catalog_object_id',
      validate: {
        notEmpty: {
          msg: 'Square catalog object ID is required'
        }
      }
    },
    squareItemId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'square_item_id'
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
          if (value.type !== 'ITEM') {
            throw new Error('square_data.type must be "ITEM"');
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
    sku: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    productType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'product_type'
    },
    isTaxable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_taxable'
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_deleted'
    },
    
    // Pricing (in cents)
    priceMoneyAmount: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'price_money_amount',
      validate: {
        min: {
          args: [0],
          msg: 'Price cannot be negative'
        }
      }
    },
    priceMoneyCurrency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'USD',
      field: 'price_money_currency'
    },
    
    // Categories (PostgreSQL array - using TEXT with getter/setter for compatibility)
    categoryIds: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'category_ids',
      get() {
        const rawValue = this.getDataValue('categoryIds');
        if (!rawValue) return [];
        // Parse PostgreSQL array format: {val1,val2,val3}
        if (typeof rawValue === 'string') {
          return rawValue.replace(/[{}]/g, '').split(',').filter(v => v);
        }
        return Array.isArray(rawValue) ? rawValue : [];
      },
      set(value) {
        // Convert array to PostgreSQL array format
        if (Array.isArray(value)) {
          this.setDataValue('categoryIds', `{${value.join(',')}}`);
        } else {
          this.setDataValue('categoryIds', null);
        }
      }
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
    modelName: 'SquareMenuItem',
    tableName: 'square_menu_items',
    timestamps: true,
    underscored: true,
    
    hooks: {
      beforeUpdate: (item) => {
        item.lastSyncedAt = new Date();
      }
    }
  }
);

export default SquareMenuItem;
