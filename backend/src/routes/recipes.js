import express from 'express';

const router = express.Router();

/**
 * @swagger
 * /api/v1/recipes:
 *   get:
 *     tags:
 *       - Recipes
 *     summary: Get all recipes
 *     description: Retrieve a list of all recipes with ingredients and costs
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter recipes by name
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by recipe category (appetizer, entree, dessert, etc.)
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
 *         description: Successfully retrieved recipes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Recipes endpoint
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', (req, res) => {
  res.json({ message: 'Recipes endpoint' });
});

/**
 * @swagger
 * /api/v1/recipes:
 *   post:
 *     tags:
 *       - Recipes
 *     summary: Create a new recipe
 *     description: Add a new recipe with ingredients and preparation instructions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - ingredients
 *             properties:
 *               name:
 *                 type: string
 *                 example: Margherita Pizza
 *               category:
 *                 type: string
 *                 example: entree
 *               description:
 *                 type: string
 *                 example: Classic Italian pizza with tomatoes and mozzarella
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     ingredientId:
 *                       type: integer
 *                       example: 1
 *                     quantity:
 *                       type: number
 *                       format: float
 *                       example: 0.5
 *                     unit:
 *                       type: string
 *                       example: lbs
 *               preparationTime:
 *                 type: integer
 *                 example: 30
 *                 description: Preparation time in minutes
 *               cookingTime:
 *                 type: integer
 *                 example: 15
 *                 description: Cooking time in minutes
 *               servings:
 *                 type: integer
 *                 example: 4
 *               instructions:
 *                 type: string
 *                 example: Roll out dough, add sauce and toppings, bake at 450°F for 15 minutes
 *     responses:
 *       201:
 *         description: Recipe created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Create recipe
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
  res.json({ message: 'Create recipe' });
});

/**
 * @swagger
 * /api/v1/recipes/{id}:
 *   get:
 *     tags:
 *       - Recipes
 *     summary: Get recipe by ID
 *     description: Retrieve detailed information about a specific recipe including cost breakdown
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Recipe ID
 *     responses:
 *       200:
 *         description: Successfully retrieved recipe
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Get recipe 1
 *       404:
 *         description: Recipe not found
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
  res.json({ message: `Get recipe ${req.params.id}` });
});

export default router;