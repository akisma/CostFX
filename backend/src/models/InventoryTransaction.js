import { DataTypes, Model, Op } from 'sequelize';
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
    // New association for Dave's period management
    InventoryTransaction.belongsTo(models.InventoryPeriod, {
      foreignKey: 'periodId',
      as: 'inventoryPeriod'
    });
    // Association for approval tracking
    InventoryTransaction.belongsTo(models.User, {
      foreignKey: 'approvedBy',
      as: 'approver'
    });
    InventoryTransaction.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
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

  // Dave's variance analysis methods
  isVarianceTransaction() {
    // Returns true if this transaction represents a variance/discrepancy
    return ['waste', 'adjustment_in', 'adjustment_out'].includes(this.type) || 
           this.varianceCategory !== null;
  }

  requiresApprovalCheck(inventoryItem) {
    // Dave's logic: High-value variances need approval
    if (!this.isVarianceTransaction()) return false;
    
    const costImpact = this.costImpact || this.getTransactionValue();
    
    // Always require approval for high-value items
    if (inventoryItem?.highValueFlag && Math.abs(costImpact) > 50) {
      return true;
    }
    
    // Require approval for large dollar impacts
    if (Math.abs(costImpact) > 100) {
      return true;
    }
    
    // Require approval for theft or receiving errors
    if (['theft', 'receiving_error'].includes(this.varianceCategory)) {
      return true;
    }
    
    return false;
  }

  getVarianceSeverity() {
    // Dave's severity classification for variance transactions
    if (!this.isVarianceTransaction()) return 'NONE';
    
    const costImpact = Math.abs(this.costImpact || this.getTransactionValue());
    
    if (costImpact > 500) return 'CRITICAL';
    if (costImpact > 200) return 'HIGH';
    if (costImpact > 50) return 'MEDIUM';
    return 'LOW';
  }

  getCategoryDescription() {
    // User-friendly descriptions for Dave's reports
    const categoryDescriptions = {
      'waste': 'Food Waste/Spoilage',
      'theft': 'Suspected Theft',
      'measurement_error': 'Measurement/Counting Error',
      'spoilage': 'Spoiled Product',
      'transfer': 'Location Transfer',
      'adjustment': 'Inventory Adjustment',
      'receiving_error': 'Receiving Discrepancy',
      'other': 'Other Variance'
    };
    
    return categoryDescriptions[this.varianceCategory] || this.varianceCategory || 'Normal Transaction';
  }

  isApproved() {
    // Check if transaction is approved (or doesn't need approval)
    return !this.requiresApproval || (this.approvedBy && this.approvalDate);
  }

  getDaysAwaitingApproval() {
    // How long has this been waiting for approval?
    if (this.isApproved()) return 0;
    
    const now = new Date();
    const created = new Date(this.createdAt);
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  }

  // Static methods for Dave's queries
  static async findVarianceTransactions(periodId, options = {}) {
    const whereClause = {
      periodId,
      [Op.or]: [
        { varianceCategory: { [Op.ne]: null } },
        { type: { [Op.in]: ['waste', 'adjustment_in', 'adjustment_out'] } }
      ]
    };

    if (options.severity) {
      // Would need to filter after querying since severity is calculated
      const transactions = await this.findAll({
        where: whereClause,
        include: options.include || ['inventoryItem', 'inventoryPeriod'],
        order: [['transactionDate', 'DESC']]
      });
      
      return transactions.filter(t => t.getVarianceSeverity() === options.severity);
    }

    return this.findAll({
      where: whereClause,
      include: options.include || ['inventoryItem', 'inventoryPeriod'],
      order: [['transactionDate', 'DESC']]
    });
  }

  static async findUnapprovedVariances(restaurantId = null) {
    const whereClause = {
      requiresApproval: true,
      approvedBy: null
    };
    
    if (restaurantId) {
      whereClause.restaurantId = restaurantId;
    }

    return this.findAll({
      where: whereClause,
      include: ['inventoryItem', 'restaurant', 'user'],
      order: [['createdAt', 'ASC']] // Oldest first for Dave's approval queue
    });
  }

  static async getVarianceSummaryByCategory(periodId) {
    // Dave's summary view by variance category
    const transactions = await this.findAll({
      where: {
        periodId,
        varianceCategory: { [Op.ne]: null }
      },
      include: ['inventoryItem']
    });

    const summary = {};
    transactions.forEach(transaction => {
      const category = transaction.varianceCategory;
      if (!summary[category]) {
        summary[category] = {
          category,
          description: transaction.getCategoryDescription(),
          count: 0,
          totalCostImpact: 0,
          transactions: []
        };
      }
      
      summary[category].count++;
      summary[category].totalCostImpact += Number(transaction.costImpact || transaction.getTransactionValue());
      summary[category].transactions.push(transaction);
    });

    return Object.values(summary).sort((a, b) => Math.abs(b.totalCostImpact) - Math.abs(a.totalCostImpact));
  }

  toJSON() {
    const values = { ...this.get() };
    // Add calculated fields
    values.transactionValue = this.getTransactionValue();
    values.stockImpact = this.getImpactOnStock();
    values.isVariance = this.isVarianceTransaction();
    values.severity = this.getVarianceSeverity();
    values.categoryDescription = this.getCategoryDescription();
    values.isApproved = this.isApproved();
    values.daysAwaitingApproval = this.getDaysAwaitingApproval();
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
  },
  // Dave's period management and variance tracking fields
  periodId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'period_id',
    references: {
      model: 'inventory_periods',
      key: 'id'
    },
    comment: 'Links transaction to specific inventory period for variance analysis'
  },
  varianceReason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'variance_reason',
    comment: 'Detailed explanation for variance adjustments'
  },
  varianceCategory: {
    type: DataTypes.ENUM('waste', 'theft', 'measurement_error', 'spoilage', 'transfer', 'adjustment', 'receiving_error', 'other'),
    allowNull: true,
    field: 'variance_category',
    comment: 'Categorized reason for variance'
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'approved_by',
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'User ID who approved this variance transaction'
  },
  approvalDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'approval_date',
    comment: 'When the variance was approved'
  },
  costImpact: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'cost_impact',
    comment: 'Dollar impact of this transaction for variance reporting'
  },
  requiresApproval: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'requires_approval',
    comment: 'Whether this transaction requires management approval'
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
    },
    // Dave's variance analysis indexes
    {
      fields: ['period_id']
    },
    {
      fields: ['variance_category']
    },
    {
      fields: ['approved_by']
    },
    {
      fields: ['approval_date']
    },
    {
      fields: ['requires_approval']
    },
    {
      fields: ['cost_impact']
    },
    // Composite indexes for Dave's queries
    {
      fields: ['period_id', 'variance_category']
    },
    {
      fields: ['period_id', 'transaction_date']
    },
    {
      fields: ['restaurant_id', 'period_id']
    },
    {
      fields: ['variance_category', 'cost_impact']
    }
  ]
});

export default InventoryTransaction;
