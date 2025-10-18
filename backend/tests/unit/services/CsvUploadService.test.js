import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ValidationError } from '../../../src/middleware/errorHandler.js';
import CsvUploadService from '../../../src/services/csv/CsvUploadService.js';

const CsvUpload = (await import('../../../src/models/CsvUpload.js')).default;
const CsvUploadBatch = (await import('../../../src/models/CsvUploadBatch.js')).default;

const buildFile = (content) => ({
  originalname: 'test.csv',
  mimetype: 'text/csv',
  size: Buffer.byteLength(content),
  buffer: Buffer.from(content, 'utf8')
});

describe('CsvUploadService', () => {
  let uploadRecord;
  let createdBatches;
  let uploadCreateMock;
  let uploadBatchCreateMock;
  let originalUploadCreate;
  let originalUploadBatchCreate;

  beforeEach(() => {
    createdBatches = [];
    uploadRecord = {
      id: 101,
      status: 'uploaded',
      rowsTotal: 0,
      rowsValid: 0,
      rowsInvalid: 0,
      validationErrors: null,
      metadata: {},
      save: vi.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
      update: vi.fn().mockImplementation(function (updates) {
        Object.assign(this, updates);
        return Promise.resolve(this);
      })
    };

    originalUploadCreate = CsvUpload.create;
    originalUploadBatchCreate = CsvUploadBatch.create;

    uploadCreateMock = vi.fn().mockResolvedValue(uploadRecord);
    uploadBatchCreateMock = vi.fn().mockImplementation(async (batch) => {
      createdBatches.push(batch);
      return { id: createdBatches.length, ...batch };
    });

    CsvUpload.create = uploadCreateMock;
    CsvUploadBatch.create = uploadBatchCreateMock;
  });

  afterEach(() => {
    CsvUpload.create = originalUploadCreate;
    CsvUploadBatch.create = originalUploadBatchCreate;
  });

  it('validates inventory CSV upload and persists batches', async () => {
    const csvContent = `name,category,unit,unit_cost,description,supplier_name,minimum_stock\n` +
      `"Chicken Breast","proteins","lb",8.5,"Boneless","Sysco",5\n` +
      `"Romaine Lettuce","produce","lb",3.25,"Crisp romaine","Farm Box",10\n` +
      `"Bad Item","","ea","-1","",""`;

    const result = await CsvUploadService.processUpload({
      restaurantId: 1,
      uploadType: 'inventory',
      file: buildFile(csvContent)
    });

    expect(result.uploadId).toBe(uploadRecord.id);
    expect(result.rowsTotal).toBe(3);
    expect(result.rowsValid).toBe(2);
    expect(result.rowsInvalid).toBe(1);
    expect(result.readyForTransform).toBe(true);
    expect(result.validationErrors.rowErrorsCount).toBe(4);

  expect(uploadCreateMock).toHaveBeenCalledOnce();
  expect(uploadBatchCreateMock).toHaveBeenCalled();
    expect(createdBatches[0].rowsValid).toBe(2);
    expect(createdBatches[0].rowsInvalid).toBe(1);
    expect(uploadRecord.status).toBe('validated');
  });

  it('throws validation error when required headers missing', async () => {
    const csvContent = `name,unit,unit_cost,description,supplier_name\n"Only Name","ea",5.5,"desc","sup"`;

    await expect(
      CsvUploadService.processUpload({
        restaurantId: 1,
        uploadType: 'inventory',
        file: buildFile(csvContent)
      })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(uploadRecord.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });
});
