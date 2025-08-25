import express from 'express';
import { 
  getAllRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant
} from '../controllers/restaurantController.js';

const router = express.Router();

// GET /api/v1/restaurants
router.get('/', getAllRestaurants);

// GET /api/v1/restaurants/:id
router.get('/:id', getRestaurantById);

// POST /api/v1/restaurants
router.post('/', createRestaurant);

// PUT /api/v1/restaurants/:id
router.put('/:id', updateRestaurant);

// DELETE /api/v1/restaurants/:id
router.delete('/:id', deleteRestaurant);

export default router;