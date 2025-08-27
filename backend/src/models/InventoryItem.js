import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class InventoryItem extends Model {
  static associate(models) {
    // Define associations
    InventoryItem.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant'
    });
    InventoryItem.belongsTo(models.Supplier, {
      foreignKey: 'supplierId',
      as: 'supplier'
    });
    InventoryItem.hasMany(models.InventoryTransaction, {
      foreignKey: 'inventoryItemId',
      as: 'transactions'
    });
  }

  // Instance methods
  async getCurrentStock() {
    const { InventoryTransaction } = sequelize.models;
    const transactions = await InventoryTransaction.findAll({
      where: { inventoryItemId: this.id },
      order: [['createdAt', 'DESC']]
    });

    return transactions.reduce((stock, transaction) => {
      if (transaction.type === 'purchase' || transaction.type === 'adjustment_in') {
        return stock + transaction.quantity;
      } else if (transaction.type === 'usage' || transaction.type === 'waste' || transaction.type === 'adjustment_out') {
        return stock - transaction.quantity;
      }
      return stock;
    }, 0);
  }

  async getStockStatus() {
    const currentStock = await this.getCurrentStock();
    
    let status = 'healthy';
    if (currentStock <= 0) {
      status = 'out_of_stock';
    } else if (currentStock <= this.minimumStock) {
      status = 'low_stock';
    } else if (currentStock >= this.maximumStock) {
      status = 'overstock';
    }

    return {
      currentStock,
      minimumStock: this.minimumStock,
      maximumStock: this.maximumStock,
      status,
      daysUntilExpiration: this.getDaysUntilExpiration()
    };
  }

  getDaysUntilExpiration() {
    if (!this.expirationDate) return null;
    
    const now = new Date();
    const expiration = new Date(this.expirationDate);
    const diffTime = expiration - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  toJSON() {
    const values = { ...this.get() };
    return values;
  }
}

InventoryItem.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  restaurantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'restaurant_id',
    references: {
      model: 'restaurants',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      isIn: [['produce', 'dairy', 'meat', 'seafood', 'dry_goods', 'beverages', 'frozen', 'condiments', 'spices', 'other']]
    }
  },
  unit: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true,
      isIn: [['lbs', 'oz', 'kg', 'g', 'gallons', 'liters', 'cups', 'pieces', 'boxes', 'cases']]
    }
  },
  minimumStock: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'minimum_stock',
    validate: {
      min: 0
    }
  },
  maximumStock: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 100,
    field: 'maximum_stock',
    validate: {
      min: 0
    }
  },
  unitCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'unit_cost',
    validate: {
      min: 0
    }
  },
  supplierId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'supplier_id',
    references: {
      model: 'suppliers',
      key: 'id'
    }
  },
  expirationDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expiration_date'
  },
  storageLocation: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'storage_location'
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
  modelName: 'InventoryItem',
  tableName: 'inventory_items',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['restaurant_id']
    },
    {
      fields: ['category']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['expiration_date']
    },
    {
      fields: ['name', 'restaurant_id'],
      unique: true
    }
  ]
});

export default InventoryItem;
