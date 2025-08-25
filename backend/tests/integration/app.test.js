import request from 'supertest';
import app from '../../src/app.js';

describe('App Integration Tests', () => {
  describe('Health Check', () => {
    test('GET /health should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('API Routes', () => {
    test('GET /api/v1 should return API info', async () => {
      const response = await request(app)
        .get('/api/v1')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('endpoints');
    });

    test('GET /invalid-route should return 404', async () => {
      const response = await request(app)
        .get('/invalid-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not Found');
    });
  });

  describe('CORS and Security', () => {
    test('should have CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    test('should have security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });
});
