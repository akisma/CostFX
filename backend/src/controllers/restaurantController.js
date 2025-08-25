import { Op } from 'sequelize';
import Restaurant from '../models/Restaurant.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export async function getAllRestaurants(req, res, next) {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where.name = {
        [Op.iLike]: `%${search}%`
      };
    }

    const restaurants = await Restaurant.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['name', 'ASC']]
    });

    res.json({
      data: restaurants.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(restaurants.count / limit),
        totalItems: restaurants.count,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getRestaurantById(req, res, next) {
  try {
    const { id } = req.params;
    
    const restaurant = await Restaurant.findByPk(id, {
      include: [
        { association: 'recipes', where: { isActive: true }, required: false }
      ]
    });

    if (!restaurant) {
      throw new NotFoundError('Restaurant not found');
    }

    res.json({ data: restaurant });
  } catch (error) {
    next(error);
  }
}

export async function createRestaurant(req, res, next) {
  try {
    const { name, location, cuisineType, phone, email, settings } = req.body;

    if (!name) {
      throw new ValidationError('Restaurant name is required');
    }

    const restaurant = await Restaurant.create({
      name,
      location,
      cuisineType,
      phone,
      email,
      settings: settings || {}
    });

    logger.info(`Restaurant created: ${restaurant.name}`, { restaurantId: restaurant.id });
    
    res.status(201).json({ 
      data: restaurant,
      message: 'Restaurant created successfully'
    });
  } catch (error) {
    next(error);
  }
}

export async function updateRestaurant(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const restaurant = await Restaurant.findByPk(id);
    if (!restaurant) {
      throw new NotFoundError('Restaurant not found');
    }

    await restaurant.update(updates);
    
    logger.info(`Restaurant updated: ${restaurant.name}`, { restaurantId: restaurant.id });
    
    res.json({ 
      data: restaurant,
      message: 'Restaurant updated successfully'
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteRestaurant(req, res, next) {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findByPk(id);
    if (!restaurant) {
      throw new NotFoundError('Restaurant not found');
    }

    // Soft delete by setting isActive to false
    await restaurant.update({ isActive: false });
    
    logger.info(`Restaurant deleted: ${restaurant.name}`, { restaurantId: restaurant.id });
    
    res.json({ message: 'Restaurant deleted successfully' });
  } catch (error) {
    next(error);
  }
}