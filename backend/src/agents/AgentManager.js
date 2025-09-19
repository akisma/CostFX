import BaseAgent from './BaseAgent.js';

/**
 * AgentManager - Orchestrates multiple agents and handles request routing
 * Manages agent lifecycle, communication, and load balancing
 */
class AgentManager {
  constructor() {
    this.agents = new Map();
    this.requestQueue = [];
    this.isProcessing = false;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Register a new agent with the manager --
   */
  async registerAgent(agent) {
    if (!(agent instanceof BaseAgent)) {
      throw new Error('Agent must extend BaseAgent class');
    }

    // Initialize the agent
    await agent.initialize();
    
    // Register agent
    this.agents.set(agent.name, agent);
    
    // Set up agent event handlers
    agent.on('request_completed', (data) => {
      this.updateStats(data);
    });

    console.log(`[AgentManager] Registered agent: ${agent.name}`);
    return agent;
  }

  /**
   * Remove an agent from the manager
   */
  async unregisterAgent(agentName) {
    const agent = this.agents.get(agentName);
    if (agent) {
      await agent.shutdown();
      this.agents.delete(agentName);
      console.log(`[AgentManager] Unregistered agent: ${agentName}`);
    }
  }

  /**
   * Route request to appropriate agent
   */
  async routeRequest(request) {
    const startTime = Date.now();
    
    try {
      // Validate request
      this.validateRequest(request);
      
      // Find capable agent
      const agent = this.findCapableAgent(request.type);
      if (!agent) {
        throw new Error(`No agent available to handle request type: ${request.type}`);
      }

      // Process request
      const result = await agent.handleRequest(request);
      
      // Update statistics
      const responseTime = Date.now() - startTime;
      this.updateRequestStats(true, responseTime);
      
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateRequestStats(false, responseTime);
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: request.id || this.generateRequestId()
      };
    }
  }

  /**
   * Find an agent capable of handling the request type
   */
  findCapableAgent(requestType) {
    for (const agent of this.agents.values()) {
      if (agent.canHandle(requestType) && agent.state.status === 'active') {
        return agent;
      }
    }
    return null;
  }

  /**
   * Process multiple requests concurrently
   */
  async processRequests(requests) {
    const promises = requests.map(request => this.routeRequest(request));
    return await Promise.allSettled(promises);
  }

  /**
   * Get insights from all agents for a restaurant
   */
  async getRestaurantInsights(restaurantId) {
    const insights = [];
    
    for (const agent of this.agents.values()) {
      if (agent.canHandle('generate_insights')) {
        try {
          const result = await agent.handleRequest({
            type: 'generate_insights',
            restaurantId,
            timestamp: new Date().toISOString()
          });
          
          if (result.success && result.result.insights) {
            insights.push(...result.result.insights);
          }
        } catch (error) {
          console.error(`[AgentManager] Error getting insights from ${agent.name}:`, error);
        }
      }
    }
    
    return this.prioritizeInsights(insights);
  }

  /**
   * Prioritize insights by importance and impact
   */
  prioritizeInsights(insights) {
    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    
    return insights.sort((a, b) => {
      const priorityA = priorityOrder[a.priority] || 0;
      const priorityB = priorityOrder[b.priority] || 0;
      return priorityB - priorityA;
    });
  }

  /**
   * Route request to a specific agent by name
   */
  async routeToSpecificAgent(agentName, request) {
    const agent = this.agents.get(agentName);
    
    if (!agent) {
      throw new Error(`Agent '${agentName}' not found`);
    }
    
    if (agent.state.status !== 'active') {
      throw new Error(`Agent '${agentName}' is not active (status: ${agent.state.status})`);
    }
    
    const startTime = Date.now();
    
    try {
      // Add request metadata
      const enrichedRequest = {
        ...request,
        id: this.generateRequestId(),
        timestamp: new Date().toISOString(),
        targetAgent: agentName
      };
      
      // Process request through agent
      const result = await agent.process(enrichedRequest);
      
      // Update statistics
      const responseTime = Date.now() - startTime;
      this.updateRequestStats(true, responseTime);
      
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateRequestStats(false, responseTime);
      throw error;
    }
  }

  /**
   * Get status of all registered agents
   */
  getAgentStatuses() {
    const statuses = {};
    
    for (const [name, agent] of this.agents) {
      statuses[name] = agent.getStatus();
    }
    
    return {
      agents: statuses,
      manager: {
        totalAgents: this.agents.size,
        activeAgents: Array.from(this.agents.values()).filter(a => a.state.status === 'active').length,
        stats: this.stats
      }
    };
  }

  /**
   * Health check for all agents
   */
  async healthCheck() {
    const health = {
      overall: 'healthy',
      agents: {},
      issues: []
    };

    for (const [name, agent] of this.agents) {
      const agentHealth = agent.getHealthScore();
      health.agents[name] = {
        health: agentHealth,
        status: agent.state.status
      };

      if (agentHealth < 80) {
        health.issues.push(`${name} agent health is low: ${agentHealth}%`);
      }

      if (agent.state.status === 'error') {
        health.issues.push(`${name} agent is in error state`);
      }
    }

    if (health.issues.length > 0) {
      health.overall = health.issues.length > 2 ? 'critical' : 'warning';
    }

    return health;
  }

  /**
   * Validate incoming request
   */
  validateRequest(request) {
    if (!request) {
      throw new Error('Request is required');
    }
    
    if (!request.type) {
      throw new Error('Request type is required');
    }
    
    if (!request.restaurantId) {
      throw new Error('Restaurant ID is required');
    }
  }

  /**
   * Update request processing statistics
   */
  updateRequestStats(success, responseTime) {
    this.stats.totalRequests++;
    
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }
    
    // Update average response time
    const totalTime = this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime;
    this.stats.averageResponseTime = Math.round(totalTime / this.stats.totalRequests);
  }

  /**
   * Update agent-specific statistics
   */
  updateStats(data) {
    // Agent-specific stat updates can be handled here
    console.log(`[AgentManager] Request completed by ${data.agent}`);
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `mgr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gracefully shutdown all agents
   */
  async shutdown() {
    console.log('[AgentManager] Shutting down all agents...');
    
    const shutdownPromises = Array.from(this.agents.values()).map(agent => 
      agent.shutdown()
    );
    
    await Promise.allSettled(shutdownPromises);
    this.agents.clear();
    
    console.log('[AgentManager] All agents shut down');
  }
}

export default AgentManager;
