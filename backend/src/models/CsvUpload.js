import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class CsvUpload extends Model {
  static associate(models) {
    CsvUpload.belongsTo(models.Restaurant, {
      foreignKey: 'restaurantId',
      as: 'restaurant'
    });

    CsvUpload.hasMany(models.CsvUploadBatch, {
      foreignKey: 'uploadId',
      as: 'batches'
    });
  }

  isValidated() {
    return this.status === 'validated';
  }

  isFailed() {
    return this.status === 'failed';
  }

  markValidated(summary = {}) {
    this.status = 'validated';
    this.validationErrors = summary.validationErrors || this.validationErrors;
    this.rowsTotal = summary.rowsTotal ?? this.rowsTotal;
    this.rowsValid = summary.rowsValid ?? this.rowsValid;
    this.rowsInvalid = summary.rowsInvalid ?? this.rowsInvalid;
    return this.save();
  }

  markFailed(errorSummary) {
    this.status = 'failed';
    this.validationErrors = errorSummary;
    return this.save();
  }
}

CsvUpload.init({
  restaurantId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'restaurant_id'
  },
  uploadType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'upload_type',
    validate: {
      isIn: [['inventory', 'sales']]
    }
  },
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  fileSizeBytes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'file_size_bytes'
  },
  mimeType: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'mime_type'
  },
  extension: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'uploaded'
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
  validationErrors: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'validation_errors'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'CsvUpload',
  tableName: 'csv_uploads',
  timestamps: true,
  underscored: true
});

export default CsvUpload;
