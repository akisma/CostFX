import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class CsvUploadBatch extends Model {
  static associate(models) {
    CsvUploadBatch.belongsTo(models.CsvUpload, {
      foreignKey: 'uploadId',
      as: 'upload'
    });
  }
}

CsvUploadBatch.init({
  uploadId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'upload_id'
  },
  batchIndex: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'batch_index'
  },
  rowsTotal: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'rows_total'
  },
  rowsValid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'rows_valid'
  },
  rowsInvalid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'rows_invalid'
  },
  rows: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  errors: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  }
}, {
  sequelize,
  modelName: 'CsvUploadBatch',
  tableName: 'csv_upload_batches',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      fields: ['upload_id', 'batch_index'],
      unique: true
    }
  ]
});

export default CsvUploadBatch;
