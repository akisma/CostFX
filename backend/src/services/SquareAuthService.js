/**
 * SquareAuthService
 * 
 * Purpose: Business logic layer for Square OAuth authentication
 * 
 * Progress Note: Issue #16 - Square OAuth Authentication Service
 * 
 * Architecture: Service → Adapter Pattern
 * This service wraps SquareAdapter OAuth methods with business logic orchestration.
 * Controllers call this service, service calls SquareAdapter, adapter calls Square API.
 * 
 * Responsibilities:
 * - Orchestrate OAuth connection flow
 * - Handle location discovery and selection
 * - Manage connection status
 * - Coordinate between POSConnection, SquareLocation, and SquareAdapter
 */

import POSAdapterFactory from '../adapters/POSAdapterFactory.js';
import { POSConnection, SquareLocation, Restaurant } from '../models/index.js';
import logger from '../utils/logger.js';
import { POSAuthError, POSError } from '../utils/posErrors.js';

class SquareAuthService {
  /**
   * Initialize Square OAuth connection flow
   * 
   * @param {number} restaurantId - Restaurant ID
   * @returns {Promise<{authorizationUrl: string, state: string}>}
   */
  static async initiateConnection(restaurantId) {
    logger.info('Initiating Square OAuth connection', { restaurantId });
    
    try {
      // Verify restaurant exists
      const restaurant = await Restaurant.findByPk(restaurantId);
      if (!restaurant) {
        throw new POSError(`Restaurant ${restaurantId} not found`);
      }
      
      // Get Square adapter
      const adapter = POSAdapterFactory.getAdapter('square');
      await adapter.initialize();
      
      // Generate OAuth URL with state token
      const result = await adapter.initiateOAuth(restaurantId);
      
      logger.info('Square OAuth initiated successfully', {
        restaurantId,
        state: result.state
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to initiate Square OAuth', {
        restaurantId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Handle OAuth callback from Square
   * 
   * @param {Object} params
   * @param {string} params.code - Authorization code from Square
   * @param {string} params.state - State token for CSRF verification
   * @param {number} params.restaurantId - Restaurant ID
   * @returns {Promise<{connection: POSConnection, locations: Array}>}
   */
  static async handleCallback({ code, state, restaurantId }) {
    logger.info('Handling Square OAuth callback', { restaurantId });
    
    try {
      // Get Square adapter
      const adapter = POSAdapterFactory.getAdapter('square');
      await adapter.initialize();
      
      // Handle OAuth callback (creates/updates POSConnection)
      const connection = await adapter.handleOAuthCallback({
        code,
        state,
        restaurantId
      });
      
      // Fetch available locations from Square
      const locations = await adapter.getLocations(connection);
      
      logger.info('Square OAuth callback handled successfully', {
        restaurantId,
        connectionId: connection.id,
        locationCount: locations.length
      });
      
      return {
        connection,
        locations
      };
    } catch (error) {
      logger.error('Failed to handle Square OAuth callback', {
        restaurantId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get connection status for restaurant
   * 
   * @param {number} restaurantId - Restaurant ID
   * @returns {Promise<{connected: boolean, connection: POSConnection|null, locations: Array}>}
   */
  static async getConnectionStatus(restaurantId) {
    try {
      // Find existing connection
      const connection = await POSConnection.findOne({
        where: {
          restaurantId,
          provider: 'square'
        },
        include: [
          {
            model: SquareLocation,
            as: 'squareLocations',
            required: false
          }
        ]
      });
      
      if (!connection) {
        return {
          connected: false,
          connection: null,
          locations: []
        };
      }
      
      return {
        connected: connection.isActive(),
        connection,
        locations: connection.squareLocations || []
      };
    } catch (error) {
      logger.error('Failed to get Square connection status', {
        restaurantId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Get available Square locations for restaurant
   * 
   * @param {number} restaurantId - Restaurant ID
   * @returns {Promise<Array>} Array of location objects
   */
  static async getLocations(restaurantId) {
    logger.info('Fetching Square locations', { restaurantId });
    
    try {
      // Get connection
      const connection = await POSConnection.findOne({
        where: {
          restaurantId,
          provider: 'square'
        }
      });
      
      if (!connection) {
        throw new POSError('No Square connection found for this restaurant');
      }
      
      if (!connection.isActive()) {
        throw new POSAuthError('Square connection is not active. Please reconnect.');
      }
      
      // Get adapter and fetch locations
      const adapter = POSAdapterFactory.getAdapter('square');
      await adapter.initialize();
      
      const locations = await adapter.getLocations(connection);
      
      logger.info('Square locations fetched successfully', {
        restaurantId,
        locationCount: locations.length
      });
      
      return locations;
    } catch (error) {
      logger.error('Failed to fetch Square locations', {
        restaurantId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Select and save Square locations for sync
   * 
   * @param {number} restaurantId - Restaurant ID
   * @param {Array<string>} locationIds - Array of Square location IDs to sync
   * @returns {Promise<Array<SquareLocation>>} Created SquareLocation records
   */
  static async selectLocations(restaurantId, locationIds) {
    logger.info('Selecting Square locations for sync', {
      restaurantId,
      locationIds
    });
    
    try {
      // Validate input
      if (!Array.isArray(locationIds) || locationIds.length === 0) {
        throw new POSError('At least one location ID is required');
      }
      
      // Get connection
      const connection = await POSConnection.findOne({
        where: {
          restaurantId,
          provider: 'square'
        }
      });
      
      if (!connection) {
        throw new POSError('No Square connection found for this restaurant');
      }
      
      // Get full location details from Square
      const adapter = POSAdapterFactory.getAdapter('square');
      await adapter.initialize();
      const allLocations = await adapter.getLocations(connection);
      
      // Filter selected locations
      const selectedLocations = allLocations.filter(loc => 
        locationIds.includes(loc.id)
      );
      
      if (selectedLocations.length !== locationIds.length) {
        throw new POSError('Some location IDs are invalid');
      }
      
      // Create or update SquareLocation records
      const squareLocations = await Promise.all(
        selectedLocations.map(async (loc) => {
          const [squareLocation, created] = await SquareLocation.findOrCreate({
            where: {
              posConnectionId: connection.id,
              locationId: loc.id
            },
            defaults: {
              locationName: loc.name,
              address: loc.address,
              status: loc.isActive ? 'active' : 'inactive',
              capabilities: loc.capabilities,
              syncEnabled: true,
              metadata: {
                squareStatus: loc.status,
                createdVia: 'location_selection'
              }
            }
          });
          
          // Update if already exists
          if (!created) {
            await squareLocation.update({
              locationName: loc.name,
              address: loc.address,
              status: loc.isActive ? 'active' : 'inactive',
              capabilities: loc.capabilities,
              syncEnabled: true
            });
          }
          
          return squareLocation;
        })
      );
      
      logger.info('Square locations selected successfully', {
        restaurantId,
        connectionId: connection.id,
        selectedCount: squareLocations.length
      });
      
      return squareLocations;
    } catch (error) {
      logger.error('Failed to select Square locations', {
        restaurantId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Disconnect Square integration
   * 
   * @param {number} restaurantId - Restaurant ID
   * @returns {Promise<void>}
   */
  static async disconnect(restaurantId) {
    logger.info('Disconnecting Square integration', { restaurantId });
    
    try {
      // Get connection
      const connection = await POSConnection.findOne({
        where: {
          restaurantId,
          provider: 'square'
        }
      });
      
      if (!connection) {
        throw new POSError('No Square connection found for this restaurant');
      }
      
      // Get adapter and revoke tokens
      const adapter = POSAdapterFactory.getAdapter('square');
      await adapter.initialize();
      
      await adapter.disconnect(connection);
      
      logger.info('Square integration disconnected successfully', {
        restaurantId,
        connectionId: connection.id
      });
    } catch (error) {
      logger.error('Failed to disconnect Square integration', {
        restaurantId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Check Square connection health
   * 
   * @param {number} restaurantId - Restaurant ID
   * @returns {Promise<{healthy: boolean, message: string, details: Object}>}
   */
  static async healthCheck(restaurantId) {
    logger.debug('Checking Square connection health', { restaurantId });
    
    try {
      // Get connection
      const connection = await POSConnection.findOne({
        where: {
          restaurantId,
          provider: 'square'
        }
      });
      
      if (!connection) {
        return {
          healthy: false,
          message: 'No Square connection found',
          details: { restaurantId }
        };
      }
      
      // Get adapter and perform health check
      const adapter = POSAdapterFactory.getAdapter('square');
      await adapter.initialize();
      
      const healthResult = await adapter.healthCheck(connection);
      
      logger.debug('Square health check completed', {
        restaurantId,
        healthy: healthResult.healthy
      });
      
      return healthResult;
    } catch (error) {
      logger.error('Square health check failed', {
        restaurantId,
        error: error.message
      });
      
      return {
        healthy: false,
        message: `Health check failed: ${error.message}`,
        details: { restaurantId, error: error.message }
      };
    }
  }
}

export default SquareAuthService;
