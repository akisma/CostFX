import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class PeriodInventorySnapshot extends Model {
  static associate(models) {
    // Define associations
    PeriodInventorySnapshot.belongsTo(models.InventoryPeriod, {
      foreignKey: 'periodId',
      as: 'period'
    });
    
    PeriodInventorySnapshot.belongsTo(models.InventoryItem, {
      foreignKey: 'inventoryItemId',
      as: 'inventoryItem'
    });
    
    // Future association when User model is implemented
    // PeriodInventorySnapshot.belongsTo(models.User, {
    //   foreignKey: 'countedBy',
    //   as: 'counter'
    // });
  }

  // Instance methods for Dave's business logic
  
  async calculateVariance(comparisonSnapshot) {
    // Calculate variance between this snapshot and another (e.g., beginning vs ending)
    if (!comparisonSnapshot) {
      throw new Error('Comparison snapshot required for variance calculation');
    }
    
    const quantityVariance = this.quantity - comparisonSnapshot.quantity;
    const valueVariance = this.totalValue - comparisonSnapshot.totalValue;
    
    // Calculate percentage variance (Dave's business requirement)
    const quantityVariancePct = comparisonSnapshot.quantity !== 0 
      ? (quantityVariance / comparisonSnapshot.quantity) * 100 
      : 0;
    
    const valueVariancePct = comparisonSnapshot.totalValue !== 0
      ? (valueVariance / comparisonSnapshot.totalValue) * 100
      : 0;

    return {
      quantityVariance,
      valueVariance,
      quantityVariancePct,
      valueVariancePct,
      isSignificant: await this.isVarianceSignificant(quantityVariance, valueVariance)
    };
  }

  async isVarianceSignificant(quantityVariance, valueVariance) {
    // Dave's business logic: significant if exceeds item thresholds
    await this.reload({ include: [{ model: sequelize.models.InventoryItem, as: 'inventoryItem' }] });
    
    const item = this.inventoryItem;
    if (!item) return false;

    const absQuantityVariance = Math.abs(quantityVariance);
    const absValueVariance = Math.abs(valueVariance);

    // Check against Dave's thresholds (from Task 1)
    return absQuantityVariance > (item.varianceThresholdQuantity || 0) ||
           absValueVariance > (item.varianceThresholdDollar || 50);
  }

  async verify(userId = null) {
    // Mark snapshot as verified and locked
    if (this.verified) {
      throw new Error('Snapshot is already verified and cannot be modified');
    }

    await this.update({ 
      verified: true,
      // Could add verifiedBy and verifiedAt fields in future enhancement
    });
    
    return this;
  }

  async addAdjustment(newQuantity, reason, adjustedBy = null) {
    // Allow adjustments only if not verified
    if (this.verified) {
      throw new Error('Cannot adjust verified snapshot');
    }

    const oldQuantity = this.quantity;
    const newTotalValue = newQuantity * this.unitCost;

    await this.update({
      quantity: newQuantity,
      totalValue: newTotalValue,
      adjustmentReason: reason,
      varianceNotes: this.varianceNotes 
        ? `${this.varianceNotes}\nAdjusted from ${oldQuantity} to ${newQuantity}: ${reason}`
        : `Adjusted from ${oldQuantity} to ${newQuantity}: ${reason}`
    });

    return this;
  }

  // Static methods for Dave's workflow
  
  static async createSnapshot(snapshotData) {
    // Ensure total_value is calculated
    const totalValue = snapshotData.quantity * snapshotData.unitCost;
    
    return this.create({
      ...snapshotData,
      totalValue,
      countedAt: snapshotData.countedAt || new Date()
    });
  }

  static async findSnapshotsForPeriod(periodId, snapshotType = null) {
    const whereClause = { periodId };
    if (snapshotType) {
      whereClause.snapshotType = snapshotType;
    }

    return this.findAll({
      where: whereClause,
      include: [
        { model: sequelize.models.InventoryItem, as: 'inventoryItem' },
        { model: sequelize.models.InventoryPeriod, as: 'period' }
      ],
      order: [['countedAt', 'DESC']]
    });
  }

  static async getVarianceAnalysis(periodId) {
    // Get both beginning and ending snapshots for variance analysis
    const beginningSnapshots = await this.findSnapshotsForPeriod(periodId, 'beginning');
    const endingSnapshots = await this.findSnapshotsForPeriod(periodId, 'ending');

    // Create map for easy lookup
    const beginningMap = new Map();
    beginningSnapshots.forEach(snap => {
      beginningMap.set(snap.inventoryItemId, snap);
    });

    const varianceResults = [];
    
    for (const endingSnapshot of endingSnapshots) {
      const beginningSnapshot = beginningMap.get(endingSnapshot.inventoryItemId);
      
      if (beginningSnapshot) {
        const variance = await endingSnapshot.calculateVariance(beginningSnapshot);
        
        varianceResults.push({
          inventoryItemId: endingSnapshot.inventoryItemId,
          itemName: endingSnapshot.inventoryItem?.name,
          beginningQuantity: beginningSnapshot.quantity,
          endingQuantity: endingSnapshot.quantity,
          beginningValue: beginningSnapshot.totalValue,
          endingValue: endingSnapshot.totalValue,
          ...variance
        });
      }
    }

    // Sort by absolute value variance (Dave's priority: dollar impact first)
    return varianceResults.sort((a, b) => 
      Math.abs(b.valueVariance) - Math.abs(a.valueVariance)
    );
  }

  static async bulkCreateSnapshots(periodId, snapshotType, itemCounts) {
    // Helper for creating multiple snapshots at once (performance optimization)
    const snapshots = itemCounts.map(item => ({
      periodId,
      inventoryItemId: item.inventoryItemId,
      snapshotType,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalValue: item.quantity * item.unitCost,
      countedBy: item.countedBy,
      varianceNotes: item.notes,
      countedAt: item.countedAt || new Date()
    }));

    return this.bulkCreate(snapshots, {
      validate: true,
      individualHooks: true // Ensure model validations run
    });
  }

  static async getIncompleteSnapshots(periodId) {
    // Find items that need snapshots for a period
    // This would require joining with inventory_items to find missing snapshots
    // Implementation would depend on business requirements for "required" vs "optional" items
    
    const allSnapshots = await this.findSnapshotsForPeriod(periodId);
    const period = await sequelize.models.InventoryPeriod.findByPk(periodId);
    
    if (!period) {
      throw new Error('Period not found');
    }

    // Group by snapshot type
    const snapshotsByType = {
      beginning: allSnapshots.filter(s => s.snapshotType === 'beginning'),
      ending: allSnapshots.filter(s => s.snapshotType === 'ending')
    };

    return {
      period,
      beginningComplete: snapshotsByType.beginning.length > 0,
      endingComplete: snapshotsByType.ending.length > 0,
      snapshots: snapshotsByType
    };
  }

  // Getter for formatted display
  get displayValue() {
    return `${this.quantity} @ $${this.unitCost} = $${this.totalValue}`;
  }
}

PeriodInventorySnapshot.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  periodId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'inventory_periods',
      key: 'id'
    },
    field: 'period_id'
  },
  inventoryItemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'inventory_items',
      key: 'id'
    },
    field: 'inventory_item_id'
  },
  snapshotType: {
    type: DataTypes.ENUM('beginning', 'ending'),
    allowNull: false,
    field: 'snapshot_type'
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  unitCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'unit_cost',
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  totalValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'total_value',
    validate: {
      min: 0,
      isDecimal: true
    }
  },
  countedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'counted_by'
  },
  countedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'counted_at',
    defaultValue: DataTypes.NOW
  },
  varianceNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'variance_notes'
  },
  adjustmentReason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'adjustment_reason'
  },
  verified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  sequelize,
  modelName: 'PeriodInventorySnapshot',
  tableName: 'period_inventory_snapshots',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['period_id', 'inventory_item_id', 'snapshot_type'],
      name: 'unique_period_item_snapshot'
    },
    {
      fields: ['period_id', 'snapshot_type']
    },
    {
      fields: ['verified']
    }
  ],
  hooks: {
    beforeCreate: (snapshot) => {
      // Ensure total_value is calculated
      if (snapshot.quantity && snapshot.unitCost) {
        snapshot.totalValue = snapshot.quantity * snapshot.unitCost;
      }
    },
    beforeUpdate: (snapshot) => {
      // Recalculate total_value if quantity or unit_cost changed
      if (snapshot.changed('quantity') || snapshot.changed('unitCost')) {
        snapshot.totalValue = snapshot.quantity * snapshot.unitCost;
      }
    }
  }
});

export default PeriodInventorySnapshot;
