import path from 'path';
import settings from '../../config/settings.js';
import CsvUpload from '../../models/CsvUpload.js';
import CsvParserService from './CsvParserService.js';
import { CSV_UPLOAD_TYPES } from './csvSchemas.js';
import logger from '../../utils/logger.js';
import { BadRequestError, ValidationError } from '../../middleware/errorHandler.js';

function validateFileConstraints(file) {
  const { uploads } = settings;
  const csvSettings = uploads?.csv;

  if (!csvSettings) {
    throw new BadRequestError('CSV upload settings are not configured');
  }

  if (!file || !file.buffer) {
    throw new BadRequestError('No file uploaded');
  }

  if (file.size > csvSettings.maxFileSizeBytes) {
    throw new BadRequestError(`File exceeds maximum allowed size of ${csvSettings.maxFileSizeBytes} bytes`);
  }

  const extension = path.extname(file.originalname || '').toLowerCase();
  if (csvSettings.allowedExtensions.length > 0 && !csvSettings.allowedExtensions.includes(extension)) {
    throw new BadRequestError(`Unsupported file extension ${extension}. Allowed extensions: ${csvSettings.allowedExtensions.join(', ')}`);
  }

  if (csvSettings.allowedMimeTypes.length > 0 && !csvSettings.allowedMimeTypes.includes(file.mimetype)) {
    throw new BadRequestError(`Unsupported MIME type ${file.mimetype}. Allowed types: ${csvSettings.allowedMimeTypes.join(', ')}`);
  }

  return { extension, csvSettings };
}

function resolveUploadType(uploadType) {
  const type = uploadType?.toLowerCase();
  if (!Object.values(CSV_UPLOAD_TYPES).includes(type)) {
    throw new BadRequestError(`Unsupported CSV upload type: ${uploadType}`);
  }
  return type;
}

export default class CsvUploadService {
  static async processUpload({ restaurantId, uploadType, file, userId = null }) {
    const { extension } = validateFileConstraints(file);
    const resolvedType = resolveUploadType(uploadType);

    const uploadRecord = await CsvUpload.create({
      restaurantId,
      uploadType: resolvedType,
      filename: file.originalname,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
      extension,
      status: 'uploaded',
      metadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString()
      }
    });

    const parserService = new CsvParserService(resolvedType);

    try {
      const summary = await parserService.parseAndPersist({
        upload: uploadRecord,
        fileBuffer: file.buffer
      });

      uploadRecord.status = 'validated';
      uploadRecord.rowsTotal = summary.rowsTotal;
      uploadRecord.rowsValid = summary.rowsValid;
      uploadRecord.rowsInvalid = summary.rowsInvalid;
      uploadRecord.validationErrors = summary.validationErrors;
      uploadRecord.metadata = {
        ...uploadRecord.metadata,
        ...summary.metadata
      };
      await uploadRecord.save();

      logger.info('CSV upload validated', {
        uploadId: uploadRecord.id,
        restaurantId,
        uploadType: resolvedType,
        rowsTotal: summary.rowsTotal,
        rowsValid: summary.rowsValid,
        rowsInvalid: summary.rowsInvalid
      });

      return {
        uploadId: uploadRecord.id,
        filename: uploadRecord.filename,
        status: uploadRecord.status,
        rowsTotal: summary.rowsTotal,
        rowsValid: summary.rowsValid,
        rowsInvalid: summary.rowsInvalid,
        validationErrors: summary.validationErrors,
        metadata: summary.metadata,
        readyForTransform: summary.readyForTransform
      };
    } catch (error) {
      logger.error('CSV upload validation failed', {
        uploadId: uploadRecord.id,
        restaurantId,
        uploadType: resolvedType,
        error: error.message
      });

      await uploadRecord.update({
        status: 'failed',
        validationErrors: error.details || { message: error.message }
      });

      if (error.code === 'CSV_HEADER_MISSING') {
        throw new ValidationError(error.message);
      }

      throw error;
    }
  }
}
