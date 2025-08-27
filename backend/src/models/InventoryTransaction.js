import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class InventoryTransaction extends Model {
  static associate(models) {
    // Define associations
    InventoryTransaction.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant'
    });
    InventoryTransaction.belongsTo(models.InventoryItem, {
      foreignKey: 'inventoryItemId',
      as: 'inventoryItem'
    });
  }

  // Instance methods
  getTransactionValue() {
    return Number((this.quantity * this.unitCost).toFixed(2));
  }

  getImpactOnStock() {
    // Returns positive for stock increases, negative for decreases
    if (this.type === 'purchase' || this.type === 'adjustment_in') {
      return this.quantity;
    } else if (this.type === 'usage' || this.type === 'waste' || this.type === 'adjustment_out') {
      return -this.quantity;
    }
    return 0;
  }

  toJSON() {
    const values = { ...this.get() };
    // Add calculated fields
    values.transactionValue = this.getTransactionValue();
    values.stockImpact = this.getImpactOnStock();
    return values;
  }
}

InventoryTransaction.init({
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
  inventoryItemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'inventory_item_id',
    references: {
      model: 'inventory_items',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true,
      isIn: [['purchase', 'usage', 'waste', 'adjustment_in', 'adjustment_out', 'transfer']]
    }
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
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
  reason: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  batchNumber: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'batch_number'
  },
  expirationDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expiration_date'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'user_id',
    comment: 'User who performed the transaction'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  transactionDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'transaction_date'
  }
}, {
  sequelize,
  modelName: 'InventoryTransaction',
  tableName: 'inventory_transactions',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['restaurant_id']
    },
    {
      fields: ['inventory_item_id']
    },
    {
      fields: ['type']
    },
    {
      fields: ['transaction_date']
    },
    {
      fields: ['expiration_date']
    }
  ]
});

export default InventoryTransaction;
