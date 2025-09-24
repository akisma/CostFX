import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class InventoryPeriod extends Model {
  static associate(models) {
    // Define associations
    InventoryPeriod.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant'
    });
    
    // Future associations for related tables (when implemented)
    // InventoryPeriod.hasMany(models.PeriodInventorySnapshot, {
    //   foreignKey: 'periodId',
    //   as: 'snapshots'
    // });
    
    // InventoryPeriod.hasMany(models.VarianceInvestigation, {
    //   foreignKey: 'periodId',
    //   as: 'investigations'
    // });
  }

  // Instance methods for Dave's business logic
  async canBeClosed() {
    // Period can be closed if both snapshots are completed
    return this.beginning_snapshot_completed && this.ending_snapshot_completed;
  }

  async isOverlapping(startDate, endDate, excludeStatuses = ['draft']) {
    // Check if this period overlaps with given date range
    // Exclude draft periods from overlap check as they can be modified
    if (excludeStatuses.includes(this.status)) {
      return false;
    }

    const periodStart = new Date(this.period_start);
    const periodEnd = new Date(this.period_end);
    const checkStart = new Date(startDate);
    const checkEnd = new Date(endDate);

    // Check for any overlap: start1 < end2 AND start2 < end1
    return periodStart < checkEnd && checkStart < periodEnd;
  }

  async updateStatus(newStatus, userId = null) {
    // Status transition validation
    const validTransitions = {
      'draft': ['active'],
      'active': ['closed'],
      'closed': ['locked'],
      'locked': [] // Final state
    };

    if (!validTransitions[this.status]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
    }

    // Update status with audit trail
    const updateData = { status: newStatus };
    
    if (newStatus === 'closed') {
      updateData.closed_by = userId;
      updateData.closed_at = new Date();
      
      // Validate closure requirements
      if (!await this.canBeClosed()) {
        throw new Error('Cannot close period: both beginning and ending snapshots must be completed');
      }
    }

    await this.update(updateData);
    return this;
  }

  async getDurationInDays() {
    const start = new Date(this.period_start);
    const end = new Date(this.period_end);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
  }

  // Static methods for period management
  static async findActivePeriodsForRestaurant(restaurantId) {
    return this.findAll({
      where: {
        restaurantId,
        status: ['active', 'closed']
      },
      order: [['period_start', 'DESC']]
    });
  }

  static async findOverlappingPeriods(restaurantId, startDate, endDate, excludeId = null) {
    const whereClause = {
      restaurantId,
      status: ['active', 'closed', 'locked'], // Don't include draft periods
      [sequelize.Sequelize.Op.or]: [
        // Period starts before our end date AND ends after our start date
        {
          period_start: { [sequelize.Sequelize.Op.lt]: endDate },
          period_end: { [sequelize.Sequelize.Op.gt]: startDate }
        }
      ]
    };

    if (excludeId) {
      whereClause.id = { [sequelize.Sequelize.Op.ne]: excludeId };
    }

    return this.findAll({ where: whereClause });
  }

  static async createPeriod(periodData) {
    // Validate no overlapping periods exist
    const overlapping = await this.findOverlappingPeriods(
      periodData.restaurantId,
      periodData.period_start,
      periodData.period_end
    );

    if (overlapping.length > 0) {
      throw new Error(`Period overlaps with existing period: ${overlapping[0].period_name}`);
    }

    return this.create(periodData);
  }

  // Getter for formatted period name
  get displayName() {
    const start = new Date(this.period_start);
    const end = new Date(this.period_end);
    
    if (this.period_type === 'weekly') {
      return `Week of ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    } else if (this.period_type === 'monthly') {
      return `${start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    } else {
      return `${this.period_name} (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`;
    }
  }
}

InventoryPeriod.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  restaurantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Restaurants',
      key: 'id'
    },
    field: 'restaurant_id'
  },
  periodName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'period_name'
  },
  periodStart: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'period_start',
    validate: {
      isDate: true,
      isBeforeEnd(value) {
        if (this.periodEnd && new Date(value) >= new Date(this.periodEnd)) {
          throw new Error('Period start must be before period end');
        }
      }
    }
  },
  periodEnd: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'period_end',
    validate: {
      isDate: true,
      isAfterStart(value) {
        if (this.periodStart && new Date(value) <= new Date(this.periodStart)) {
          throw new Error('Period end must be after period start');
        }
      }
    }
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'closed', 'locked'),
    allowNull: false,
    defaultValue: 'draft'
  },
  periodType: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'custom'),
    allowNull: false,
    defaultValue: 'weekly',
    field: 'period_type'
  },
  beginningSnapshotCompleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'beginning_snapshot_completed'
  },
  endingSnapshotCompleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'ending_snapshot_completed'
  },
  varianceAnalysisCompleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'variance_analysis_completed'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'created_by'
  },
  closedBy: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'closed_by'
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'closed_at'
  }
}, {
  sequelize,
  modelName: 'InventoryPeriod',
  tableName: 'inventory_periods',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeValidate: (period) => {
      // Auto-generate period name if not provided
      if (!period.periodName && period.periodStart && period.periodEnd) {
        const start = new Date(period.periodStart);
        const end = new Date(period.periodEnd);
        
        if (period.periodType === 'weekly') {
          const weekNum = Math.ceil(start.getDate() / 7);
          period.periodName = `Week ${weekNum} ${start.getFullYear()}`;
        } else if (period.periodType === 'monthly') {
          period.periodName = `${start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        } else {
          period.periodName = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
        }
      }
    }
  }
});

export default InventoryPeriod;
