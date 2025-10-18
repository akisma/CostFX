/**
 * Square Connection Routes (OAuth)
 * 
 * RESTful endpoints for Square OAuth connection management.
 * 
 * Base Path: /api/v1/pos/square/connections
 * 
 * Endpoints:
 * - POST   /           - Initiate OAuth flow
 * - GET    /callback  - Handle OAuth callback
 * - GET    /status    - Get connection status
 * - GET    /locations - Get available Square locations
 * - POST   /locations - Select locations for sync
 * - DELETE /          - Disconnect integration
 * - GET    /health    - Health check
 * 
 * Related:
 * - Issue #16: Square OAuth Authentication Service
 * - SquareAuthController: Request handling
 * - squareAuthMiddleware: OAuth validation
 * 
 * Created: 2025-10-13 (REST API Restructure)
 */

import express from 'express';
import SquareAuthController from '../../../controllers/SquareAuthController.js';
import { requireRestaurant } from '../../../middleware/restaurantContext.js';
import {
  validateOAuthCallback,
  requireSquareConnection,
  squareOAuthRateLimit,
  squareErrorHandler
} from '../../../middleware/squareAuthMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/pos/square/connections:
 *   post:
 *     tags:
 *       - Square Connections
 *     summary: Initiate Square OAuth connection
 *     description: Generates OAuth authorization URL for Square. User should be redirected to this URL to grant permissions.
 *     parameters:
 *       - in: header
 *         name: X-Restaurant-Id
 *         schema:
 *           type: integer
 *         required: false
 *         description: Restaurant ID (defaults to 1 in development)
 *     responses:
 *       200:
 *         description: OAuth URL generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authUrl:
 *                   type: string
 *                   description: Square OAuth authorization URL
 *                 state:
 *                   type: string
 *                   description: OAuth state parameter for security
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  requireRestaurant,
  squareOAuthRateLimit,
  SquareAuthController.connect
);

/**
 * @swagger
 * /api/v1/pos/square/connections/callback:
 *   get:
 *     tags:
 *       - Square Connections
 *     summary: Handle Square OAuth callback
 *     description: Processes OAuth callback from Square, exchanges authorization code for access token
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         required: true
 *         description: Authorization code from Square
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         required: true
 *         description: OAuth state parameter
 *     responses:
 *       200:
 *         description: OAuth completed successfully
 *       400:
 *         description: Invalid callback parameters
 *       500:
 *         description: OAuth exchange failed
 */
router.get(
  '/callback',
  validateOAuthCallback,
  squareOAuthRateLimit,
  SquareAuthController.callback
);

/**
 * @swagger
 * /api/v1/pos/square/connections/status:
 *   get:
 *     tags:
 *       - Square Connections
 *     summary: Get Square connection status
 *     description: Returns connection status and details for a restaurant
 *     parameters:
 *       - in: header
 *         name: X-Restaurant-Id
 *         schema:
 *           type: integer
 *         required: false
 *         description: Restaurant ID (defaults to 1 in development)
 *     responses:
 *       200:
 *         description: Connection status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isConnected:
 *                   type: boolean
 *                 connection:
 *                   type: object
 *                   nullable: true
 *       404:
 *         description: No connection found
 */
router.get(
  '/status',
  requireRestaurant,
  SquareAuthController.status
);

/**
 * @swagger
 * /api/v1/pos/square/connections/locations:
 *   get:
 *     tags:
 *       - Square Connections
 *     summary: Get available Square locations
 *     description: Fetches list of locations from Square API for location selection
 *     parameters:
 *       - in: header
 *         name: X-Restaurant-Id
 *         schema:
 *           type: integer
 *         required: false
 *     responses:
 *       200:
 *         description: Locations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 locations:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: No connection found
 *       503:
 *         description: Square API error
 */
router.get(
  '/locations',
  requireRestaurant,
  requireSquareConnection,
  SquareAuthController.locations
);

/**
 * @swagger
 * /api/v1/pos/square/connections/locations:
 *   post:
 *     tags:
 *       - Square Connections
 *     summary: Select Square locations for sync
 *     description: Updates which Square locations should be synced
 *     parameters:
 *       - in: header
 *         name: X-Restaurant-Id
 *         schema:
 *           type: integer
 *         required: false
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               locationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Locations updated successfully
 *       400:
 *         description: Invalid location IDs
 *       404:
 *         description: No connection found
 */
router.post(
  '/locations',
  requireRestaurant,
  requireSquareConnection,
  SquareAuthController.selectLocations
);

/**
 * @swagger
 * /api/v1/pos/square/connections:
 *   delete:
 *     tags:
 *       - Square Connections
 *     summary: Disconnect Square integration
 *     description: Revokes OAuth token and removes connection
 *     parameters:
 *       - in: header
 *         name: X-Restaurant-Id
 *         schema:
 *           type: integer
 *         required: false
 *     responses:
 *       200:
 *         description: Disconnected successfully
 *       404:
 *         description: No connection found
 *       503:
 *         description: Square API error during revocation
 */
router.delete(
  '/',
  requireRestaurant,
  requireSquareConnection,
  SquareAuthController.disconnect
);

/**
 * @swagger
 * /api/v1/pos/square/connections/health:
 *   get:
 *     tags:
 *       - Square Connections
 *     summary: Health check
 *     description: Verifies Square API connectivity and OAuth service health
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 squareApi:
 *                   type: string
 *                   example: reachable
 *       503:
 *         description: Service unhealthy
 */
router.get('/health', SquareAuthController.health);

// Error handling middleware (must be last)
router.use(squareErrorHandler);

export default router;
