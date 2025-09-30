import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

/**
 * Basic API Test - Just verify routes are mounted correctly
 */
describe('Basic API Test', () => {
  test('should respond to basic health check', async () => {
    const response = await request(app)
      .get('/api/v1')
      .expect(200);

    expect(response.body).toBeDefined();
  });

  test('should have periods routes mounted', async () => {
    // This should return 400 (validation error) not 404 (not found)
    const response = await request(app)
      .post('/api/v1/periods')
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Validation error');
  });
});
