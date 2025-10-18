/**
 * POS Sync Controller
 * 
 * Generic REST API controller for POS inventory synchronization.
 * Provider-agnostic - works with Square, Toast, Clover, etc.
 * 
 * Routes:
 * - POST   /api/v1/pos/sync/:connectionId        - Trigger sync and transform
 * - POST   /api/v1/pos/sync-sales/:connectionId  - Trigger sales data sync
 * - GET    /api/v1/pos/status/:connectionId      - Get sync status
 * - GET    /api/v1/pos/stats/:restaurantId       - Get transformation stats
 * - POST   /api/v1/pos/clear/:restaurantId       - Clear POS data
 * - GET    /api/v1/pos/validate/:restaurantId    - Validate transformation
 * 
 * Architecture:
 * - Controller dispatches to appropriate service based on connection.provider
 * - SquareInventorySyncService for Square connections
 * - SquareSalesSyncService for Square sales data (Issue #21)
 * - Future: ToastInventorySyncService, CloverInventorySyncService, etc.
 * 
 * Related:
 * - Issue #20: Square Inventory Synchronization
 * - Issue #21: Square Sales Data Synchronization
 * - SquareInventorySyncService: Square-specific orchestration
 * - SquareSalesSyncService: Square sales data orchestration
 * - POSDataTransformer: Provider → unified format transformation
 * 
 * Created: 2025-10-06
 */

import POSConnection from '../models/POSConnection.js';
import POSAdapterFactory from '../adapters/POSAdapterFactory.js';
import SquareInventorySyncService from '../services/SquareInventorySyncService.js';
import SquareSalesSyncService from '../services/SquareSalesSyncService.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Get sync service for a provider
 * Returns service that will handle connection-specific operations
 * 
 * @param {string} provider - Provider name ('square', 'toast', etc.)
 * @returns {Object} Sync service instance
 * @throws {ValidationError} If provider not supported
 */
function getSyncService(provider) {
  switch (provider) {
    case 'square': {
      // Get singleton adapter - it will receive connection in method calls
      const adapter = POSAdapterFactory.getAdapter('square');
      return new SquareInventorySyncService(adapter);
    }
    // Future providers:
    // case 'toast':
    //   const toastAdapter = POSAdapterFactory.getAdapter('toast');
    //   return new ToastInventorySyncService(toastAdapter);
    // case 'clover':
    //   const cloverAdapter = POSAdapterFactory.getAdapter('clover');
    //   return new CloverInventorySyncService(cloverAdapter);
    default:
      throw new ValidationError(`POS provider '${provider}' not supported`);
  }
}

/**
 * POST /api/v1/pos/sync/:connectionId
 * 
 * Trigger inventory sync and transformation for a POS connection
 * 
 * Query Parameters:
 * - incremental: boolean (default: true) - Use lastSyncAt for incremental sync
 * - dryRun: boolean (default: false) - Simulate without saving
 * - clearBeforeSync: boolean (default: false) - Clear existing data first
 * 
 * Response: 200 OK
 * {
 *   syncId: "sync_abc123",
 *   connectionId: 1,
 *   restaurantId: 1,
 *   status: "completed",
 *   phase: "complete",
 *   sync: { synced: 10, errors: [] },
 *   transform: { successCount: 9, errorCount: 1 },
 *   duration: 5432
 * }
 */
export async function syncInventory(req, res, next) {
  try {
    const { connectionId } = req.params;
    const { incremental = true, dryRun = false, clearBeforeSync = false } = req.query;

    // Validate connection exists
    const connection = await POSConnection.findByPk(connectionId);
    if (!connection) {
      throw new NotFoundError(`POS connection ${connectionId} not found`);
    }

    if (!connection.isActive) {
      throw new ValidationError(`POS connection ${connectionId} is not active`);
    }

    logger.info('POSSyncController: Starting sync', {
      connectionId,
      provider: connection.provider,
      restaurantId: connection.restaurantId,
      incremental,
      dryRun,
      clearBeforeSync
    });

    // Get provider-specific sync service
    const syncService = getSyncService(connection.provider);

    // Execute sync (transformation is optional and disabled by default)
    // Transformation can fail due to missing categories, invalid units, etc.
    // Better to sync raw data first, then transform after user review
    const result = await syncService.syncAndTransform(connectionId, {
      incremental: incremental === 'true' || incremental === true,
      dryRun: dryRun === 'true' || dryRun === true,
      clearBeforeSync: clearBeforeSync === 'true' || clearBeforeSync === true,
      transform: false // Skip transformation - sync raw data only
    });

    logger.info('POSSyncController: Sync complete', {
      syncId: result.syncId,
      status: result.status,
      duration: result.duration
    });

    res.json(result);
  } catch (error) {
    logger.error('POSSyncController: Sync failed', {
      connectionId: req.params.connectionId,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
}

/**
 * POST /api/v1/pos/sync-sales/:connectionId
 * 
 * Trigger sales data sync and transformation for a POS connection
 * 
 * Request Body:
 * - startDate: ISO date string (required) - Start of date range
 * - endDate: ISO date string (required) - End of date range
 * - dryRun: boolean (default: false) - Simulate without saving
 * - transform: boolean (default: true) - Transform to SalesTransaction records
 * 
 * Response: 200 OK
 * {
 *   syncId: "sales-sync-abc123",
 *   connectionId: 1,
 *   restaurantId: 1,
 *   status: "completed",
 *   phase: "complete",
 *   sync: {
 *     orders: 150,
 *     lineItems: 450,
 *     errors: []
 *   },
 *   transform: {
 *     created: 450,
 *     skipped: 0,
 *     errors: 0
 *   },
 *   duration: 5432
 * }
 */
export async function syncSales(req, res, next) {
  try {
    const { connectionId } = req.params;
    const { startDate, endDate, dryRun = false } = req.body;

    // Validate required parameters
    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate are required');
    }

    // Validate date format
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError('Invalid date format. Use ISO 8601 format (e.g., 2023-10-01)');
    }

    if (start > end) {
      throw new ValidationError('startDate must be before endDate');
    }

    // Validate connection exists
    const connection = await POSConnection.findByPk(connectionId);
    if (!connection) {
      throw new NotFoundError(`POS connection ${connectionId} not found`);
    }

    if (!connection.isActive()) {
      throw new ValidationError(`POS connection ${connectionId} is not active`);
    }

    if (connection.provider !== 'square') {
      throw new ValidationError(`Sales sync only supported for Square connections (provider: ${connection.provider})`);
    }

    logger.info('POSSyncController: Starting sales sync', {
      connectionId,
      restaurantId: connection.restaurantId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      dryRun
    });

    // Get Square sales sync service
    const adapter = POSAdapterFactory.getAdapter('square');
    const salesSyncService = new SquareSalesSyncService(adapter);

    // Execute sync ONLY (no transformation) - sync raw data to square_orders/square_order_items
    // Transformation to sales_transactions happens in separate step via transformSales()
    const result = await salesSyncService.syncAndTransform(connectionId, {
      startDate: start,
      endDate: end,
      dryRun: dryRun === 'true' || dryRun === true,
      transform: false // STAGED: Sync raw data only, transform separately
    });

    logger.info('POSSyncController: Sales sync complete', {
      syncId: result.syncId,
      status: result.status,
      ordersSynced: result.sync?.synced?.orders,
      lineItemsSynced: result.sync?.synced?.lineItems,
      duration: result.duration
    });

    res.json(result);
  } catch (error) {
    logger.error('POSSyncController: Sales sync failed', {
      connectionId: req.params.connectionId,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
}

/**
 * POST /api/v1/pos/transform/:connectionId
 * 
 * Transform synced POS data to inventory items
 * 
 * Query Parameters:
 * - dryRun (boolean): Simulate without saving (default: false)
 * 
 * Response: 200 OK
 * {
 *   syncId: "transform_abc123",
 *   connectionId: 1,
 *   restaurantId: 1,
 *   status: "completed",
 *   transform: {
 *     totalItems: 10,
 *     successCount: 8,
 *     errorCount: 2,
 *     skippedCount: 0,
 *     errors: [...]
 *   },
 *   duration: 1234
 * }
 */
export async function transformInventory(req, res, next) {
  try {
    const { connectionId } = req.params;
    const { dryRun = false } = req.query;

    logger.info('POSSyncController: Starting transformation', {
      connectionId,
      dryRun
    });

    // Get POS connection
    const connection = await POSConnection.findByPk(connectionId);
    if (!connection) {
      throw new NotFoundError(`POS connection ${connectionId} not found`);
    }

    if (!connection.isActive) {
      throw new ValidationError(`POS connection ${connectionId} is not active`);
    }

    // Get provider-specific sync service
    const syncService = getSyncService(connection.provider);

    // Execute transformation only
    const transformResult = await syncService._transformMenuItems(connection, {
      dryRun: dryRun === 'true' || dryRun === true
    });

    const result = {
      syncId: `transform_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      connectionId: connection.id,
      restaurantId: connection.restaurantId,
      status: 'completed',
      transform: transformResult,
      duration: 0
    };

    logger.info('POSSyncController: Transformation complete', {
      syncId: result.syncId,
      transformed: transformResult.successCount,
      errors: transformResult.errorCount
    });

    res.json(result);
  } catch (error) {
    logger.error('POSSyncController: Transformation failed', {
      connectionId: req.params.connectionId,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
}

/**
 * POST /api/v1/pos/transform-sales/:connectionId
 * 
 * Transform synced Square sales data (square_orders) to sales transactions
 * 
 * Request Body:
 * - startDate: ISO date string (required) - Start of date range
 * - endDate: ISO date string (required) - End of date range
 * - dryRun: boolean (default: false) - Simulate without saving
 * 
 * Response: 200 OK
 * {
 *   syncId: "transform_abc123",
 *   connectionId: 1,
 *   restaurantId: 1,
 *   status: "completed",
 *   transform: {
 *     processed: 450,
 *     created: 448,
 *     skipped: 2,
 *     errors: []
 *   },
 *   duration: 1234
 * }
 */
export async function transformSales(req, res, next) {
  try {
    const { connectionId } = req.params;
    const { startDate, endDate, dryRun = false } = req.body;

    // Validate required parameters
    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate are required');
    }

    // Validate date format
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError('Invalid date format. Use ISO 8601 format (e.g., 2023-10-01)');
    }

    if (start > end) {
      throw new ValidationError('startDate must be before endDate');
    }

    logger.info('POSSyncController: Starting sales transformation', {
      connectionId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      dryRun
    });

    // Get POS connection
    const connection = await POSConnection.findByPk(connectionId);
    if (!connection) {
      throw new NotFoundError(`POS connection ${connectionId} not found`);
    }

    if (!connection.isActive()) {
      throw new ValidationError(`POS connection ${connectionId} is not active`);
    }

    if (connection.provider !== 'square') {
      throw new ValidationError(`Sales transformation only supported for Square connections (provider: ${connection.provider})`);
    }

    // Get Square sales sync service
    const adapter = POSAdapterFactory.getAdapter('square');
    const salesSyncService = new SquareSalesSyncService(adapter);

    // Execute transformation ONLY (assume sync already happened)
    const result = await salesSyncService.syncAndTransform(connectionId, {
      startDate: start,
      endDate: end,
      dryRun: dryRun === 'true' || dryRun === true,
      transform: true // Transform only, skip sync
    });

    logger.info('POSSyncController: Sales transformation complete', {
      syncId: result.syncId,
      created: result.transform?.created,
      errors: result.transform?.errors?.length || 0
    });

    res.json(result);
  } catch (error) {
    logger.error('POSSyncController: Sales transformation failed', {
      connectionId: req.params.connectionId,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
}

/**
 * GET /api/v1/pos/status/:connectionId
 * 
 * Get sync status for a POS connection
 * 
 * Response: 200 OK
 * {
 *   connectionId: 1,
 *   restaurantId: 1,
 *   provider: "square",
 *   tier1Count: 10,
 *   tier2Count: 9,
 *   lastSyncAt: "2025-10-06T10:00:00Z",
 *   mostRecentUpdate: "2025-10-06T12:00:00Z",
 *   syncNeeded: true,
 *   reason: "Recent updates since last sync"
 * }
 */
export async function getSyncStatus(req, res, next) {
  try {
    const { connectionId } = req.params;

    // Validate connection exists
    const connection = await POSConnection.findByPk(connectionId);
    if (!connection) {
      throw new NotFoundError(`POS connection ${connectionId} not found`);
    }

    logger.info('POSSyncController: Getting sync status', {
      connectionId,
      provider: connection.provider
    });

    // Get provider-specific sync service
    const syncService = getSyncService(connection.provider);

    // Get status
    const status = await syncService.getSyncStatus(connectionId);

    res.json(status);
  } catch (error) {
    logger.error('POSSyncController: Failed to get sync status', {
      connectionId: req.params.connectionId,
      error: error.message
    });
    next(error);
  }
}

/**
 * GET /api/v1/pos/stats/:restaurantId
 * 
 * Get transformation statistics for a restaurant
 * 
 * Response: 200 OK
 * {
 *   restaurantId: 1,
 *   categoryDistribution: [
 *     { category: "produce", count: 15 },
 *     { category: "proteins", count: 8 }
 *   ],
 *   unitDistribution: [
 *     { unit: "lb", count: 12 },
 *     { unit: "each", count: 11 }
 *   ],
 *   highValueItemCount: 5
 * }
 */
export async function getTransformationStats(req, res, next) {
  try {
    const { restaurantId } = req.params;

    // Find a POS connection for this restaurant
    const connection = await POSConnection.findOne({
      where: { restaurantId }
    });

    if (!connection) {
      throw new NotFoundError(`No POS connection found for restaurant ${restaurantId}`);
    }

    logger.info('POSSyncController: Getting transformation stats', {
      restaurantId,
      provider: connection.provider
    });

    // Get provider-specific sync service
    const syncService = getSyncService(connection.provider);

    // Get stats
    const stats = await syncService.getTransformationStats(restaurantId);

    res.json(stats);
  } catch (error) {
    logger.error('POSSyncController: Failed to get stats', {
      restaurantId: req.params.restaurantId,
      error: error.message
    });
    next(error);
  }
}

/**
 * POST /api/v1/pos/clear/:restaurantId
 * 
 * Clear all POS data for a restaurant (Tier 1 and Tier 2)
 * 
 * Response: 200 OK
 * {
 *   restaurantId: 1,
 *   deleted: {
 *     inventoryItems: 9,
 *     squareMenuItems: 10,
 *     squareCategories: 5,
 *     squareInventoryCounts: 3
 *   }
 * }
 */
export async function clearPOSData(req, res, next) {
  try {
    const { restaurantId } = req.params;

    // Find a POS connection for this restaurant
    const connection = await POSConnection.findOne({
      where: { restaurantId }
    });

    if (!connection) {
      throw new NotFoundError(`No POS connection found for restaurant ${restaurantId}`);
    }

    logger.info('POSSyncController: Clearing POS data', {
      restaurantId,
      provider: connection.provider
    });

    // Get provider-specific sync service
    const syncService = getSyncService(connection.provider);

    // Clear data
    const result = await syncService.clearSquareData(restaurantId);

    logger.info('POSSyncController: POS data cleared', {
      restaurantId,
      deleted: result
    });

    res.json({
      restaurantId: parseInt(restaurantId),
      deleted: result
    });
  } catch (error) {
    logger.error('POSSyncController: Failed to clear data', {
      restaurantId: req.params.restaurantId,
      error: error.message
    });
    next(error);
  }
}

/**
 * POST /api/v1/pos/clear-sales/:restaurantId
 * 
 * Clear all sales data for a restaurant
 * 
 * Deletes both Tier 1 (square_orders, square_order_items) and
 * Tier 2 (sales_transactions) sales data.
 * 
 * Response: 200 OK
 * {
 *   restaurantId: 1,
 *   deleted: {
 *     squareOrders: 50,
 *     squareOrderItems: 200,
 *     salesTransactions: 180
 *   }
 * }
 */
export async function clearSalesData(req, res, next) {
  try {
    const { restaurantId } = req.params;

    // Find a POS connection for this restaurant
    const connection = await POSConnection.findOne({
      where: { restaurantId }
    });

    if (!connection) {
      throw new NotFoundError(`No POS connection found for restaurant ${restaurantId}`);
    }

    logger.info('POSSyncController: Clearing sales data', {
      restaurantId,
      provider: connection.provider
    });

    // Get Square sales sync service
    const adapter = POSAdapterFactory.getAdapter('square');
    const salesSyncService = new SquareSalesSyncService(adapter);

    // Clear sales data
    const result = await salesSyncService.clearSalesData(restaurantId);

    logger.info('POSSyncController: Sales data cleared', {
      restaurantId,
      deleted: result
    });

    res.json({
      restaurantId: parseInt(restaurantId),
      deleted: result
    });
  } catch (error) {
    logger.error('POSSyncController: Failed to clear sales data', {
      restaurantId: req.params.restaurantId,
      error: error.message
    });
    next(error);
  }
}

/**
 * GET /api/v1/pos/validate/:restaurantId
 * 
 * Validate transformation accuracy for a restaurant
 * 
 * Response: 200 OK
 * {
 *   restaurantId: 1,
 *   tier1Count: 10,
 *   tier2Count: 9,
 *   transformationRate: "90.00%",
 *   isValid: false,
 *   status: "incomplete"
 * }
 */
export async function validateTransformation(req, res, next) {
  try {
    const { restaurantId } = req.params;

    // Find a POS connection for this restaurant
    const connection = await POSConnection.findOne({
      where: { restaurantId }
    });

    if (!connection) {
      throw new NotFoundError(`No POS connection found for restaurant ${restaurantId}`);
    }

    logger.info('POSSyncController: Validating transformation', {
      restaurantId,
      provider: connection.provider
    });

    // Get provider-specific sync service
    const syncService = getSyncService(connection.provider);

    // Validate
    const validation = await syncService.validateTransformation(restaurantId);

    res.json(validation);
  } catch (error) {
    logger.error('POSSyncController: Validation failed', {
      restaurantId: req.params.restaurantId,
      error: error.message
    });
    next(error);
  }
}
