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
 * @swagger
 * /api/v1/variance/period-analysis:
 *   post:
 *     tags:
 *       - Variance
 *     summary: Analyze period variance
 *     description: Analyze inventory variance for a specific period using Dave's variance system (saffron vs romaine principle)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - periodId
 *             properties:
 *               periodId:
 *                 type: integer
 *                 example: 1
 *                 description: The period to analyze
 *               method:
 *                 type: string
 *                 enum: [recipe_based, historical_average, manual, ai_predicted]
 *                 default: recipe_based
 *                 description: Calculation method for theoretical usage
 *               itemIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 5, 10]
 *                 description: Specific items to analyze (optional, analyzes all if omitted)
 *               recalculate:
 *                 type: boolean
 *                 default: false
 *                 description: Force recalculation even if cached results exist
 *               priority:
 *                 type: string
 *                 enum: [critical, high, medium, low]
 *                 description: Filter results by priority level
 *               includeInsights:
 *                 type: boolean
 *                 default: true
 *                 description: Include Dave's business insights and recommendations
 *     responses:
 *       200:
 *         description: Successfully analyzed variance
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
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalVarianceValue:
 *                           type: number
 *                           format: float
 *                           example: 1250.50
 *                         criticalItems:
 *                           type: integer
 *                           example: 3
 *                         highPriorityItems:
 *                           type: integer
 *                           example: 7
 *                     variances:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           itemId:
 *                             type: integer
 *                           itemName:
 *                             type: string
 *                           theoretical:
 *                             type: number
 *                             format: float
 *                           actual:
 *                             type: number
 *                             format: float
 *                           variance:
 *                             type: number
 *                             format: float
 *                           varianceDollarValue:
 *                             type: number
 *                             format: float
 *                           priority:
 *                             type: string
 *                             enum: [critical, high, medium, low]
 *                     insights:
 *                       type: array
 *                       items:
 *                         type: string
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
 * @swagger
 * /api/v1/variance/categories:
 *   get:
 *     tags:
 *       - Variance
 *     summary: Get category variance breakdown
 *     description: Get hierarchical category variance breakdown for a period (e.g., spices.premium.saffron vs produce.leafy_greens.romaine)
 *     parameters:
 *       - in: query
 *         name: periodId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The period to analyze
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [critical, high, medium, low]
 *         description: Filter by priority level
 *       - in: query
 *         name: minVarianceAmount
 *         schema:
 *           type: number
 *           format: float
 *         description: Minimum variance dollar amount to include
 *       - in: query
 *         name: includeZeroVariance
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include items with zero variance
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [variance_amount, variance_percentage, item_name]
 *           default: variance_amount
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Successfully retrieved category breakdown
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
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           categoryPath:
 *                             type: string
 *                             example: spices.premium.saffron
 *                           categoryName:
 *                             type: string
 *                             example: Saffron
 *                           totalVariance:
 *                             type: number
 *                             format: float
 *                           itemCount:
 *                             type: integer
 *                           items:
 *                             type: array
 *                             items:
 *                               type: object
 *       400:
 *         description: Invalid or missing period ID
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
 * @swagger
 * /api/v1/variance/summary/{periodId}:
 *   get:
 *     tags:
 *       - Variance
 *     summary: Get variance summary
 *     description: Get comprehensive variance summary for a period with Dave's priority system
 *     parameters:
 *       - in: path
 *         name: periodId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The period to summarize
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [critical, high, medium, low]
 *         description: Filter by priority level
 *     responses:
 *       200:
 *         description: Successfully retrieved variance summary
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
 *                     periodId:
 *                       type: integer
 *                     periodName:
 *                       type: string
 *                     totalVarianceDollarValue:
 *                       type: number
 *                       format: float
 *                       example: 2450.75
 *                     priorityCounts:
 *                       type: object
 *                       properties:
 *                         critical:
 *                           type: integer
 *                           example: 3
 *                         high:
 *                           type: integer
 *                           example: 7
 *                         medium:
 *                           type: integer
 *                           example: 15
 *                         low:
 *                           type: integer
 *                           example: 42
 *                     topVariances:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           itemName:
 *                             type: string
 *                           varianceDollarValue:
 *                             type: number
 *                             format: float
 *                           priority:
 *                             type: string
 *       400:
 *         description: Invalid period ID
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
 * @swagger
 * /api/v1/variance/trends:
 *   get:
 *     tags:
 *       - Variance
 *     summary: Get historical variance trends
 *     description: Get historical variance trends for analysis and pattern identification
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *       - in: query
 *         name: itemIds
 *         schema:
 *           type: array
 *           items:
 *             type: integer
 *         description: Specific items to analyze (analyzes all items if omitted)
 *       - in: query
 *         name: periodCount
 *         schema:
 *           type: integer
 *           default: 6
 *           minimum: 1
 *           maximum: 24
 *         description: Number of recent periods to analyze
 *     responses:
 *       200:
 *         description: Successfully retrieved variance trends
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
 *                     trends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           itemId:
 *                             type: integer
 *                           itemName:
 *                             type: string
 *                           periods:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 periodId:
 *                                   type: integer
 *                                 periodName:
 *                                   type: string
 *                                 varianceDollarValue:
 *                                   type: number
 *                                   format: float
 *                           averageVariance:
 *                             type: number
 *                             format: float
 *                           trend:
 *                             type: string
 *                             enum: [improving, worsening, stable]
 *                     insights:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Invalid or missing restaurant ID
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
