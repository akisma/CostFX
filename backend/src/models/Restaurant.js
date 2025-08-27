import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Restaurant extends Model {
  static associate(models) {
    // Define associations
    Restaurant.hasMany(models.Recipe, {
      foreignKey: 'restaurantId',
      as: 'recipes'
    });
    Restaurant.hasMany(models.InventoryItem, {
      foreignKey: 'restaurantId',
      as: 'inventoryItems'
    });
    Restaurant.hasMany(models.InventoryTransaction, {
      foreignKey: 'restaurantId',
      as: 'inventoryTransactions'
    });
    Restaurant.hasMany(models.Sales, {
      foreignKey: 'restaurantId',
      as: 'sales'
    });
  }

  // Instance methods
  async getActiveRecipes() {
    const { Recipe } = sequelize.models;
    return await Recipe.findAll({
      where: { 
        restaurantId: this.id,
        isActive: true 
      }
    });
  }

  async getCurrentInventoryValue() {
    // TODO: Implement inventory value calculation
    return 0;
  }

  toJSON() {
    const values = { ...this.get() };
    // Remove sensitive data if needed
    return values;
  }
}

Restaurant.init({
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
  location: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  cuisineType: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'cuisine_type'
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      // More flexible phone validation that accepts common formats
      isValidPhone(value) {
        if (value && !/^[+]?[\d\-()s.]{7,20}$/.test(value)) {
          throw new Error('Phone number must be a valid format');
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
  settings: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
    validate: {
      isValidSettings(value) {
        if (typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('Settings must be an object');
        }
      }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  sequelize,
  modelName: 'Restaurant',
  tableName: 'restaurants',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['name']
    },
    {
      fields: ['is_active']
    }
  ]
});

export default Restaurant;