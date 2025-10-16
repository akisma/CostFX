import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class CsvTransform extends Model {
  static associate(models) {
    CsvTransform.belongsTo(models.CsvUpload, {
      foreignKey: 'uploadId',
      as: 'upload'
    });
  }
}

CsvTransform.init({
  uploadId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'upload_id'
  },
  restaurantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'restaurant_id'
  },
  transformType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'transform_type'
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'processing'
  },
  dryRun: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'dry_run'
  },
  processedCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'processed_count'
  },
  createdCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'created_count'
  },
  updatedCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'updated_count'
  },
  skippedCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'skipped_count'
  },
  errorCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'error_count'
  },
  errorRate: {
    type: DataTypes.DECIMAL(6, 3),
    allowNull: false,
    defaultValue: 0,
    field: 'error_rate'
  },
  summary: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  errors: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'completed_at'
  }
}, {
  sequelize,
  modelName: 'CsvTransform',
  tableName: 'csv_transforms',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default CsvTransform;
