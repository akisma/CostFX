import express from 'express';
import restaurantRoutes from './restaurants.js';
import ingredientRoutes from './ingredients.js';
import recipeRoutes from './recipes.js';
import inventoryRoutes from './inventory.js';
import salesRoutes from './sales.js';
import agentRoutes from './agents.js';
import periodRoutes from './periods.js';
import varianceRoutes from './variance.js';

const router = express.Router();

// Mount all route modules
router.use('/restaurants', restaurantRoutes);
router.use('/ingredients', ingredientRoutes);
router.use('/recipes', recipeRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/sales', salesRoutes);
router.use('/agents', agentRoutes);
router.use('/periods', periodRoutes);
router.use('/variance', varianceRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Restaurant AI System API v1',
    version: '1.0.0',
    endpoints: {
      restaurants: '/api/v1/restaurants',
      ingredients: '/api/v1/ingredients',
      recipes: '/api/v1/recipes',
      inventory: '/api/v1/inventory',
      sales: '/api/v1/sales',
      agents: '/api/v1/agents',
      periods: '/api/v1/periods',
      variance: '/api/v1/variance'
    }
  });
});

export default router;