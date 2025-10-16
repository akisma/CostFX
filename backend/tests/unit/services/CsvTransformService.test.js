import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CsvTransformService } from '../../../src/services/csv/CsvTransformService.js';

const { mockUploadModel, mockUploadBatchModel, mockTransformModel } = vi.hoisted(() => ({
  mockUploadModel: {
    findByPk: vi.fn()
  },
  mockUploadBatchModel: {
    findAll: vi.fn()
  },
  mockTransformModel: {
    create: vi.fn()
  }
}));

vi.mock('../../../src/models/CsvUpload.js', () => ({
  default: mockUploadModel
}));

vi.mock('../../../src/models/CsvUploadBatch.js', () => ({
  default: mockUploadBatchModel
}));

vi.mock('../../../src/models/CsvTransform.js', () => ({
  default: mockTransformModel
}));

describe('CsvTransformService', () => {
  beforeEach(() => {
    mockUploadModel.findByPk.mockReset();
    mockUploadBatchModel.findAll.mockReset();
    mockTransformModel.create.mockReset();
  });

  it('persists transform metadata and marks upload transformed on success', async () => {
    const inventoryTransformer = {
      transform: vi.fn().mockResolvedValue({
        summary: {
          processed: 2,
          created: 1,
          updated: 1,
          skipped: 0,
          errors: 0
        },
        errorRate: 0,
        exceededThreshold: false,
        itemMatching: { autoLinked: 1, needsReview: 1 },
        flaggedForReview: [],
        errors: []
      })
    };

    const service = new CsvTransformService({ inventoryTransformer });

    const uploadRecord = {
      id: 10,
      restaurantId: 9,
      uploadType: 'inventory',
      rowsValid: 2,
      status: 'validated',
      markTransformed: vi.fn().mockResolvedValue()
    };

    const transformRecord = {
      id: 500,
      errors: [],
      update: vi.fn().mockResolvedValue()
    };

    mockUploadModel.findByPk.mockResolvedValue(uploadRecord);
    mockUploadBatchModel.findAll.mockResolvedValue([{ rows: [{ row: 1, data: {} }] }]);
    mockTransformModel.create.mockResolvedValue(transformRecord);

    const result = await service.transformInventoryUpload({ uploadId: 10, restaurantId: 9, dryRun: false });

    expect(inventoryTransformer.transform).toHaveBeenCalled();
    expect(transformRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      processedCount: 2
    }));
    expect(uploadRecord.markTransformed).toHaveBeenCalledWith(expect.objectContaining({
      transformId: transformRecord.id
    }));
    expect(result.status).toBe('completed');
    expect(result.summary.processed).toBe(2);
  });

  it('returns failed status when error threshold exceeded and skips upload status update', async () => {
    const inventoryTransformer = {
      transform: vi.fn().mockResolvedValue({
        summary: {
          processed: 20,
          created: 0,
          updated: 0,
          skipped: 0,
          errors: 5
        },
        errorRate: 25,
        exceededThreshold: true,
        itemMatching: { autoLinked: 0, needsReview: 20 },
        flaggedForReview: [],
        errors: [{ row: 1, message: 'boom' }]
      })
    };

    const service = new CsvTransformService({ inventoryTransformer });

    const uploadRecord = {
      id: 11,
      restaurantId: 4,
      uploadType: 'inventory',
      rowsValid: 20,
      status: 'validated',
      markTransformed: vi.fn().mockResolvedValue()
    };

    const transformRecord = {
      id: 600,
      errors: [],
      update: vi.fn().mockResolvedValue()
    };

    mockUploadModel.findByPk.mockResolvedValue(uploadRecord);
    mockUploadBatchModel.findAll.mockResolvedValue([{ rows: [{ row: 1, data: {} }] }]);
    mockTransformModel.create.mockResolvedValue(transformRecord);

    const result = await service.transformInventoryUpload({ uploadId: 11, restaurantId: 4, dryRun: false });

    expect(result.status).toBe('failed');
    expect(uploadRecord.markTransformed).not.toHaveBeenCalled();
    expect(transformRecord.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });
});
