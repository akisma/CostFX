import csvTransformService from '../services/csv/CsvTransformService.js';
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
  return fromUser || 1;
}

function resolveDryRunFlag(req) {
  if (typeof req.query?.dryRun === 'string') {
    return ['true', '1', 'yes'].includes(req.query.dryRun.toLowerCase());
  }
  if (typeof req.body?.dryRun === 'boolean') {
    return req.body.dryRun;
  }
  return false;
}

export const transformInventoryUpload = async (req, res, next) => {
  try {
    const uploadId = Number(req.params.uploadId);
    if (Number.isNaN(uploadId)) {
      throw new BadRequestError('uploadId must be a valid integer');
    }

    const restaurantId = resolveRestaurantId(req);
    const dryRun = resolveDryRunFlag(req);

    const result = await csvTransformService.transformInventoryUpload({
      uploadId,
      restaurantId,
      dryRun
    });

    logger.info('CSV inventory transform completed', {
      uploadId,
      transformId: result.transformId,
      status: result.status,
      dryRun
    });

    res.status(200).json({
      transformId: result.transformId,
      uploadId: result.uploadId,
      restaurantId: result.restaurantId,
      status: result.status,
      dryRun: result.dryRun,
      errorRate: result.errorRate,
      summary: result.summary,
      errors: result.errors
    });
  } catch (error) {
    next(error);
  }
};

export const transformSalesUpload = async (req, res, next) => {
  try {
    const uploadId = Number(req.params.uploadId);
    if (Number.isNaN(uploadId)) {
      throw new BadRequestError('uploadId must be a valid integer');
    }

    const restaurantId = resolveRestaurantId(req);
    const dryRun = resolveDryRunFlag(req);

    const result = await csvTransformService.transformSalesUpload({
      uploadId,
      restaurantId,
      dryRun
    });

    logger.info('CSV sales transform completed', {
      uploadId,
      transformId: result.transformId,
      status: result.status,
      dryRun
    });

    res.status(200).json({
      transformId: result.transformId,
      uploadId: result.uploadId,
      restaurantId: result.restaurantId,
      status: result.status,
      dryRun: result.dryRun,
      errorRate: result.errorRate,
      summary: result.summary,
      errors: result.errors
    });
  } catch (error) {
    next(error);
  }
};
