/**
 * Square OAuth Routes
 * 
 * Purpose: Express routes for Square OAuth authentication
 * 
 * Progress Note: Issue #16 - Square OAuth Authentication Service
 * 
 * Endpoints:
 * - POST /connect - Initiate OAuth flow
 * - GET /callback - Handle OAuth callback
 * - GET /status - Get connection status
 * - GET /locations - Get available locations
 * - POST /locations/select - Select locations for sync
 * - POST /disconnect - Disconnect integration
 * - GET /health - Health check
 */

import express from 'express';
import SquareAuthController from '../controllers/SquareAuthController.js';
import { requireRestaurant } from '../middleware/restaurantContext.js';
import {
  validateOAuthCallback,
  requireSquareConnection,
  squareOAuthRateLimit,
  squareErrorHandler
} from '../middleware/squareAuthMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/pos/square/connect:
 *   post:
 *     tags:
 *       - Square OAuth
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
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Square OAuth initiated. Redirect user to authorizationUrl.
 *                 data:
 *                   type: object
 *                   properties:
 *                     authorizationUrl:
 *                       type: string
 *                       example: https://connect.squareup.com/oauth2/authorize?client_id=...
 *                     state:
 *                       type: string
 *                       example: abc123xyz789
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/connect', requireRestaurant, squareOAuthRateLimit, SquareAuthController.connect);

/**
 * @swagger
 * /api/pos/square/callback:
 *   get:
 *     tags:
 *       - Square OAuth
 *     summary: Handle OAuth callback from Square
 *     description: Receives authorization code from Square and exchanges it for access tokens. Creates POSConnection and fetches available locations.
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
 *         description: State token for CSRF verification
 *     responses:
 *       200:
 *         description: OAuth callback handled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Square OAuth callback handled successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     connection:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         provider:
 *                           type: string
 *                           example: square
 *                         status:
 *                           type: string
 *                           example: active
 *                         isActive:
 *                           type: boolean
 *                           example: true
 *                     locations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: L1234567890
 *                           name:
 *                             type: string
 *                             example: Main Street Location
 *                           address:
 *                             type: object
 *                           isActive:
 *                             type: boolean
 *                             example: true
 *                           capabilities:
 *                             type: array
 *                             items:
 *                               type: string
 *       400:
 *         description: Invalid callback parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/callback', validateOAuthCallback, SquareAuthController.callback);

/**
 * @swagger
 * /api/pos/square/status:
 *   get:
 *     tags:
 *       - Square OAuth
 *     summary: Get Square connection status
 *     description: Returns current connection status, details, and selected locations for the restaurant.
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
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Square connection active
 *                 data:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                       example: true
 *                     connection:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: integer
 *                         provider:
 *                           type: string
 *                         status:
 *                           type: string
 *                         merchantId:
 *                           type: string
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                     locations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           locationId:
 *                             type: string
 *                           locationName:
 *                             type: string
 *                           address:
 *                             type: object
 *                           status:
 *                             type: string
 *                           syncEnabled:
 *                             type: boolean
 *                           lastSyncAt:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/status', requireRestaurant, SquareAuthController.status);

/**
 * @swagger
 * /api/pos/square/locations:
 *   get:
 *     tags:
 *       - Square OAuth
 *     summary: Get available Square locations
 *     description: Fetches all locations from Square for the connected restaurant. Requires active connection.
 *     parameters:
 *       - in: header
 *         name: X-Restaurant-Id
 *         schema:
 *           type: integer
 *         required: false
 *         description: Restaurant ID (defaults to 1 in development)
 *     responses:
 *       200:
 *         description: Locations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Found 3 Square location(s)
 *                 data:
 *                   type: object
 *                   properties:
 *                     locations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: L1234567890
 *                           name:
 *                             type: string
 *                             example: Main Street Location
 *                           address:
 *                             type: object
 *                             properties:
 *                               addressLine1:
 *                                 type: string
 *                               city:
 *                                 type: string
 *                               state:
 *                                 type: string
 *                               postalCode:
 *                                 type: string
 *                           isActive:
 *                             type: boolean
 *                             example: true
 *                           status:
 *                             type: string
 *                             example: ACTIVE
 *                           capabilities:
 *                             type: array
 *                             items:
 *                               type: string
 *       401:
 *         description: No active Square connection
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/locations', requireRestaurant, SquareAuthController.locations);

/**
 * @swagger
 * /api/pos/square/locations/select:
 *   post:
 *     tags:
 *       - Square OAuth
 *     summary: Select locations for sync
 *     description: Saves selected Square locations to database and enables sync for them.
 *     parameters:
 *       - in: header
 *         name: X-Restaurant-Id
 *         schema:
 *           type: integer
 *         required: false
 *         description: Restaurant ID (defaults to 1 in development)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - locationIds
 *             properties:
 *               locationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["L1234567890", "L0987654321"]
 *                 description: Array of Square location IDs to enable for sync
 *     responses:
 *       200:
 *         description: Locations selected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Successfully selected 2 location(s) for sync
 *                 data:
 *                   type: object
 *                   properties:
 *                     locations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           locationId:
 *                             type: string
 *                           locationName:
 *                             type: string
 *                           address:
 *                             type: object
 *                           status:
 *                             type: string
 *                           syncEnabled:
 *                             type: boolean
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: No active Square connection
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/locations/select', requireRestaurant, SquareAuthController.selectLocations);

/**
 * @swagger
 * /api/pos/square/disconnect:
 *   post:
 *     tags:
 *       - Square OAuth
 *     summary: Disconnect Square integration
 *     description: Revokes OAuth tokens and marks connection as disconnected. Does not delete historical data.
 *     parameters:
 *       - in: header
 *         name: X-Restaurant-Id
 *         schema:
 *           type: integer
 *         required: false
 *         description: Restaurant ID (defaults to 1 in development)
 *     responses:
 *       200:
 *         description: Disconnected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Square integration disconnected successfully
 *                 data:
 *                   type: null
 *       401:
 *         description: No Square connection found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/disconnect', requireRestaurant, SquareAuthController.disconnect);

/**
 * @swagger
 * /api/pos/square/health:
 *   get:
 *     tags:
 *       - Square OAuth
 *     summary: Check Square connection health
 *     description: Verifies Square connection is operational by making a test API call.
 *     parameters:
 *       - in: header
 *         name: X-Restaurant-Id
 *         schema:
 *           type: integer
 *         required: false
 *         description: Restaurant ID (defaults to 1 in development)
 *     responses:
 *       200:
 *         description: Connection healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Square connection healthy
 *                 data:
 *                   type: object
 *       503:
 *         description: Connection unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Token expired
 *                 data:
 *                   type: object
 *       500:
 *         description: Health check failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/health', requireRestaurant, SquareAuthController.health);

// Apply Square-specific error handler to all routes
router.use(squareErrorHandler);

export default router;
