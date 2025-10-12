/**
 * POSAdapterFactory - Factory and Registry for POS Adapters
 * 
 * Progress Note: Day 2 - Factory Pattern Implementation
 * Manages lifecycle and access to POS adapter instances
 * 
 * Design Pattern: Singleton Factory
 * - Single instance manages all adapter instances
 * - Lazy initialization of adapters (created on first use)
 * - Registry pattern for adapter lookup
 * 
 * Responsibilities:
 * 1. Initialize and manage adapter instances
 * 2. Provide adapter lookup by provider name or restaurant
 * 3. System-wide health checks for all adapters
 * 4. Centralized adapter lifecycle management
 * 
 * Usage:
 * ```javascript
 * // Initialize factory on application startup
 * await POSAdapterFactory.initializeAdapters();
 * 
 * // Get adapter by provider
 * const squareAdapter = POSAdapterFactory.getAdapter('square');
 * 
 * // Get adapter for specific restaurant
 * const adapter = await POSAdapterFactory.getAdapterForRestaurant(restaurantId);
 * 
 * // Health check all adapters
 * const health = await POSAdapterFactory.healthCheckAll();
 * ```
 */

import SquareAdapter from './SquareAdapter.js';
import ToastAdapter from './ToastAdapter.js';
import posProviders from '../config/posProviders.js';
import POSConnection from '../models/POSConnection.js';
import Restaurant from '../models/Restaurant.js';
import logger from '../utils/logger.js';
import { POSError, POSConfigError } from '../utils/posErrors.js';

class POSAdapterFactory {
  constructor() {
    // Registry of adapter instances by provider name
    // Progress Note: Stores initialized adapter instances
    this.adapters = new Map();
    
    // Initialization state
    this.initialized = false;
    
    // Adapter class registry
    // Progress Note: Maps provider names to adapter classes
    this.adapterClasses = {
      square: SquareAdapter,
      toast: ToastAdapter
    };
    
    logger.info('POSAdapterFactory created');
  }

  /**
   * Initialize all configured adapters
   * 
   * Progress Note: Should be called once on application startup
   * Loads configuration for each provider and initializes adapters
   * Gracefully handles configuration errors for optional providers
   * 
   * @param {Object} [options] - Initialization options
   * @param {Array<string>} [options.providers] - Specific providers to initialize (default: all)
   * @param {boolean} [options.strict] - Whether to fail on any adapter initialization error (default: false)
   * @returns {Promise<{initialized: Array, failed: Array}>} Initialization results
   */
  async initializeAdapters(options = {}) {
    const { providers = null, strict = false } = options;
    
    logger.info('Initializing POS adapters...', { providers, strict });
    
    // Log configuration status (without secrets)
    posProviders.logStatus();
    
    // Determine which providers to initialize
    const providersToInit = providers || Object.keys(this.adapterClasses);
    
    const results = {
      initialized: [],
      failed: []
    };
    
    // Initialize each provider
    for (const providerName of providersToInit) {
      try {
        await this._initializeAdapter(providerName);
        results.initialized.push(providerName);
        logger.info(`Successfully initialized ${providerName} adapter`);
        
      } catch (error) {
        logger.error(`Failed to initialize ${providerName} adapter:`, {
          error: error.message,
          provider: providerName
        });
        
        results.failed.push({
          provider: providerName,
          error: error.message
        });
        
        // In strict mode, fail entire initialization if any adapter fails
        if (strict) {
          throw new POSConfigError(
            `Failed to initialize ${providerName} adapter: ${error.message}`
          );
        }
      }
    }
    
    this.initialized = true;
    
    logger.info('POS adapter initialization complete', {
      initialized: results.initialized,
      failed: results.failed.map(f => f.provider)
    });
    
    return results;
  }

  /**
   * Initialize a specific adapter
   * 
   * Progress Note: Internal method for initializing individual adapters
   * Validates configuration before creating adapter instance
   * 
   * @private
   * @param {string} providerName - Provider to initialize
   * @returns {Promise<void>}
   * @throws {POSConfigError} If configuration is invalid or initialization fails
   */
  async _initializeAdapter(providerName) {
    // Check if adapter class exists
    const AdapterClass = this.adapterClasses[providerName];
    if (!AdapterClass) {
      throw new POSConfigError(
        `No adapter class registered for provider: ${providerName}`
      );
    }
    
    // Get configuration for provider
    const config = posProviders.getConfig(providerName);
    if (!config) {
      throw new POSConfigError(
        `No configuration found for provider: ${providerName}`
      );
    }
    
    // Validate configuration
    // Progress Note: Use non-strict validation to allow development without full config
    const validation = posProviders.validate(providerName, config, false);
    if (!validation.valid) {
      logger.warn(`Configuration validation warnings for ${providerName}:`, {
        errors: validation.errors
      });
    }
    
    // Create adapter instance
    const adapter = new AdapterClass(config);
    
    // Initialize adapter
    await adapter.initialize();
    
    // Store in registry
    this.adapters.set(providerName, adapter);
    
    logger.info(`Adapter ${providerName} initialized and registered`);
  }

  /**
   * Get adapter by provider name
   * 
   * Progress Note: Primary method for retrieving adapter instances
   * Returns null if adapter not initialized (non-throwing for graceful degradation)
   * 
   * @param {string} providerName - Provider name ('square', 'toast', etc.)
   * @returns {POSAdapter|null} Adapter instance or null if not found
   */
  getAdapter(providerName) {
    if (!this.initialized) {
      logger.warn('POSAdapterFactory not initialized - call initializeAdapters() first');
      return null;
    }
    
    const adapter = this.adapters.get(providerName);
    
    if (!adapter) {
      logger.warn(`No adapter found for provider: ${providerName}`, {
        availableProviders: Array.from(this.adapters.keys())
      });
      return null;
    }
    
    return adapter;
  }

  /**
   * Get adapter for a specific restaurant
   * 
   * Progress Note: Looks up restaurant's POS connection and returns appropriate adapter
   * Throws error if restaurant has no POS connection or connection is invalid
   * 
   * @param {number} restaurantId - Restaurant ID
   * @returns {Promise<{adapter: POSAdapter, connection: POSConnection}>} Adapter and connection
   * @throws {POSError} If restaurant has no active POS connection
   */
  async getAdapterForRestaurant(restaurantId) {
    if (!this.initialized) {
      throw new POSError(
        'POSAdapterFactory not initialized - call initializeAdapters() first',
        'NOT_INITIALIZED'
      );
    }
    
    // Find restaurant
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      throw new POSError(
        `Restaurant not found: ${restaurantId}`,
        'RESTAURANT_NOT_FOUND'
      );
    }
    
    // Find active POS connection for restaurant
    // Progress Note: Looks for any active connection, prioritizing the restaurant's posProvider
    let connection = null;
    
    if (restaurant.posProvider) {
      // Try to find connection matching restaurant's primary provider
      connection = await POSConnection.findOne({
        where: {
          restaurantId,
          provider: restaurant.posProvider,
          status: 'active'
        }
      });
    }
    
    // If no connection for primary provider, find any active connection
    if (!connection) {
      connection = await POSConnection.findOne({
        where: {
          restaurantId,
          status: 'active'
        },
        order: [['updatedAt', 'DESC']] // Most recently updated first
      });
    }
    
    if (!connection) {
      throw new POSError(
        `No active POS connection found for restaurant ${restaurantId}`,
        'NO_ACTIVE_CONNECTION'
      );
    }
    
    // Check if token is expired
    if (connection.isTokenExpired()) {
      throw new POSError(
        `POS connection token expired for restaurant ${restaurantId}`,
        'TOKEN_EXPIRED'
      );
    }
    
    // Get adapter for connection's provider
    const adapter = this.getAdapter(connection.provider);
    if (!adapter) {
      throw new POSError(
        `No adapter available for provider: ${connection.provider}`,
        'ADAPTER_NOT_AVAILABLE'
      );
    }
    
    logger.info('Retrieved adapter for restaurant', {
      restaurantId,
      provider: connection.provider,
      connectionId: connection.id
    });
    
    return { adapter, connection };
  }

  /**
   * Get all active connections for a restaurant
   * 
   * Progress Note: Restaurants can have multiple POS connections (rare but possible)
   * Returns array of {adapter, connection} pairs
   * 
   * @param {number} restaurantId - Restaurant ID
   * @returns {Promise<Array<{adapter: POSAdapter, connection: POSConnection}>>} All adapters and connections
   */
  async getAllAdaptersForRestaurant(restaurantId) {
    if (!this.initialized) {
      throw new POSError(
        'POSAdapterFactory not initialized',
        'NOT_INITIALIZED'
      );
    }
    
    // Find all active connections for restaurant
    const connections = await POSConnection.findAll({
      where: {
        restaurantId,
        status: 'active'
      }
    });
    
    // Map to adapter/connection pairs
    const adapters = connections
      .map(connection => {
        const adapter = this.getAdapter(connection.provider);
        if (!adapter) {
          logger.warn(`No adapter for connection ${connection.id} (provider: ${connection.provider})`);
          return null;
        }
        return { adapter, connection };
      })
      .filter(Boolean); // Remove nulls
    
    return adapters;
  }

  /**
   * Health check all initialized adapters
   * 
   * Progress Note: System-wide health check for monitoring
   * Returns status for each adapter without requiring specific connections
   * 
   * @returns {Promise<Object>} Health status for all adapters
   */
  async healthCheckAll() {
    if (!this.initialized) {
      return {
        healthy: false,
        message: 'POSAdapterFactory not initialized',
        adapters: {}
      };
    }
    
    const results = {
      healthy: true,
      timestamp: new Date().toISOString(),
      adapters: {}
    };
    
    // Check each adapter
    for (const [providerName, adapter] of this.adapters.entries()) {
      try {
        const adapterInfo = adapter.getInfo();
        
        results.adapters[providerName] = {
          available: true,
          initialized: adapterInfo.initialized,
          info: adapterInfo
        };
        
      } catch (error) {
        results.healthy = false;
        results.adapters[providerName] = {
          available: false,
          error: error.message
        };
        
        logger.error(`Health check failed for ${providerName} adapter`, {
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Health check all connections for a specific restaurant
   * 
   * Progress Note: Restaurant-specific health check
   * Tests actual API connectivity for each connection
   * 
   * @param {number} restaurantId - Restaurant ID
   * @returns {Promise<Array>} Health status for each connection
   */
  async healthCheckRestaurant(restaurantId) {
    const connections = await POSConnection.findAll({
      where: { restaurantId }
    });
    
    const results = [];
    
    for (const connection of connections) {
      const adapter = this.getAdapter(connection.provider);
      
      if (!adapter) {
        results.push({
          connectionId: connection.id,
          provider: connection.provider,
          healthy: false,
          message: `No adapter available for ${connection.provider}`
        });
        continue;
      }
      
      try {
        const health = await adapter.healthCheck(connection);
        results.push({
          connectionId: connection.id,
          provider: connection.provider,
          ...health
        });
        
      } catch (error) {
        results.push({
          connectionId: connection.id,
          provider: connection.provider,
          healthy: false,
          message: error.message,
          error: error.code || 'UNKNOWN'
        });
      }
    }
    
    return results;
  }

  /**
   * Reload a specific adapter
   * 
   * Progress Note: Allows hot-reloading adapter configuration
   * Useful for updating credentials without full application restart
   * 
   * @param {string} providerName - Provider to reload
   * @returns {Promise<void>}
   * @throws {POSConfigError} If reload fails
   */
  async reloadAdapter(providerName) {
    logger.info(`Reloading adapter: ${providerName}`);
    
    // Remove existing adapter
    this.adapters.delete(providerName);
    
    // Re-initialize
    await this._initializeAdapter(providerName);
    
    logger.info(`Adapter ${providerName} reloaded successfully`);
  }

  /**
   * Get list of available providers
   * 
   * Progress Note: Returns list of successfully initialized providers
   * 
   * @returns {Array<string>} List of provider names
   */
  getAvailableProviders() {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a specific provider is available
   * 
   * @param {string} providerName - Provider to check
   * @returns {boolean} True if provider is initialized
   */
  isProviderAvailable(providerName) {
    return this.adapters.has(providerName);
  }

  /**
   * Shutdown all adapters
   * 
   * Progress Note: Cleanup method for graceful application shutdown
   * Allows adapters to clean up resources (close connections, cancel timers, etc.)
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    logger.info('Shutting down POSAdapterFactory...');
    
    // Future: Call shutdown() on each adapter if they implement it
    // For now, just clear the registry
    
    this.adapters.clear();
    this.initialized = false;
    
    logger.info('POSAdapterFactory shutdown complete');
  }
}

// Export singleton instance
// Progress Note: Single instance pattern - all imports get the same instance
const instance = new POSAdapterFactory();

export default instance;
