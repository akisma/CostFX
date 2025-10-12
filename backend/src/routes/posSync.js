/**
 * POS Sync Routes
 * 
 * Generic REST API routes for POS inventory synchronization.
 * Provider-agnostic - works with Square, Toast, Clover, etc.
 * 
 * Base Path: /api/v1/pos
 * 
 * Routes:
 * - POST   /sync/:connectionId        - Trigger sync and transform
 * - GET    /status/:connectionId      - Get sync status
 * - GET    /stats/:restaurantId       - Get transformation stats
 * - POST   /clear/:restaurantId       - Clear POS data
 * - GET    /validate/:restaurantId    - Validate transformation
 * 
 * Related:
 * - Issue #20: Square Inventory Synchronization
 * - POSSyncController: Request handling
 * - SquareInventorySyncService: Square orchestration
 * 
 * Created: 2025-10-06
 */

import express from 'express';
import {
  syncInventory,
  transformInventory,
  getSyncStatus,
  getTransformationStats,
  clearPOSData,
  validateTransformation
} from '../controllers/POSSyncController.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/pos/sync/{connectionId}:
 *   post:
 *     summary: Trigger inventory sync and transformation
 *     description: Executes two-phase sync (POS API → raw tables → unified format)
 *     tags: [POS Sync]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: POS connection ID
 *       - in: query
 *         name: incremental
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Use lastSyncAt for incremental sync
 *       - in: query
 *         name: dryRun
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Simulate without saving to database
 *       - in: query
 *         name: clearBeforeSync
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Clear existing POS data before sync
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
 *                   example: sync_abc123
 *                 connectionId:
 *                   type: integer
 *                 restaurantId:
 *                   type: integer
 *                 status:
 *                   type: string
 *                   enum: [completed, failed]
 *                 phase:
 *                   type: string
 *                   enum: [sync, transform, complete]
 *                 sync:
 *                   type: object
 *                   properties:
 *                     synced:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                 transform:
 *                   type: object
 *                   properties:
 *                     successCount:
 *                       type: integer
 *                     errorCount:
 *                       type: integer
 *                 duration:
 *                   type: integer
 *                   description: Duration in milliseconds
 *       404:
 *         description: POS connection not found
 *       400:
 *         description: Connection not active or invalid parameters
 *       503:
 *         description: Sync failed
 */
router.post('/sync/:connectionId', syncInventory);

/**
 * @swagger
 * /api/v1/pos/transform/{connectionId}:
 *   post:
 *     summary: Transform synced POS data to inventory items
 *     description: Transforms tier 1 raw data to tier 2 normalized inventory items
 *     tags: [POS Sync]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: POS connection ID
 *       - in: query
 *         name: dryRun
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Simulate without saving to database
 *     responses:
 *       200:
 *         description: Transformation completed
 *       404:
 *         description: POS connection not found
 *       503:
 *         description: Transformation failed
 */
router.post('/transform/:connectionId', transformInventory);

/**
 * @swagger
 * /api/v1/pos/status/{connectionId}:
 *   get:
 *     summary: Get sync status for a POS connection
 *     description: Returns tier counts, last sync time, and whether sync is needed
 *     tags: [POS Sync]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: POS connection ID
 *     responses:
 *       200:
 *         description: Sync status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connectionId:
 *                   type: integer
 *                 restaurantId:
 *                   type: integer
 *                 provider:
 *                   type: string
 *                   example: square
 *                 tier1Count:
 *                   type: integer
 *                   description: Raw POS items count
 *                 tier2Count:
 *                   type: integer
 *                   description: Unified inventory items count
 *                 lastSyncAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 mostRecentUpdate:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 syncNeeded:
 *                   type: boolean
 *                 reason:
 *                   type: string
 *                   example: Recent updates since last sync
 *       404:
 *         description: POS connection not found
 */
router.get('/status/:connectionId', getSyncStatus);

/**
 * @swagger
 * /api/v1/pos/stats/{restaurantId}:
 *   get:
 *     summary: Get transformation statistics
 *     description: Returns category/unit distribution and high-value item count
 *     tags: [POS Sync]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Statistics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 restaurantId:
 *                   type: integer
 *                 categoryDistribution:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category:
 *                         type: string
 *                       count:
 *                         type: integer
 *                 unitDistribution:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       unit:
 *                         type: string
 *                       count:
 *                         type: integer
 *                 highValueItemCount:
 *                   type: integer
 *       404:
 *         description: No POS connection found for restaurant
 */
router.get('/stats/:restaurantId', getTransformationStats);

/**
 * @swagger
 * /api/v1/pos/clear/{restaurantId}:
 *   post:
 *     summary: Clear all POS data for a restaurant
 *     description: Deletes all Tier 1 (raw POS) and Tier 2 (unified) data
 *     tags: [POS Sync]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
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
 *                     inventoryItems:
 *                       type: integer
 *                     squareMenuItems:
 *                       type: integer
 *                     squareCategories:
 *                       type: integer
 *                     squareInventoryCounts:
 *                       type: integer
 *       404:
 *         description: No POS connection found for restaurant
 */
router.post('/clear/:restaurantId', clearPOSData);

/**
 * @swagger
 * /api/v1/pos/validate/{restaurantId}:
 *   get:
 *     summary: Validate transformation accuracy
 *     description: Compares Tier 1 vs Tier 2 counts, checks 95% threshold
 *     tags: [POS Sync]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 restaurantId:
 *                   type: integer
 *                 tier1Count:
 *                   type: integer
 *                 tier2Count:
 *                   type: integer
 *                 transformationRate:
 *                   type: string
 *                   example: "95.00%"
 *                 isValid:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                   enum: [valid, incomplete, not_transformed]
 *       404:
 *         description: No POS connection found for restaurant
 */
router.get('/validate/:restaurantId', validateTransformation);

/**
 * @swagger
 * /api/v1/pos/square/raw-data/{connectionId}:
 *   get:
 *     summary: Get raw Square data (Tier 1)
 *     description: Returns categories and menu items from square_* tables
 *     tags: [POS Sync]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Raw Square data retrieved
 */
router.get('/square/raw-data/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { SquareCategory, SquareMenuItem } = await import('../models/index.js');
    
    const categories = await SquareCategory.findAll({
      where: { posConnectionId: connectionId },
      order: [['id', 'ASC']],
      raw: true
    });
    
    const items = await SquareMenuItem.findAll({
      where: { posConnectionId: connectionId },
      order: [['id', 'ASC']],
      raw: true
    });
    
    res.json({
      success: true,
      data: {
        categories,
        items
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
 * /api/v1/pos/square/transformed-data/{connectionId}:
 *   get:
 *     summary: Get transformed inventory items (Tier 2)
 *     description: Returns normalized inventory items from inventory_items table
 *     tags: [POS Sync]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Transformed inventory items retrieved
 */
router.get('/square/transformed-data/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { InventoryItem, POSConnection } = await import('../models/index.js');
    
    // Get restaurant ID from connection
    const connection = await POSConnection.findByPk(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'POS connection not found'
      });
    }
    
    const items = await InventoryItem.findAll({
      where: {
        restaurantId: connection.restaurantId,
        sourcePosProvider: 'square'
      },
      order: [['id', 'ASC']],
      raw: true
    });
    
    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
