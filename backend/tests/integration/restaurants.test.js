import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Restaurant API Integration Tests', () => {
  describe('GET /api/v1/restaurants', () => {
    test('should return list of restaurants', async () => {
      const response = await request(app)
        .get('/api/v1/restaurants')
        .expect(200);

      expect(response.body).toHaveProperty('restaurants');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.restaurants)).toBe(true);
    });

    test('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/api/v1/restaurants?page=1&limit=5')
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
    });
  });

  describe('GET /api/v1/restaurants/:id', () => {
    test('should return restaurant details for valid ID', async () => {
      // First get a restaurant to test with
      const listResponse = await request(app)
        .get('/api/v1/restaurants')
        .expect(200);

      if (listResponse.body.restaurants.length > 0) {
        const restaurantId = listResponse.body.restaurants[0].id;
        
        const response = await request(app)
          .get(`/api/v1/restaurants/${restaurantId}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', restaurantId);
        expect(response.body).toHaveProperty('name');
        expect(response.body).toHaveProperty('location');
      }
    });

    test('should return 404 for non-existent restaurant', async () => {
      const response = await request(app)
        .get('/api/v1/restaurants/99999')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should return 400 for invalid restaurant ID', async () => {
      const response = await request(app)
        .get('/api/v1/restaurants/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
