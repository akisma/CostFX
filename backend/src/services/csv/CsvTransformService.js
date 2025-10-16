import CsvUpload from '../../models/CsvUpload.js';
import CsvUploadBatch from '../../models/CsvUploadBatch.js';
import CsvTransform from '../../models/CsvTransform.js';
import CsvInventoryTransformer from './CsvInventoryTransformer.js';
import logger from '../../utils/logger.js';
import { BadRequestError, NotFoundError } from '../../middleware/errorHandler.js';

const FLAGGED_REVIEW_LIMIT = 25;

class CsvTransformService {
  constructor(options = {}) {
    this.inventoryTransformer = options.inventoryTransformer || new CsvInventoryTransformer();
  }

  async transformInventoryUpload({ uploadId, restaurantId, dryRun = false }) {
    const upload = await CsvUpload.findByPk(uploadId);

    if (!upload) {
      throw new NotFoundError(`CSV upload ${uploadId} not found`);
    }

    if (restaurantId && upload.restaurantId !== restaurantId) {
      throw new BadRequestError('Upload does not belong to the specified restaurant');
    }

    if (upload.uploadType !== 'inventory') {
      throw new BadRequestError('Upload type must be inventory to run this transform');
    }

    if (upload.rowsValid === 0) {
      throw new BadRequestError('Upload does not contain any valid rows to transform');
    }

    if (!['validated', 'transformed'].includes(upload.status)) {
      throw new BadRequestError(`Upload must be validated before transformation. Current status: ${upload.status}`);
    }

    const batches = await CsvUploadBatch.findAll({
      where: { uploadId },
      order: [['batchIndex', 'ASC']]
    });

    if (batches.length === 0) {
      throw new BadRequestError('No persisted CSV batches were found for this upload');
    }

    const transformRecord = await CsvTransform.create({
      uploadId,
      restaurantId: upload.restaurantId,
      transformType: 'inventory',
      status: 'processing',
      dryRun
    });

    try {
      const result = await this.inventoryTransformer.transform({ upload, batches }, { dryRun });

      const completedAt = new Date();
      const status = result.exceededThreshold ? 'failed' : 'completed';

      const summaryPayload = {
        ...result.summary,
        itemMatching: result.itemMatching,
        flaggedForReview: result.flaggedForReview.slice(0, FLAGGED_REVIEW_LIMIT)
      };

      await transformRecord.update({
        status,
        processedCount: result.summary.processed,
        createdCount: result.summary.created,
        updatedCount: result.summary.updated,
        skippedCount: result.summary.skipped,
        errorCount: result.summary.errors,
        errorRate: result.errorRate,
        summary: summaryPayload,
        errors: result.errors,
        completedAt
      });

      if (!dryRun && status === 'completed') {
        await upload.markTransformed({
          transformId: transformRecord.id,
          completedAt: completedAt.toISOString(),
          summary: summaryPayload
        });
      }

      if (result.exceededThreshold) {
        logger.warn('CsvTransformService: Error threshold exceeded', {
          uploadId,
          transformId: transformRecord.id,
          errorRate: result.errorRate
        });
      } else {
        logger.info('CsvTransformService: Transformation completed', {
          uploadId,
          transformId: transformRecord.id,
          dryRun,
          status
        });
      }

      return {
        transformId: transformRecord.id,
        uploadId: upload.id,
        restaurantId: upload.restaurantId,
        status,
        dryRun,
        errorRate: result.errorRate,
        summary: summaryPayload,
        errors: result.errors
      };
    } catch (error) {
      await transformRecord.update({
        status: 'failed',
        errors: [
          ...(Array.isArray(transformRecord.errors) ? transformRecord.errors : []),
          { message: error.message }
        ],
        completedAt: new Date()
      });

      logger.error('CsvTransformService: Transformation failed', {
        uploadId,
        transformId: transformRecord.id,
        error: error.message
      });

      throw error;
    }
  }
}

const csvTransformService = new CsvTransformService();
export default csvTransformService;
export { CsvTransformService };
