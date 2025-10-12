/**
 * POS Sync Controller
 * 
 * Generic REST API controller for POS inventory synchronization.
 * Provider-agnostic - works with Square, Toast, Clover, etc.
 * 
 * Routes:
 * - POST   /api/v1/pos/sync/:connectionId        - Trigger sync and transform
 * - GET    /api/v1/pos/status/:connectionId      - Get sync status
 * - GET    /api/v1/pos/stats/:restaurantId       - Get transformation stats
 * - POST   /api/v1/pos/clear/:restaurantId       - Clear POS data
 * - GET    /api/v1/pos/validate/:restaurantId    - Validate transformation
 * 
 * Architecture:
 * - Controller dispatches to appropriate service based on connection.provider
 * - SquareInventorySyncService for Square connections
 * - Future: ToastInventorySyncService, CloverInventorySyncService, etc.
 * 
 * Related:
 * - Issue #20: Square Inventory Synchronization
 * - SquareInventorySyncService: Square-specific orchestration
 * - POSDataTransformer: Provider → unified format transformation
 * 
 * Created: 2025-10-06
 */

import POSConnection from '../models/POSConnection.js';
import POSAdapterFactory from '../adapters/POSAdapterFactory.js';
import SquareInventorySyncService from '../services/SquareInventorySyncService.js';
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
