/**
 * BaseAgent - Core agent class that all specialized agents inherit from
 * Provides standard interface for agent communication and state management
 */
class BaseAgent {
  constructor(name, capabilities = []) {
    this.name = name;
    this.capabilities = capabilities;
    this.state = {
      status: 'inactive', // inactive, active, processing, error
      lastActivity: null,
      processedRequests: 0,
      errors: 0
    };
    this.eventHandlers = new Map();
  }

  /**
   * Initialize the agent - override in subclasses
   */
  async initialize() {
    this.state.status = 'active';
    this.state.lastActivity = new Date().toISOString();
    console.log(`[${this.name}] Agent initialized`);
  }

  /**
   * Process a request - must be implemented by subclasses
   */
  // eslint-disable-next-line no-unused-vars
  async process(request) {
    throw new Error(`${this.name} agent must implement process() method`);
  }

  /**
   * Standard request processing wrapper with error handling and logging
   */
  async handleRequest(request) {
    try {
      this.state.status = 'processing';
      this.state.lastActivity = new Date().toISOString();
      
      // Validate request
      this.validateRequest(request);
      
      // Process the request
      const result = await this.process(request);
      
      // Update state and return result
      this.state.processedRequests++;
      this.state.status = 'active';
      
      return {
        success: true,
        agent: this.name,
        result,
        timestamp: new Date().toISOString(),
        requestId: request.id || this.generateRequestId()
      };
      
    } catch (error) {
      this.state.errors++;
      this.state.status = 'error';
      
      console.error(`[${this.name}] Error processing request:`, error);
      
      return {
        success: false,
        agent: this.name,
        error: error.message,
        timestamp: new Date().toISOString(),
        requestId: request.id || this.generateRequestId()
      };
    }
  }

  /**
   * Validate incoming request - override in subclasses for specific validation
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
   * Check if agent can handle a specific request type
   */
  canHandle(requestType) {
    return this.capabilities.includes(requestType);
  }

  /**
   * Get agent status and health information
   */
  getStatus() {
    return {
      name: this.name,
      capabilities: this.capabilities,
      state: { ...this.state },
      health: this.getHealthScore()
    };
  }

  /**
   * Calculate agent health score based on performance metrics
   */
  getHealthScore() {
    const totalRequests = this.state.processedRequests + this.state.errors;
    if (totalRequests === 0) return 100;
    
    const successRate = (this.state.processedRequests / totalRequests) * 100;
    return Math.round(successRate);
  }

  /**
   * Register event handler for agent communication
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  /**
   * Emit event to registered handlers
   */
  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[${this.name}] Error in event handler for ${event}:`, error);
      }
    });
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update agent metrics after processing a request
   */
  updateMetrics(processingTime, success = true) {
    if (success) {
      this.state.processedRequests++;
    } else {
      this.state.errors++;
    }
    
    // Initialize metrics if not exists
    if (!this.metrics) {
      this.metrics = {
        requests: 0,
        errors: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0
      };
    }
    
    this.metrics.requests++;
    if (!success) {
      this.metrics.errors++;
    }
    
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.requests;
    
    this.state.lastActivity = new Date().toISOString();
  }

  /**
   * Shutdown agent gracefully
   */
  async shutdown() {
    this.state.status = 'inactive';
    console.log(`[${this.name}] Agent shutting down`);
  }
}

export default BaseAgent;
