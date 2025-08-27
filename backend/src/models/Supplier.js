import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Supplier extends Model {
  static associate(models) {
    // Define associations
    Supplier.hasMany(models.InventoryItem, {
      foreignKey: 'supplierId',
      as: 'inventoryItems'
    });
  }

  // Instance methods
  async getReliabilityScore() {
    // Calculate supplier reliability based on delivery performance
    // This is a placeholder - in real implementation, would track delivery times
    return this.reliabilityScore || 85;
  }

  async getAverageLeadTime() {
    // Return average lead time for this supplier
    return this.leadTimeDays || 3;
  }

  async getActiveInventoryItems() {
    const { InventoryItem } = sequelize.models;
    return await InventoryItem.findAll({
      where: { 
        supplierId: this.id,
        isActive: true 
      }
    });
  }

  toJSON() {
    const values = { ...this.get() };
    return values;
  }
}

Supplier.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  contactName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'contact_name'
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      isValidPhone(value) {
        if (value && !/^[+]?[1-9][\d]{0,15}$/i.test(value)) {
          throw new Error('Invalid phone number format');
        }
      }
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  leadTimeDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
    field: 'lead_time_days',
    validate: {
      min: 0,
      max: 30
    }
  },
  minimumOrderAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'minimum_order_amount',
    validate: {
      min: 0
    }
  },
  reliabilityScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 85,
    field: 'reliability_score',
    validate: {
      min: 0,
      max: 100
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  sequelize,
  modelName: 'Supplier',
  tableName: 'suppliers',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['name']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['reliability_score']
    }
  ]
});

export default Supplier;
