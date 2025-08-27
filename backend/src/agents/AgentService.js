import AgentManager from './AgentManager.js';
import CostAgent from './CostAgent.js';
import InventoryAgent from './InventoryAgent.js';
import ForecastAgent from './ForecastAgent.js';

/**
 * AgentService - Service layer for managing AI agents
 * Provides interface between HTTP routes and agent system
 */
class AgentService {
  constructor() {
    this.manager = new AgentManager();
    this.initialized = false;
  }

  /**
   * Initialize the agent service with all available agents
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Register Cost Agent
      const costAgent = new CostAgent();
      await this.manager.registerAgent(costAgent);

      // Register Inventory Agent
      const inventoryAgent = new InventoryAgent();
      await this.manager.registerAgent(inventoryAgent);

      // Register Forecast Agent
      const forecastAgent = new ForecastAgent();
      await this.manager.registerAgent(forecastAgent);

      this.initialized = true;
      console.log('[AgentService] All agents initialized successfully');
      
    } catch (error) {
      console.error('[AgentService] Failed to initialize agents:', error);
      throw error;
    }
  }

  /**
   * Process a query request from the API
   */
  async processQuery(queryData) {
    await this.ensureInitialized();

    const { agent: agentName, query, context, restaurantId } = queryData;

    // If specific agent requested, route to that agent
    if (agentName) {
      return await this.routeToSpecificAgent(agentName, query, context, restaurantId);
    }

    // Otherwise, determine best agent based on query content
    return await this.routeByQueryContent(query, context, restaurantId);
  }

  /**
   * Route request to a specific agent
   */
  async routeToSpecificAgent(agentName, query, context, restaurantId) {
    const request = {
      type: this.determineRequestType(query, agentName),
      restaurantId,
      data: { query, context },
      timestamp: new Date().toISOString()
    };

    return await this.manager.routeRequest(request);
  }

  /**
   * Route request based on query content analysis
   */
  async routeByQueryContent(query, context, restaurantId) {
    const requestType = this.analyzeQueryForType(query);
    
    const request = {
      type: requestType,
      restaurantId,
      data: { query, context },
      timestamp: new Date().toISOString()
    };

    return await this.manager.routeRequest(request);
  }

  /**
   * Get insights for a specific restaurant
   */
  async getRestaurantInsights(restaurantId) {
    await this.ensureInitialized();
    
    try {
      const insights = await this.manager.getRestaurantInsights(restaurantId);
      
      return {
        restaurantId: parseInt(restaurantId),
        insights,
        generated_at: new Date().toISOString(),
        total_insights: insights.length
      };
      
    } catch (error) {
      console.error('[AgentService] Error getting restaurant insights:', error);
      throw error;
    }
  }

  /**
   * Calculate recipe cost using Cost Agent
   */
  async calculateRecipeCost(restaurantId, recipeData) {
    await this.ensureInitialized();

    const request = {
      type: 'calculate_recipe_cost',
      restaurantId,
      data: recipeData,
      timestamp: new Date().toISOString()
    };

    return await this.manager.routeRequest(request);
  }

  /**
   * Analyze menu margins using Cost Agent
   */
  async analyzeMenuMargins(restaurantId, menuData) {
    await this.ensureInitialized();

    const request = {
      type: 'analyze_margins',
      restaurantId,
      data: menuData,
      timestamp: new Date().toISOString()
    };

    return await this.manager.routeRequest(request);
  }

  /**
   * Get cost optimization recommendations
   */
  async getCostOptimization(restaurantId, costData) {
    await this.ensureInitialized();

    const request = {
      type: 'optimize_costs',
      restaurantId,
      data: costData,
      timestamp: new Date().toISOString()
    };

    return await this.manager.routeRequest(request);
  }

  /**
   * Get system health status
   */
  async getSystemHealth() {
    await this.ensureInitialized();
    return await this.manager.healthCheck();
  }

  /**
   * Get agent statuses
   */
  async getAgentStatuses() {
    await this.ensureInitialized();
    return this.manager.getAgentStatuses();
  }

  // Forecast Agent Methods

  /**
   * Forecast demand for menu items
   */
  async forecastDemand(restaurantId, options = {}) {
    await this.ensureInitialized();
    
    return await this.manager.routeToSpecificAgent('ForecastAgent', {
      type: 'forecast_demand',
      data: {
        restaurantId,
        ...options
      }
    });
  }

  /**
   * Analyze seasonal trends and patterns
   */
  async analyzeSeasonalTrends(restaurantId, options = {}) {
    await this.ensureInitialized();
    
    return await this.manager.routeToSpecificAgent('ForecastAgent', {
      type: 'analyze_seasonal_trends',
      data: {
        restaurantId,
        ...options
      }
    });
  }

  /**
   * Predict revenue based on demand forecasts
   */
  async predictRevenue(restaurantId, options = {}) {
    await this.ensureInitialized();
    
    return await this.manager.routeToSpecificAgent('ForecastAgent', {
      type: 'predict_revenue',
      data: {
        restaurantId,
        ...options
      }
    });
  }

  /**
   * Optimize capacity planning
   */
  async optimizeCapacity(restaurantId, options = {}) {
    await this.ensureInitialized();
    
    return await this.manager.routeToSpecificAgent('ForecastAgent', {
      type: 'optimize_capacity',
      data: {
        restaurantId,
        ...options
      }
    });
  }

  /**
   * Forecast ingredient needs based on demand predictions
   */
  async forecastIngredientNeeds(restaurantId, options = {}) {
    await this.ensureInitialized();
    
    return await this.manager.routeToSpecificAgent('ForecastAgent', {
      type: 'forecast_ingredients',
      data: {
        restaurantId,
        ...options
      }
    });
  }

  /**
   * Process a direct request to a specific agent
   */
  async processRequest(agentName, request) {
    await this.ensureInitialized();
    
    try {
      return await this.manager.routeRequest({
        agentName,
        ...request,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`[AgentService] Error processing request to ${agentName}:`, error);
      throw error;
    }
  }

  /**
   * Analyze query content to determine request type
   */
  analyzeQueryForType(query) {
    const queryLower = query.toLowerCase();
    
    // Cost-related keywords
    if (queryLower.includes('cost') || 
        queryLower.includes('price') || 
        queryLower.includes('margin') ||
        queryLower.includes('profit')) {
      return 'generate_insights'; // Default to insights for cost queries
    }
    
    // Inventory-related keywords
    if (queryLower.includes('inventory') || 
        queryLower.includes('stock') || 
        queryLower.includes('ingredient')) {
      return 'generate_insights'; // Will expand when inventory agent is added
    }
    
    // Forecast-related keywords
    if (queryLower.includes('forecast') || 
        queryLower.includes('predict') || 
        queryLower.includes('demand')) {
      return 'generate_insights'; // Will expand when forecast agent is added
    }
    
    // Default to general insights
    return 'generate_insights';
  }

  /**
   * Determine request type based on agent and query
   */
  determineRequestType(query, agentName) {
    const queryLower = query.toLowerCase();
    
    if (agentName.toLowerCase() === 'costagent') {
      if (queryLower.includes('recipe cost')) return 'calculate_recipe_cost';
      if (queryLower.includes('margin')) return 'analyze_margins';
      if (queryLower.includes('optimize')) return 'optimize_costs';
      if (queryLower.includes('trend')) return 'cost_trends';
      return 'generate_insights';
    }
    
    // Default to insights for other agents
    return 'generate_insights';
  }

  /**
   * Ensure service is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Gracefully shutdown all agents
   */
  async shutdown() {
    if (this.manager) {
      await this.manager.shutdown();
      this.initialized = false;
    }
  }
}

// Create singleton instance
const agentService = new AgentService();

export default agentService;
