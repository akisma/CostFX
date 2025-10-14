/**
 * SquareSalesSyncService
 * 
 * Orchestrates the complete Square sales synchronization pipeline:
 * 
 * Pipeline Flow:
 * 1. SquareAdapter.syncSales() → Tier 1 (square_orders, square_order_items)
 * 2. POSDataTransformer.squareOrderToSalesTransactions() → Tier 2 (sales_transactions)
 * 
 * Architecture:
 * - Tier 1 (Raw POS Data): square_orders, square_order_items
 * - Tier 2 (Unified Format): sales_transactions for recipe variance analysis
 * - Two-phase sync: fetch raw data, then transform to unified format
 * 
 * Features:
 * - Date range-based sync (manual trigger, not automated)
 * - Batch transformation with error tolerance
 * - Comprehensive status tracking and reporting
 * - Transaction support for atomic operations
 * - Dry-run mode for testing
 * 
 * Related:
 * - Issue #21: Square Sales Data Synchronization
 * - SquareAdapter: Fetches raw orders from Square Orders API
 * - POSDataTransformer: Maps square_order_items → sales_transactions
 * 
 * Created: 2025-10-12 (Issue #21 Day 2)
 */

import POSConnection from '../models/POSConnection.js';
import SquareOrder from '../models/SquareOrder.js';
import SquareOrderItem from '../models/SquareOrderItem.js';
import SalesTransaction from '../models/SalesTransaction.js';
import POSDataTransformer from './POSDataTransformer.js';
import sequelize from '../config/database.js';
import logger from '../utils/logger.js';
import { POSSyncError } from '../utils/posErrors.js';
import { Op } from 'sequelize';

class SquareSalesSyncService {
  /**
   * Create a new Square sales sync service
   * 
   * @param {Object} squareAdapter - Initialized SquareAdapter instance
   * @param {Object} transformer - Optional POSDataTransformer instance (for testing)
   */
  constructor(squareAdapter, transformer = null) {
    if (!squareAdapter) {
      throw new Error('SquareAdapter is required');
    }
    this.squareAdapter = squareAdapter;
    this.transformer = transformer || new POSDataTransformer();
  }

  /**
   * Execute full sync and transform pipeline
   * 
   * Two-Phase Operation:
   * 1. Sync: SquareAdapter fetches raw orders from Square API → square_orders/square_order_items tables
   * 2. Transform: POSDataTransformer maps square_order_items → sales_transactions
   * 
   * @param {number} connectionId - POSConnection ID
   * @param {Object} options - Sync options
   * @param {Date|string} options.startDate - Start date for orders (REQUIRED)
   * @param {Date|string} options.endDate - End date for orders (default: now)
   * @param {boolean} options.transform - If true, run transform phase (default: false)
   * @param {boolean} options.dryRun - If true, simulate transformation without saving (default: false)
   * @returns {Promise<Object>} Sync result with stats
   * @throws {POSSyncError} If sync fails
   */
  async syncAndTransform(connectionId, options = {}) {
    const {
      startDate,
      endDate,
      transform = false,
      dryRun = false
    } = options;

    // Validate required startDate
    if (!startDate) {
      throw new Error('startDate is required for sales sync');
    }

    const startDateObj = new Date(startDate);
    const endDateObj = endDate ? new Date(endDate) : new Date();

    logger.info('SquareSalesSyncService: Starting sync and transform', {
      connectionId,
      startDate: startDateObj.toISOString(),
      endDate: endDateObj.toISOString(),
      transform,
      dryRun
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

      // Phase 1: Sync raw orders from Square Orders API
      result.phase = 'sync';
      
      result.sync = await this.squareAdapter.syncSales(
        connection,
        startDateObj,
        endDateObj
      );
      
      logger.info('SquareSalesSyncService: Sync phase complete', {
        syncId: result.syncId,
        orders: result.sync.synced.orders,
        lineItems: result.sync.synced.lineItems,
        errors: result.sync.errors.length
      });

      // Phase 2: Transform square_order_items to sales_transactions (OPTIONAL)
      // Transformation may fail due to unmapped items - keep raw data separate
      // UI can trigger transformation separately after user reviews/maps items
      if (transform === true) {
        try {
          result.phase = 'transform';
          result.transform = await this._transformOrders(connection, {
            startDate: startDateObj,
            endDate: endDateObj,
            dryRun
          });
          
          logger.info('SquareSalesSyncService: Transform phase complete', {
            syncId: result.syncId,
            created: result.transform.created,
            skipped: result.transform.skipped,
            errors: result.transform.errors.length,
            dryRun
          });
        } catch (transformError) {
          // Log transform error but don't fail the entire sync
          logger.warn('SquareSalesSyncService: Transform phase failed, but sync data is preserved', {
            syncId: result.syncId,
            error: transformError.message,
            syncSucceeded: true
          });
          
          result.transform = {
            processed: 0,
            created: 0,
            skipped: 0,
            errors: [{ message: transformError.message }]
          };
        }
      } else {
        result.transform = {
          processed: 0,
          created: 0,
          skipped: 0,
          errors: [],
          skipped: true
        };
      }

      // Mark as complete
      result.status = 'completed';
      result.phase = 'complete';
      result.completedAt = new Date();
      result.duration = Date.now() - startTime;

      logger.info('SquareSalesSyncService: Sync and transform complete', {
        syncId: result.syncId,
        duration: result.duration,
        ordersSynced: result.sync.synced.orders,
        lineItemsSynced: result.sync.synced.lineItems,
        transactionsCreated: result.transform.created,
        totalErrors: result.sync.errors.length + result.transform.errors.length
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

      logger.error('SquareSalesSyncService: Sync and transform failed', {
        syncId: result.syncId,
        phase: result.phase,
        error: error.message,
        stack: error.stack
      });

      // If this is a validation error (connection issues), re-throw
      // Otherwise return the failed result (sync/transform operations can fail gracefully)
      if (!result.phase || result.phase === null) {
        throw error; // Validation error before sync started
      }

      return result; // Operation failed, but return structured result
    }
  }

  /**
   * Transform square_orders to sales_transactions
   * 
   * Uses POSDataTransformer to map raw Square order data to unified format
   * for recipe variance analysis.
   * 
   * @private
   * @param {POSConnection} connection - POS connection
   * @param {Object} options - Transform options
   * @param {Date} options.startDate - Start date for orders
   * @param {Date} options.endDate - End date for orders
   * @param {boolean} options.dryRun - If true, don't save to database
   * @returns {Promise<Object>} Transform result with stats
   */
  async _transformOrders(connection, { startDate, endDate, dryRun = false } = {}) {
    logger.info('SquareSalesSyncService: Starting order transformation', {
      restaurantId: connection.restaurantId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dryRun
    });

    // Fetch orders from date range
    const orders = await SquareOrder.findAll({
      where: {
        restaurantId: connection.restaurantId,
        closedAt: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [{
        model: SquareOrderItem,
        as: 'SquareOrderItems'
      }],
      order: [['closedAt', 'ASC']]
    });

    if (orders.length === 0) {
      logger.warn('SquareSalesSyncService: No orders found to transform', {
        restaurantId: connection.restaurantId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      return {
        processed: 0,
        created: 0,
        skipped: 0,
        errors: []
      };
    }

    logger.info('SquareSalesSyncService: Transform batch', {
      restaurantId: connection.restaurantId,
      orderCount: orders.length,
      dryRun
    });

    // Transform each order
    const results = await Promise.allSettled(
      orders.map(order => 
        this.transformer.squareOrderToSalesTransactions(order, { dryRun })
      )
    );

    // Aggregate results
    const summary = {
      processed: results.length,
      created: 0,
      skipped: 0,
      errors: []
    };

    for (const result of results) {
      if (result.status === 'fulfilled') {
        summary.created += result.value.created;
        summary.skipped += result.value.skipped;
        summary.errors.push(...result.value.errors);
      } else {
        summary.errors.push({
          error: result.reason.message
        });
      }
    }

    logger.info('SquareSalesSyncService: Transformation summary', {
      processed: summary.processed,
      created: summary.created,
      skipped: summary.skipped,
      errors: summary.errors.length,
      mappingRate: summary.processed > 0 
        ? ((summary.created / (summary.created + summary.skipped)) * 100).toFixed(1) + '%'
        : '0%'
    });

    return summary;
  }

  /**
   * Load and validate POS connection
   * @private
   */
  async _loadConnection(connectionId) {
    const connection = await POSConnection.findByPk(connectionId);
    
    if (!connection) {
      throw new Error(`POS connection ${connectionId} not found`);
    }

    if (!connection.isActive()) {
      throw new Error(`POS connection ${connectionId} is not active`);
    }

    if (connection.provider !== 'square') {
      throw new Error(`Connection ${connectionId} is not a Square connection (provider: ${connection.provider})`);
    }

    return connection;
  }

  /**
   * Clear all sales data for a restaurant
   * 
   * Deletes both Tier 1 (square_orders, square_order_items) and 
   * Tier 2 (sales_transactions) data with transaction support.
   * 
   * @param {number} restaurantId - Restaurant ID
   * @returns {Promise<Object>} Deletion counts
   */
  async clearSalesData(restaurantId) {
    logger.info('SquareSalesSyncService: Clearing sales data', { restaurantId });

    const transaction = await sequelize.transaction();

    try {
      const deletionCounts = {
        squareOrders: 0,
        squareOrderItems: 0,
        salesTransactions: 0
      };

      // Delete from Tier 2 (sales_transactions with square source)
      deletionCounts.salesTransactions = await SalesTransaction.destroy({
        where: {
          restaurantId,
          sourcePosProvider: 'square'
        },
        transaction
      });

      // Delete from Tier 1 (square_order_items)
      deletionCounts.squareOrderItems = await SquareOrderItem.destroy({
        where: { restaurantId },
        transaction
      });

      // Delete from Tier 1 (square_orders)
      deletionCounts.squareOrders = await SquareOrder.destroy({
        where: { restaurantId },
        transaction
      });

      await transaction.commit();

      logger.info('SquareSalesSyncService: Sales data cleared', {
        restaurantId,
        ...deletionCounts
      });

      return deletionCounts;

    } catch (error) {
      await transaction.rollback();
      
      logger.error('SquareSalesSyncService: Failed to clear sales data', {
        restaurantId,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }

  /**
   * Generate unique sync ID
   * @private
   */
  _generateSyncId() {
    return `sales-sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default SquareSalesSyncService;
