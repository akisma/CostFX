import { DataTypes, Model } from 'sequelize';
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
    // Investigation workflow associations (User model not yet implemented)
    // TheoreticalUsageAnalysis.belongsTo(models.User, {
    //   foreignKey: 'assignedTo',
    //   as: 'assignee'
    // });
    // TheoreticalUsageAnalysis.belongsTo(models.User, {
    //   foreignKey: 'investigatedBy',
    //   as: 'investigator'
    // });
  }

  // NOTE: All instance methods (variance calculations and workflow) have been moved to services:
  // - VarianceAnalysisService: getAbsoluteVariance, isHighImpactVariance, getVarianceDirection, getEfficiencyRatio
  // - InvestigationWorkflowService: getDaysInInvestigation, canBeResolved, assignInvestigation, resolveInvestigation

  // NOTE: All static query methods have been moved to services:
  // - VarianceAnalysisService: findHighPriorityVariances, findByDollarThreshold, getVarianceSummaryByPeriod
  // - InvestigationWorkflowService: findPendingInvestigations, getInvestigationWorkload

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
      // NOTE: Removed calls to getDaysInInvestigation() and canBeResolved() - use InvestigationWorkflowService
      hasExplanation: !!this.explanation
    };
  }

  toJSON() {
    const values = { ...this.get() };
    // NOTE: Calculated fields now provided by VarianceAnalysisService and InvestigationWorkflowService
    // Use service.enrichAnalysisData() or service.enrichWithWorkflowData() for computed properties
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
