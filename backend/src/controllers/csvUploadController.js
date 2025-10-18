import CsvUploadService from '../services/csv/CsvUploadService.js';
import { CSV_UPLOAD_TYPES } from '../services/csv/csvSchemas.js';
import logger from '../utils/logger.js';
import { BadRequestError } from '../middleware/errorHandler.js';

function resolveRestaurantId(req) {
  const fromUser = req.user?.restaurantId;
  const fromBody = req.body?.restaurantId;
  if (fromBody) {
    const parsed = Number(fromBody);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fromUser || 1; // Development default
}

async function handleUpload(req, res, uploadType) {
  if (!req.file) {
    throw new BadRequestError('CSV file is required under form field "file"');
  }

  const restaurantId = resolveRestaurantId(req);
  const result = await CsvUploadService.processUpload({
    restaurantId,
    uploadType,
    file: req.file,
    userId: req.user?.id || null
  });

  logger.info('CSV upload processed', {
    uploadId: result.uploadId,
    restaurantId,
    uploadType,
    rowsTotal: result.rowsTotal,
    rowsValid: result.rowsValid,
    rowsInvalid: result.rowsInvalid
  });

  res.status(201).json({
    uploadId: result.uploadId,
    filename: result.filename,
    status: result.status,
    rowsTotal: result.rowsTotal,
    rowsValid: result.rowsValid,
    rowsInvalid: result.rowsInvalid,
    validationErrors: result.validationErrors,
    metadata: result.metadata,
    readyForTransform: result.readyForTransform
  });
}

export const uploadInventoryCsv = async (req, res, next) => {
  try {
    await handleUpload(req, res, CSV_UPLOAD_TYPES.INVENTORY);
  } catch (error) {
    next(error);
  }
};

export const uploadSalesCsv = async (req, res, next) => {
  try {
    await handleUpload(req, res, CSV_UPLOAD_TYPES.SALES);
  } catch (error) {
    next(error);
  }
};
