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
    
    // New association for hierarchical categories (Task 1)
    InventoryItem.belongsTo(models.IngredientCategory, {
      foreignKey: 'categoryId',
      as: 'hierarchicalCategory'
    });
    
    // Association for period snapshots (Task 3)
    InventoryItem.hasMany(models.PeriodInventorySnapshot, {
      foreignKey: 'inventoryItemId',
      as: 'snapshots'
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

  // Dave's business logic methods for variance management
  
  isVarianceSignificant(quantityVariance, valueVariance) {
    // Dave's core business logic: "I don't care if we are off 20 pounds of romaine, but 4oz of saffron is like $600"
    const absQuantityVariance = Math.abs(quantityVariance || 0);
    const absValueVariance = Math.abs(valueVariance || 0);
    
    // Check against Dave's thresholds
    return absQuantityVariance > this.varianceThresholdQuantity ||
           absValueVariance > this.varianceThresholdDollar;
  }
  
  getVariancePriority(valueVariance) {
    // Dave's prioritization logic based on dollar impact
    const absValueVariance = Math.abs(valueVariance || 0);
    
    if (this.highValueFlag && absValueVariance > this.varianceThresholdDollar) {
      return 'CRITICAL'; // High-value items like saffron
    } else if (absValueVariance > this.varianceThresholdDollar * 2) {
      return 'HIGH'; // Large dollar impact
    } else if (absValueVariance > this.varianceThresholdDollar) {
      return 'MEDIUM'; // Moderate impact
    } else {
      return 'LOW'; // Normal business variance
    }
  }
  
  async getCategoryPath() {
    // Get full hierarchical category path for Dave's drilling capabilities
    if (!this.categoryId) return this.category; // Fallback to old category
    
    await this.reload({ 
      include: [{ model: sequelize.models.IngredientCategory, as: 'hierarchicalCategory' }] 
    });
    
    return this.hierarchicalCategory?.path || this.category;
  }
  
  calculateTheoreticalUsage(salesQuantity, recipeYield = 1) {
    // Calculate expected usage based on sales and Dave's yield factors
    return (salesQuantity * recipeYield) / this.theoreticalYieldFactor;
  }
  
  isHighValueItem() {
    // Dave's logic for items requiring special attention
    return this.highValueFlag || 
           this.unitCost > 10.00 || // Arbitrary high-cost threshold
           this.varianceThresholdDollar < 25.00; // Items with tight thresholds
  }
  
  async getRecentVariances(periodCount = 3) {
    // Get recent variance history for trending analysis
    const { PeriodInventorySnapshot } = sequelize.models;
    
    const snapshots = await PeriodInventorySnapshot.findAll({
      where: { inventoryItemId: this.id },
      include: [{
        model: sequelize.models.InventoryPeriod,
        as: 'period',
        where: { status: 'closed' }
      }],
      order: [['period', 'period_start', 'DESC']],
      limit: periodCount * 2 // Beginning + ending for each period
    });
    
    // Group by period and calculate variances
    const varianceHistory = [];
    for (let i = 0; i < snapshots.length; i += 2) {
      const ending = snapshots[i];
      const beginning = snapshots[i + 1];
      
      if (beginning && ending && ending.snapshotType === 'ending' && beginning.snapshotType === 'beginning') {
        const quantityVariance = ending.quantity - beginning.quantity;
        const valueVariance = ending.totalValue - beginning.totalValue;
        
        varianceHistory.push({
          periodId: ending.periodId,
          periodName: ending.period.periodName,
          quantityVariance,
          valueVariance,
          isSignificant: this.isVarianceSignificant(quantityVariance, valueVariance),
          priority: this.getVariancePriority(valueVariance)
        });
      }
    }
    
    return varianceHistory;
  }
  
  // Static methods for Dave's management queries
  
  static async findHighValueItems(restaurantId) {
    return this.findAll({
      where: {
        restaurantId,
        highValueFlag: true,
        isActive: true
      },
      include: [
        { model: sequelize.models.IngredientCategory, as: 'hierarchicalCategory' }
      ],
      order: [['unitCost', 'DESC']]
    });
  }
  
  static async findItemsExceedingThresholds(restaurantId, varianceData) {
    // Find items with variances exceeding their thresholds
    const items = await this.findAll({
      where: { restaurantId, isActive: true },
      include: [
        { model: sequelize.models.IngredientCategory, as: 'hierarchicalCategory' }
      ]
    });
    
    return items.filter(item => {
      const variance = varianceData.find(v => v.inventoryItemId === item.id);
      if (!variance) return false;
      
      return item.isVarianceSignificant(variance.quantityVariance, variance.valueVariance);
    });
  }
  
  static async getCategoryVarianceSummary(restaurantId, categoryPath = null) {
    // Get variance summary by category for Dave's drilling workflow
    const whereClause = { 
      restaurantId, 
      isActive: true 
    };
    
    if (categoryPath) {
      // Include items from specific category path and subcategories
      whereClause['$hierarchicalCategory.path$'] = { 
        [sequelize.Op.like]: `${categoryPath}%` 
      };
    }
    
    return this.findAll({
      where: whereClause,
      include: [
        { model: sequelize.models.IngredientCategory, as: 'hierarchicalCategory' }
      ],
      group: ['hierarchicalCategory.path'],
      attributes: [
        'hierarchicalCategory.path',
        [sequelize.fn('COUNT', sequelize.col('InventoryItem.id')), 'itemCount'],
        [sequelize.fn('AVG', sequelize.col('unitCost')), 'avgUnitCost'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN high_value_flag = true THEN 1 ELSE 0 END')), 'highValueCount']
      ]
    });
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
    },
    comment: 'DEPRECATED: Use categoryId instead. Will be removed in future migration.'
  },
  // New hierarchical category system (Task 1 integration)
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Allows gradual migration
    field: 'category_id',
    references: {
      model: 'ingredient_categories',
      key: 'id'
    }
  },
  // Dave's variance threshold system (Task 1 integration)
  varianceThresholdQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'variance_threshold_quantity',
    validate: {
      min: 0
    }
  },
  varianceThresholdDollar: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 50.00,
    field: 'variance_threshold_dollar',
    validate: {
      min: 0
    }
  },
  highValueFlag: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'high_value_flag'
  },
  theoreticalYieldFactor: {
    type: DataTypes.DECIMAL(4, 3),
    allowNull: false,
    defaultValue: 1.000,
    field: 'theoretical_yield_factor',
    validate: {
      min: 0.100,
      max: 2.000
    }
  },
  costPerUnitVariancePct: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 10.00,
    field: 'cost_per_unit_variance_pct',
    validate: {
      min: 0,
      max: 100
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
  currentStock: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'current_stock',
    validate: {
      min: 0
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
    field: 'location' // Maps to 'location' column in database
  },
  // TODO: notes field requires migration before enabling
  // notes: {
  //   type: DataTypes.TEXT,
  //   allowNull: true
  // },
  // POS source tracking (Issue #18 - Square Integration)
  sourcePosProvider: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'source_pos_provider',
    validate: {
      isIn: [['square', 'toast', 'clover', 'csv']]
    },
    comment: 'POS provider that this item was synced from (square, toast, clover, csv)'
  },
  sourcePosItemId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'source_pos_item_id',
    comment: 'Original item ID from POS system'
  },
  sourcePosData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'source_pos_data',
    comment: 'Additional POS-specific metadata for bi-directional sync'
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
      fields: ['category'] // Legacy category index
    },
    {
      fields: ['category_id'] // New hierarchical category index
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['expiration_date']
    },
    {
      fields: ['high_value_flag'] // Dave's priority system
    },
    {
      fields: ['variance_threshold_dollar']
    },
    {
      fields: ['name', 'restaurant_id'],
      unique: true
    },
    // POS source tracking index (Issue #18 - Square Integration)
    {
      fields: ['restaurant_id', 'source_pos_provider', 'source_pos_item_id'],
      name: 'idx_inventory_items_pos_source'
    },
    // Composite indexes for Dave's variance queries
    {
      fields: ['restaurant_id', 'high_value_flag']
    },
    {
      fields: ['category_id', 'high_value_flag'] 
    },
    {
      fields: ['variance_threshold_dollar', 'high_value_flag']
    }
  ]
});

export default InventoryItem;
