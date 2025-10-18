import express from 'express';
import agentService from '../agents/AgentService.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/inventory/levels:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Track inventory levels
 *     description: Get current inventory levels and identify stock issues using AI-powered analysis
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include inactive inventory items
 *     responses:
 *       200:
 *         description: Successfully retrieved inventory levels
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
 *                         totalItems:
 *                           type: integer
 *                           example: 150
 *                         totalValue:
 *                           type: number
 *                           format: float
 *                           example: 12500.00
 *                         lowStockItems:
 *                           type: integer
 *                           example: 5
 *                         outOfStockItems:
 *                           type: integer
 *                           example: 2
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           currentQuantity:
 *                             type: number
 *                             format: float
 *                           unit:
 *                             type: string
 *                           reorderPoint:
 *                             type: number
 *                             format: float
 *                           status:
 *                             type: string
 *                             enum: [in_stock, low_stock, out_of_stock]
 *       400:
 *         description: Missing or invalid restaurant ID
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
router.get('/levels', async (req, res) => {
  try {
    const { restaurantId } = req.query;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restaurant ID is required' 
      });
    }

    const result = await agentService.processRequest('InventoryAgent', {
      type: 'track_levels',
      data: { 
        restaurantId: parseInt(restaurantId),
        includeInactive: req.query.includeInactive === 'true'
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error tracking inventory levels:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to track inventory levels',
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/reorder-needs:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Predict reorder needs
 *     description: Predict inventory reorder needs based on usage patterns, lead times, and demand forecasting
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *       - in: query
 *         name: forecastDays
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days to forecast ahead
 *     responses:
 *       200:
 *         description: Successfully predicted reorder needs
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
 *                         itemsNeedingReorder:
 *                           type: integer
 *                           example: 12
 *                         urgentReorders:
 *                           type: integer
 *                           example: 3
 *                         totalReorderCost:
 *                           type: number
 *                           format: float
 *                           example: 3250.00
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           itemId:
 *                             type: integer
 *                           itemName:
 *                             type: string
 *                           currentQuantity:
 *                             type: number
 *                             format: float
 *                           recommendedOrderQuantity:
 *                             type: number
 *                             format: float
 *                           urgency:
 *                             type: string
 *                             enum: [critical, high, medium, low]
 *                           estimatedRunoutDate:
 *                             type: string
 *                             format: date
 *       400:
 *         description: Missing or invalid parameters
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
router.get('/reorder-needs', async (req, res) => {
  try {
    const { restaurantId, forecastDays } = req.query;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restaurant ID is required' 
      });
    }

    const result = await agentService.processRequest('InventoryAgent', {
      type: 'predict_reorder',
      data: { 
        restaurantId: parseInt(restaurantId),
        forecastDays: forecastDays ? parseInt(forecastDays) : 7
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error predicting reorder needs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to predict reorder needs',
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/expiration-alerts:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Monitor expiration dates
 *     description: Get alerts for items approaching their expiration dates to minimize waste
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *       - in: query
 *         name: warningDays
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of days before expiration to trigger warning
 *     responses:
 *       200:
 *         description: Successfully retrieved expiration alerts
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
 *                         criticalItems:
 *                           type: integer
 *                           example: 2
 *                           description: Items expiring within 24 hours
 *                         warningItems:
 *                           type: integer
 *                           example: 5
 *                           description: Items expiring within warning period
 *                         totalValue:
 *                           type: number
 *                           format: float
 *                           example: 450.00
 *                     alerts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           itemId:
 *                             type: integer
 *                           itemName:
 *                             type: string
 *                           quantity:
 *                             type: number
 *                             format: float
 *                           expirationDate:
 *                             type: string
 *                             format: date
 *                           daysUntilExpiration:
 *                             type: integer
 *                           value:
 *                             type: number
 *                             format: float
 *                           priority:
 *                             type: string
 *                             enum: [critical, warning, info]
 *       400:
 *         description: Missing or invalid restaurant ID
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
router.get('/expiration-alerts', async (req, res) => {
  try {
    const { restaurantId, warningDays } = req.query;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restaurant ID is required' 
      });
    }

    const result = await agentService.processRequest('InventoryAgent', {
      type: 'monitor_expiration',
      data: { 
        restaurantId: parseInt(restaurantId),
        warningDays: warningDays ? parseInt(warningDays) : 5
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error monitoring expiration dates:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to monitor expiration dates',
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/waste-analysis:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Analyze waste patterns
 *     description: Analyze waste patterns to identify optimization opportunities and cost savings
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *       - in: query
 *         name: timeframeDays
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to analyze
 *     responses:
 *       200:
 *         description: Successfully retrieved waste analysis
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
 *                         totalWasteValue:
 *                           type: number
 *                           format: float
 *                           example: 1250.00
 *                         averageWastePercentage:
 *                           type: number
 *                           format: float
 *                           example: 3.5
 *                         wasteItems:
 *                           type: integer
 *                           example: 25
 *                         topWasteCategories:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               category:
 *                                 type: string
 *                               wasteValue:
 *                                 type: number
 *                                 format: float
 *                               percentage:
 *                                 type: number
 *                                 format: float
 *                     insights:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [spoilage, over_ordering, preparation_waste, theft]
 *                           description:
 *                             type: string
 *                           potentialSavings:
 *                             type: number
 *                             format: float
 *                           recommendation:
 *                             type: string
 *       400:
 *         description: Missing or invalid restaurant ID
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
router.get('/waste-analysis', async (req, res) => {
  try {
    const { restaurantId, timeframeDays } = req.query;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restaurant ID is required' 
      });
    }

    const result = await agentService.processRequest('InventoryAgent', {
      type: 'analyze_waste',
      data: { 
        restaurantId: parseInt(restaurantId),
        timeframeDays: timeframeDays ? parseInt(timeframeDays) : 30
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error analyzing waste patterns:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to analyze waste patterns',
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/optimization:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Optimize stock levels
 *     description: Get stock optimization recommendations using Economic Order Quantity (EOQ) and demand forecasting
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *       - in: query
 *         name: optimizationGoal
 *         schema:
 *           type: string
 *           enum: [balanced, cost_reduction, service_level]
 *           default: balanced
 *         description: Optimization goal for recommendations
 *     responses:
 *       200:
 *         description: Successfully generated optimization recommendations
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
 *                         potentialSavings:
 *                           type: number
 *                           format: float
 *                           example: 2500.00
 *                         itemsToOptimize:
 *                           type: integer
 *                           example: 15
 *                         expectedServiceLevel:
 *                           type: number
 *                           format: float
 *                           example: 98.5
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           itemId:
 *                             type: integer
 *                           itemName:
 *                             type: string
 *                           currentOrderQuantity:
 *                             type: number
 *                             format: float
 *                           optimalOrderQuantity:
 *                             type: number
 *                             format: float
 *                           optimalReorderPoint:
 *                             type: number
 *                             format: float
 *                           expectedSavings:
 *                             type: number
 *                             format: float
 *                           reasoning:
 *                             type: string
 *       400:
 *         description: Missing or invalid restaurant ID
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
router.get('/optimization', async (req, res) => {
  try {
    const { restaurantId, optimizationGoal } = req.query;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restaurant ID is required' 
      });
    }

    const validGoals = ['balanced', 'cost_reduction', 'service_level'];
    const goal = validGoals.includes(optimizationGoal) ? optimizationGoal : 'balanced';

    const result = await agentService.processRequest('InventoryAgent', {
      type: 'optimize_stock',
      data: { 
        restaurantId: parseInt(restaurantId),
        optimizationGoal: goal
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error optimizing stock levels:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to optimize stock levels',
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory/dashboard:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get inventory dashboard
 *     description: Get comprehensive inventory dashboard data combining levels, reorder needs, expiration alerts, and waste analysis
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Successfully retrieved dashboard data
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
 *                     inventory:
 *                       type: object
 *                       description: Current inventory levels
 *                     reorderNeeds:
 *                       type: object
 *                       description: Items needing reorder
 *                     expirationAlerts:
 *                       type: object
 *                       description: Items approaching expiration
 *                     wasteAnalysis:
 *                       type: object
 *                       description: Waste patterns and insights
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalItems:
 *                           type: integer
 *                           example: 150
 *                         totalValue:
 *                           type: number
 *                           format: float
 *                           example: 12500.00
 *                         urgentReorders:
 *                           type: integer
 *                           example: 3
 *                         criticalExpirations:
 *                           type: integer
 *                           example: 2
 *                         averageWastePercentage:
 *                           type: number
 *                           format: float
 *                           example: 3.5
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Missing or invalid restaurant ID
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
router.get('/dashboard', async (req, res) => {
  try {
    const { restaurantId } = req.query;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restaurant ID is required' 
      });
    }

    // Execute multiple agent requests in parallel for dashboard data
    const [
      levelsResult,
      reorderResult,
      expirationResult,
      wasteResult
    ] = await Promise.all([
      agentService.processRequest('InventoryAgent', {
        type: 'track_levels',
        data: { restaurantId: parseInt(restaurantId) }
      }),
      agentService.processRequest('InventoryAgent', {
        type: 'predict_reorder',
        data: { restaurantId: parseInt(restaurantId) }
      }),
      agentService.processRequest('InventoryAgent', {
        type: 'monitor_expiration',
        data: { restaurantId: parseInt(restaurantId) }
      }),
      agentService.processRequest('InventoryAgent', {
        type: 'analyze_waste',
        data: { restaurantId: parseInt(restaurantId) }
      })
    ]);

    // Combine results for dashboard
    const dashboardData = {
      inventory: levelsResult,
      reorderNeeds: reorderResult,
      expirationAlerts: expirationResult,
      wasteAnalysis: wasteResult,
      summary: {
        totalItems: levelsResult.summary.totalItems,
        totalValue: levelsResult.summary.totalValue,
        urgentReorders: reorderResult.summary.itemsNeedingReorder,
        criticalExpirations: expirationResult.summary.criticalItems,
        averageWastePercentage: wasteResult.summary.averageWastePercentage
      },
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error generating inventory dashboard:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate inventory dashboard',
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/v1/inventory:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get inventory API info
 *     description: Get information about available inventory endpoints
 *     responses:
 *       200:
 *         description: API info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Inventory API - Available endpoints
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 */
router.get('/', (req, res) => {
  res.json({ 
    message: 'Inventory API - Available endpoints: /levels, /reorder-needs, /expiration-alerts, /waste-analysis, /optimization, /dashboard',
    version: '1.0.0'
  });
});

/**
 * @swagger
 * /api/v1/inventory/transactions:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Log inventory transaction
 *     description: Record an inventory transaction (receive, consume, adjust, etc.)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - itemId
 *               - transactionType
 *               - quantity
 *             properties:
 *               restaurantId:
 *                 type: integer
 *                 example: 1
 *               itemId:
 *                 type: integer
 *                 example: 5
 *               transactionType:
 *                 type: string
 *                 enum: [receive, consume, adjust, waste, transfer]
 *                 example: receive
 *               quantity:
 *                 type: number
 *                 format: float
 *                 example: 10.5
 *               unitCost:
 *                 type: number
 *                 format: float
 *                 example: 2.50
 *               notes:
 *                 type: string
 *                 example: Delivery from supplier XYZ
 *     responses:
 *       200:
 *         description: Transaction logged successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request body
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
router.post('/transactions', (req, res) => {
  res.json({ message: 'Inventory transaction logging - implement based on business needs' });
});

/**
 * @swagger
 * /api/v1/inventory/current:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Get current inventory (legacy)
 *     description: Legacy endpoint that redirects to /levels. Use /levels instead.
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Redirected to /levels endpoint
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing or invalid restaurant ID
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
router.get('/current', async (req, res) => {
  // Redirect to levels endpoint
  req.url = '/levels';
  return router.handle(req, res);
});

export default router;