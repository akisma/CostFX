/**
 * SquareInventoryCount Model
 * 
 * Tier 1 (POS-Specific Raw Data): Stores Square inventory count snapshots
 * 
 * Key Features:
 * 1. Tracks inventory levels over time for variance analysis
 * 2. Supports multiple states (IN_STOCK, SOLD, WASTE, etc.)
 * 3. Preserves exact Square API responses in JSONB
 * 4. Links to SquareMenuItem via catalog_object_id
 * 
 * Architecture:
 * - This is Tier 1 (raw POS data) - agents NEVER query this directly
 * - POSDataTransformer uses these counts to populate inventory_items.current_stock
 * - calculated_at: When Square calculated the count
 * - snapshot_date: When we retrieved it
 * 
 * Square API:
 * - Endpoint: POST /v2/inventory/batch-retrieve-counts
 * - Docs: https://developer.squareup.com/reference/square/inventory-api
 * 
 * Related: Issue #18 - Square-Focused Database Schema
 * Created: 2025-10-05
 */

import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class SquareInventoryCount extends Model {
  /**
   * Define associations with other models
   * 
   * Relationships:
   * - belongsTo SquareMenuItem
   * - belongsTo POSConnection
   * - belongsTo Restaurant
   * - belongsTo SquareLocation (optional)
   */
  static associate(models) {
    SquareInventoryCount.belongsTo(models.SquareMenuItem, {
      foreignKey: 'squareMenuItemId',
      as: 'menuItem',
      onDelete: 'CASCADE'
    });
    
    SquareInventoryCount.belongsTo(models.POSConnection, {
      foreignKey: 'posConnectionId',
      as: 'posConnection',
      onDelete: 'CASCADE'
    });
    
    SquareInventoryCount.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant',
      onDelete: 'CASCADE'
    });
    
    SquareInventoryCount.belongsTo(models.SquareLocation, {
      foreignKey: 'squareLocationId',
      as: 'squareLocation',
      onDelete: 'SET NULL'
    });
  }
  
  /**
   * Helper: Check if this is an IN_STOCK count (most common query)
   */
  isInStock() {
    return this.squareState === 'IN_STOCK';
  }
  
  /**
   * Helper: Check if this represents waste/shrinkage
   */
  isWaste() {
    return this.squareState === 'WASTE';
  }
  
  /**
   * Helper: Get quantity as float
   */
  getQuantity() {
    return parseFloat(this.quantity) || 0;
  }
}

SquareInventoryCount.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    
    // Foreign Keys
    squareMenuItemId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'square_menu_item_id',
      references: {
        model: 'square_menu_items',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
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
      field: 'square_catalog_object_id'
    },
    squareState: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'square_state',
      validate: {
        isIn: {
          args: [[
            'IN_STOCK', 'SOLD', 'RETURNED_BY_CUSTOMER', 'RESERVED_FOR_SALE',
            'SOLD_ONLINE', 'ORDERED_FROM_VENDOR', 'RECEIVED_FROM_VENDOR',
            'IN_TRANSIT_TO', 'WASTE', 'UNLINKED_RETURN', 'CUSTOM', 'COMPOSED_VARIATION_PARENT'
          ]],
          msg: 'Invalid Square inventory state'
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
    quantity: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: 'Quantity cannot be negative'
        }
      }
    },
    calculatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'calculated_at',
      comment: 'When Square calculated this count (from API)'
    },
    
    // Sync Metadata
    snapshotDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'snapshot_date',
      comment: 'When we retrieved this snapshot'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  },
  {
    sequelize,
    modelName: 'SquareInventoryCount',
    tableName: 'square_inventory_counts',
    timestamps: false, // No updatedAt for immutable snapshots
    underscored: true
  }
);

export default SquareInventoryCount;
