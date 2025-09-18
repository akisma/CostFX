import { vi, describe, beforeEach, test, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import agentService from '../../src/agents/AgentService.js';

// Mock AgentService
vi.mock('../../src/agents/AgentService.js', () => {
  return {
    default: {
      processRequest: vi.fn()
    }
  };
});

describe('Inventory Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/inventory/check-levels', () => {
    test('should check inventory levels successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          restaurant_id: 1,
          timestamp: new Date().toISOString(),
          analysis: {
            low_stock_items: [],
            overstocked_items: [],
            reorder_recommendations: []
          }
        }
      };

      agentService.processRequest.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/inventory/levels')
        .query({ restaurantId: '1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResponse);
      
      expect(agentService.processRequest).toHaveBeenCalledWith('InventoryAgent', {
        type: 'track_levels',
        data: { 
          restaurantId: 1,
          includeInactive: false 
        }
      });
    });

    test('should return 400 when restaurant ID is missing', async () => {
      const response = await request(app)
        .get('/api/inventory/levels');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Restaurant ID is required');
    });

    test('should handle AgentService errors', async () => {
      agentService.processRequest.mockRejectedValue(new Error('Agent processing failed'));

      const response = await request(app)
        .get('/api/inventory/levels')
        .query({ restaurantId: '1' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to track inventory levels');
    });

    test('should handle includeInactive parameter', async () => {
      const mockResponse = { inventoryItems: [], summary: {} };
      agentService.processRequest.mockResolvedValue(mockResponse);

      await request(app)
        .get('/api/inventory/levels')
        .query({ restaurantId: '1', includeInactive: 'true' });

      expect(agentService.processRequest).toHaveBeenCalledWith('InventoryAgent', {
        type: 'track_levels',
        data: { 
          restaurantId: 1,
          includeInactive: true 
        }
      });
    });
  });

  describe('GET /api/inventory/reorder-needs', () => {
    test('should return reorder predictions with default forecast days', async () => {
      const mockResponse = {
        recommendations: [
          {
            inventoryItemId: 1,
            itemName: 'Test Item',
            needsReorder: true,
            priority: 'high'
          }
        ],
        summary: {
          totalItems: 1,
          itemsNeedingReorder: 1
        }
      };

      agentService.processRequest.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/inventory/reorder-needs')
        .query({ restaurantId: '1' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResponse);
      
      expect(agentService.processRequest).toHaveBeenCalledWith('InventoryAgent', {
        type: 'predict_reorder',
        data: { 
          restaurantId: 1,
          forecastDays: 7 
        }
      });
    });

    test('should use custom forecast days when provided', async () => {
      const mockResponse = { recommendations: [], summary: {} };
      agentService.processRequest.mockResolvedValue(mockResponse);

      await request(app)
        .get('/api/inventory/reorder-needs')
        .query({ restaurantId: '1', forecastDays: '14' });

      expect(agentService.processRequest).toHaveBeenCalledWith('InventoryAgent', {
        type: 'predict_reorder',
        data: { 
          restaurantId: 1,
          forecastDays: 14 
        }
      });
    });
  });

  describe('GET /api/inventory/expiration-alerts', () => {
    test('should return expiration alerts with default warning days', async () => {
      const mockResponse = {
        alerts: [
          {
            inventoryItemId: 1,
            itemName: 'Expiring Item',
            severity: 'critical',
            daysUntilExpiration: 1
          }
        ],
        summary: {
          criticalItems: 1,
          warningItems: 0
        }
      };

      agentService.processRequest.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/inventory/expiration-alerts')
        .query({ restaurantId: '1' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResponse);
      
      expect(agentService.processRequest).toHaveBeenCalledWith('InventoryAgent', {
        type: 'monitor_expiration',
        data: { 
          restaurantId: 1,
          warningDays: 5 
        }
      });
    });
  });

  describe('GET /api/inventory/waste-analysis', () => {
    test('should return waste analysis with default timeframe', async () => {
      const mockResponse = {
        wasteAnalysis: [
          {
            itemName: 'Lettuce',
            wastePercentage: 15.5,
            severity: 'high'
          }
        ],
        recommendations: [
          {
            type: 'inventory-management',
            suggestion: 'Reduce order quantities'
          }
        ],
        summary: {
          totalTransactions: 5,
          averageWastePercentage: 8.2
        }
      };

      agentService.processRequest.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/inventory/waste-analysis')
        .query({ restaurantId: '1' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResponse);
      
      expect(agentService.processRequest).toHaveBeenCalledWith('InventoryAgent', {
        type: 'analyze_waste',
        data: { 
          restaurantId: 1,
          timeframeDays: 30 
        }
      });
    });
  });

  describe('GET /api/inventory/optimization', () => {
    test('should return stock optimization with default goal', async () => {
      const mockResponse = {
        optimizations: [
          {
            inventoryItemId: 1,
            itemName: 'Test Item',
            current: { minStock: 20, maxStock: 100 },
            optimized: { minStock: 15, maxStock: 80 },
            impact: { type: 'reduction', annualSavings: 500 }
          }
        ],
        summary: {
          totalItems: 1,
          totalAnnualSavings: 500
        }
      };

      agentService.processRequest.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/inventory/optimization')
        .query({ restaurantId: '1' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockResponse);
      
      expect(agentService.processRequest).toHaveBeenCalledWith('InventoryAgent', {
        type: 'optimize_stock',
        data: { 
          restaurantId: 1,
          optimizationGoal: 'balanced' 
        }
      });
    });

    test('should validate optimization goal parameter', async () => {
      const mockResponse = { optimizations: [], summary: {} };
      agentService.processRequest.mockResolvedValue(mockResponse);

      // Test with valid goal
      await request(app)
        .get('/api/inventory/optimization')
        .query({ restaurantId: '1', optimizationGoal: 'cost_reduction' });

      expect(agentService.processRequest).toHaveBeenCalledWith('InventoryAgent', {
        type: 'optimize_stock',
        data: { 
          restaurantId: 1,
          optimizationGoal: 'cost_reduction' 
        }
      });

      // Test with invalid goal - should default to 'balanced'
      await request(app)
        .get('/api/inventory/optimization')
        .query({ restaurantId: '1', optimizationGoal: 'invalid_goal' });

      expect(agentService.processRequest).toHaveBeenLastCalledWith('InventoryAgent', {
        type: 'optimize_stock',
        data: { 
          restaurantId: 1,
          optimizationGoal: 'balanced' 
        }
      });
    });
  });

  describe('GET /api/inventory/dashboard', () => {
    test('should return comprehensive dashboard data', async () => {
      const mockLevels = { inventoryItems: [], summary: {} };
      const mockReorders = { recommendations: [], summary: {} };
      const mockExpirations = { alerts: [], summary: {} };
      const mockWaste = { wasteAnalysis: [], summary: {} };

      agentService.processRequest
        .mockResolvedValueOnce(mockLevels)
        .mockResolvedValueOnce(mockReorders)
        .mockResolvedValueOnce(mockExpirations)
        .mockResolvedValueOnce(mockWaste);

      const response = await request(app)
        .get('/api/inventory/dashboard')
        .query({ restaurantId: '1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.inventory).toEqual(mockLevels);
      expect(response.body.data.reorderNeeds).toEqual(mockReorders);
      expect(response.body.data.expirationAlerts).toEqual(mockExpirations);
      expect(response.body.data.wasteAnalysis).toEqual(mockWaste);
      expect(response.body.data.summary).toBeDefined();

      // Should call AgentService 4 times for different data types
      expect(agentService.processRequest).toHaveBeenCalledTimes(4);
    });

    test('should handle parallel request failures gracefully', async () => {
      agentService.processRequest
        .mockResolvedValueOnce({ inventoryItems: [], summary: {} })
        .mockRejectedValueOnce(new Error('Reorder service failed'))
        .mockResolvedValueOnce({ alerts: [], summary: {} })
        .mockResolvedValueOnce({ wasteAnalysis: [], summary: {} });

      const response = await request(app)
        .get('/api/inventory/dashboard')
        .query({ restaurantId: '1' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to generate inventory dashboard');
    });
  });

  describe('Legacy routes', () => {
    test('GET /api/inventory should return API information', async () => {
      const response = await request(app)
        .get('/api/inventory');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Inventory API');
      expect(response.body.version).toBe('1.0.0');
    });

    test('POST /api/inventory/transactions should return placeholder message', async () => {
      const response = await request(app)
        .post('/api/inventory/transactions')
        .send({ test: 'data' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('transaction logging');
    });
  });

  describe('Error handling', () => {
    test('should handle missing restaurant ID consistently across endpoints', async () => {
      const endpoints = [
        '/api/inventory/levels',
        '/api/inventory/reorder-needs',
        '/api/inventory/expiration-alerts',
        '/api/inventory/waste-analysis',
        '/api/inventory/optimization',
        '/api/inventory/dashboard'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Restaurant ID is required');
      }
    });

    test('should handle AgentService errors consistently', async () => {
      agentService.processRequest.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .get('/api/inventory/levels')
        .query({ restaurantId: '1' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.details).toBe('Service unavailable');
    });

    test('should handle invalid restaurant ID format', async () => {
      agentService.processRequest.mockResolvedValue({ inventoryItems: [], summary: {} });

      const response = await request(app)
        .get('/api/inventory/levels')
        .query({ restaurantId: 'invalid' });

      expect(response.status).toBe(200); // Should still work, parseInt will handle conversion
      
      expect(agentService.processRequest).toHaveBeenCalledWith('InventoryAgent', {
        type: 'track_levels',
        data: { 
          restaurantId: NaN, // parseInt('invalid') returns NaN
          includeInactive: false 
        }
      });
    });
  });

  describe('Parameter validation', () => {
    test('should convert string parameters to numbers correctly', async () => {
      const mockResponse = { recommendations: [], summary: {} };
      agentService.processRequest.mockResolvedValue(mockResponse);

      await request(app)
        .get('/api/inventory/reorder-needs')
        .query({ restaurantId: '123', forecastDays: '14' });

      expect(agentService.processRequest).toHaveBeenCalledWith('InventoryAgent', {
        type: 'predict_reorder',
        data: { 
          restaurantId: 123,
          forecastDays: 14 
        }
      });
    });

    test('should handle boolean parameters correctly', async () => {
      const mockResponse = { inventoryItems: [], summary: {} };
      agentService.processRequest.mockResolvedValue(mockResponse);

      await request(app)
        .get('/api/inventory/levels')
        .query({ restaurantId: '1', includeInactive: 'true' });

      expect(agentService.processRequest).toHaveBeenCalledWith('InventoryAgent', {
        type: 'track_levels',
        data: { 
          restaurantId: 1,
          includeInactive: true 
        }
      });

      await request(app)
        .get('/api/inventory/levels')
        .query({ restaurantId: '1', includeInactive: 'false' });

      expect(agentService.processRequest).toHaveBeenLastCalledWith('InventoryAgent', {
        type: 'track_levels',
        data: { 
          restaurantId: 1,
          includeInactive: false 
        }
      });
    });
  });
});
