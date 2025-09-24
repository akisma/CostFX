import { DataTypes, Model, Op } from 'sequelize';
import sequelize from '../config/database.js';

class TheoreticalUsageAnalysis extends Model {
  static associate(models) {
    // Define associations for Dave's variance system
    TheoreticalUsageAnalysis.belongsTo(models.InventoryPeriod, {
      foreignKey: 'periodId',
      as: 'inventoryPeriod'
    });
    TheoreticalUsageAnalysis.belongsTo(models.InventoryItem, {
      foreignKey: 'inventoryItemId',
      as: 'inventoryItem'
    });
    // Investigation workflow associations
    TheoreticalUsageAnalysis.belongsTo(models.User, {
      foreignKey: 'assignedTo',
      as: 'assignee'
    });
    TheoreticalUsageAnalysis.belongsTo(models.User, {
      foreignKey: 'investigatedBy',
      as: 'investigator'
    });
  }

  // Instance methods for Dave's business logic

  getAbsoluteVariance() {
    // Dave cares about absolute impact regardless of direction
    return {
      quantity: Math.abs(this.varianceQuantity || 0),
      dollarValue: Math.abs(this.varianceDollarValue || 0),
      percentage: Math.abs(this.variancePercentage || 0)
    };
  }

  isHighImpactVariance() {
    // Dave's logic: high-impact variances need immediate attention
    const absVariance = Math.abs(this.varianceDollarValue || 0);
    return absVariance >= 100 || this.priority === 'critical' || this.priority === 'high';
  }

  getVarianceDirection() {
    // Determine if variance is overage (+) or shortage (-)
    const variance = this.varianceQuantity || 0;
    if (variance > 0) return 'overage';
    if (variance < 0) return 'shortage';
    return 'none';
  }

  getEfficiencyRatio() {
    // Calculate actual vs theoretical efficiency
    if (!this.theoreticalQuantity || this.theoreticalQuantity === 0) return null;
    return Number((this.actualQuantity / this.theoreticalQuantity).toFixed(4));
  }

  getDaysInInvestigation() {
    // How long has this been under investigation?
    if (this.investigationStatus === 'pending' || !this.assignedAt) return 0;
    
    const startDate = new Date(this.assignedAt);
    const endDate = this.resolvedAt ? new Date(this.resolvedAt) : new Date();
    return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
  }

  canBeResolved() {
    // Check if investigation can be marked as resolved
    return ['investigating', 'escalated'].includes(this.investigationStatus) && 
           this.investigatedBy && 
           this.investigationNotes;
  }

  async assignInvestigation(userId, notes = null) {
    // Assign investigation to a user with Dave's workflow
    await this.update({
      assignedTo: userId,
      investigationStatus: 'investigating',
      assignedAt: new Date(),
      investigationNotes: notes || this.investigationNotes
    });
    return this;
  }

  async resolveInvestigation(userId, explanation, resolution = 'resolved') {
    // Complete investigation with findings
    const updates = {
      investigatedBy: userId,
      investigationStatus: resolution,
      resolvedAt: new Date(),
      explanation: explanation
    };
    
    // If resolution shows no issue, mark as accepted
    if (resolution === 'resolved' && explanation.toLowerCase().includes('acceptable')) {
      updates.investigationStatus = 'accepted';
    }
    
    await this.update(updates);
    return this;
  }

  // Static methods for Dave's management queries

  static async findHighPriorityVariances(periodId = null, restaurantId = null) {
    // Get critical and high priority variances for Dave's attention
    const whereClause = {
      priority: { [Op.in]: ['critical', 'high'] }
    };
    
    if (periodId) whereClause.periodId = periodId;
    
    const include = [
      { model: sequelize.models.InventoryItem, as: 'inventoryItem' },
      { model: sequelize.models.InventoryPeriod, as: 'inventoryPeriod' }
    ];
    
    if (restaurantId) {
      include[1].where = { restaurantId };
    }

    return this.findAll({
      where: whereClause,
      include,
      order: [
        ['priority', 'DESC'],
        [sequelize.fn('ABS', sequelize.col('variance_dollar_value')), 'DESC']
      ]
    });
  }

  static async findPendingInvestigations(assignedTo = null) {
    // Get investigations awaiting action
    const whereClause = {
      investigationStatus: { [Op.in]: ['pending', 'investigating'] }
    };
    
    if (assignedTo) {
      whereClause.assignedTo = assignedTo;
    }

    return this.findAll({
      where: whereClause,
      include: [
        { model: sequelize.models.InventoryItem, as: 'inventoryItem' },
        { model: sequelize.models.InventoryPeriod, as: 'inventoryPeriod' },
        { model: sequelize.models.User, as: 'assignee' }
      ],
      order: [['assignedAt', 'ASC']] // Oldest first for Dave's queue
    });
  }

  static async getVarianceSummaryByPeriod(periodId) {
    // Dave's period-level variance summary
    const analyses = await this.findAll({
      where: { periodId },
      include: [
        { model: sequelize.models.InventoryItem, as: 'inventoryItem' }
      ]
    });

    const summary = {
      totalVariances: analyses.length,
      totalDollarImpact: 0,
      byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
      byStatus: { pending: 0, investigating: 0, resolved: 0, accepted: 0, escalated: 0 },
      significantCount: 0,
      averageVariancePercent: 0,
      topVariances: [],
      investigationMetrics: {
        totalAssigned: 0,
        averageDaysToResolve: 0,
        pendingCount: 0
      }
    };

    analyses.forEach(analysis => {
      summary.totalDollarImpact += Math.abs(analysis.varianceDollarValue);
      summary.byPriority[analysis.priority]++;
      summary.byStatus[analysis.investigationStatus]++;
      
      if (analysis.isSignificant) summary.significantCount++;
      if (analysis.assignedTo) summary.investigationMetrics.totalAssigned++;
      if (['pending', 'investigating'].includes(analysis.investigationStatus)) {
        summary.investigationMetrics.pendingCount++;
      }
    });

    // Calculate averages
    if (analyses.length > 0) {
      const validPercentages = analyses.filter(a => a.variancePercentage !== null);
      if (validPercentages.length > 0) {
        summary.averageVariancePercent = Number(
          (validPercentages.reduce((sum, a) => sum + Math.abs(a.variancePercentage), 0) / validPercentages.length).toFixed(2)
        );
      }
    }

    // Get top 10 variances by dollar impact
    summary.topVariances = analyses
      .sort((a, b) => Math.abs(b.varianceDollarValue) - Math.abs(a.varianceDollarValue))
      .slice(0, 10)
      .map(analysis => ({
        id: analysis.id,
        itemName: analysis.inventoryItem?.name,
        dollarVariance: analysis.varianceDollarValue,
        priority: analysis.priority,
        status: analysis.investigationStatus
      }));

    return summary;
  }

  static async findByDollarThreshold(threshold = 100, periodId = null) {
    // Find variances exceeding Dave's dollar threshold
    const whereClause = {
      [Op.or]: [
        { varianceDollarValue: { [Op.gte]: threshold } },
        { varianceDollarValue: { [Op.lte]: -threshold } }
      ]
    };
    
    if (periodId) whereClause.periodId = periodId;

    return this.findAll({
      where: whereClause,
      include: [
        { model: sequelize.models.InventoryItem, as: 'inventoryItem' },
        { model: sequelize.models.InventoryPeriod, as: 'inventoryPeriod' }
      ],
      order: [
        [sequelize.fn('ABS', sequelize.col('variance_dollar_value')), 'DESC']
      ]
    });
  }

  static async getInvestigationWorkload() {
    // Get investigation workload metrics for Dave's management
    const investigations = await this.findAll({
      where: {
        investigationStatus: { [Op.in]: ['pending', 'investigating', 'escalated'] }
      },
      include: [
        { model: sequelize.models.User, as: 'assignee' },
        { model: sequelize.models.InventoryItem, as: 'inventoryItem' }
      ]
    });

    const workload = {
      totalPending: 0,
      totalInvestigating: 0,
      totalEscalated: 0,
      byAssignee: {},
      oldestPending: null,
      highestDollarImpact: null
    };

    investigations.forEach(investigation => {
      const status = investigation.investigationStatus;
      if (status === 'pending') workload.totalPending++;
      else if (status === 'investigating') workload.totalInvestigating++;
      else if (status === 'escalated') workload.totalEscalated++;

      if (investigation.assignee) {
        const assigneeName = investigation.assignee.name || `User ${investigation.assignedTo}`;
        if (!workload.byAssignee[assigneeName]) {
          workload.byAssignee[assigneeName] = { pending: 0, investigating: 0, escalated: 0, total: 0 };
        }
        workload.byAssignee[assigneeName][status]++;
        workload.byAssignee[assigneeName].total++;
      }

      // Track metrics for Dave's attention
      if (status === 'pending' && (!workload.oldestPending || investigation.createdAt < workload.oldestPending.createdAt)) {
        workload.oldestPending = investigation;
      }

      if (!workload.highestDollarImpact || Math.abs(investigation.varianceDollarValue) > Math.abs(workload.highestDollarImpact.varianceDollarValue)) {
        workload.highestDollarImpact = investigation;
      }
    });

    return workload;
  }

  // Getter methods for formatted display
  get displayVariance() {
    return {
      quantity: `${this.varianceQuantity > 0 ? '+' : ''}${this.varianceQuantity}`,
      percentage: this.variancePercentage ? `${this.variancePercentage > 0 ? '+' : ''}${this.variancePercentage.toFixed(2)}%` : 'N/A',
      dollar: `${this.varianceDollarValue > 0 ? '+' : ''}$${Math.abs(this.varianceDollarValue).toFixed(2)}`
    };
  }

  get investigationSummary() {
    return {
      status: this.investigationStatus,
      assignedTo: this.assignedTo,
      daysInProgress: this.getDaysInInvestigation(),
      canResolve: this.canBeResolved(),
      hasExplanation: !!this.explanation
    };
  }

  toJSON() {
    const values = { ...this.get() };
    // Add calculated fields for Dave's interface
    values.absoluteVariance = this.getAbsoluteVariance();
    values.isHighImpact = this.isHighImpactVariance();
    values.varianceDirection = this.getVarianceDirection();
    values.efficiencyRatio = this.getEfficiencyRatio();
    values.daysInInvestigation = this.getDaysInInvestigation();
    values.displayVariance = this.displayVariance;
    values.investigationSummary = this.investigationSummary;
    return values;
  }
}

TheoreticalUsageAnalysis.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  periodId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'period_id',
    references: {
      model: 'inventory_periods',
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
  // Usage calculations
  theoreticalQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'theoretical_quantity',
    validate: {
      min: 0
    }
  },
  actualQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'actual_quantity'
  },
  unitCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'unit_cost',
    validate: {
      min: 0
    }
  },
  // Dave's variance metrics
  varianceQuantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'variance_quantity'
  },
  variancePercentage: {
    type: DataTypes.DECIMAL(8, 4),
    allowNull: true,
    field: 'variance_percentage'
  },
  varianceDollarValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'variance_dollar_value'
  },
  // Dave's priority and significance flags
  priority: {
    type: DataTypes.ENUM('critical', 'high', 'medium', 'low'),
    allowNull: false,
    defaultValue: 'low'
  },
  isSignificant: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_significant'
  },
  requiresInvestigation: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'requires_investigation'
  },
  // Investigation workflow
  investigationStatus: {
    type: DataTypes.ENUM('pending', 'investigating', 'resolved', 'accepted', 'escalated'),
    allowNull: false,
    defaultValue: 'pending',
    field: 'investigation_status'
  },
  explanation: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  assignedTo: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'assigned_to',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  investigatedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'investigated_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  assignedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'assigned_at'
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'resolved_at'
  },
  investigationNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'investigation_notes'
  },
  // Calculation metadata
  calculationMethod: {
    type: DataTypes.ENUM('recipe_based', 'historical_average', 'manual', 'ai_predicted'),
    allowNull: false,
    defaultValue: 'recipe_based',
    field: 'calculation_method'
  },
  recipeData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'recipe_data'
  },
  calculationConfidence: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    field: 'calculation_confidence',
    validate: {
      min: 0.0,
      max: 1.0
    }
  },
  calculatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'calculated_at'
  }
}, {
  sequelize,
  modelName: 'TheoreticalUsageAnalysis',
  tableName: 'theoretical_usage_analysis',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['period_id']
    },
    {
      fields: ['inventory_item_id']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['investigation_status']
    },
    {
      fields: ['variance_dollar_value']
    },
    {
      fields: ['is_significant']
    },
    {
      fields: ['requires_investigation']
    },
    {
      fields: ['assigned_to']
    },
    {
      fields: ['calculated_at']
    },
    // Composite indexes for Dave's queries
    {
      fields: ['period_id', 'priority']
    },
    {
      fields: ['period_id', 'is_significant']
    },
    {
      fields: ['period_id', 'investigation_status']
    },
    {
      fields: ['priority', 'investigation_status']
    },
    {
      fields: ['variance_dollar_value', 'priority']
    },
    {
      fields: ['assigned_to', 'investigation_status']
    }
  ]
});

export default TheoreticalUsageAnalysis;
