/**
 * Square Auth Middleware
 * 
 * Purpose: Square-specific authentication and validation middleware
 * 
 * Progress Note: Issue #16 - Square OAuth Authentication Service
 * 
 * Middleware Functions:
 * - requireSquareConnection: Ensure restaurant has active Square connection
 * - validateOAuthCallback: Validate OAuth callback parameters
 * - squareErrorHandler: Handle Square-specific errors
 */

import { POSConnection, SquareLocation } from '../models/index.js';
import {
  UnauthorizedError,
  BadRequestError,
  NotFoundError
} from './errorHandler.js';
import {
  POSAuthError,
  POSTokenError,
  POSConfigError
} from '../utils/posErrors.js';
import logger from '../utils/logger.js';

/**
 * Require active Square connection for restaurant
 * 
 * Usage:
 * router.get('/locations', requireRestaurant, requireSquareConnection, handler);
 * 
 * Validates:
 * - Restaurant has Square connection
 * - Connection is active
 * - Token is not expired (or close to expiration)
 * 
 * @param {Request} req - Express request (expects req.restaurant from requireRestaurant)
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
export const requireSquareConnection = async (req, res, next) => {
  try {
    // Ensure restaurant context exists
    if (!req.restaurant) {
      throw new UnauthorizedError('Restaurant context required');
    }
    
    // Find active Square connection for restaurant
    const connection = await POSConnection.findOne({
      where: {
        restaurantId: req.restaurant.id,
        provider: 'square'
      },
      include: [
        {
          model: SquareLocation,
          as: 'squareLocations',
          required: false // Include even if no locations yet
        }
      ]
    });
    
    // Check if connection exists
    if (!connection) {
      throw new NotFoundError('No Square connection found for this restaurant');
    }
    
    // Check if connection is active
    if (!connection.isActive()) {
      const reason = connection.isTokenExpired() 
        ? 'token expired' 
        : `status is ${connection.status}`;
      
      throw new UnauthorizedError(
        `Square connection is not active (${reason}). Please reconnect.`
      );
    }
    
    // Check if token is close to expiration (within 24 hours)
    const hoursUntilExpiry = connection.getHoursUntilExpiration();
    if (hoursUntilExpiry !== null && hoursUntilExpiry < 24) {
      logger.warn('Square token expiring soon', {
        restaurantId: req.restaurant.id,
        connectionId: connection.id,
        hoursUntilExpiry
      });
      // Note: Don't fail request, just log warning
      // Token refresh will happen automatically in SquareAdapter
    }
    
    // Attach connection to request
    req.squareConnection = connection;
    
    logger.debug('Square connection validated', {
      restaurantId: req.restaurant.id,
      connectionId: connection.id,
      merchantId: connection.merchantId,
      locationCount: connection.squareLocations?.length || 0
    });
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validate OAuth callback parameters
 * 
 * Usage:
 * router.get('/callback', validateOAuthCallback, handler);
 * 
 * Validates:
 * - Required parameters present (code, state)
 * - No error from OAuth provider
 * - Parameter format validity
 * 
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next middleware
 */
export const validateOAuthCallback = async (req, res, next) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    // Check for OAuth error from Square
    if (error) {
      logger.error('Square OAuth error', {
        error,
        error_description,
        query: req.query
      });
      
      throw new BadRequestError(
        `OAuth authorization failed: ${error_description || error}`
      );
    }
    
    // Validate required parameters
    if (!code) {
      throw new BadRequestError('Missing authorization code');
    }
    
    if (!state) {
      throw new BadRequestError('Missing state parameter');
    }
    
    // Validate parameter format
    if (typeof code !== 'string' || code.length < 10) {
      throw new BadRequestError('Invalid authorization code format');
    }
    
    if (typeof state !== 'string' || state.length < 10) {
      throw new BadRequestError('Invalid state parameter format');
    }
    
    logger.debug('OAuth callback parameters validated', {
      codeLength: code.length,
      stateLength: state.length
    });
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Square-specific errors
 * 
 * Usage:
 * app.use('/api/pos/square', squareRoutes);
 * app.use(squareErrorHandler); // After all routes
 * 
 * Converts POS-specific errors to HTTP responses
 * 
 * @param {Error} err - Error object
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Next error handler
 */
export const squareErrorHandler = (err, req, res, next) => {
  // Handle Square-specific POS errors
  if (err instanceof POSAuthError) {
    logger.error('Square authentication error', {
      message: err.message,
      retryable: err.retryable,
      path: req.path
    });
    
    return res.status(401).json({
      success: false,
      error: 'Square Authentication Error',
      message: err.message,
      retryable: err.retryable,
      details: {
        provider: 'square',
        action: 'reconnect_required'
      }
    });
  }
  
  if (err instanceof POSTokenError) {
    logger.error('Square token error', {
      message: err.message,
      retryable: err.retryable,
      path: req.path
    });
    
    return res.status(401).json({
      success: false,
      error: 'Square Token Error',
      message: err.message,
      retryable: err.retryable,
      details: {
        provider: 'square',
        action: 'token_refresh_failed'
      }
    });
  }
  
  if (err instanceof POSConfigError) {
    logger.error('Square configuration error', {
      message: err.message,
      path: req.path
    });
    
    return res.status(500).json({
      success: false,
      error: 'Square Configuration Error',
      message: 'Square integration is not properly configured. Please contact support.',
      details: {
        provider: 'square',
        action: 'contact_support'
      }
    });
  }
  
  // Pass non-Square errors to next error handler
  next(err);
};

/**
 * Rate limiting for Square OAuth endpoints
 * 
 * Prevents abuse of OAuth flow
 * 
 * Usage:
 * router.post('/connect', squareOAuthRateLimit, handler);
 */
import rateLimit from 'express-rate-limit';

export const squareOAuthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 OAuth requests per windowMs
  message: {
    success: false,
    error: 'Too many OAuth requests',
    message: 'Please wait before trying to connect again'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in test environment
  skip: (req) => process.env.NODE_ENV === 'test'
});

export default {
  requireSquareConnection,
  validateOAuthCallback,
  squareErrorHandler,
  squareOAuthRateLimit
};
