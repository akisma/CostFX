/**
 * SquareInventorySyncService
 * 
 * Orchestrates the complete Square inventory synchronization pipeline:
 * 
 * Pipeline F      logger.info('SquareInventorySyncService: Transformation complete', {
        syncId: result.syncId,
        transformed: result.transform.successCount,
        errors: result.transform.errorCount,
        errorRate: result.transform.totalItems > 0 
          ? ((result.transform.errorCount / result.transform.totalItems) * 100).toFixed(2) + '%'
          : '0%',
        dryRun
      });* 1. SquareAdapter.syncInventory() → Tier 1 (square_* tables)
 * 2. POSDataTransformer.transformBatch() → Tier 2 (inventory_items)
 * 
 * Architecture:
 * - Tier 1 (Raw POS Data): square_menu_items, square_categories, square_inventory_counts
 * - Tier 2 (Unified Format): inventory_items with variance thresholds
 * - Two-phase sync: fetch raw data, then transform to unified format
 * 
 * Features:
 * - Full vs incremental sync support
 * - Batch transformation with error threshold (5%)
 * - Comprehensive status tracking and reporting
 * - Transaction support for atomic operations
 * - Dry-run mode for testing
 * 
 * Related:
 * - Issue #20: Square Inventory Synchronization
 * - SquareAdapter: Fetches raw data from Square API
 * - POSDataTransformer: Maps square_menu_items → inventory_items
 * 
 * Created: 2025-10-06
 */

import POSConnection from '../models/POSConnection.js';
import SquareMenuItem from '../models/SquareMenuItem.js';
import SquareCategory from '../models/SquareCategory.js';
import SquareInventoryCount from '../models/SquareInventoryCount.js';
import InventoryItem from '../models/InventoryItem.js';
import POSDataTransformer from './POSDataTransformer.js';
import sequelize from '../config/database.js';
import logger from '../utils/logger.js';
import { POSSyncError } from '../utils/posErrors.js';

class SquareInventorySyncService {
  /**
   * Create a new Square inventory sync service
   * 
   * @param {Object} squareAdapter - Initialized SquareAdapter instance
   */
  constructor(squareAdapter) {
    if (!squareAdapter) {
      throw new Error('SquareAdapter is required');
    }
    this.squareAdapter = squareAdapter;
    this.transformer = new POSDataTransformer({
      categoryMapperOptions: {
        enableFallback: false
      }
    });
  }

  /**
   * Execute full sync and transform pipeline
   * 
   * Two-Phase Operation:
   * 1. Sync: SquareAdapter fetches raw data from Square API → square_* tables
   * 2. Transform: POSDataTransformer maps square_menu_items → inventory_items
   * 
   * @param {number} connectionId - POSConnection ID
   * @param {Object} options - Sync options
   * @param {boolean} options.incremental - If true, only sync items updated since lastSyncAt
   * @param {boolean} options.dryRun - If true, simulate transformation without saving
   * @param {boolean} options.clearBeforeSync - If true, clear square_* tables before sync
   * @returns {Promise<Object>} Sync result with stats
   * @throws {POSSyncError} If sync fails
   */
  async syncAndTransform(connectionId, options = {}) {
    const {
      incremental = true,
      dryRun = false,
      clearBeforeSync = false
    } = options;

    logger.info('SquareInventorySyncService: Starting sync and transform', {
      connectionId,
      incremental,
      dryRun,
      clearBeforeSync
    });

    const startTime = Date.now();
    const result = {
      syncId: this._generateSyncId(),
      connectionId,
      phase: null,
      status: 'in_progress',
      startedAt: new Date(),
      completedAt: null,
      duration: null,
      sync: null,
      transform: null,
      errors: []
    };

    try {
      // Load connection
      const connection = await this._loadConnection(connectionId);
      result.restaurantId = connection.restaurantId;

      // Optional: Clear existing data
      if (clearBeforeSync) {
        result.phase = 'clear';
        await this._clearSquareData(connection.restaurantId);
        logger.info('SquareInventorySyncService: Cleared existing Square data', {
          syncId: result.syncId,
          restaurantId: connection.restaurantId
        });
      }

      // Phase 1: Sync raw data from Square API
      result.phase = 'sync';
      const since = incremental ? connection.lastSyncAt : null;
      
      result.sync = await this.squareAdapter.syncInventory(connection, since);
      
      logger.info('SquareInventorySyncService: Sync phase complete', {
        syncId: result.syncId,
        synced: result.sync.synced,
        errors: result.sync.errors.length
      });

      // Phase 2: Transform square_menu_items to inventory_items (OPTIONAL)
      // Transformation is complex and may fail - keep raw data separate
      // UI can trigger transformation separately after user reviews/maps categories
      if (options.transform !== false) {
        try {
          result.phase = 'transform';
          result.transform = await this._transformMenuItems(connection, { dryRun });
          
          logger.info('SquareInventorySyncService: Transform phase complete', {
            syncId: result.syncId,
            transformed: result.transform.successCount,
            errors: result.transform.errorCount,
            dryRun
          });
        } catch (transformError) {
          // Log transform error but don't fail the entire sync
          logger.warn('SquareInventorySyncService: Transform phase failed, but sync data is preserved', {
            syncId: result.syncId,
            error: transformError.message,
            syncSucceeded: true
          });
          
          result.transform = {
            totalItems: 0,
            successCount: 0,
            errorCount: 0,
            skippedCount: 0,
            errors: [{ message: transformError.message }]
          };
        }
      } else {
        result.transform = {
          totalItems: 0,
          successCount: 0,
          errorCount: 0,
          skippedCount: 0,
          errors: [],
          skipped: true
        };
      }

      // Mark as complete
      result.status = 'completed';
      result.phase = 'complete';
      result.completedAt = new Date();
      result.duration = Date.now() - startTime;

      logger.info('SquareInventorySyncService: Sync and transform complete', {
        syncId: result.syncId,
        duration: result.duration,
        totalSynced: result.sync.synced,
        totalTransformed: result.transform.successCount,
        totalErrors: result.sync.errors.length + result.transform.errorCount
      });

      return result;

    } catch (error) {
      result.status = 'failed';
      result.completedAt = new Date();
      result.duration = Date.now() - startTime;
      result.errors.push({
        phase: result.phase,
        message: error.message,
        timestamp: new Date()
      });

      logger.error('SquareInventorySyncService: Sync and transform failed', {
        syncId: result.syncId,
        phase: result.phase,
        error: error.message,
        stack: error.stack,
        // Log individual transformation errors if available
        transformErrors: error.results?.errors || []
      });

      throw new POSSyncError(
        `Square sync failed in ${result.phase} phase: ${error.message}`,
        true, // retryable
        result, // result
        'square' // provider
      );
    }
  }

  /**
   * Transform square_menu_items to inventory_items
   * 
   * Uses POSDataTransformer to map raw Square data to unified format
   * with variance thresholds and category/unit mappings.
   * 
   * @private
   * @param {POSConnection} connection - POS connection
   * @param {Object} options - Transform options
   * @param {boolean} options.dryRun - If true, don't save to database
   * @returns {Promise<Object>} Transform result with stats
   */
  async _transformMenuItems(connection, { dryRun = false } = {}) {
    logger.info('SquareInventorySyncService: Starting menu item transformation', {
      restaurantId: connection.restaurantId,
      dryRun
    });

    // Fetch all square_menu_items for this restaurant
    const squareMenuItems = await SquareMenuItem.findAll({
      where: {
        restaurantId: connection.restaurantId,
        posConnectionId: connection.id
      },
      order: [['name', 'ASC']]
    });

    if (squareMenuItems.length === 0) {
      logger.warn('SquareInventorySyncService: No menu items found to transform', {
        restaurantId: connection.restaurantId
      });
      
      return {
        totalItems: 0,
        successCount: 0,
        errorCount: 0,
        skippedCount: 0,
        errors: []
      };
    }

    // Transform batch using POSDataTransformer
    const result = await this.transformer.transformBatch(
      squareMenuItems,
      connection.restaurantId,
      { dryRun }
    );

    logger.info('SquareInventorySyncService: Menu item transformation complete', {
      restaurantId: connection.restaurantId,
      totalItems: result.totalItems,
      successCount: result.successCount,
      errorCount: result.errorCount,
      errorRate: result.errorRate,
      dryRun
    });

    return result;
  }

  /**
   * Get sync status for a connection
   * 
   * Returns current sync state, last sync timestamp, and item counts
   * 
   * @param {number} connectionId - POSConnection ID
   * @returns {Promise<Object>} Sync status
   */
  async getSyncStatus(connectionId) {
    logger.info('SquareInventorySyncService: Getting sync status', { connectionId });

    const connection = await this._loadConnection(connectionId);

    // Count items in each tier
    const [squareItemCount, inventoryItemCount] = await Promise.all([
      SquareMenuItem.count({
        where: { restaurantId: connection.restaurantId }
      }),
      InventoryItem.count({
        where: {
          restaurantId: connection.restaurantId,
          sourcePosProvider: 'square'
        }
      })
    ]);

    // Get most recent square_menu_item update
    const mostRecentSquareItem = await SquareMenuItem.findOne({
      where: { restaurantId: connection.restaurantId },
      order: [['updatedAt', 'DESC']],
      attributes: ['updatedAt']
    });

    const status = {
      connectionId: connection.id,
      restaurantId: connection.restaurantId,
      provider: 'square',
      lastSyncAt: connection.lastSyncAt,
      tier1: {
        name: 'Raw Square Data',
        tables: ['square_menu_items', 'square_categories', 'square_inventory_counts'],
        itemCount: squareItemCount,
        mostRecentUpdate: mostRecentSquareItem?.updatedAt || null
      },
      tier2: {
        name: 'Unified Inventory Items',
        table: 'inventory_items',
        itemCount: inventoryItemCount
      },
      syncNeeded: this._determineSyncNeeded(connection, mostRecentSquareItem?.updatedAt),
      status: connection.status,
      isActive: connection.isActive
    };

    logger.info('SquareInventorySyncService: Sync status retrieved', {
      connectionId,
      tier1Count: squareItemCount,
      tier2Count: inventoryItemCount,
      syncNeeded: status.syncNeeded
    });

    return status;
  }

  /**
   * Clear all Square data for a restaurant
   * 
   * Removes all square_* records (Tier 1) and square-sourced inventory_items (Tier 2)
   * Useful for testing or re-syncing from scratch
   * 
   * @param {number} restaurantId - Restaurant ID
   * @returns {Promise<Object>} Deletion counts
   */
  async clearSquareData(restaurantId) {
    logger.info('SquareInventorySyncService: Clearing Square data', { restaurantId });

    const transaction = await sequelize.transaction();

    try {
      const deletionCounts = {
        squareMenuItems: 0,
        squareCategories: 0,
        squareInventoryCounts: 0,
        inventoryItems: 0
      };

      // Delete from Tier 2 (inventory_items with square source)
      deletionCounts.inventoryItems = await InventoryItem.destroy({
        where: {
          restaurantId,
          sourcePosProvider: 'square'
        },
        transaction
      });

      // Delete from Tier 1 (square_* tables)
      deletionCounts.squareInventoryCounts = await SquareInventoryCount.destroy({
        where: { restaurantId },
        transaction
      });

      deletionCounts.squareMenuItems = await SquareMenuItem.destroy({
        where: { restaurantId },
        transaction
      });

      deletionCounts.squareCategories = await SquareCategory.destroy({
        where: { restaurantId },
        transaction
      });

      await transaction.commit();

      logger.info('SquareInventorySyncService: Square data cleared', {
        restaurantId,
        ...deletionCounts
      });

      return deletionCounts;

    } catch (error) {
      await transaction.rollback();
      
      logger.error('SquareInventorySyncService: Failed to clear Square data', {
        restaurantId,
        error: error.message,
        stack: error.stack
      });

      throw new POSSyncError(
        `Failed to clear Square data: ${error.message}`,
        false, // not retryable
        null, // result
        'square' // provider
      );
    }
  }

  /**
   * Validate transformation accuracy
   * 
   * Compares square_menu_items count with inventory_items count
   * to ensure transformation completed successfully
   * 
   * @param {number} restaurantId - Restaurant ID
   * @returns {Promise<Object>} Validation result
   */
  async validateTransformation(restaurantId) {
    logger.info('SquareInventorySyncService: Validating transformation', { restaurantId });

    const [squareItemCount, inventoryItemCount] = await Promise.all([
      SquareMenuItem.count({
        where: { restaurantId }
      }),
      InventoryItem.count({
        where: {
          restaurantId,
          sourcePosProvider: 'square'
        }
      })
    ]);

    const validation = {
      restaurantId,
      tier1Count: squareItemCount,
      tier2Count: inventoryItemCount,
      transformationRate: squareItemCount > 0
        ? ((inventoryItemCount / squareItemCount) * 100).toFixed(2) + '%'
        : '0%',
      // Valid if: (1) nothing to transform (squareItemCount=0), OR (2) >= 95% success rate
      isValid: squareItemCount === 0 || inventoryItemCount >= squareItemCount * 0.95,
      status: null
    };

    if (validation.isValid) {
      validation.status = 'valid';
    } else if (inventoryItemCount === 0 && squareItemCount > 0) {
      validation.status = 'not_transformed';
    } else {
      validation.status = 'incomplete';
    }

    logger.info('SquareInventorySyncService: Validation complete', validation);

    return validation;
  }

  /**
   * Get transformation statistics
   * 
   * Provides detailed breakdown of transformed items by category and status
   * 
   * @param {number} restaurantId - Restaurant ID
   * @returns {Promise<Object>} Transformation statistics
   */
  async getTransformationStats(restaurantId) {
    logger.info('SquareInventorySyncService: Getting transformation stats', { restaurantId });

    // Get category distribution
    const categoryStats = await InventoryItem.findAll({
      where: {
        restaurantId,
        sourcePosProvider: 'square'
      },
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['category']
    });

    // Calculate total count from category stats
    const totalItems = categoryStats.reduce((sum, stat) => {
      return sum + parseInt(stat.dataValues.count);
    }, 0);

    // Classification tiers don't exist in schema yet
    // TODO: Add tier classification logic when implementing ingredient tiers
    const tier1Count = 0;
    const tier2Count = 0;
    const tier3Count = 0;
    const unclassifiedCount = totalItems;

    // Get high-value item count
    const highValueCount = await InventoryItem.count({
      where: {
        restaurantId,
        sourcePosProvider: 'square',
        highValueFlag: true
      }
    });

    // Get unit distribution
    const unitStats = await InventoryItem.findAll({
      where: {
        restaurantId,
        sourcePosProvider: 'square'
      },
      attributes: [
        'unit',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['unit']
    });

    const stats = {
      restaurantId,
      totalItems,
      tier1Count,
      tier2Count,
      tier3Count,
      unclassifiedCount,
      highValueItems: highValueCount,
      byCategory: categoryStats.map(stat => ({
        category: stat.category,
        count: parseInt(stat.dataValues.count)
      })),
      byUnit: unitStats.map(stat => ({
        unit: stat.unit,
        count: parseInt(stat.dataValues.count)
      }))
    };

    logger.info('SquareInventorySyncService: Transformation stats retrieved', {
      restaurantId,
      totalItems: stats.totalItems,
      categories: stats.byCategory.length,
      units: stats.byUnit.length
    });

    return stats;
  }

  // ======================== Private Helper Methods ========================

  /**
   * Load POSConnection by ID
   * 
   * @private
   * @param {number} connectionId - Connection ID
   * @returns {Promise<POSConnection>} POS connection
   * @throws {Error} If connection not found
   */
  async _loadConnection(connectionId) {
    const connection = await POSConnection.findByPk(connectionId);
    
    if (!connection) {
      throw new Error(`POSConnection ${connectionId} not found`);
    }
    
    if (connection.provider !== 'square') {
      throw new Error(`Connection ${connectionId} is not a Square connection (provider: ${connection.provider})`);
    }
    
    return connection;
  }

  /**
   * Clear Square data for a restaurant
   * 
   * @private
   * @param {number} restaurantId - Restaurant ID
   */
  async _clearSquareData(restaurantId) {
    await this.clearSquareData(restaurantId);
  }

  /**
   * Determine if sync is needed
   * 
   * @private
   * @param {POSConnection} connection - POS connection
   * @param {Date} mostRecentUpdate - Most recent square_menu_item update
   * @returns {boolean} True if sync needed
   */
  _determineSyncNeeded(connection, mostRecentUpdate) {
    // Never synced
    if (!connection.lastSyncAt) {
      return true;
    }

    // Has recent updates since last sync
    if (mostRecentUpdate && mostRecentUpdate > connection.lastSyncAt) {
      return true;
    }

    // Check if data is stale (more than 24 hours old)
    const hoursSinceLastSync = (Date.now() - connection.lastSyncAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastSync > 24) {
      return true;
    }

    return false;
  }

  /**
   * Generate unique sync ID
   * 
   * @private
   * @returns {string} Sync ID
   */
  _generateSyncId() {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default SquareInventorySyncService;
