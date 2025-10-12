/**
 * Restaurant Context Middleware
 * 
 * Purpose: Provides restaurant-centric authentication for MVP
 * 
 * Progress Note: Issue #16 - Square OAuth Authentication Service
 * 
 * Design Decision: Restaurant-Centric (No User Model Yet)
 * ----------------------------------------------------
 * For MVP, we're using a restaurant-centric approach instead of user-centric:
 * 
 * Why?
 * - Square OAuth is restaurant-level (merchant authorizes for their business)
 * - Analysis is restaurant-level (variance calculated per restaurant)
 * - Data is restaurant-level (inventory, sales belong to restaurant)
 * - Simpler, faster MVP delivery
 * 
 * When to Add User Model?
 * - Phase 5+ (Issue #26+) when implementing:
 *   - Multi-user access control
 *   - Login/signup flows
 *   - Role-based permissions
 *   - Audit trails
 * 
 * Current Flow:
 * Request → requireRestaurant → req.restaurant = { id, name } → Next Handler
 */

import { Restaurant } from '../models/index.js';
import { UnauthorizedError, NotFoundError } from './errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Require restaurant context
 * 
 * Usage:
 * router.post('/connect', requireRestaurant, SquareAuthController.connect);
 * 
 * For MVP: Extracts restaurantId from request (query, body, or header)
 * Future: Will integrate with User authentication to determine restaurant access
 * 
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
export const requireRestaurant = async (req, res, next) => {
  try {
    // Extract restaurant ID from various sources (priority order)
    let restaurantId = 
      req.params.restaurantId ||      // URL params: /api/restaurant/:restaurantId/...
      req.body.restaurantId ||         // Request body
      req.query.restaurantId ||        // Query string
      req.headers['x-restaurant-id'];  // Custom header
    
    // Convert to integer if string
    if (restaurantId) {
      restaurantId = parseInt(restaurantId, 10);
    }
    
    // MVP Development Mode: Use default restaurant if none provided
    if (!restaurantId && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
      logger.warn('No restaurant ID provided, using default restaurant for development', {
        path: req.path,
        method: req.method
      });
      restaurantId = 1; // Default restaurant for development
    }
    
    // Validate restaurant ID
    if (!restaurantId || isNaN(restaurantId)) {
      throw new UnauthorizedError('Restaurant ID required');
    }
    
    // Fetch restaurant from database
    const restaurant = await Restaurant.findByPk(restaurantId);
    
    if (!restaurant) {
      throw new NotFoundError(`Restaurant with ID ${restaurantId} not found`);
    }
    
    // Attach restaurant to request for downstream handlers
    req.restaurant = {
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      phoneNumber: restaurant.phoneNumber,
      cuisine: restaurant.cuisine,
      // Full model available if needed
      _model: restaurant
    };
    
    logger.debug('Restaurant context established', {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      path: req.path
    });
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional restaurant context
 * 
 * Similar to requireRestaurant but doesn't fail if no restaurant found
 * Useful for endpoints that work with or without restaurant context
 * 
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
export const optionalRestaurant = async (req, res, next) => {
  try {
    // Extract restaurant ID
    let restaurantId = 
      req.params.restaurantId ||
      req.body.restaurantId ||
      req.query.restaurantId ||
      req.headers['x-restaurant-id'];
    
    if (restaurantId) {
      restaurantId = parseInt(restaurantId, 10);
      
      if (!isNaN(restaurantId)) {
        const restaurant = await Restaurant.findByPk(restaurantId);
        
        if (restaurant) {
          req.restaurant = {
            id: restaurant.id,
            name: restaurant.name,
            address: restaurant.address,
            phoneNumber: restaurant.phoneNumber,
            cuisine: restaurant.cuisine,
            _model: restaurant
          };
        }
      }
    }
    
    next();
  } catch (error) {
    // Don't fail - just log and continue
    logger.warn('Failed to establish optional restaurant context', {
      error: error.message,
      path: req.path
    });
    next();
  }
};

/**
 * Validate restaurant ownership
 * 
 * For future use when User model is implemented
 * Ensures the authenticated user has access to the requested restaurant
 * 
 * Usage:
 * router.get('/data', requireRestaurant, validateRestaurantAccess, handler);
 * 
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
export const validateRestaurantAccess = async (req, res, next) => {
  try {
    // TODO: Implement when User model is added (Issue #26+)
    // For now, just pass through
    
    // Future implementation:
    // if (!req.user) {
    //   throw new UnauthorizedError('User authentication required');
    // }
    // 
    // const hasAccess = await req.user.hasAccessToRestaurant(req.restaurant.id);
    // if (!hasAccess) {
    //   throw new ForbiddenError('No access to this restaurant');
    // }
    
    next();
  } catch (error) {
    next(error);
  }
};

export default {
  requireRestaurant,
  optionalRestaurant,
  validateRestaurantAccess
};
