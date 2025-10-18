import InventoryItem from '../../models/InventoryItem.js';
import SalesTransaction from '../../models/SalesTransaction.js';
import logger from '../../utils/logger.js';

const ERROR_THRESHOLD_PCT = 5;
const MAX_ERROR_DETAILS = 50;

function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Number.parseFloat(numeric.toFixed(2));
}

function parseDate(value) {
  if (!value) {
    throw new Error('Transaction date is required');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid transaction date: ${value}`);
  }

  return parsed;
}

function slugify(value, fallback) {
  if (!value || typeof value !== 'string') {
    return fallback;
  }

  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const trimmed = slug.replace(/(^-|-$)/g, '');
  return trimmed.length > 0 ? trimmed : fallback;
}

function buildLineItemIdentifier(row, upload, slug) {
  if (row.data.line_item_id) {
    return `csv-${row.data.line_item_id}`;
  }

  const fallbackSlug = slug || slugify(row.data.item_name, `line-${row.row}`);
  return `csv-${upload.id}-${row.row}-${fallbackSlug}`;
}

async function resolveInventoryItem(upload, row, slug) {
  const sourceMatch = await InventoryItem.findOne({
    where: {
      restaurantId: upload.restaurantId,
      sourcePosProvider: 'csv',
      sourcePosItemId: slug
    }
  });

  if (sourceMatch) {
    return sourceMatch;
  }

  const nameCandidate = row.data.item_name?.trim();
  if (!nameCandidate) {
    return null;
  }

  return InventoryItem.findOne({
    where: {
      restaurantId: upload.restaurantId,
      name: nameCandidate
    }
  });
}

class CsvSalesTransformer {
  constructor(options = {}) {
    const thresholdPct = typeof options.errorThresholdPct === 'number'
      ? options.errorThresholdPct
      : ERROR_THRESHOLD_PCT;
    this.errorThresholdPct = thresholdPct;
    this.errorThreshold = thresholdPct / 100;
  }

  async transform({ upload, batches }, options = {}) {
    const { dryRun = false } = options;

    const results = {
      processedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      itemMatching: {
        matched: 0,
        unmatched: 0
      },
      flaggedForReview: []
    };

    if (!batches || batches.length === 0) {
      logger.warn('CsvSalesTransformer: No batches available for transformation', {
        uploadId: upload.id
      });

      return {
        ...results,
        errorRate: 0,
        exceededThreshold: false,
        summary: {
          processed: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          errors: 0
        }
      };
    }

    for (const batch of batches) {
      for (const row of batch.rows) {
        results.processedCount += 1;

        try {
          const rowResult = await this.transformRow({ upload, row, dryRun });

          if (rowResult.created) {
            results.createdCount += 1;
          } else if (rowResult.updated) {
            results.updatedCount += 1;
          }

          if (rowResult.matchedInventory) {
            results.itemMatching.matched += 1;
          } else {
            results.itemMatching.unmatched += 1;
          }

          if (rowResult.flaggedForReview) {
            results.flaggedForReview.push(rowResult.flaggedForReview);
          }
        } catch (error) {
          results.errorCount += 1;
          if (results.errors.length < MAX_ERROR_DETAILS) {
            results.errors.push({
              row: row.row,
              message: error.message
            });
          }

          logger.error('CsvSalesTransformer: Failed to transform row', {
            uploadId: upload.id,
            row: row.row,
            error: error.message
          });
        }
      }
    }

    const errorRate = results.processedCount === 0
      ? 0
      : results.errorCount / results.processedCount;
    const exceededThreshold = errorRate > this.errorThreshold;

    logger.info('CsvSalesTransformer: Transformation summary', {
      uploadId: upload.id,
      restaurantId: upload.restaurantId,
      processed: results.processedCount,
      created: results.createdCount,
      updated: results.updatedCount,
      errors: results.errorCount,
      errorRatePct: Number((errorRate * 100).toFixed(2)),
      exceededThreshold,
      thresholdPct: this.errorThresholdPct,
      matched: results.itemMatching.matched,
      unmatched: results.itemMatching.unmatched
    });

    return {
      ...results,
      errorRate: Number(errorRate.toFixed(4)),
      exceededThreshold,
      summary: {
        processed: results.processedCount,
        created: results.createdCount,
        updated: results.updatedCount,
        skipped: results.skippedCount,
        errors: results.errorCount
      }
    };
  }

  async transformRow({ upload, row, dryRun }) {
    const data = row.data;
    if (!data) {
      return {
        created: false,
        updated: false,
        matchedInventory: false,
        flaggedForReview: null
      };
    }

    const transactionDate = parseDate(data.transaction_date);
    const quantity = toNumber(data.quantity);
    const unitPrice = toNumber(data.unit_price, null);
    const totalAmount = toNumber(data.total_amount, null);

    if (!quantity || quantity <= 0) {
      throw new Error(`Invalid quantity for row ${row.row}`);
    }

    const slug = slugify(
      data.line_item_id || data.item_name,
      `item-${row.row}`
    );

    const inventoryItem = await resolveInventoryItem(upload, row, slug);
    const lineItemIdentifier = buildLineItemIdentifier(row, upload, slug);

    const salesTransactionData = {
      restaurantId: upload.restaurantId,
      inventoryItemId: inventoryItem?.id || null,
      transactionDate,
      quantity,
      unitPrice,
      totalAmount,
      sourcePosProvider: 'csv',
      sourcePosOrderId: data.order_id,
      sourcePosLineItemId: lineItemIdentifier,
      sourcePosData: {
        uploadId: upload.id,
        originalRow: row.row,
        modifiers: data.modifiers,
        notes: data.notes,
        location: data.location,
        serverName: data.server_name,
        guestCount: toNumber(data.guest_count, null),
        itemName: data.item_name
      }
    };

    if (dryRun) {
      const existing = await SalesTransaction.findOne({
        where: {
          sourcePosProvider: 'csv',
          sourcePosLineItemId: lineItemIdentifier
        }
      });

      return {
        created: !existing,
        updated: Boolean(existing),
        matchedInventory: Boolean(inventoryItem),
        flaggedForReview: inventoryItem ? null : {
          name: data.item_name,
          reason: 'inventory_match_not_found',
          orderId: data.order_id,
          lineItemId: data.line_item_id || null
        }
      };
    }

    const [transaction, created] = await SalesTransaction.upsert(salesTransactionData, {
      conflictFields: ['source_pos_provider', 'source_pos_line_item_id'],
      returning: true
    });

    const flaggedForReview = inventoryItem ? null : {
      name: data.item_name,
      reason: 'inventory_match_not_found',
      orderId: data.order_id,
      lineItemId: data.line_item_id || transaction?.sourcePosLineItemId || null
    };

    return {
      created,
      updated: !created,
      matchedInventory: Boolean(inventoryItem),
      flaggedForReview
    };
  }
}

export default CsvSalesTransformer;
