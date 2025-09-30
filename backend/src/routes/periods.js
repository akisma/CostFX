import express from 'express';
import periodController from '../controllers/periodController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { body, query } from 'express-validator';

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
 * @route   GET /api/v1/periods
 * @desc    List periods with filtering and pagination
 * @access  Private
 * @query   restaurantId, status, periodType, page, limit
 */
router.get('/', asyncHandler(periodController.listPeriods));

/**
 * @route   POST /api/v1/periods
 * @desc    Create a new inventory period
 * @access  Private
 * @body    { restaurantId, periodName, periodType, periodStart, periodEnd, description }
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
 * @route   GET /api/v1/periods/:id
 * @desc    Get period details with snapshots and summary
 * @access  Private
 * @params  id - Period ID
 */
router.get('/:id', asyncHandler(periodController.getPeriod));

/**
 * @route   PUT /api/v1/periods/:id/activate
 * @desc    Activate a period (draft → active)
 * @access  Private
 * @params  id - Period ID
 */
router.put('/:id/activate', asyncHandler(periodController.activatePeriod));

/**
 * @route   PUT /api/v1/periods/:id/close
 * @desc    Close a period (active → closed)
 * @access  Private
 * @params  id - Period ID
 * @body    { notes? }
 */
router.put('/:id/close', asyncHandler(periodController.closePeriod));

/**
 * @route   DELETE /api/v1/periods/:id
 * @desc    Delete a period (only draft periods)
 * @access  Private
 * @params  id - Period ID
 */
router.delete('/:id', asyncHandler(periodController.deletePeriod));

/**
 * @route   GET /api/v1/periods/:id/snapshots
 * @desc    Get snapshots for a period
 * @access  Private
 * @params  id - Period ID
 * @query   type? - beginning|ending
 */
router.get('/:id/snapshots', asyncHandler(periodController.getSnapshots));

/**
 * @route   POST /api/v1/periods/:id/snapshots
 * @desc    Create snapshots for a period
 * @access  Private
 * @params  id - Period ID
 * @body    { snapshotType: 'beginning'|'ending', items: [{inventoryItemId, quantity, unitCost?, notes?}] }
 */
router.post('/:id/snapshots', [
  body('snapshotType').isIn(['beginning', 'ending']).withMessage('Snapshot type must be beginning or ending'),
  body('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
  body('items.*.inventoryItemId').isInt({ min: 1 }).withMessage('Each item must have a valid inventory item ID'),
  body('items.*.quantity').isFloat({ min: 0 }).withMessage('Each item must have a non-negative quantity'),
  body('items.*.unitCost').optional().isFloat({ min: 0 }).withMessage('Unit cost must be non-negative if provided'),
  body('items.*.notes').optional().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
], asyncHandler(periodController.createSnapshots));

export default router;
