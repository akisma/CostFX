import CsvUpload from '../../models/CsvUpload.js';
import CsvUploadBatch from '../../models/CsvUploadBatch.js';
import CsvTransform from '../../models/CsvTransform.js';
import CsvInventoryTransformer from './CsvInventoryTransformer.js';
import CsvSalesTransformer from './CsvSalesTransformer.js';
import logger from '../../utils/logger.js';
import { BadRequestError, NotFoundError } from '../../middleware/errorHandler.js';

const FLAGGED_REVIEW_LIMIT = 25;

class CsvTransformService {
  constructor(options = {}) {
    this.inventoryTransformer = options.inventoryTransformer || new CsvInventoryTransformer();
    this.salesTransformer = options.salesTransformer || new CsvSalesTransformer();
    this.transformers = {
      inventory: this.inventoryTransformer,
      sales: this.salesTransformer
    };
  }

  async transformUpload({ uploadId, restaurantId, dryRun = false, expectedType = null }) {
    const upload = await CsvUpload.findByPk(uploadId);

    if (!upload) {
      throw new NotFoundError(`CSV upload ${uploadId} not found`);
    }

    if (restaurantId && upload.restaurantId !== restaurantId) {
      throw new BadRequestError('Upload does not belong to the specified restaurant');
    }

    if (expectedType && upload.uploadType !== expectedType) {
      throw new BadRequestError(`Upload type must be ${expectedType} to run this transform`);
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

    const transformer = this.transformers[upload.uploadType];
    if (!transformer) {
      throw new BadRequestError(`No transformer implemented for upload type: ${upload.uploadType}`);
    }

    const transformRecord = await CsvTransform.create({
      uploadId,
      restaurantId: upload.restaurantId,
      transformType: upload.uploadType,
      status: 'processing',
      dryRun
    });

    try {
      const result = await transformer.transform({ upload, batches }, { dryRun });

      const completedAt = new Date();
      const status = result.exceededThreshold ? 'failed' : 'completed';
      const summary = result.summary || {
        processed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0
      };

      const summaryPayload = { ...summary };
      if (result.itemMatching) {
        summaryPayload.itemMatching = result.itemMatching;
      }
      if (Array.isArray(result.flaggedForReview)) {
        summaryPayload.flaggedForReview = result.flaggedForReview.slice(0, FLAGGED_REVIEW_LIMIT);
      }
      if (result.metadata) {
        summaryPayload.metadata = result.metadata;
      }

      await transformRecord.update({
        status,
        processedCount: summary.processed,
        createdCount: summary.created,
        updatedCount: summary.updated,
        skippedCount: summary.skipped,
        errorCount: summary.errors,
        errorRate: typeof result.errorRate === 'number' ? result.errorRate : 0,
        summary: summaryPayload,
        errors: result.errors || [],
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
          status,
          uploadType: upload.uploadType
        });
      }

      return {
        transformId: transformRecord.id,
        uploadId: upload.id,
        restaurantId: upload.restaurantId,
        status,
        dryRun,
        errorRate: typeof result.errorRate === 'number' ? result.errorRate : 0,
        summary: summaryPayload,
        errors: result.errors || []
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

  async transformInventoryUpload(args) {
    return this.transformUpload({ ...args, expectedType: 'inventory' });
  }

  async transformSalesUpload(args) {
    return this.transformUpload({ ...args, expectedType: 'sales' });
  }
}

const csvTransformService = new CsvTransformService();
export default csvTransformService;
export { CsvTransformService };
