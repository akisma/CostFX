/**
 * SquareCategory Model
 * 
 * Tier 1 (POS-Specific Raw Data): Stores Square Catalog categories
 * 
 * Key Features:
 * 1. Preserves exact Square API responses in JSONB (square_data)
 * 2. Denormalizes common fields (name, is_deleted) for query performance
 * 3. Maps to internal ingredient_categories via POSDataTransformer (Issue #20)
 * 4. Tracks Square version for optimistic concurrency
 * 
 * Architecture:
 * - This is Tier 1 (raw POS data) - agents NEVER query this directly
 * - POSDataTransformer maps square_categories → ingredient_categories
 * - Full Square API response preserved for audit trail and re-processing
 * 
 * Square API:
 * - Type: "CATEGORY"
 * - Docs: https://developer.squareup.com/reference/square/objects/CatalogObject
 * 
 * Related: Issue #18 - Square-Focused Database Schema
 * Created: 2025-10-05
 */

import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class SquareCategory extends Model {
  /**
   * Define associations with other models
   * 
   * Relationships:
   * - belongsTo POSConnection: Each category belongs to one POS connection
   * - belongsTo Restaurant: Each category belongs to one restaurant
   */
  static associate(models) {
    SquareCategory.belongsTo(models.POSConnection, {
      foreignKey: 'posConnectionId',
      as: 'posConnection',
      onDelete: 'CASCADE' // If connection deleted, delete its categories
    });
    
    SquareCategory.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant',
      onDelete: 'CASCADE' // If restaurant deleted, delete its categories
    });
  }
  
  /**
   * Helper: Extract category name from Square API response
   * Handles cases where square_data might be malformed
   */
  getCategoryName() {
    try {
      return this.squareData?.category_data?.name || this.name || 'Unknown Category';
    } catch (error) {
      return this.name || 'Unknown Category';
    }
  }
  
  /**
   * Helper: Check if category is deleted in Square
   */
  isDeleted() {
    return this.isDeleted === true || this.squareData?.is_deleted === true;
  }
  
  /**
   * Helper: Get full Square API object for debugging
   */
  getSquareData() {
    return this.squareData;
  }
}

SquareCategory.init(
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
    squareCategoryId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'square_category_id'
    },
    
    // Raw API Response (CRITICAL - stores exact Square response)
    squareData: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'square_data',
      validate: {
        isValidJSON(value) {
          if (!value || typeof value !== 'object') {
            throw new Error('square_data must be a valid JSON object');
          }
          if (value.type !== 'CATEGORY') {
            throw new Error('square_data.type must be "CATEGORY"');
          }
        }
      }
    },
    
    // Denormalized Fields (for query performance)
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Category name is required'
        }
      }
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_deleted'
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
      field: 'square_version',
      comment: 'Square\'s version number for optimistic concurrency'
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
    modelName: 'SquareCategory',
    tableName: 'square_categories',
    timestamps: true,
    underscored: true,
    
    // Indexes defined in migration, but documented here for reference:
    // - square_catalog_object_id (unique)
    // - pos_connection_id
    // - restaurant_id
    // - name
    // - is_deleted (partial, where is_deleted = false)
    
    // Lifecycle hooks
    hooks: {
      // Auto-update lastSyncedAt on every save
      beforeUpdate: (category) => {
        category.lastSyncedAt = new Date();
      }
    }
  }
);

export default SquareCategory;
