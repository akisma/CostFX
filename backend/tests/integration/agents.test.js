import request from 'supertest';
import app from '../../src/app.js';

describe('AI Agents API Integration Tests', () => {
  describe('POST /api/v1/agents/query', () => {
    test('should handle agent queries', async () => {
      const queryData = {
        agent: 'CostAgent',
        query: 'What are the cost trends?',
        context: { period: '30d' },
        restaurantId: 1
      };

      const response = await request(app)
        .post('/api/v1/agents/query')
        .send(queryData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('agent', 'CostAgent');
      expect(response.body).toHaveProperty('result');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should validate required fields', async () => {
      const invalidData = {
        query: 'Test query'
        // Missing restaurantId field
      };

      const response = await request(app)
        .post('/api/v1/agents/query')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Restaurant ID is required');
    });

    test('should handle missing query', async () => {
      const invalidData = {
        restaurantId: 1
        // Missing query field
      };

      const response = await request(app)
        .post('/api/v1/agents/query')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Query is required');
    });
  });

  describe('GET /api/v1/agents/insights/:restaurantId', () => {
    test('should return AI insights for restaurant', async () => {
      const restaurantId = 1;
      
      const response = await request(app)
        .get(`/api/v1/agents/insights/${restaurantId}`)
        .expect(200);

      expect(response.body).toHaveProperty('restaurantId', restaurantId);
      expect(response.body).toHaveProperty('insights');
      expect(response.body).toHaveProperty('generated_at');
      expect(response.body).toHaveProperty('total_insights');
      expect(Array.isArray(response.body.insights)).toBe(true);
    });

    test('should handle invalid restaurant ID', async () => {
      const response = await request(app)
        .get('/api/v1/agents/insights/invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Valid restaurant ID is required');
    });
  });

  describe('POST /api/v1/agents/cost/recipe', () => {
    test('should calculate recipe cost', async () => {
      const recipeData = {
        restaurantId: 1,
        recipeId: 'recipe_001',
        ingredients: [
          { name: 'Tomato', quantity: 2, unit: 'lbs', costPerUnit: 3.50 },
          { name: 'Cheese', quantity: 1, unit: 'lb', costPerUnit: 8.00 },
          { name: 'Flour', quantity: 3, unit: 'cups', costPerUnit: 0.50 }
        ],
        portions: 8
      };

      const response = await request(app)
        .post('/api/v1/agents/cost/recipe')
        .send(recipeData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('costAnalysis');
      expect(response.body.result.costAnalysis).toHaveProperty('totalCost');
      expect(response.body.result.costAnalysis).toHaveProperty('costPerPortion');
    });

    test('should validate required fields for recipe cost', async () => {
      const invalidData = {
        restaurantId: 1
        // Missing ingredients
      };

      const response = await request(app)
        .post('/api/v1/agents/cost/recipe')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Ingredients array is required');
    });
  });

  describe('POST /api/v1/agents/cost/margins', () => {
    test('should analyze menu margins', async () => {
      const marginData = {
        restaurantId: 1,
        menuItems: [
          { name: 'Margherita Pizza', sellingPrice: 18.00, cost: 7.50, salesVolume: 10 },
          { name: 'Caesar Salad', sellingPrice: 12.00, cost: 4.80, salesVolume: 5 }
        ]
      };

      const response = await request(app)
        .post('/api/v1/agents/cost/margins')
        .send(marginData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('marginAnalysis');
      expect(response.body.result.marginAnalysis).toHaveProperty('items');
      expect(response.body.result.marginAnalysis).toHaveProperty('overall');
    });
  });

  describe('GET /api/v1/agents/health', () => {
    test('should return agent system health', async () => {
      const response = await request(app)
        .get('/api/v1/agents/health')
        .expect(200);

      expect(response.body).toHaveProperty('overall');
      expect(response.body).toHaveProperty('agents');
      expect(['healthy', 'warning', 'critical']).toContain(response.body.overall);
    });
  });

  describe('GET /api/v1/agents/status', () => {
    test('should return agent statuses', async () => {
      const response = await request(app)
        .get('/api/v1/agents/status')
        .expect(200);

      expect(response.body).toHaveProperty('agents');
      expect(response.body).toHaveProperty('manager');
      expect(response.body.manager).toHaveProperty('totalAgents');
      expect(response.body.manager).toHaveProperty('activeAgents');
    });
  });
});
