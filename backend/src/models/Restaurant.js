import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Restaurant extends Model {
  static associate(models) {
    // Define associations with existing models
    Restaurant.hasMany(models.InventoryItem, {
      foreignKey: 'restaurantId',
      as: 'inventoryItems'
    });
    Restaurant.hasMany(models.InventoryTransaction, {
      foreignKey: 'restaurantId',
      as: 'inventoryTransactions'
    });
    Restaurant.hasMany(models.InventoryPeriod, {
      foreignKey: 'restaurantId',
      as: 'inventoryPeriods'
    });
    
    // POS Integration: One restaurant can have multiple POS connections
    // Progress Note: Added for Issue #15 - Multi-POS Architecture
    Restaurant.hasMany(models.POSConnection, {
      foreignKey: 'restaurantId',
      as: 'posConnections'
    });
    
    // Future associations when models are implemented
    // Restaurant.hasMany(models.Recipe, {
    //   foreignKey: 'restaurantId',
    //   as: 'recipes'
    // });
    // Restaurant.hasMany(models.Sales, {
    //   foreignKey: 'restaurantId',
    //   as: 'sales'
    // });
  }

  // Instance methods
  // Future method when Recipe model is implemented
  // async getActiveRecipes() {
  //   const { Recipe } = sequelize.models;
  //   return await Recipe.findAll({
  //     where: { 
  //       restaurantId: this.id,
  //       isActive: true 
  //     }
  //   });
  // }

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
  },
  // POS Integration: Primary POS provider for this restaurant
  // Progress Note: Added for Issue #15 - Multi-POS Architecture
  // This field indicates the main POS system used by the restaurant
  posProvider: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'pos_provider',
    validate: {
      isIn: {
        args: [['square', 'toast', null]],
        msg: 'POS provider must be either "square", "toast", or null'
      }
    }
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