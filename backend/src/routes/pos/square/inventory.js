/**
 * Square Inventory Routes
 * 
 * RESTful endpoints for Square inventory synchronization and transformation.
 * 
 * Base Path: /api/v1/pos/square/inventory
 * 
 * Endpoints:
 * - POST   /sync/:connectionId       - Sync raw inventory data (Tier 1)
 * - POST   /transform/:connectionId  - Transform to unified format (Tier 2)
 * - DELETE /:restaurantId            - Clear all inventory data
 * - GET    /status/:connectionId     - Get sync status
 * - GET    /stats/:restaurantId      - Get transformation statistics
 * - GET    /validate/:restaurantId   - Validate transformation
 * - GET    /raw/:connectionId        - Get raw Square data (Tier 1)
 * - GET    /transformed/:connectionId - Get transformed data (Tier 2)
 * 
 * Related:
 * - Issue #20: Square Inventory Synchronization
 * - POSSyncController: Request handling
 * - SquareInventorySyncService: Square orchestration
 * 
 * Created: 2025-10-13 (REST API Restructure)
 */

import express from 'express';
import {
  syncInventory,
  transformInventory,
  getSyncStatus,
  getTransformationStats,
  clearPOSData,
  validateTransformation
} from '../../../controllers/POSSyncController.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/pos/square/inventory/sync/{connectionId}:
 *   post:
 *     summary: Sync raw inventory data from Square
 *     description: Fetches categories and menu items from Square API and stores in Tier 1 tables (square_categories, square_menu_items)
 *     tags: [Square Inventory]
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
 *         description: Clear existing data before sync
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
 *                       type: integer
 *                     errors:
 *                       type: array
 *                 duration:
 *                   type: integer
 *       404:
 *         description: Connection not found
 *       503:
 *         description: Sync failed
 */
router.post('/sync/:connectionId', syncInventory);

/**
 * @swagger
 * /api/v1/pos/square/inventory/transform/{connectionId}:
 *   post:
 *     summary: Transform inventory to unified format
 *     description: Transforms square_menu_items (Tier 1) to inventory_items (Tier 2)
 *     tags: [Square Inventory]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: dryRun
 *         schema:
 *           type: boolean
 *           default: false
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
 *                     successCount:
 *                       type: integer
 *                     errorCount:
 *                       type: integer
 *       404:
 *         description: Connection not found
 */
router.post('/transform/:connectionId', transformInventory);

/**
 * @swagger
 * /api/v1/pos/square/inventory/{restaurantId}:
 *   delete:
 *     summary: Clear all inventory data
 *     description: Deletes all Tier 1 (square_*) and Tier 2 (inventory_items) data
 *     tags: [Square Inventory]
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
 *       404:
 *         description: No connection found
 */
router.delete('/:restaurantId', clearPOSData);

/**
 * @swagger
 * /api/v1/pos/square/inventory/status/{connectionId}:
 *   get:
 *     summary: Get sync status
 *     description: Returns current sync status and last sync timestamp
 *     tags: [Square Inventory]
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
 * /api/v1/pos/square/inventory/stats/{restaurantId}:
 *   get:
 *     summary: Get transformation statistics
 *     description: Returns aggregated stats about transformed inventory (categories, units, tiers)
 *     tags: [Square Inventory]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Stats retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalItems:
 *                   type: integer
 *                 byCategory:
 *                   type: array
 *                 byUnit:
 *                   type: array
 *       404:
 *         description: No connection found
 */
router.get('/stats/:restaurantId', getTransformationStats);

/**
 * @swagger
 * /api/v1/pos/square/inventory/validate/{restaurantId}:
 *   get:
 *     summary: Validate transformation
 *     description: Validates data consistency between Tier 1 and Tier 2
 *     tags: [Square Inventory]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Validation completed
 *       404:
 *         description: No connection found
 */
router.get('/validate/:restaurantId', validateTransformation);

/**
 * @swagger
 * /api/v1/pos/square/inventory/raw/{connectionId}:
 *   get:
 *     summary: Get raw Square inventory data (Tier 1)
 *     description: Returns categories and menu items from square_* tables
 *     tags: [Square Inventory]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Raw data retrieved
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
 *                     categories:
 *                       type: array
 *                     items:
 *                       type: array
 *       404:
 *         description: Connection not found
 */
router.get('/raw/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { SquareCategory, SquareMenuItem } = await import('../../../models/index.js');
    
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
 * /api/v1/pos/square/inventory/transformed/{connectionId}:
 *   get:
 *     summary: Get transformed inventory data (Tier 2)
 *     description: Returns normalized inventory items from inventory_items table
 *     tags: [Square Inventory]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Transformed data retrieved
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
    const { InventoryItem, POSConnection } = await import('../../../models/index.js');
    
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
