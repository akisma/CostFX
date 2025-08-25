import express from 'express';
import agentService from '../agents/AgentService.js';

const router = express.Router();

// AI agent query endpoint
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

// Get AI insights for restaurant
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

// Calculate recipe cost
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

// Analyze menu margins
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

// Get agent system health
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

// Get agent statuses
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