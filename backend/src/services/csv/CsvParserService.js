import { Readable } from 'stream';
import { parse } from 'csv-parse';
import CsvUploadBatch from '../../models/CsvUploadBatch.js';
import { getSchema, normalizeHeader, CSV_UPLOAD_TYPES } from './csvSchemas.js';

const BATCH_SIZE = 1000;

function sanitizeString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const normalized = typeof value === 'string' ? value.replace(/[,\s]/g, '') : value;
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : NaN;
}

function validateInventoryRow(row, rowNumber) {
  const errors = [];
  const normalized = {};

  normalized.name = sanitizeString(row.name);
  if (!normalized.name) {
    errors.push({ row: rowNumber, field: 'name', error: 'Name is required' });
  } else if (normalized.name.length > 255) {
    errors.push({ row: rowNumber, field: 'name', error: 'Name must be 255 characters or less' });
  }

  normalized.category = sanitizeString(row.category);
  if (!normalized.category) {
    errors.push({ row: rowNumber, field: 'category', error: 'Category is required' });
  }

  normalized.unit = sanitizeString(row.unit);
  if (!normalized.unit) {
    errors.push({ row: rowNumber, field: 'unit', error: 'Unit is required' });
  }

  const unitCost = toNumber(row.unit_cost);
  if (Number.isNaN(unitCost) || unitCost <= 0) {
    errors.push({ row: rowNumber, field: 'unit_cost', error: 'Unit cost must be a positive number' });
    normalized.unit_cost = null;
  } else {
    normalized.unit_cost = Number(unitCost.toFixed(4));
  }

  normalized.description = sanitizeString(row.description);
  if (!normalized.description) {
    errors.push({ row: rowNumber, field: 'description', error: 'Description is required' });
  }

  normalized.supplier_name = sanitizeString(row.supplier_name);
  if (!normalized.supplier_name) {
    errors.push({ row: rowNumber, field: 'supplier_name', error: 'Supplier name is required' });
  }

  const numericFields = ['minimum_stock', 'maximum_stock', 'current_stock'];
  numericFields.forEach(field => {
    const value = toNumber(row[field]);
    if (Number.isNaN(value)) {
      errors.push({ row: rowNumber, field, error: `${field} must be a number` });
      normalized[field] = null;
    } else if (value !== null && value < 0) {
      errors.push({ row: rowNumber, field, error: `${field} cannot be negative` });
      normalized[field] = null;
    } else {
      normalized[field] = value === null ? null : Number(value.toFixed(4));
    }
  });

  normalized.batch_number = sanitizeString(row.batch_number);
  normalized.location = sanitizeString(row.location);
  normalized.gl_account = sanitizeString(row.gl_account);
  normalized.sku = sanitizeString(row.sku);
  normalized.vendor_item_number = sanitizeString(row.vendor_item_number);
  normalized.notes = sanitizeString(row.notes);

  return { normalized, errors };
}

function validateSalesRow(row, rowNumber) {
  const errors = [];
  const normalized = {};

  normalized.transaction_date = sanitizeString(row.transaction_date);
  if (!normalized.transaction_date) {
    errors.push({ row: rowNumber, field: 'transaction_date', error: 'Transaction date is required' });
  } else if (Number.isNaN(Date.parse(normalized.transaction_date))) {
    errors.push({ row: rowNumber, field: 'transaction_date', error: 'Transaction date must be ISO 8601 format' });
  }

  normalized.item_name = sanitizeString(row.item_name);
  if (!normalized.item_name) {
    errors.push({ row: rowNumber, field: 'item_name', error: 'Item name is required' });
  }

  const quantity = toNumber(row.quantity);
  if (Number.isNaN(quantity) || quantity <= 0) {
    errors.push({ row: rowNumber, field: 'quantity', error: 'Quantity must be a positive number' });
    normalized.quantity = null;
  } else {
    normalized.quantity = Number(quantity.toFixed(4));
  }

  const unitPrice = toNumber(row.unit_price);
  if (Number.isNaN(unitPrice)) {
    errors.push({ row: rowNumber, field: 'unit_price', error: 'Unit price must be a number' });
    normalized.unit_price = null;
  } else if (unitPrice !== null && unitPrice < 0) {
    errors.push({ row: rowNumber, field: 'unit_price', error: 'Unit price cannot be negative' });
    normalized.unit_price = null;
  } else {
    normalized.unit_price = unitPrice === null ? null : Number(unitPrice.toFixed(4));
  }

  const totalAmount = toNumber(row.total_amount);
  if (Number.isNaN(totalAmount)) {
    errors.push({ row: rowNumber, field: 'total_amount', error: 'Total amount must be a number' });
    normalized.total_amount = null;
  } else if (totalAmount !== null && totalAmount < 0) {
    errors.push({ row: rowNumber, field: 'total_amount', error: 'Total amount cannot be negative' });
    normalized.total_amount = null;
  } else {
    normalized.total_amount = totalAmount === null ? null : Number(totalAmount.toFixed(4));
  }

  normalized.order_id = sanitizeString(row.order_id);
  if (!normalized.order_id) {
    errors.push({ row: rowNumber, field: 'order_id', error: 'Order ID is required' });
  }

  normalized.line_item_id = sanitizeString(row.line_item_id);
  normalized.modifiers = sanitizeString(row.modifiers);
  normalized.notes = sanitizeString(row.notes);
  normalized.location = sanitizeString(row.location);
  normalized.server_name = sanitizeString(row.server_name);
  normalized.guest_count = toNumber(row.guest_count);

  if (Number.isNaN(normalized.guest_count)) {
    errors.push({ row: rowNumber, field: 'guest_count', error: 'Guest count must be a number' });
    normalized.guest_count = null;
  } else if (normalized.guest_count !== null && normalized.guest_count < 0) {
    errors.push({ row: rowNumber, field: 'guest_count', error: 'Guest count cannot be negative' });
    normalized.guest_count = null;
  }

  return { normalized, errors };
}

export default class CsvParserService {
  constructor(uploadType) {
    this.schema = getSchema(uploadType);
  }

  validateHeaders(normalizedHeaders) {
    const missing = this.schema.requiredHeaders.filter(header => !normalizedHeaders.includes(header));
    const unknown = normalizedHeaders.filter(header => !this.schema.knownHeaders.has(header));
    return { missing, unknown };
  }

  async parseAndPersist({ upload, fileBuffer }) {
    const summary = {
      rowsTotal: 0,
      rowsValid: 0,
      rowsInvalid: 0,
      validationErrors: {
        missingHeaders: [],
        unknownHeaders: [],
        rowErrorsSample: [],
        rowErrorsCount: 0
      },
      metadata: {
        rawHeaders: [],
        normalizedHeaders: [],
        unknownHeaders: [],
        sampleRows: []
      }
    };

    const batchRows = [];
    const batchErrors = [];
    let batchIndex = 0;
    const parser = parse({
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      columns: headerRow => {
        const normalizedHeaders = headerRow.map(normalizeHeader);
        const { missing, unknown } = this.validateHeaders(normalizedHeaders);

        if (missing.length > 0) {
          const error = new Error(`Missing required columns: ${missing.join(', ')}`);
          error.code = 'CSV_HEADER_MISSING';
          error.details = { missing, normalizedHeaders };
          throw error;
        }

        summary.metadata.rawHeaders = headerRow.map(h => h.trim());
        summary.metadata.normalizedHeaders = normalizedHeaders;
        summary.metadata.unknownHeaders = unknown;
        summary.validationErrors.missingHeaders = missing;
        summary.validationErrors.unknownHeaders = unknown;

        return normalizedHeaders;
      }
    });

    const readable = Readable.from(fileBuffer.toString('utf8'));
    const rowErrors = [];

    const flushBatch = async () => {
      if (batchRows.length === 0 && batchErrors.length === 0) {
        return;
      }

      await CsvUploadBatch.create({
        uploadId: upload.id,
        batchIndex,
        rowsTotal: batchRows.length + batchErrors.length,
        rowsValid: batchRows.length,
        rowsInvalid: batchErrors.length,
        rows: batchRows.splice(0),
        errors: batchErrors.splice(0)
      });

      batchIndex += 1;
    };

    let dataRowNumber = 1;

    readable.pipe(parser);

    for await (const row of parser) {
      const { normalized, errors } = this.schema.uploadType === CSV_UPLOAD_TYPES.INVENTORY
        ? validateInventoryRow(row, dataRowNumber)
        : validateSalesRow(row, dataRowNumber);

      summary.rowsTotal += 1;

      if (errors.length > 0) {
        summary.rowsInvalid += 1;
        errors.forEach(error => {
          rowErrors.push(error);
          if (summary.validationErrors.rowErrorsSample.length < 50) {
            summary.validationErrors.rowErrorsSample.push(error);
          }
        });
        batchErrors.push({ row: dataRowNumber, errors });
      } else {
        summary.rowsValid += 1;
        batchRows.push({ row: dataRowNumber, data: normalized });
        if (summary.metadata.sampleRows.length < 25) {
          summary.metadata.sampleRows.push(normalized);
        }
      }

      if (batchRows.length + batchErrors.length >= BATCH_SIZE) {
        await flushBatch();
      }

      dataRowNumber += 1;
    }

    await flushBatch();

    summary.validationErrors.rowErrorsCount = rowErrors.length;

    const readyForTransform = summary.rowsValid > 0;

    return {
      ...summary,
      readyForTransform
    };
  }
}
