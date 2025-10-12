/**
 * SquareLocation Model
 * 
 * Purpose: Represents Square POS locations for multi-location restaurant chains
 * 
 * Progress Note: Issue #16 - Square OAuth Authentication Service
 * Extends pos_connections with Square-specific location data
 * 
 * Use Cases:
 * - Restaurant chains with multiple Square locations
 * - Per-location inventory and sales sync
 * - Location-specific sync control
 * - Multi-location analytics and reporting
 * 
 * Relationships:
 * - Belongs to POSConnection (one connection can have many locations)
 * - Belongs to Restaurant (through POSConnection)
 */

import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class SquareLocation extends Model {
  /**
   * Define associations with other models
   * 
   * @param {Object} models - Object containing all models
   */
  static associate(models) {
    // Belongs to POSConnection
    SquareLocation.belongsTo(models.POSConnection, {
      foreignKey: 'posConnectionId',
      as: 'posConnection'
    });
    
    // Access Restaurant through POSConnection
    // Note: This is a convenience - actual relationship is through posConnection
  }
  
  /**
   * Get the restaurant for this location (through POSConnection)
   * 
   * @returns {Promise<Restaurant>} Restaurant instance
   */
  async getRestaurant() {
    const connection = await this.getPosConnection({
      include: ['restaurant']
    });
    return connection?.restaurant;
  }
  
  /**
   * Check if location is active and enabled for sync
   * 
   * @returns {boolean} True if location should be synced
   */
  isActiveForSync() {
    return this.status === 'active' && this.syncEnabled === true;
  }
  
  /**
   * Update sync timestamp
   * 
   * @returns {Promise<SquareLocation>} Updated instance
   */
  async recordSync() {
    this.lastSyncAt = new Date();
    return await this.save();
  }
  
  /**
   * Format location address for display
   * 
   * @returns {string} Formatted address string
   */
  getFormattedAddress() {
    if (!this.address) return '';
    
    const addr = this.address;
    const parts = [
      addr.addressLine1,
      addr.addressLine2,
      addr.locality,
      addr.administrativeDistrictLevel1,
      addr.postalCode,
      addr.country
    ].filter(Boolean);
    
    return parts.join(', ');
  }
  
  /**
   * Get location capabilities as array
   * 
   * @returns {Array<string>} Array of capability strings
   */
  getCapabilities() {
    return Array.isArray(this.capabilities) ? this.capabilities : [];
  }
  
  /**
   * Check if location has specific capability
   * 
   * @param {string} capability - Capability to check (e.g., 'CREDIT_CARD_PROCESSING')
   * @returns {boolean} True if location has capability
   */
  hasCapability(capability) {
    const caps = this.getCapabilities();
    return caps.includes(capability);
  }
  
  /**
   * Serialize for API response
   * 
   * @returns {Object} Clean object for API responses
   */
  toJSON() {
    return {
      id: this.id,
      posConnectionId: this.posConnectionId,
      locationId: this.locationId,
      locationName: this.locationName,
      address: this.address,
      formattedAddress: this.getFormattedAddress(),
      status: this.status,
      capabilities: this.getCapabilities(),
      syncEnabled: this.syncEnabled,
      lastSyncAt: this.lastSyncAt,
      metadata: this.metadata,
      isActiveForSync: this.isActiveForSync(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

// Initialize model
SquareLocation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      comment: 'Unique identifier for square_location record'
    },
    
    posConnectionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'pos_connection_id',
      references: {
        model: 'pos_connections',
        key: 'id'
      },
      onDelete: 'CASCADE',
      comment: 'Link to pos_connections table'
    },
    
    locationId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'location_id',
      comment: 'Square location ID from Square API'
    },
    
    locationName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'location_name',
      comment: 'Square location name (e.g., "Main Street Store")'
    },
    
    address: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Location address as JSON (street, city, state, zip, country)'
    },
    
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'inactive', 'suspended']]
      },
      comment: 'Location status: active, inactive, suspended'
    },
    
    capabilities: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Square location capabilities (e.g., ["CREDIT_CARD_PROCESSING"])'
    },
    
    syncEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'sync_enabled',
      comment: 'Whether to sync inventory/sales for this location'
    },
    
    lastSyncAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_sync_at',
      comment: 'Last successful data sync timestamp'
    },
    
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional Square location metadata (business hours, timezone, etc.)'
    },
    
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
    modelName: 'SquareLocation',
    tableName: 'square_locations',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_square_locations_connection',
        fields: ['pos_connection_id']
      },
      {
        name: 'idx_square_locations_location_id',
        fields: ['location_id']
      },
      {
        name: 'idx_square_locations_sync_status',
        fields: ['status', 'sync_enabled'],
        where: {
          syncEnabled: true,
          status: 'active'
        }
      },
      {
        name: 'idx_square_locations_last_sync',
        fields: ['last_sync_at'],
        where: {
          syncEnabled: true
        }
      }
    ]
  }
);

export default SquareLocation;
