import express from 'express';
import agentService from '../agents/AgentService.js';

const router = express.Router();

/**
 * GET /api/inventory/levels
 * Track current inventory levels and identify stock issues
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
 * GET /api/inventory/reorder-needs
 * Predict reorder needs based on usage patterns and lead times
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
 * GET /api/inventory/expiration-alerts
 * Monitor items approaching expiration dates
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
 * GET /api/inventory/waste-analysis
 * Analyze waste patterns to identify optimization opportunities
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
 * GET /api/inventory/optimization
 * Optimize stock levels using EOQ and demand forecasting
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
 * GET /api/inventory/dashboard
 * Get comprehensive inventory dashboard data
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

// Legacy routes for backward compatibility
router.get('/', (req, res) => {
  res.json({ 
    message: 'Inventory API - Available endpoints: /levels, /reorder-needs, /expiration-alerts, /waste-analysis, /optimization, /dashboard',
    version: '1.0.0'
  });
});

router.post('/transactions', (req, res) => {
  res.json({ message: 'Inventory transaction logging - implement based on business needs' });
});

router.get('/current', async (req, res) => {
  // Redirect to levels endpoint
  req.url = '/levels';
  return router.handle(req, res);
});

export default router;