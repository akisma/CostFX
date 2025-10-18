import express from 'express';
import periodController from '../controllers/periodController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
// import { authenticate } from '../middleware/auth.js'; // Uncomment when auth is implemented
import { body } from 'express-validator';

const router = express.Router();

/**
 * Period Management Routes
 * 
 * These routes handle Dave's inventory period lifecycle management:
 * - Creating and managing periods
 * - Period status transitions (draft → active → closed → locked)
 * - Snapshot management
 * - Validation and audit trails
 */

// Apply authentication middleware to all routes
// router.use(authenticate); // Uncomment when auth is implemented

/**
 * @swagger
 * /api/v1/periods:
 *   get:
 *     tags:
 *       - Periods
 *     summary: List inventory periods
 *     description: Retrieve a list of inventory periods with filtering and pagination
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         schema:
 *           type: integer
 *         description: Filter by restaurant ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, closed, locked]
 *         description: Filter by period status
 *       - in: query
 *         name: periodType
 *         schema:
 *           type: string
 *           enum: [weekly, monthly, custom]
 *         description: Filter by period type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: Successfully retrieved periods
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     periods:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           periodName:
 *                             type: string
 *                           periodType:
 *                             type: string
 *                           status:
 *                             type: string
 *                           periodStart:
 *                             type: string
 *                             format: date
 *                           periodEnd:
 *                             type: string
 *                             format: date
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', asyncHandler(periodController.listPeriods));

/**
 * @swagger
 * /api/v1/periods:
 *   post:
 *     tags:
 *       - Periods
 *     summary: Create a new inventory period
 *     description: Create a new inventory period for tracking inventory snapshots and variance
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - periodName
 *               - periodType
 *               - periodStart
 *               - periodEnd
 *             properties:
 *               restaurantId:
 *                 type: integer
 *                 example: 1
 *               periodName:
 *                 type: string
 *                 example: Week 1 - January 2024
 *               periodType:
 *                 type: string
 *                 enum: [weekly, monthly, custom]
 *                 example: weekly
 *               periodStart:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-01"
 *               periodEnd:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-07"
 *               description:
 *                 type: string
 *                 example: First week of January inventory period
 *     responses:
 *       201:
 *         description: Period created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     periodName:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: draft
 *       400:
 *         description: Invalid request body or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', [
  body('restaurantId').isInt({ min: 1 }).withMessage('Restaurant ID must be a positive integer'),
  body('periodName').isLength({ min: 1, max: 100 }).withMessage('Period name must be 1-100 characters'),
  body('periodType').isIn(['weekly', 'monthly', 'custom']).withMessage('Period type must be weekly, monthly, or custom'),
  body('periodStart').isISO8601().withMessage('Period start must be a valid date'),
  body('periodEnd').isISO8601().withMessage('Period end must be a valid date'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description must be less than 500 characters')
], asyncHandler(periodController.createPeriod));

/**
 * @swagger
 * /api/v1/periods/{id}:
 *   get:
 *     tags:
 *       - Periods
 *     summary: Get period details
 *     description: Get detailed information about a period including snapshots and summary
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Period ID
 *     responses:
 *       200:
 *         description: Successfully retrieved period
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         periodName:
 *                           type: string
 *                         periodType:
 *                           type: string
 *                         status:
 *                           type: string
 *                         periodStart:
 *                           type: string
 *                           format: date
 *                         periodEnd:
 *                           type: string
 *                           format: date
 *                         snapshotCompleteness:
 *                           type: object
 *                           properties:
 *                             beginning:
 *                               type: boolean
 *                             ending:
 *                               type: boolean
 *                     snapshots:
 *                       type: array
 *                       items:
 *                         type: object
 *       404:
 *         description: Period not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', asyncHandler(periodController.getPeriod));

/**
 * @swagger
 * /api/v1/periods/{id}/activate:
 *   put:
 *     tags:
 *       - Periods
 *     summary: Activate a period
 *     description: Transition a period from draft to active status (requires beginning snapshot)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Period ID
 *     responses:
 *       200:
 *         description: Period activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       example: active
 *       400:
 *         description: Cannot activate period (invalid status or missing snapshot)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Period not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id/activate', asyncHandler(periodController.activatePeriod));

/**
 * @swagger
 * /api/v1/periods/{id}/close:
 *   put:
 *     tags:
 *       - Periods
 *     summary: Close a period
 *     description: Transition a period from active to closed status (requires ending snapshot)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Period ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 example: Period closed successfully with all counts verified
 *     responses:
 *       200:
 *         description: Period closed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       example: closed
 *       400:
 *         description: Cannot close period (invalid status or missing snapshot)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Period not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id/close', asyncHandler(periodController.closePeriod));

/**
 * @swagger
 * /api/v1/periods/{id}:
 *   delete:
 *     tags:
 *       - Periods
 *     summary: Delete a period
 *     description: Delete a period (only draft periods can be deleted)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Period ID
 *     responses:
 *       200:
 *         description: Period deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Period deleted successfully
 *       400:
 *         description: Cannot delete period (not in draft status)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Period not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', asyncHandler(periodController.deletePeriod));

/**
 * @swagger
 * /api/v1/periods/{id}/snapshots:
 *   get:
 *     tags:
 *       - Periods
 *     summary: Get period snapshots
 *     description: Retrieve inventory snapshots for a period
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Period ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [beginning, ending]
 *         description: Filter by snapshot type
 *     responses:
 *       200:
 *         description: Successfully retrieved snapshots
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     snapshots:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           snapshotType:
 *                             type: string
 *                             enum: [beginning, ending]
 *                           inventoryItemId:
 *                             type: integer
 *                           itemName:
 *                             type: string
 *                           quantity:
 *                             type: number
 *                             format: float
 *                           unitCost:
 *                             type: number
 *                             format: float
 *                           notes:
 *                             type: string
 *       404:
 *         description: Period not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     tags:
 *       - Periods
 *     summary: Create period snapshots
 *     description: Create inventory snapshots for a period (beginning or ending)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Period ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - snapshotType
 *               - items
 *             properties:
 *               snapshotType:
 *                 type: string
 *                 enum: [beginning, ending]
 *                 example: beginning
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - inventoryItemId
 *                     - quantity
 *                   properties:
 *                     inventoryItemId:
 *                       type: integer
 *                       example: 5
 *                     quantity:
 *                       type: number
 *                       format: float
 *                       example: 25.5
 *                     unitCost:
 *                       type: number
 *                       format: float
 *                       example: 2.50
 *                     notes:
 *                       type: string
 *                       example: Verified count with physical inventory
 *     responses:
 *       201:
 *         description: Snapshots created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     snapshotsCreated:
 *                       type: integer
 *                       example: 15
 *       400:
 *         description: Invalid request body or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Period not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id/snapshots', asyncHandler(periodController.getSnapshots));

router.post('/:id/snapshots', [
  body('snapshotType').isIn(['beginning', 'ending']).withMessage('Snapshot type must be beginning or ending'),
  body('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
  body('items.*.inventoryItemId').isInt({ min: 1 }).withMessage('Each item must have a valid inventory item ID'),
  body('items.*.quantity').isFloat({ min: 0 }).withMessage('Each item must have a non-negative quantity'),
  body('items.*.unitCost').optional().isFloat({ min: 0 }).withMessage('Unit cost must be non-negative if provided'),
  body('items.*.notes').optional().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
], asyncHandler(periodController.createSnapshots));

export default router;
