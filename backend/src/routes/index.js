import express from 'express';
import restaurantRoutes from './restaurants.js';
import ingredientRoutes from './ingredients.js';
import recipeRoutes from './recipes.js';
import inventoryRoutes from './inventory.js';
import salesRoutes from './sales.js';
import agentRoutes from './agents.js';
import periodRoutes from './periods.js';
import varianceRoutes from './variance.js';
import squareRoutes from './pos/square/index.js'; // RESTful Square routes

const router = express.Router();

// Core resource routes
router.use('/restaurants', restaurantRoutes);
router.use('/ingredients', ingredientRoutes);
router.use('/recipes', recipeRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/sales', salesRoutes);
router.use('/agents', agentRoutes);
router.use('/periods', periodRoutes);
router.use('/variance', varianceRoutes);

// RESTful Square POS routes (Issue #16, #20, #21, #46)
router.use('/pos/square', squareRoutes);

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
      variance: '/api/v1/variance',
      // POS Integration (Square)
      square: {
        connections: '/api/v1/pos/square/connections',
        inventory: '/api/v1/pos/square/inventory',
        sales: '/api/v1/pos/square/sales'
      }
    }
  });
});

export default router;