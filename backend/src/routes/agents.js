import express from 'express';
import agentService from '../agents/AgentService.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/agents/query:
 *   post:
 *     tags:
 *       - Agents
 *     summary: Query AI agents
 *     description: Send a natural language query to the AI agent system for cost, inventory, or forecast analysis
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *               - restaurantId
 *             properties:
 *               query:
 *                 type: string
 *                 example: What are my top 5 most expensive menu items?
 *               agent:
 *                 type: string
 *                 enum: [CostAgent, InventoryAgent, ForecastAgent]
 *                 description: Specific agent to route query to (optional, auto-detected if omitted)
 *               restaurantId:
 *                 type: integer
 *                 example: 1
 *               context:
 *                 type: object
 *                 description: Additional context for the query
 *     responses:
 *       200:
 *         description: Successfully processed query
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agent:
 *                   type: string
 *                 answer:
 *                   type: string
 *                 data:
 *                   type: object
 *                 confidence:
 *                   type: number
 *                   format: float
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Query processing failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/query', async (req, res) => {
  try {
    const { agent, query, context, restaurantId } = req.body;
    
    // Validate required fields
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }
    
    // Process query through agent service
    const result = await agentService.processQuery({
      agent,
      query,
      context: context || {},
      restaurantId
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('[AgentRoute] Query processing error:', error);
    res.status(500).json({ 
      error: 'Agent query failed', 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/v1/agents/insights/{restaurantId}:
 *   get:
 *     tags:
 *       - Agents
 *     summary: Get AI insights for restaurant
 *     description: Get comprehensive AI-generated insights from all agents (Cost, Inventory, Forecast)
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Successfully retrieved insights
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 restaurantId:
 *                   type: integer
 *                 insights:
 *                   type: object
 *                   properties:
 *                     cost:
 *                       type: array
 *                       items:
 *                         type: string
 *                     inventory:
 *                       type: array
 *                       items:
 *                         type: string
 *                     forecast:
 *                       type: array
 *                       items:
 *                         type: string
 *                 generatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid restaurant ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to get insights
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/insights/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // Validate restaurant ID
    if (!restaurantId || isNaN(parseInt(restaurantId))) {
      return res.status(400).json({ error: 'Valid restaurant ID is required' });
    }
    
    // Get insights from all agents
    const insights = await agentService.getRestaurantInsights(restaurantId);
    
    res.json(insights);
    
  } catch (error) {
    console.error('[AgentRoute] Insights error:', error);
    res.status(500).json({ 
      error: 'Failed to get insights', 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/v1/agents/cost/recipe:
 *   post:
 *     tags:
 *       - Agents
 *     summary: Calculate recipe cost
 *     description: Calculate total cost and per-portion cost for a recipe using AI-powered analysis
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - ingredients
 *             properties:
 *               restaurantId:
 *                 type: integer
 *                 example: 1
 *               recipeId:
 *                 type: integer
 *                 example: 5
 *                 description: Recipe ID (optional, for existing recipes)
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     ingredientId:
 *                       type: integer
 *                     quantity:
 *                       type: number
 *                       format: float
 *                     unit:
 *                       type: string
 *               portions:
 *                 type: integer
 *                 default: 1
 *                 example: 4
 *     responses:
 *       200:
 *         description: Successfully calculated recipe cost
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalCost:
 *                   type: number
 *                   format: float
 *                   example: 25.50
 *                 costPerPortion:
 *                   type: number
 *                   format: float
 *                   example: 6.38
 *                 breakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       ingredient:
 *                         type: string
 *                       cost:
 *                         type: number
 *                         format: float
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Calculation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/cost/recipe', async (req, res) => {
  try {
    const { restaurantId, recipeId, ingredients, portions } = req.body;
    
    // Validate required fields
    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }
    
    if (!ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({ error: 'Ingredients array is required' });
    }
    
    const result = await agentService.calculateRecipeCost(restaurantId, {
      recipeId,
      ingredients,
      portions: portions || 1
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('[AgentRoute] Recipe cost calculation error:', error);
    res.status(500).json({ 
      error: 'Recipe cost calculation failed', 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/v1/agents/cost/margins:
 *   post:
 *     tags:
 *       - Agents
 *     summary: Analyze menu margins
 *     description: Analyze profit margins for menu items and identify optimization opportunities
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - menuItems
 *             properties:
 *               restaurantId:
 *                 type: integer
 *                 example: 1
 *               menuItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: integer
 *                     salePrice:
 *                       type: number
 *                       format: float
 *     responses:
 *       200:
 *         description: Successfully analyzed margins
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 averageMargin:
 *                   type: number
 *                   format: float
 *                   example: 68.5
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       itemName:
 *                         type: string
 *                       cost:
 *                         type: number
 *                         format: float
 *                       price:
 *                         type: number
 *                         format: float
 *                       margin:
 *                         type: number
 *                         format: float
 *                       recommendation:
 *                         type: string
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Analysis failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/cost/margins', async (req, res) => {
  try {
    const { restaurantId, menuItems } = req.body;
    
    // Validate required fields
    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }
    
    if (!menuItems || !Array.isArray(menuItems)) {
      return res.status(400).json({ error: 'Menu items array is required' });
    }
    
    const result = await agentService.analyzeMenuMargins(restaurantId, {
      menuItems
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('[AgentRoute] Margin analysis error:', error);
    res.status(500).json({ 
      error: 'Margin analysis failed', 
      message: error.message 
    });
  }
});

// Get cost optimization recommendations
router.post('/cost/optimize', async (req, res) => {
  try {
    const { restaurantId, currentCosts, targetMargin } = req.body;
    
    // Validate required fields
    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }
    
    if (!currentCosts) {
      return res.status(400).json({ error: 'Current costs data is required' });
    }
    
    const result = await agentService.getCostOptimization(restaurantId, {
      currentCosts,
      targetMargin
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('[AgentRoute] Cost optimization error:', error);
    res.status(500).json({ 
      error: 'Cost optimization failed', 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/v1/agents/forecast/demand:
 *   post:
 *     tags:
 *       - Agents
 *     summary: Forecast demand
 *     description: Forecast demand for menu items using time series analysis and AI predictions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *             properties:
 *               restaurantId:
 *                 type: integer
 *                 example: 1
 *               forecastDays:
 *                 type: integer
 *                 default: 30
 *                 example: 30
 *               menuItems:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Specific menu items to forecast (optional, forecasts all if omitted)
 *               includeConfidenceIntervals:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Successfully generated forecast
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 forecast:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       predictedDemand:
 *                         type: number
 *                         format: float
 *                       confidence:
 *                         type: object
 *                         properties:
 *                           lower:
 *                             type: number
 *                             format: float
 *                           upper:
 *                             type: number
 *                             format: float
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Forecast failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/forecast/demand', async (req, res) => {
  try {
    const { restaurantId, forecastDays, menuItems, includeConfidenceIntervals } = req.body;
    
    // Validate required fields
    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }
    
    const result = await agentService.forecastDemand(restaurantId, {
      forecastDays: forecastDays || 30,
      menuItems,
      includeConfidenceIntervals: includeConfidenceIntervals !== false
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('[AgentRoute] Demand forecast error:', error);
    res.status(500).json({ 
      error: 'Demand forecast failed', 
      message: error.message 
    });
  }
});

// Analyze seasonal trends
router.post('/forecast/seasonal', async (req, res) => {
  try {
    const { restaurantId, analysisMonths, includeYearOverYear } = req.body;
    
    // Validate required fields
    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }
    
    const result = await agentService.analyzeSeasonalTrends(restaurantId, {
      analysisMonths: analysisMonths || 12,
      includeYearOverYear: includeYearOverYear !== false
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('[AgentRoute] Seasonal analysis error:', error);
    res.status(500).json({ 
      error: 'Seasonal analysis failed', 
      message: error.message 
    });
  }
});

// Predict revenue
router.post('/forecast/revenue', async (req, res) => {
  try {
    const { restaurantId, forecastDays, scenario, includeProfitability } = req.body;
    
    // Validate required fields
    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }
    
    const result = await agentService.predictRevenue(restaurantId, {
      forecastDays: forecastDays || 30,
      scenario: scenario || 'current',
      includeProfitability: includeProfitability !== false
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('[AgentRoute] Revenue prediction error:', error);
    res.status(500).json({ 
      error: 'Revenue prediction failed', 
      message: error.message 
    });
  }
});

// Optimize capacity planning
router.post('/forecast/capacity', async (req, res) => {
  try {
    const { restaurantId, forecastDays, currentCapacity, optimizationGoal } = req.body;
    
    // Validate required fields
    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }
    
    const result = await agentService.optimizeCapacity(restaurantId, {
      forecastDays: forecastDays || 30,
      currentCapacity,
      optimizationGoal: optimizationGoal || 'balanced'
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('[AgentRoute] Capacity optimization error:', error);
    res.status(500).json({ 
      error: 'Capacity optimization failed', 
      message: error.message 
    });
  }
});

// Forecast ingredient needs
router.post('/forecast/ingredients', async (req, res) => {
  try {
    const { restaurantId, forecastDays, includeBuffer, bufferPercentage } = req.body;
    
    // Validate required fields
    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }
    
    const result = await agentService.forecastIngredientNeeds(restaurantId, {
      forecastDays: forecastDays || 30,
      includeBuffer: includeBuffer !== false,
      bufferPercentage: bufferPercentage || 15
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('[AgentRoute] Ingredient forecast error:', error);
    res.status(500).json({ 
      error: 'Ingredient forecast failed', 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/v1/agents/health:
 *   get:
 *     tags:
 *       - Agents
 *     summary: Get agent system health
 *     description: Check the health status of the AI agent system
 *     responses:
 *       200:
 *         description: Successfully retrieved health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 healthy:
 *                   type: boolean
 *                   example: true
 *                 agents:
 *                   type: object
 *                   properties:
 *                     CostAgent:
 *                       type: string
 *                       example: healthy
 *                     InventoryAgent:
 *                       type: string
 *                       example: healthy
 *                     ForecastAgent:
 *                       type: string
 *                       example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Health check failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/health', async (req, res) => {
  try {
    const health = await agentService.getSystemHealth();
    res.json(health);
    
  } catch (error) {
    console.error('[AgentRoute] Health check error:', error);
    res.status(500).json({ 
      error: 'Health check failed', 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/v1/agents/status:
 *   get:
 *     tags:
 *       - Agents
 *     summary: Get agent statuses
 *     description: Get detailed status information for all AI agents
 *     responses:
 *       200:
 *         description: Successfully retrieved agent statuses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: CostAgent
 *                       status:
 *                         type: string
 *                         enum: [active, inactive, error]
 *                       capabilities:
 *                         type: array
 *                         items:
 *                           type: string
 *                       metrics:
 *                         type: object
 *                         properties:
 *                           requests:
 *                             type: integer
 *                           successRate:
 *                             type: number
 *                             format: float
 *                           avgResponseTime:
 *                             type: number
 *                             format: float
 *       500:
 *         description: Status check failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/status', async (req, res) => {
  try {
    const statuses = await agentService.getAgentStatuses();
    res.json(statuses);
    
  } catch (error) {
    console.error('[AgentRoute] Status check error:', error);
    res.status(500).json({ 
      error: 'Status check failed', 
      message: error.message 
    });
  }
});

export default router;