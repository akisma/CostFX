import express from 'express';
import { body, query, param } from 'express-validator';
import asyncHandler from '../middleware/asyncHandler.js';
import * as varianceController from '../controllers/varianceController.js';

const router = express.Router();

/**
 * Variance Analysis Routes - Task 10
 * 
 * Provides Dave's inventory variance analysis endpoints with:
 * - Period-based variance analysis
 * - Hierarchical category breakdowns
 * - Priority-based filtering
 * - Thin controller wrappers around InventoryVarianceAgent
 */

/**
 * @route POST /api/v1/variance/period-analysis
 * @desc Analyze variance for a specific period using Dave's variance system
 * @access Private
 * @param {number} periodId - The period to analyze
 * @param {string} [method] - Calculation method (recipe_based, historical_average, manual, ai_predicted)
 * @param {number[]} [itemIds] - Specific items to analyze (optional)
 * @param {boolean} [recalculate] - Force recalculation (optional)
 * @param {string} [priority] - Filter by priority level (critical, high, medium, low)
 * @param {boolean} [includeInsights] - Include Dave's business insights (default: true)
 */
router.post('/period-analysis',
  [
    // Validation
    body('periodId')
      .isInt({ min: 1 })
      .withMessage('Period ID must be a positive integer'),
    
    body('method')
      .optional()
      .isIn(['recipe_based', 'historical_average', 'manual', 'ai_predicted'])
      .withMessage('Method must be one of: recipe_based, historical_average, manual, ai_predicted'),
    
    body('itemIds')
      .optional()
      .isArray()
      .withMessage('Item IDs must be an array')
      .custom((value) => {
        if (value && value.some(id => !Number.isInteger(id) || id <= 0)) {
          throw new Error('All item IDs must be positive integers');
        }
        return true;
      }),
    
    body('recalculate')
      .optional()
      .isBoolean()
      .withMessage('Recalculate must be a boolean'),
    
    body('priority')
      .optional()
      .isIn(['critical', 'high', 'medium', 'low'])
      .withMessage('Priority must be one of: critical, high, medium, low'),
    
    body('includeInsights')
      .optional()
      .isBoolean()
      .withMessage('Include insights must be a boolean')
  ],
  asyncHandler(varianceController.analyzePeriodVariance)
);

/**
 * @route GET /api/v1/variance/categories
 * @desc Get hierarchical category variance breakdown for a period
 * @access Private
 * @param {number} periodId - The period to analyze (required)
 * @param {string} [priority] - Filter by priority level
 * @param {number} [minVarianceAmount] - Minimum variance amount to include
 * @param {boolean} [includeZeroVariance] - Include items with zero variance (default: false)
 * @param {string} [sortBy] - Sort by: variance_amount, variance_percentage, item_name (default: variance_amount)
 * @param {string} [sortOrder] - Sort order: asc, desc (default: desc)
 */
router.get('/categories',
  [
    // Validation
    query('periodId')
      .isInt({ min: 1 })
      .withMessage('Period ID must be a positive integer'),
    
    query('priority')
      .optional()
      .isIn(['critical', 'high', 'medium', 'low'])
      .withMessage('Priority must be one of: critical, high, medium, low'),
    
    query('minVarianceAmount')
      .optional()
      .isFloat()
      .withMessage('Minimum variance amount must be a number'),
    
    query('includeZeroVariance')
      .optional()
      .isBoolean()
      .withMessage('Include zero variance must be a boolean'),
    
    query('sortBy')
      .optional()
      .isIn(['variance_amount', 'variance_percentage', 'item_name'])
      .withMessage('Sort by must be one of: variance_amount, variance_percentage, item_name'),
    
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc')
  ],
  asyncHandler(varianceController.getCategoryVarianceBreakdown)
);

/**
 * @route GET /api/v1/variance/summary/:periodId
 * @desc Get variance summary for a period with Dave's priority system
 * @access Private
 * @param {number} periodId - The period to summarize
 * @param {string} [priority] - Filter by priority level
 */
router.get('/summary/:periodId',
  [
    param('periodId')
      .isInt({ min: 1 })
      .withMessage('Period ID must be a positive integer'),
    
    query('priority')
      .optional()
      .isIn(['critical', 'high', 'medium', 'low'])
      .withMessage('Priority must be one of: critical, high, medium, low')
  ],
  asyncHandler(varianceController.getPriorityVarianceSummary)
);

/**
 * @route GET /api/v1/variance/trends
 * @desc Get historical variance trends for analysis
 * @access Private
 * @param {number} restaurantId - Restaurant ID (required)
 * @param {number[]} [itemIds] - Specific items to analyze
 * @param {number} [periodCount] - Number of periods to analyze (default: 6)
 */
router.get('/trends',
  [
    query('restaurantId')
      .isInt({ min: 1 })
      .withMessage('Restaurant ID must be a positive integer'),
    
    query('itemIds')
      .optional()
      .custom((value) => {
        if (value) {
          const ids = Array.isArray(value) ? value : [value];
          if (ids.some(id => !Number.isInteger(parseInt(id)) || parseInt(id) <= 0)) {
            throw new Error('All item IDs must be positive integers');
          }
        }
        return true;
      }),
    
    query('periodCount')
      .optional()
      .isInt({ min: 1, max: 24 })
      .withMessage('Period count must be between 1 and 24')
  ],
  asyncHandler(varianceController.getHistoricalVarianceTrends)
);

export default router;
