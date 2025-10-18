import express from 'express';
import { 
  getAllRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant
} from '../controllers/restaurantController.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/restaurants:
 *   get:
 *     tags:
 *       - Restaurants
 *     summary: Get all restaurants
 *     description: Retrieve a list of all restaurants with pagination support
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: Successfully retrieved restaurants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 restaurants:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Restaurant'
 *                 total:
 *                   type: integer
 *                   example: 1
 *             example:
 *               restaurants:
 *                 - id: 1
 *                   name: Demo Restaurant
 *                   address: 123 Main St
 *                   city: San Francisco
 *                   state: CA
 *                   zipCode: "94102"
 *                   phone: "555-1234"
 *                   email: demo@restaurant.com
 *                   createdAt: "2024-01-01T00:00:00.000Z"
 *                   updatedAt: "2024-01-01T00:00:00.000Z"
 *               total: 1
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', getAllRestaurants);

/**
 * @swagger
 * /api/v1/restaurants/{id}:
 *   get:
 *     tags:
 *       - Restaurants
 *     summary: Get restaurant by ID
 *     description: Retrieve detailed information about a specific restaurant
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Successfully retrieved restaurant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Restaurant'
 *       400:
 *         description: Invalid restaurant ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Restaurant not found
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
router.get('/:id', getRestaurantById);

/**
 * @swagger
 * /api/v1/restaurants:
 *   post:
 *     tags:
 *       - Restaurants
 *     summary: Create a new restaurant
 *     description: Create a new restaurant with the provided information
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: New Restaurant
 *               address:
 *                 type: string
 *                 example: 456 Oak Ave
 *               city:
 *                 type: string
 *                 example: Los Angeles
 *               state:
 *                 type: string
 *                 example: CA
 *               zipCode:
 *                 type: string
 *                 example: "90001"
 *               phone:
 *                 type: string
 *                 example: "555-5678"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: contact@newrestaurant.com
 *     responses:
 *       201:
 *         description: Restaurant created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Restaurant'
 *       400:
 *         description: Invalid request body
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
router.post('/', createRestaurant);

/**
 * @swagger
 * /api/v1/restaurants/{id}:
 *   put:
 *     tags:
 *       - Restaurants
 *     summary: Update a restaurant
 *     description: Update an existing restaurant's information
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Restaurant Name
 *               address:
 *                 type: string
 *                 example: 789 Pine St
 *               city:
 *                 type: string
 *                 example: San Diego
 *               state:
 *                 type: string
 *                 example: CA
 *               zipCode:
 *                 type: string
 *                 example: "92101"
 *               phone:
 *                 type: string
 *                 example: "555-9012"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: updated@restaurant.com
 *     responses:
 *       200:
 *         description: Restaurant updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Restaurant'
 *       400:
 *         description: Invalid request body or restaurant ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Restaurant not found
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
router.put('/:id', updateRestaurant);

/**
 * @swagger
 * /api/v1/restaurants/{id}:
 *   delete:
 *     tags:
 *       - Restaurants
 *     summary: Delete a restaurant
 *     description: Delete a restaurant and all associated data
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Restaurant deleted successfully
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
 *                   example: Restaurant deleted successfully
 *       400:
 *         description: Invalid restaurant ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Restaurant not found
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
router.delete('/:id', deleteRestaurant);

export default router;