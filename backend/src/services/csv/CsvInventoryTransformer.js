import InventoryItem from '../../models/InventoryItem.js';
import logger from '../../utils/logger.js';
import CategoryMapper from '../helpers/CategoryMapper.js';
import VarianceCalculator from '../helpers/VarianceCalculator.js';
import POSDataTransformer from '../POSDataTransformer.js';

const ERROR_THRESHOLD_PCT = 5;
const DEFAULT_PAR_LEVEL = 10;
const MAX_ERROR_DETAILS = 50;

const LEGACY_CATEGORY_MAP = {
  produce: 'produce',
  proteins: 'meat',
  dairy: 'dairy',
  dry_goods: 'dry_goods',
  beverages: 'beverages',
  frozen: 'frozen',
  paper_disposables: 'dry_goods',
  cleaning_chemicals: 'other',
  condiments: 'condiments',
  spices: 'spices',
  other: 'other'
};

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function roundToTwo(value) {
  return Number.parseFloat(Number(value || 0).toFixed(2));
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

class CsvInventoryTransformer {
  constructor(options = {}) {
    this.categoryMapper = options.categoryMapper || new CategoryMapper();
    this.varianceCalculator = options.varianceCalculator || new VarianceCalculator();
    this.posTransformer = options.posTransformer || new POSDataTransformer();
    this.errorThreshold = options.errorThresholdPct || ERROR_THRESHOLD_PCT;
  }

  mapToLegacyCategory(categoryResult) {
    if (!categoryResult) {
      return 'other';
    }
    return LEGACY_CATEGORY_MAP[categoryResult.category] || 'other';
  }

  buildSourceItemId(row, rowNumber) {
    const fallback = `row-${rowNumber}`;
    const base = row.sku || row.vendor_item_number || row.name;
    const slug = slugify(base, fallback);
    return `csv-${slug}`;
  }

  normalizeUnit(unitRaw) {
    if (!unitRaw) {
      return 'pieces';
    }
    const normalized = unitRaw.toString().trim().toLowerCase();
    return this.posTransformer.normalizeUnit(normalized);
  }

  determineParLevels(row) {
    const max = toNumber(row.maximum_stock, null);
    const min = toNumber(row.minimum_stock, null);
    const parCandidate = max || min || DEFAULT_PAR_LEVEL;
    const parLevel = parCandidate > 0 ? parCandidate : DEFAULT_PAR_LEVEL;

    const minimumStock = min !== null ? roundToTwo(min) : roundToTwo(parLevel * 0.3);
    const maximumStock = max !== null ? roundToTwo(max) : roundToTwo(parLevel * 1.5);

    return { parLevel, minimumStock, maximumStock };
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
        autoLinked: 0,
        needsReview: 0
      },
      flaggedForReview: []
    };

    if (!batches || batches.length === 0) {
      logger.warn('CsvInventoryTransformer: No batches available for transformation', {
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
          const rowResult = await this.transformRow(row, {
            upload,
            dryRun
          });

          if (rowResult.created) {
            results.createdCount += 1;
          } else if (rowResult.updated) {
            results.updatedCount += 1;
          } else if (rowResult.skipped) {
            results.skippedCount += 1;
          }

          if (rowResult.autoLinked) {
            results.itemMatching.autoLinked += 1;
          } else {
            results.itemMatching.needsReview += 1;
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
          logger.error('CsvInventoryTransformer: Failed to transform row', {
            uploadId: upload.id,
            row: row.row,
            error: error.message
          });
        }
      }
    }

    const errorRate = results.processedCount === 0
      ? 0
      : (results.errorCount / results.processedCount) * 100;
    const exceededThreshold = errorRate > this.errorThreshold;

    logger.info('CsvInventoryTransformer: Transformation summary', {
      uploadId: upload.id,
      restaurantId: upload.restaurantId,
      processed: results.processedCount,
      created: results.createdCount,
      updated: results.updatedCount,
      skipped: results.skippedCount,
      errors: results.errorCount,
      errorRate: Number(errorRate.toFixed(2)),
      exceededThreshold
    });

    return {
      ...results,
      errorRate: Number(errorRate.toFixed(3)),
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

  async transformRow(row, context) {
    const { upload, dryRun } = context;
    const { data } = row;

    if (!data) {
      return { skipped: true, autoLinked: false };
    }

    const categoryMapping = this.categoryMapper.mapSquareCategory(data.category);
    const legacyCategory = this.mapToLegacyCategory(categoryMapping);
    const normalizedUnit = this.normalizeUnit(data.unit);
    const { parLevel, minimumStock, maximumStock } = this.determineParLevels(data);
    const unitCost = roundToTwo(toNumber(data.unit_cost, 0));
    const currentStock = roundToTwo(toNumber(data.current_stock, 0));
    const sourcePosItemId = this.buildSourceItemId(data, row.row);

    const variance = this.varianceCalculator.calculate({
      unitCost,
      unit: normalizedUnit,
      category: categoryMapping?.category || legacyCategory,
      parLevel
    });

    const inventoryItemData = {
      restaurantId: upload.restaurantId,
      supplierId: 1, // Default supplier placeholder (follow-up task to map actual suppliers)
      name: data.name,
      description: data.description,
      category: legacyCategory,
      unit: normalizedUnit,
      unitCost,
      currentStock,
      minimumStock,
      maximumStock,
      storageLocation: data.location,
      varianceThresholdQuantity: variance.varianceThresholdQuantity,
      varianceThresholdDollar: variance.varianceThresholdDollar,
      highValueFlag: variance.highValueFlag,
      theoreticalYieldFactor: 1.0,
      costPerUnitVariancePct: 10.0,
      sourcePosProvider: 'csv',
      sourcePosItemId,
      sourcePosData: {
        uploadId: upload.id,
        originalRow: row.row,
        supplierName: data.supplier_name,
        batchNumber: data.batch_number,
        glAccount: data.gl_account,
        sku: data.sku,
        vendorItemNumber: data.vendor_item_number,
        notes: data.notes,
        category: data.category,
        categoryMapping,
        unitOriginal: data.unit
      }
    };

    const existing = await InventoryItem.findOne({
      where: {
        restaurantId: upload.restaurantId,
        sourcePosProvider: 'csv',
        sourcePosItemId
      }
    });

    if (dryRun) {
      const flaggedForReview = this.shouldFlagForReview({ categoryMapping, data });
      return {
        created: !existing,
        updated: !!existing,
        skipped: false,
        autoLinked: !!existing,
        flaggedForReview
      };
    }

    const [inventoryItem, created] = await InventoryItem.upsert(inventoryItemData, {
      fields: Object.keys(inventoryItemData),
      conflictFields: ['restaurant_id', 'source_pos_provider', 'source_pos_item_id'],
      returning: true
    });

    const flaggedForReview = this.shouldFlagForReview({ categoryMapping, data, inventoryItem });

    return {
      created,
      updated: !created,
      skipped: false,
      autoLinked: !created,
      flaggedForReview
    };
  }

  shouldFlagForReview({ categoryMapping, data, inventoryItem }) {
    if (!categoryMapping) {
      return {
        name: data.name,
        reason: 'unmapped_category',
        category: data.category
      };
    }

    if (categoryMapping.confidence < 0.7) {
      return {
        name: data.name,
        reason: 'low_category_confidence',
        category: data.category,
        mappedCategory: categoryMapping.category,
        confidence: Number(categoryMapping.confidence.toFixed(2)),
        inventoryItemId: inventoryItem?.id || null
      };
    }

    if (!data.sku && !data.vendor_item_number) {
      return {
        name: data.name,
        reason: 'missing_identifiers'
      };
    }

    return null;
  }
}

export default CsvInventoryTransformer;
