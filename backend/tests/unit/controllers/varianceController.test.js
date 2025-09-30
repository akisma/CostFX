import { describe, test, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import varianceRoutes from '../../../src/routes/variance.js';

/**
 * Variance Controller Tests - Task 10
 * 
 * Controller-level tests with mocked InventoryVarianceAgent as specified:
 * "controller-level - just no db integration tests. everything should be mocked"
 * 
 * Tests the thin controller wrappers around InventoryVarianceAgent methods.
 */

// Mock the InventoryVarianceAgent
vi.mock('../../../src/agents/InventoryVarianceAgent.js', () => {
  const MockInventoryVarianceAgent = vi.fn();
  MockInventoryVarianceAgent.prototype.process = vi.fn();
  return { default: MockInventoryVarianceAgent };
});

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/variance', varianceRoutes);

// Mock auth middleware - set up fake user context
app.use((req, res, next) => {
  req.user = { restaurantId: 1 };
  next();
});

describe('Variance Controller', () => {
  let mockAgent;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Get the mock agent instance
    const InventoryVarianceAgent = await import('../../../src/agents/InventoryVarianceAgent.js');
    mockAgent = new InventoryVarianceAgent.default();
  });

  describe('POST /api/v1/variance/period-analysis', () => {
    test('should analyze period variance successfully', async () => {
      // Mock agent responses
      const mockVarianceResult = {
        success: true,
        periodId: 1,
        method: 'recipe_based',
        summary: {
          itemsProcessed: 10,
          itemsSkipped: 0,
          totalErrors: 0,
          highPriorityVariances: 2,
          totalVarianceDollarValue: 150.75
        },
        analyses: [
          {
            itemId: 1,
            itemName: 'Tomatoes',
            theoretical: 5.0,
            actual: 6.2,
            variance: 1.2,
            variancePercentage: 24.0,
            varianceDollarValue: 25.50,
            priority: 'high',
            confidence: 0.85
          },
          {
            itemId: 2,
            itemName: 'Onions',
            theoretical: 3.0,
            actual: 2.8,
            variance: -0.2,
            variancePercentage: -6.7,
            varianceDollarValue: -5.25,
            priority: 'low',
            confidence: 0.92
          }
        ],
        insights: {
          overallTrend: 'mixed',
          highestVarianceItem: 'Tomatoes',
          recommendations: ['Check portion control for high-variance items']
        },
        errors: [],
        calculatedAt: '2024-01-01T12:00:00.000Z'
      };

      const mockPeriodAnalysis = {
        success: true,
        analysis: {
          periodId: 1,
          overview: {
            totalItems: 10,
            totalVarianceDollarValue: 150.75,
            averageConfidence: 0.88
          },
          priorityBreakdown: {
            critical: 0,
            high: 2,
            medium: 3,
            low: 5
          },
          methodBreakdown: {
            recipe_based: 8,
            historical_average: 2
          },
          recommendations: [
            {
              type: 'portion_control',
              priority: 'high',
              message: 'Review portion control procedures'
            }
          ]
        }
      };

      // Set up mock calls
      mockAgent.process
        .mockResolvedValueOnce(mockVarianceResult)  // First call: calculate_usage_variance
        .mockResolvedValueOnce(mockPeriodAnalysis); // Second call: analyze_period_variance

      const response = await request(app)
        .post('/api/v1/variance/period-analysis')
        .send({
          periodId: 1,
          method: 'recipe_based',
          includeInsights: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.periodId).toBe(1);
      expect(response.body.data.method).toBe('recipe_based');
      expect(response.body.data.analysisType).toBe('period_variance');
      expect(response.body.data.summary.itemsProcessed).toBe(10);
      expect(response.body.data.analyses).toHaveLength(2);
      expect(response.body.data.insights).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
      expect(response.body.meta.calculatedAt).toBe('2024-01-01T12:00:00.000Z');

      // Verify agent was called correctly
      expect(mockAgent.process).toHaveBeenCalledTimes(2);
      expect(mockAgent.process).toHaveBeenNthCalledWith(1, {
        type: 'calculate_usage_variance',
        data: {
          periodId: 1,
          method: 'recipe_based',
          itemIds: null,
          recalculate: false,
          restaurantId: 1
        }
      });
      expect(mockAgent.process).toHaveBeenNthCalledWith(2, {
        type: 'analyze_period_variance',
        data: { periodId: 1 }
      });
    });

    test('should filter analyses by priority when specified', async () => {
      const mockVarianceResult = {
        success: true,
        analyses: [
          { itemId: 1, priority: 'high', varianceDollarValue: 25.50 },
          { itemId: 2, priority: 'low', varianceDollarValue: -5.25 },
          { itemId: 3, priority: 'high', varianceDollarValue: 15.00 }
        ],
        summary: { itemsProcessed: 3, totalErrors: 0 },
        errors: [],
        calculatedAt: '2024-01-01T12:00:00.000Z'
      };

      const mockPeriodAnalysis = {
        success: true,
        analysis: { overview: {}, priorityBreakdown: {}, methodBreakdown: {} }
      };

      mockAgent.process
        .mockResolvedValueOnce(mockVarianceResult)
        .mockResolvedValueOnce(mockPeriodAnalysis);

      const response = await request(app)
        .post('/api/v1/variance/period-analysis')
        .send({
          periodId: 1,
          priority: 'high'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.analyses).toHaveLength(2); // Only high priority items
      expect(response.body.data.summary.filteredItemCount).toBe(2);
      expect(response.body.data.summary.filter.priority).toBe('high');
    });

    test('should validate request data', async () => {
      const response = await request(app)
        .post('/api/v1/variance/period-analysis')
        .send({
          periodId: 'invalid',
          method: 'invalid_method'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toHaveLength(2);
    });

    test('should handle agent errors gracefully', async () => {
      mockAgent.process.mockRejectedValue(new Error('Agent processing failed'));

      const response = await request(app)
        .post('/api/v1/variance/period-analysis')
        .send({ periodId: 1 })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to analyze period variance');
    });
  });

  describe('GET /api/v1/variance/categories', () => {
    test('should get category variance breakdown successfully', async () => {
      const mockVarianceResult = {
        success: true,
        analyses: [
          {
            itemId: 1,
            itemName: 'Tomatoes',
            varianceDollarValue: 25.50,
            variancePercentage: 24.0,
            priority: 'high',
            item: { category_path: 'ingredients.vegetables.fresh' }
          },
          {
            itemId: 2,
            itemName: 'Onions',
            varianceDollarValue: -5.25,
            variancePercentage: -6.7,
            priority: 'low',
            item: { category_path: 'ingredients.vegetables.fresh' }
          },
          {
            itemId: 3,
            itemName: 'Chicken Breast',
            varianceDollarValue: 45.00,
            variancePercentage: 15.0,
            priority: 'medium',
            item: { category_path: 'ingredients.proteins.poultry' }
          }
        ],
        errors: [],
        calculatedAt: '2024-01-01T12:00:00.000Z'
      };

      mockAgent.process.mockResolvedValue(mockVarianceResult);

      const response = await request(app)
        .get('/api/v1/variance/categories')
        .query({
          periodId: 1,
          sortBy: 'variance_amount',
          sortOrder: 'desc'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.periodId).toBe(1);
      expect(response.body.data.analysisType).toBe('category_breakdown');
      expect(response.body.data.summary.totalCategories).toBe(2); // vegetables and proteins
      expect(response.body.data.summary.totalItems).toBe(3);
      expect(response.body.data.categories).toHaveLength(2);
      
      // Check category structure
      const categoriesMap = new Map(response.body.data.categories.map(c => [c.categoryName, c]));
      expect(categoriesMap.has('vegetables')).toBe(true);
      expect(categoriesMap.has('proteins')).toBe(true);
      
      const vegetablesCategory = categoriesMap.get('vegetables');
      expect(vegetablesCategory.itemCount).toBe(2);
      expect(vegetablesCategory.items).toHaveLength(2);
    });

    test('should filter by priority', async () => {
      const mockVarianceResult = {
        success: true,
        analyses: [
          { itemId: 1, priority: 'high', varianceDollarValue: 25.50, item: { category_path: 'ingredients.vegetables' } },
          { itemId: 2, priority: 'low', varianceDollarValue: -5.25, item: { category_path: 'ingredients.vegetables' } }
        ],
        errors: [],
        calculatedAt: '2024-01-01T12:00:00.000Z'
      };

      mockAgent.process.mockResolvedValue(mockVarianceResult);

      const response = await request(app)
        .get('/api/v1/variance/categories')
        .query({
          periodId: 1,
          priority: 'high'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalItems).toBe(1); // Only high priority items
      expect(response.body.data.filters.priority).toBe('high');
    });

    test('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/v1/variance/categories')
        .query({
          periodId: 'invalid',
          priority: 'invalid_priority'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toHaveLength(2);
    });
  });

  describe('GET /api/v1/variance/summary/:periodId', () => {
    test('should get priority variance summary successfully', async () => {
      const mockSummaryResult = {
        success: true,
        summary: {
          periodId: 1,
          priority: 'critical',
          variances: [
            {
              itemId: 1,
              itemName: 'High Value Item',
              varianceDollarValue: 200.00,
              priority: 'critical'
            }
          ],
          totalImpact: 200.00,
          investigationRequired: 1,
          recommendations: [
            {
              type: 'immediate_investigation',
              count: 1,
              message: 'Critical variances detected requiring immediate investigation'
            }
          ],
          generatedAt: '2024-01-01T12:00:00.000Z'
        }
      };

      mockAgent.process.mockResolvedValue(mockSummaryResult);

      const response = await request(app)
        .get('/api/v1/variance/summary/1')
        .query({ priority: 'critical' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.periodId).toBe(1);
      expect(response.body.data.priority).toBe('critical');
      expect(response.body.data.summary.totalImpact).toBe(200.00);
      expect(response.body.data.summary.investigationRequired).toBe(1);

      expect(mockAgent.process).toHaveBeenCalledWith({
        type: 'priority_variance_summary',
        data: {
          periodId: 1,
          priority: 'critical'
        }
      });
    });

    test('should validate period ID parameter', async () => {
      const response = await request(app)
        .get('/api/v1/variance/summary/invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /api/v1/variance/trends', () => {
    test('should get historical variance trends successfully', async () => {
      const mockTrendsResult = {
        success: true,
        trends: [
          {
            periodId: 1,
            date: '2024-01-01',
            totalVarianceDollarValue: 150.75,
            itemCount: 10
          },
          {
            periodId: 2,
            date: '2024-01-08',
            totalVarianceDollarValue: 125.50,
            itemCount: 12
          }
        ],
        summary: {
          averageVariance: 138.13,
          trend: 'improving'
        }
      };

      mockAgent.process.mockResolvedValue(mockTrendsResult);

      const response = await request(app)
        .get('/api/v1/variance/trends')
        .query({
          restaurantId: 1,
          periodCount: 6
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.restaurantId).toBe(1);
      expect(response.body.data.periodCount).toBe(6);
      expect(response.body.data.trends).toBeDefined();

      expect(mockAgent.process).toHaveBeenCalledWith({
        type: 'historical_variance_trends',
        data: {
          restaurantId: 1,
          itemIds: null,
          periodCount: 6
        }
      });
    });

    test('should handle itemIds parameter correctly', async () => {
      const mockTrendsResult = { success: true, trends: [] };
      mockAgent.process.mockResolvedValue(mockTrendsResult);

      const response = await request(app)
        .get('/api/v1/variance/trends')
        .query({
          restaurantId: 1,
          itemIds: [1, 2, 3]
        })
        .expect(200);

      expect(response.body.data.itemIds).toEqual([1, 2, 3]);
      expect(mockAgent.process).toHaveBeenCalledWith({
        type: 'historical_variance_trends',
        data: {
          restaurantId: 1,
          itemIds: [1, 2, 3],
          periodCount: 6
        }
      });
    });

    test('should validate required parameters', async () => {
      const response = await request(app)
        .get('/api/v1/variance/trends')
        .query({
          periodCount: 6
          // Missing restaurantId
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('Error Handling', () => {
    test('should handle agent initialization errors', async () => {
      mockAgent.process.mockRejectedValue(new Error('Agent not initialized'));

      const response = await request(app)
        .post('/api/v1/variance/period-analysis')
        .send({ periodId: 1 })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to analyze period variance');
    });

    test('should include errors in response when agent returns errors', async () => {
      const mockResultWithErrors = {
        success: true,
        analyses: [],
        summary: { itemsProcessed: 0, totalErrors: 2 },
        errors: [
          'Item 1: Missing recipe data',
          'Item 2: Invalid snapshot data'
        ],
        calculatedAt: '2024-01-01T12:00:00.000Z'
      };

      const mockPeriodAnalysis = {
        success: true,
        analysis: { overview: {}, priorityBreakdown: {}, methodBreakdown: {} }
      };

      mockAgent.process
        .mockResolvedValueOnce(mockResultWithErrors)
        .mockResolvedValueOnce(mockPeriodAnalysis);

      const response = await request(app)
        .post('/api/v1/variance/period-analysis')
        .send({ periodId: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.meta.hasErrors).toBe(true);
      expect(response.body.meta.errorCount).toBe(2);
      expect(response.body.errors).toHaveLength(2);
    });
  });
});
