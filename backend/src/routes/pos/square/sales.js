/**
 * Square Sales Routes
 * 
 * RESTful endpoints for Square sales data synchronization and transformation.
 * 
 * Base Path: /api/v1/pos/square/sales
 * 
 * Endpoints:
 * - POST   /sync/:connectionId       - Sync raw sales data (Tier 1)
 * - POST   /transform/:connectionId  - Transform to sales transactions (Tier 2)
 * - DELETE /:restaurantId            - Clear all sales data
 * - GET    /status/:connectionId     - Get sync status
 * - GET    /raw/:connectionId        - Get raw Square orders (Tier 1)
 * - GET    /transformed/:connectionId - Get transformed transactions (Tier 2)
 * 
 * Related:
 * - Issue #21: Square Sales Data Synchronization
 * - Issue #46: UI for Square Sales Import & Transformation
 * - POSSyncController: Request handling
 * - SquareSalesSyncService: Square orchestration
 * 
 * Created: 2025-10-13 (REST API Restructure)
 */

import express from 'express';
import {
  syncSales,
  transformSales,
  clearSalesData,
  getSyncStatus
} from '../../../controllers/POSSyncController.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/pos/square/sales/sync/{connectionId}:
 *   post:
 *     summary: Sync raw sales data from Square
 *     description: Fetches orders and order items from Square API for date range and stores in Tier 1 tables (square_orders, square_order_items)
 *     tags: [Square Sales]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: POS connection ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startDate
 *               - endDate
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: '2023-10-01'
 *                 description: Start date (ISO 8601)
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: '2023-10-31'
 *                 description: End date (ISO 8601)
 *               dryRun:
 *                 type: boolean
 *                 default: false
 *                 description: Simulate without saving
 *     responses:
 *       200:
 *         description: Sync completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 syncId:
 *                   type: string
 *                 connectionId:
 *                   type: integer
 *                 status:
 *                   type: string
 *                   enum: [completed, failed]
 *                 sync:
 *                   type: object
 *                   properties:
 *                     synced:
 *                       type: object
 *                       properties:
 *                         orders:
 *                           type: integer
 *                         lineItems:
 *                           type: integer
 *                     errors:
 *                       type: array
 *                 duration:
 *                   type: integer
 *       400:
 *         description: Invalid date range
 *       404:
 *         description: Connection not found
 *       503:
 *         description: Sync failed
 */
router.post('/sync/:connectionId', syncSales);

/**
 * @swagger
 * /api/v1/pos/square/sales/transform/{connectionId}:
 *   post:
 *     summary: Transform sales data to unified format
 *     description: Transforms square_order_items (Tier 1) to sales_transactions (Tier 2) for specified date range
 *     tags: [Square Sales]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startDate
 *               - endDate
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: '2023-10-01'
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: '2023-10-31'
 *               dryRun:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Transformation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 syncId:
 *                   type: string
 *                 status:
 *                   type: string
 *                 transform:
 *                   type: object
 *                   properties:
 *                     created:
 *                       type: integer
 *                     skipped:
 *                       type: integer
 *                     errors:
 *                       type: array
 *       400:
 *         description: Invalid date range
 *       404:
 *         description: Connection not found
 */
router.post('/transform/:connectionId', transformSales);

/**
 * @swagger
 * /api/v1/pos/square/sales/{restaurantId}:
 *   delete:
 *     summary: Clear all sales data
 *     description: Deletes all Tier 1 (square_orders, square_order_items) and Tier 2 (sales_transactions) data
 *     tags: [Square Sales]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Data cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 restaurantId:
 *                   type: integer
 *                 deleted:
 *                   type: object
 *                   properties:
 *                     squareOrders:
 *                       type: integer
 *                     squareOrderItems:
 *                       type: integer
 *                     salesTransactions:
 *                       type: integer
 *       404:
 *         description: No connection found
 */
router.delete('/:restaurantId', clearSalesData);

/**
 * @swagger
 * /api/v1/pos/square/sales/status/{connectionId}:
 *   get:
 *     summary: Get sales sync status
 *     description: Returns current sync status and last sync timestamp
 *     tags: [Square Sales]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connectionId:
 *                   type: integer
 *                 status:
 *                   type: string
 *                 lastSyncAt:
 *                   type: string
 *       404:
 *         description: Connection not found
 */
router.get('/status/:connectionId', getSyncStatus);

/**
 * @swagger
 * /api/v1/pos/square/sales/raw/{connectionId}:
 *   get:
 *     summary: Get raw Square sales data (Tier 1)
 *     description: Returns orders and order items from square_orders and square_order_items tables
 *     tags: [Square Sales]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Raw sales data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     orders:
 *                       type: array
 *                     orderItems:
 *                       type: array
 *       404:
 *         description: Connection not found
 */
router.get('/raw/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { SquareOrder, SquareOrderItem } = await import('../../../models/index.js');
    
    const orders = await SquareOrder.findAll({
      where: { posConnectionId: connectionId },
      order: [['createdAt', 'DESC']],
      limit: 100, // Limit for performance
      raw: true
    });
    
    const orderItems = await SquareOrderItem.findAll({
      where: { posConnectionId: connectionId },
      order: [['id', 'ASC']],
      limit: 500, // Limit for performance
      raw: true
    });
    
    res.json({
      success: true,
      data: {
        orders,
        orderItems
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/pos/square/sales/transformed/{connectionId}:
 *   get:
 *     summary: Get transformed sales data (Tier 2)
 *     description: Returns sales transactions from sales_transactions table
 *     tags: [Square Sales]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Transformed sales data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *       404:
 *         description: Connection not found
 */
router.get('/transformed/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { SalesTransaction, POSConnection } = await import('../../../models/index.js');
    
    const connection = await POSConnection.findByPk(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'POS connection not found'
      });
    }
    
    const transactions = await SalesTransaction.findAll({
      where: {
        restaurantId: connection.restaurantId,
        sourceSystem: 'square'
      },
      order: [['transactionTime', 'DESC']],
      limit: 500, // Limit for performance
      raw: true
    });
    
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
