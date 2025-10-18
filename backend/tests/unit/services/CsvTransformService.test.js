import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CsvTransformService } from '../../../src/services/csv/CsvTransformService.js';

const CsvUpload = (await import('../../../src/models/CsvUpload.js')).default;
const CsvUploadBatch = (await import('../../../src/models/CsvUploadBatch.js')).default;
const CsvTransform = (await import('../../../src/models/CsvTransform.js')).default;

const defaultBatches = [{ batchIndex: 0, rows: [{ row: 1, data: {} }] }];
const originalFindByPk = CsvUpload.findByPk;
const originalFindAll = CsvUploadBatch.findAll;
const originalCreate = CsvTransform.create;

describe('CsvTransformService', () => {
  let inventoryTransformer;
  let salesTransformer;

  beforeEach(() => {
    inventoryTransformer = { transform: vi.fn() };
    salesTransformer = { transform: vi.fn() };
    CsvUpload.findByPk = originalFindByPk;
    CsvUploadBatch.findAll = originalFindAll;
    CsvTransform.create = originalCreate;
  });

  afterEach(() => {
    CsvUpload.findByPk = originalFindByPk;
    CsvUploadBatch.findAll = originalFindAll;
    CsvTransform.create = originalCreate;
  });

  it('persists transform metadata and marks upload transformed on success', async () => {
    const service = new CsvTransformService({
      inventoryTransformer,
      salesTransformer
    });

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

    inventoryTransformer.transform.mockResolvedValue({
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
    });

    const findByPkMock = vi.fn().mockResolvedValue(uploadRecord);
    const findAllMock = vi.fn().mockResolvedValue(defaultBatches);
    const createMock = vi.fn().mockResolvedValue(transformRecord);
    CsvUpload.findByPk = findByPkMock;
    CsvUploadBatch.findAll = findAllMock;
    CsvTransform.create = createMock;

    const result = await service.transformInventoryUpload({ uploadId: 10, restaurantId: 9, dryRun: false });

  expect(inventoryTransformer.transform).toHaveBeenCalledWith({ upload: uploadRecord, batches: defaultBatches }, { dryRun: false });
    expect(transformRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      processedCount: 2,
      createdCount: 1,
      updatedCount: 1,
      errorCount: 0
    }));
    expect(uploadRecord.markTransformed).toHaveBeenCalledWith(expect.objectContaining({
      transformId: transformRecord.id,
      summary: expect.objectContaining({ processed: 2 })
    }));
    expect(result.status).toBe('completed');
    expect(result.summary.processed).toBe(2);
  });

  it('returns failed status when error threshold exceeded and skips upload status update', async () => {
    const service = new CsvTransformService({
      inventoryTransformer,
      salesTransformer
    });

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

    inventoryTransformer.transform.mockResolvedValue({
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
    });

    const findByPkMock = vi.fn().mockResolvedValue(uploadRecord);
    const findAllMock = vi.fn().mockResolvedValue(defaultBatches);
    const createMock = vi.fn().mockResolvedValue(transformRecord);
    CsvUpload.findByPk = findByPkMock;
    CsvUploadBatch.findAll = findAllMock;
    CsvTransform.create = createMock;

    const result = await service.transformInventoryUpload({ uploadId: 11, restaurantId: 4, dryRun: false });

    expect(result.status).toBe('failed');
    expect(uploadRecord.markTransformed).not.toHaveBeenCalled();
    expect(transformRecord.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('transforms a sales upload and records completion details', async () => {
    const service = new CsvTransformService({
      inventoryTransformer,
      salesTransformer
    });

    const uploadRecord = {
      id: 77,
      restaurantId: 321,
      uploadType: 'sales',
      rowsValid: 4,
      status: 'validated',
      markTransformed: vi.fn().mockResolvedValue()
    };

    const transformRecord = {
      id: 501,
      errors: [],
      update: vi.fn().mockResolvedValue()
    };

    salesTransformer.transform.mockResolvedValue({
      exceededThreshold: false,
      errorRate: 0,
      summary: {
        processed: 4,
        created: 3,
        updated: 1,
        skipped: 0,
        errors: 0
      },
      errors: [],
      itemMatching: { matched: 3, unmatched: 1 },
      flaggedForReview: [{ name: 'Unknown Item', reason: 'inventory_match_not_found' }]
    });

    const findByPkMock = vi.fn().mockResolvedValue(uploadRecord);
    const findAllMock = vi.fn().mockResolvedValue(defaultBatches);
    const createMock = vi.fn().mockResolvedValue(transformRecord);
    CsvUpload.findByPk = findByPkMock;
    CsvUploadBatch.findAll = findAllMock;
    CsvTransform.create = createMock;

    const result = await service.transformSalesUpload({ uploadId: uploadRecord.id, restaurantId: uploadRecord.restaurantId });

  expect(salesTransformer.transform).toHaveBeenCalledWith({ upload: uploadRecord, batches: defaultBatches }, { dryRun: false });
    expect(transformRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      summary: expect.objectContaining({
        itemMatching: { matched: 3, unmatched: 1 },
        flaggedForReview: [{ name: 'Unknown Item', reason: 'inventory_match_not_found' }]
      })
    }));
    expect(uploadRecord.markTransformed).toHaveBeenCalledWith(expect.objectContaining({ transformId: transformRecord.id }));
    expect(result).toMatchObject({ status: 'completed', summary: expect.objectContaining({ processed: 4 }) });
    expect(inventoryTransformer.transform).not.toHaveBeenCalled();
  });

  it('marks sales transforms as failed when the error threshold is exceeded', async () => {
    const service = new CsvTransformService({
      inventoryTransformer,
      salesTransformer
    });

    const uploadRecord = {
      id: 88,
      restaurantId: 22,
      uploadType: 'sales',
      rowsValid: 5,
      status: 'validated',
      markTransformed: vi.fn().mockResolvedValue()
    };

    const transformRecord = {
      id: 700,
      errors: [],
      update: vi.fn().mockResolvedValue()
    };

    salesTransformer.transform.mockResolvedValue({
      exceededThreshold: true,
      errorRate: 42,
      summary: {
        processed: 5,
        created: 2,
        updated: 0,
        skipped: 0,
        errors: 3
      },
      errors: [{ row: 1, message: 'bad data' }]
    });

    const findByPkMock = vi.fn().mockResolvedValue(uploadRecord);
    const findAllMock = vi.fn().mockResolvedValue(defaultBatches);
    const createMock = vi.fn().mockResolvedValue(transformRecord);
    CsvUpload.findByPk = findByPkMock;
    CsvUploadBatch.findAll = findAllMock;
    CsvTransform.create = createMock;

    const result = await service.transformSalesUpload({ uploadId: uploadRecord.id });

    expect(result.status).toBe('failed');
    expect(result.errorRate).toBe(42);
    expect(uploadRecord.markTransformed).not.toHaveBeenCalled();
    expect(transformRecord.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('passes dryRun flag to sales transformer and skips upload mutation', async () => {
    const service = new CsvTransformService({
      inventoryTransformer,
      salesTransformer
    });

    const uploadRecord = {
      id: 90,
      restaurantId: 33,
      uploadType: 'sales',
      rowsValid: 1,
      status: 'validated',
      markTransformed: vi.fn().mockResolvedValue()
    };

    const transformRecord = {
      id: 710,
      errors: [],
      update: vi.fn().mockResolvedValue()
    };

    salesTransformer.transform.mockResolvedValue({
      exceededThreshold: false,
      summary: {
        processed: 1,
        created: 1,
        updated: 0,
        skipped: 0,
        errors: 0
      },
      errors: []
    });

  const findByPkMock = vi.fn().mockResolvedValue(uploadRecord);
  const findAllMock = vi.fn().mockResolvedValue(defaultBatches);
  const createMock = vi.fn().mockResolvedValue(transformRecord);
  CsvUpload.findByPk = findByPkMock;
  CsvUploadBatch.findAll = findAllMock;
  CsvTransform.create = createMock;

    const result = await service.transformSalesUpload({ uploadId: uploadRecord.id, dryRun: true });

    expect(salesTransformer.transform).toHaveBeenCalledWith({ upload: uploadRecord, batches: defaultBatches }, { dryRun: true });
    expect(uploadRecord.markTransformed).not.toHaveBeenCalled();
    expect(result.dryRun).toBe(true);
    expect(result.status).toBe('completed');
  });
});
