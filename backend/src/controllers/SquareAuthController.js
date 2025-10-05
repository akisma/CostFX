/**
 * SquareAuthController
 * 
 * Purpose: HTTP request handlers for Square OAuth endpoints
 * 
 * Progress Note: Issue #16 - Square OAuth Authentication Service
 * 
 * Responsibilities:
 * - Parse HTTP requests
 * - Call SquareAuthService methods
 * - Format HTTP responses
 * - Handle errors and edge cases
 */

import SquareAuthService from '../services/SquareAuthService.js';
import logger from '../utils/logger.js';
import { POSError, POSAuthError, POSTokenError } from '../utils/posErrors.js';

class SquareAuthController {
  /**
   * Initiate Square OAuth connection
   * POST /api/pos/square/connect
   * 
   * @param {Request} req - Express request (restaurantId from middleware)
   * @param {Response} res - Express response
   */
  static async connect(req, res) {
    try {
      const restaurantId = req.restaurant?.id;
      
      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Restaurant context is required'
        });
      }
      
      const result = await SquareAuthService.initiateConnection(restaurantId);
      
      res.status(200).json({
        success: true,
        message: 'Square OAuth initiated. Redirect user to authorizationUrl.',
        data: {
          authorizationUrl: result.authorizationUrl,
          state: result.state
        }
      });
    } catch (error) {
      logger.error('SquareAuthController.connect failed', {
        error: error.message,
        restaurantId: req.restaurant?.id
      });
      
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to initiate Square OAuth',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
  
  /**
   * Handle OAuth callback from Square
   * GET /api/pos/square/callback
   * 
   * @param {Request} req - Express request (code, state from query, restaurantId from state)
   * @param {Response} res - Express response
   */
  static async callback(req, res) {
    try {
      const { code, state } = req.query;
      const restaurantId = req.restaurantId; // Extracted by validateOAuthCallback middleware
      
      const result = await SquareAuthService.handleCallback({
        code,
        state,
        restaurantId
      });
      
      res.status(200).json({
        success: true,
        message: 'Square OAuth callback handled successfully',
        data: {
          connection: {
            id: result.connection.id,
            provider: result.connection.provider,
            status: result.connection.status,
            isActive: result.connection.isActive()
          },
          locations: result.locations.map(loc => ({
            id: loc.id,
            name: loc.name,
            address: loc.address,
            isActive: loc.isActive,
            capabilities: loc.capabilities
          }))
        }
      });
    } catch (error) {
      logger.error('SquareAuthController.callback failed', {
        error: error.message,
        restaurantId: req.restaurantId || req.restaurant?.id
      });
      
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to handle Square OAuth callback',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
  
  /**
   * Get Square connection status
   * GET /api/pos/square/status
   * 
   * @param {Request} req - Express request (restaurantId from middleware)
   * @param {Response} res - Express response
   */
  static async status(req, res) {
    try {
      const restaurantId = req.restaurant?.id;
      
      const result = await SquareAuthService.getConnectionStatus(restaurantId);
      
      res.status(200).json({
        success: true,
        message: result.connected ? 'Square connection active' : 'No Square connection',
        data: {
          connected: result.connected,
          connection: result.connection ? {
            id: result.connection.id,
            provider: result.connection.provider,
            status: result.connection.status,
            merchantId: result.connection.merchantId,
            createdAt: result.connection.createdAt,
            updatedAt: result.connection.updatedAt
          } : null,
          locations: result.locations.map(loc => ({
            id: loc.id,
            locationId: loc.locationId,
            locationName: loc.locationName,
            address: loc.address,
            status: loc.status,
            syncEnabled: loc.syncEnabled,
            lastSyncAt: loc.lastSyncAt
          }))
        }
      });
    } catch (error) {
      logger.error('SquareAuthController.status failed', {
        error: error.message,
        restaurantId: req.restaurant?.id
      });
      
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get Square connection status',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
  
  /**
   * Get available Square locations
   * GET /api/pos/square/locations
   * 
   * @param {Request} req - Express request (restaurantId from middleware)
   * @param {Response} res - Express response
   */
  static async locations(req, res) {
    try {
      const restaurantId = req.restaurant?.id;
      
      const locations = await SquareAuthService.getLocations(restaurantId);
      
      res.status(200).json({
        success: true,
        message: `Found ${locations.length} Square location(s)`,
        data: {
          locations: locations.map(loc => ({
            id: loc.id,
            name: loc.name,
            address: loc.address,
            isActive: loc.isActive,
            status: loc.status,
            capabilities: loc.capabilities
          }))
        }
      });
    } catch (error) {
      logger.error('SquareAuthController.locations failed', {
        error: error.message,
        restaurantId: req.restaurant?.id
      });
      
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to fetch Square locations',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
  
  /**
   * Select Square locations for sync
   * POST /api/pos/square/locations/select
   * 
   * @param {Request} req - Express request (restaurantId from middleware, locationIds from body)
   * @param {Response} res - Express response
   */
  static async selectLocations(req, res) {
    try {
      const restaurantId = req.restaurant?.id;
      const { locationIds } = req.body;
      
      // Validate request body
      if (!locationIds || !Array.isArray(locationIds)) {
        return res.status(400).json({
          success: false,
          message: 'locationIds array is required in request body'
        });
      }
      
      if (locationIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one location ID is required'
        });
      }
      
      const squareLocations = await SquareAuthService.selectLocations(
        restaurantId,
        locationIds
      );
      
      res.status(200).json({
        success: true,
        message: `Successfully selected ${squareLocations.length} location(s) for sync`,
        data: {
          locations: squareLocations.map(loc => ({
            id: loc.id,
            locationId: loc.locationId,
            locationName: loc.locationName,
            address: loc.address,
            status: loc.status,
            syncEnabled: loc.syncEnabled
          }))
        }
      });
    } catch (error) {
      logger.error('SquareAuthController.selectLocations failed', {
        error: error.message,
        restaurantId: req.restaurant?.id
      });
      
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to select Square locations',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
  
  /**
   * Disconnect Square integration
   * POST /api/pos/square/disconnect
   * 
   * @param {Request} req - Express request (restaurantId from middleware)
   * @param {Response} res - Express response
   */
  static async disconnect(req, res) {
    try {
      const restaurantId = req.restaurant?.id;
      
      await SquareAuthService.disconnect(restaurantId);
      
      res.status(200).json({
        success: true,
        message: 'Square integration disconnected successfully',
        data: null
      });
    } catch (error) {
      logger.error('SquareAuthController.disconnect failed', {
        error: error.message,
        restaurantId: req.restaurant?.id
      });
      
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to disconnect Square integration',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
  
  /**
   * Check Square connection health
   * GET /api/pos/square/health
   * 
   * @param {Request} req - Express request (restaurantId from middleware)
   * @param {Response} res - Express response
   */
  static async health(req, res) {
    try {
      const restaurantId = req.restaurant?.id;
      
      const result = await SquareAuthService.healthCheck(restaurantId);
      
      res.status(result.healthy ? 200 : 503).json({
        success: result.healthy,
        message: result.message,
        data: result.details
      });
    } catch (error) {
      logger.error('SquareAuthController.health failed', {
        error: error.message,
        restaurantId: req.restaurant?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Health check failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
}

export default SquareAuthController;
