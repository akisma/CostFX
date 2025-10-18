import express from 'express';

const router = express.Router();

/**
 * @swagger
 * /api/v1/ingredients:
 *   get:
 *     tags:
 *       - Ingredients
 *     summary: Get all ingredients
 *     description: Retrieve a list of all ingredients in the catalog
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter ingredients by name
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by ingredient category
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
 *           default: 50
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: Successfully retrieved ingredients
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Ingredients endpoint
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', (req, res) => {
  res.json({ message: 'Ingredients endpoint' });
});

/**
 * @swagger
 * /api/v1/ingredients:
 *   post:
 *     tags:
 *       - Ingredients
 *     summary: Create a new ingredient
 *     description: Add a new ingredient to the catalog
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - unit
 *             properties:
 *               name:
 *                 type: string
 *                 example: Organic Tomatoes
 *               category:
 *                 type: string
 *                 example: produce
 *               unit:
 *                 type: string
 *                 example: lbs
 *               unitCost:
 *                 type: number
 *                 format: float
 *                 example: 2.50
 *               description:
 *                 type: string
 *                 example: Fresh organic tomatoes from local farm
 *     responses:
 *       201:
 *         description: Ingredient created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Create ingredient
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
router.post('/', (req, res) => {
  res.json({ message: 'Create ingredient' });
});

/**
 * @swagger
 * /api/v1/ingredients/{id}:
 *   get:
 *     tags:
 *       - Ingredients
 *     summary: Get ingredient by ID
 *     description: Retrieve detailed information about a specific ingredient
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Ingredient ID
 *     responses:
 *       200:
 *         description: Successfully retrieved ingredient
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Get ingredient 1
 *       404:
 *         description: Ingredient not found
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
router.get('/:id', (req, res) => {
  res.json({ message: `Get ingredient ${req.params.id}` });
});

export default router;