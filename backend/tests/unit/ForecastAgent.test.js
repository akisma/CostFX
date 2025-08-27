import { jest } from '@jest/globals';
import ForecastAgent from '../../src/agents/ForecastAgent.js';

describe('ForecastAgent', () => {
  let forecastAgent;
  
  beforeEach(() => {
    forecastAgent = new ForecastAgent();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with correct name and capabilities', () => {
      expect(forecastAgent.name).toBe('ForecastAgent');
      expect(forecastAgent.capabilities).toEqual([
        'forecast_demand',
        'analyze_seasonal_trends',
        'predict_revenue',
        'optimize_capacity',
        'forecast_ingredients'
      ]);
    });

    test('should initialize with default configuration', () => {
      expect(forecastAgent.config).toEqual({
        defaultForecastDays: 30,
        seasonalFactors: {
          spring: { multiplier: 1.1, peak_months: [3, 4, 5] },
          summer: { multiplier: 1.25, peak_months: [6, 7, 8] },
          fall: { multiplier: 1.05, peak_months: [9, 10, 11] },
          winter: { multiplier: 0.9, peak_months: [12, 1, 2] }
        },
        weekdayFactors: {
          monday: 0.8,
          tuesday: 0.85,
          wednesday: 0.9,
          thursday: 1.0,
          friday: 1.3,
          saturday: 1.4,
          sunday: 1.1
        },
        confidenceThresholds: {
          high: 0.85,
          medium: 0.65,
          low: 0.45
        }
      });
    });
  });

  describe('process method', () => {
    test('should route forecast_demand request correctly', async () => {
      const mockResult = { itemForecasts: [], summary: {} };
      jest.spyOn(forecastAgent, 'forecastDemand').mockResolvedValue(mockResult);

      const request = {
        type: 'forecast_demand',
        data: { restaurantId: 1, forecastDays: 7 }
      };

      const result = await forecastAgent.process(request);
      
      expect(forecastAgent.forecastDemand).toHaveBeenCalledWith({ restaurantId: 1, forecastDays: 7 });
      expect(result).toBe(mockResult);
      expect(forecastAgent.metrics.requests).toBe(1);
    });

    test('should route analyze_seasonal_trends request correctly', async () => {
      const mockResult = { seasonalTrends: {}, recommendations: [] };
      jest.spyOn(forecastAgent, 'analyzeSeasonalTrends').mockResolvedValue(mockResult);

      const request = {
        type: 'analyze_seasonal_trends',
        data: { restaurantId: 1 }
      };

      const result = await forecastAgent.process(request);
      
      expect(forecastAgent.analyzeSeasonalTrends).toHaveBeenCalledWith({ restaurantId: 1 });
      expect(result).toBe(mockResult);
    });

    test('should route predict_revenue request correctly', async () => {
      const mockResult = { totalProjections: {}, insights: [] };
      jest.spyOn(forecastAgent, 'predictRevenue').mockResolvedValue(mockResult);

      const request = {
        type: 'predict_revenue',
        data: { restaurantId: 1, scenario: 'optimistic' }
      };

      const result = await forecastAgent.process(request);
      
      expect(forecastAgent.predictRevenue).toHaveBeenCalledWith({ restaurantId: 1, scenario: 'optimistic' });
      expect(result).toBe(mockResult);
    });

    test('should throw error for unknown request type', async () => {
      const request = {
        type: 'unknown_type',
        data: { restaurantId: 1 }
      };

      await expect(forecastAgent.process(request)).rejects.toThrow('Unknown request type: unknown_type');
    });

    test('should update metrics on successful request', async () => {
      const mockResult = { itemForecasts: [] };
      jest.spyOn(forecastAgent, 'forecastDemand').mockResolvedValue(mockResult);
      jest.spyOn(forecastAgent, 'updateMetrics').mockImplementation(() => {});

      const request = {
        type: 'forecast_demand',
        data: { restaurantId: 1 }
      };

      await forecastAgent.process(request);
      
      expect(forecastAgent.updateMetrics).toHaveBeenCalledWith(expect.any(Number), true);
    });

    test('should update metrics on failed request', async () => {
      jest.spyOn(forecastAgent, 'forecastDemand').mockRejectedValue(new Error('Test error'));
      jest.spyOn(forecastAgent, 'updateMetrics').mockImplementation(() => {});

      const request = {
        type: 'forecast_demand',
        data: { restaurantId: 1 }
      };

      await expect(forecastAgent.process(request)).rejects.toThrow('Test error');
      expect(forecastAgent.updateMetrics).toHaveBeenCalledWith(expect.any(Number), false);
    });
  });

  describe('forecastDemand', () => {
    test('should generate demand forecasts for menu items', async () => {
      const mockHistoricalData = [
        {
          itemId: 1,
          itemName: 'Classic Burger',
          historicalSales: [
            { date: '2024-08-20', quantity: 25 },
            { date: '2024-08-21', quantity: 30 },
            { date: '2024-08-22', quantity: 22 }
          ],
          trend: 0.1,
          seasonality: 'summer_peak',
          historicalVariance: 0.15
        }
      ];

      jest.spyOn(forecastAgent, 'getHistoricalSalesData').mockResolvedValue(mockHistoricalData);

      const result = await forecastAgent.forecastDemand({ 
        restaurantId: 1, 
        forecastDays: 7,
        includeConfidenceIntervals: true 
      });

      expect(result.restaurantId).toBe(1);
      expect(result.forecastPeriod.days).toBe(7);
      expect(result.itemForecasts).toHaveLength(1);
      expect(result.itemForecasts[0].itemId).toBe(1);
      expect(result.itemForecasts[0].itemName).toBe('Classic Burger');
      expect(result.itemForecasts[0].dailyForecasts).toHaveLength(7);
      expect(result.itemForecasts[0].confidenceIntervals).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.metadata.confidence).toBeDefined();
    });

    test('should use default forecast days when not specified', async () => {
      jest.spyOn(forecastAgent, 'getHistoricalSalesData').mockResolvedValue([]);

      const result = await forecastAgent.forecastDemand({ restaurantId: 1 });

      expect(result.forecastPeriod.days).toBe(30); // Default value
    });
  });

  describe('analyzeSeasonalTrends', () => {
    test('should analyze seasonal patterns and generate recommendations', async () => {
      const mockSeasonalData = [
        { date: '2024-01-15', quantity: 20, month: 1 },
        { date: '2024-07-15', quantity: 35, month: 7 }
      ];

      jest.spyOn(forecastAgent, 'getSeasonalSalesData').mockResolvedValue(mockSeasonalData);

      const result = await forecastAgent.analyzeSeasonalTrends({ 
        restaurantId: 1, 
        analysisMonths: 12,
        includeYearOverYear: true 
      });

      expect(result.restaurantId).toBe(1);
      expect(result.analysisPeriod.months).toBe(12);
      expect(result.seasonalTrends).toBeDefined();
      expect(result.weeklyPatterns).toBeDefined();
      expect(result.yearOverYear).toBeDefined();
      expect(result.recommendations).toHaveLength(2);
      expect(result.metadata.dataPoints).toBe(2);
    });

    test('should not include year-over-year analysis for insufficient data', async () => {
      jest.spyOn(forecastAgent, 'getSeasonalSalesData').mockResolvedValue([]);

      const result = await forecastAgent.analyzeSeasonalTrends({ 
        restaurantId: 1, 
        analysisMonths: 6,
        includeYearOverYear: true 
      });

      expect(result.yearOverYear).toBeNull();
    });
  });

  describe('predictRevenue', () => {
    test('should predict revenue based on demand forecasts', async () => {
      const mockDemandForecast = {
        itemForecasts: [
          {
            itemId: 1,
            itemName: 'Classic Burger',
            summary: { totalForecast: 100 }
          }
        ],
        forecastPeriod: { days: 7 },
        metadata: { generatedAt: '2024-08-26T10:00:00Z' }
      };

      const mockPricing = [
        { itemId: 1, price: 12.99, cost: 4.50 }
      ];

      jest.spyOn(forecastAgent, 'forecastDemand').mockResolvedValue(mockDemandForecast);
      jest.spyOn(forecastAgent, 'getMenuPricing').mockResolvedValue(mockPricing);

      const result = await forecastAgent.predictRevenue({ 
        restaurantId: 1, 
        forecastDays: 7,
        scenario: 'current',
        includeProfitability: true 
      });

      expect(result.restaurantId).toBe(1);
      expect(result.scenario).toBe('current');
      expect(result.itemRevenues).toHaveLength(1);
      expect(result.totalProjections.revenue).toBe(1299); // 100 * 12.99
      expect(result.profitabilityMetrics).toBeDefined();
      expect(result.profitabilityMetrics.projectedRevenue).toBe(1299);
      expect(result.profitabilityMetrics.projectedCost).toBe(450); // 100 * 4.50
      expect(result.insights).toHaveLength(2);
    });

    test('should adjust forecasts based on scenario', async () => {
      const mockDemandForecast = {
        itemForecasts: [
          {
            itemId: 1,
            itemName: 'Test Item',
            summary: { totalForecast: 100 }
          }
        ],
        forecastPeriod: { days: 7 },
        metadata: { generatedAt: '2024-08-26T10:00:00Z' }
      };

      const mockPricing = [{ itemId: 1, price: 10.00, cost: 3.00 }];

      jest.spyOn(forecastAgent, 'forecastDemand').mockResolvedValue(mockDemandForecast);
      jest.spyOn(forecastAgent, 'getMenuPricing').mockResolvedValue(mockPricing);

      // Test optimistic scenario
      const optimisticResult = await forecastAgent.predictRevenue({ 
        restaurantId: 1, 
        scenario: 'optimistic' 
      });

      // Test conservative scenario
      const conservativeResult = await forecastAgent.predictRevenue({ 
        restaurantId: 1, 
        scenario: 'conservative' 
      });

      expect(optimisticResult.itemRevenues[0].forecastUnits).toBe(110); // 100 * 1.1
      expect(conservativeResult.itemRevenues[0].forecastUnits).toBe(90); // 100 * 0.9
    });
  });

  describe('optimizeCapacity', () => {
    test('should generate capacity optimization recommendations', async () => {
      const mockDemandForecast = {
        summary: { totalForecastUnits: 1000 },
        forecastPeriod: { days: 30 }
      };

      const currentCapacity = { staff: 10, seating: 50 };

      jest.spyOn(forecastAgent, 'forecastDemand').mockResolvedValue(mockDemandForecast);

      const result = await forecastAgent.optimizeCapacity({ 
        restaurantId: 1, 
        forecastDays: 30,
        currentCapacity,
        optimizationGoal: 'efficiency' 
      });

      expect(result.restaurantId).toBe(1);
      expect(result.currentCapacity).toEqual(currentCapacity);
      expect(result.capacityAnalysis).toBeDefined();
      expect(result.optimizations).toHaveLength(1);
      expect(result.recommendations).toHaveLength(1);
      expect(result.metadata.optimizationGoal).toBe('efficiency');
    });
  });

  describe('forecastIngredientNeeds', () => {
    test('should forecast ingredient requirements based on demand', async () => {
      const mockDemandForecast = {
        itemForecasts: [
          { itemId: 1, summary: { totalForecast: 100 } }
        ],
        forecastPeriod: { days: 7 }
      };

      const mockRecipeIngredients = [
        { itemId: 1, ingredients: [{ name: 'Ground Beef', quantityPer: 0.25 }] }
      ];

      jest.spyOn(forecastAgent, 'forecastDemand').mockResolvedValue(mockDemandForecast);
      jest.spyOn(forecastAgent, 'getRecipeIngredients').mockResolvedValue(mockRecipeIngredients);

      const result = await forecastAgent.forecastIngredientNeeds({ 
        restaurantId: 1, 
        forecastDays: 7,
        includeBuffer: true,
        bufferPercentage: 15 
      });

      expect(result.restaurantId).toBe(1);
      expect(result.ingredientForecasts).toHaveLength(1);
      expect(result.procurementPlan).toBeDefined();
      expect(result.summary.bufferIncluded).toBe(true);
      expect(result.summary.bufferPercentage).toBe(15);
    });
  });

  describe('Helper methods', () => {
    test('getSeasonalFactor should return correct multipliers', () => {
      // Summer month (July)
      const summerDate = new Date(2024, 6, 15); // Month is 0-indexed
      expect(forecastAgent.getSeasonalFactor(summerDate)).toBe(1.25);

      // Winter month (January)
      const winterDate = new Date(2024, 0, 15);
      expect(forecastAgent.getSeasonalFactor(winterDate)).toBe(0.9);

      // Spring month (April)
      const springDate = new Date(2024, 3, 15);
      expect(forecastAgent.getSeasonalFactor(springDate)).toBe(1.1);
    });

    test('calculateForecastConfidence should decrease with time and variance', () => {
      const item = { historicalVariance: 0.2 };
      
      const day1Confidence = forecastAgent.calculateForecastConfidence(item, 1);
      const day30Confidence = forecastAgent.calculateForecastConfidence(item, 30);
      
      expect(day1Confidence).toBeGreaterThan(day30Confidence);
      expect(day1Confidence).toBeLessThanOrEqual(1.0);
      expect(day30Confidence).toBeGreaterThanOrEqual(0.3);
    });

    test('generateItemForecast should create daily forecasts with confidence', () => {
      const mockItem = {
        itemId: 1,
        itemName: 'Test Item',
        historicalSales: [
          { date: '2024-08-25', quantity: 20 }
        ],
        trend: 0.1,
        seasonality: 'summer_peak',
        historicalVariance: 0.15
      };

      const forecast = forecastAgent.generateItemForecast(mockItem, 7);

      expect(forecast.itemId).toBe(1);
      expect(forecast.itemName).toBe('Test Item');
      expect(forecast.dailyForecasts).toHaveLength(7);
      expect(forecast.summary.totalForecast).toBeGreaterThan(0);
      expect(forecast.summary.confidence).toBeGreaterThan(0);
      
      // Check that each daily forecast has required properties
      forecast.dailyForecasts.forEach(day => {
        expect(day.date).toBeDefined();
        expect(day.forecastQuantity).toBeGreaterThanOrEqual(0);
        expect(day.confidence).toBeGreaterThan(0);
      });
    });

    test('calculateForecastSummary should aggregate forecast data correctly', () => {
      const mockForecasts = [
        {
          summary: { totalForecast: 100, confidence: 0.8 }
        },
        {
          summary: { totalForecast: 150, confidence: 0.9 }
        }
      ];

      const summary = forecastAgent.calculateForecastSummary(mockForecasts, 7);

      expect(summary.totalItems).toBe(2);
      expect(summary.totalForecastUnits).toBe(250);
      expect(summary.dailyAverageUnits).toBe(36); // Math.round(250/7)
      expect(summary.averageConfidence).toBe(0.85); // (0.8 + 0.9) / 2
      expect(summary.forecastAccuracy).toBe('high'); // > 0.8
    });

    test('generateMockSalesHistory should create realistic data', () => {
      const history = forecastAgent.generateMockSalesHistory(30, 5);

      expect(history).toHaveLength(90); // 90 days
      expect(history[0].date).toBeDefined();
      expect(history[0].quantity).toBeGreaterThanOrEqual(0);
      
      // Check that all quantities are within reasonable range
      const quantities = history.map(h => h.quantity);
      const avg = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
      expect(avg).toBeCloseTo(30, 0); // Should be close to target average (within 0.5)
    });
  });

  describe('generateRevenueInsights', () => {
    test('should generate meaningful insights from revenue data', () => {
      const mockRevenues = [
        {
          itemName: 'Best Seller',
          totalRevenue: 1000
        },
        {
          itemName: 'Average Item',
          totalRevenue: 500
        }
      ];

      const mockProfitability = {
        marginPercentage: 65
      };

      const insights = forecastAgent.generateRevenueInsights(mockRevenues, mockProfitability);

      expect(insights).toHaveLength(2);
      expect(insights[0].type).toBe('top_performer');
      expect(insights[0].message).toContain('Best Seller');
      expect(insights[1].type).toBe('profitability');
      expect(insights[1].message).toContain('65%');
    });
  });
});

describe('ForecastAgent Integration', () => {
  let forecastAgent;

  beforeEach(() => {
    forecastAgent = new ForecastAgent();
  });

  test('should handle complete workflow from demand forecast to revenue prediction', async () => {
    // Mock all dependencies for integration test
    jest.spyOn(forecastAgent, 'getHistoricalSalesData').mockResolvedValue([
      {
        itemId: 1,
        itemName: 'Integration Test Item',
        historicalSales: [{ date: '2024-08-25', quantity: 25 }],
        trend: 0.1,
        seasonality: 'summer_peak',
        historicalVariance: 0.15
      }
    ]);

    jest.spyOn(forecastAgent, 'getMenuPricing').mockResolvedValue([
      { itemId: 1, price: 15.00, cost: 5.00 }
    ]);

    // Test demand forecast
    const demandResult = await forecastAgent.process({ 
      type: 'forecast_demand', 
      data: { restaurantId: 1, forecastDays: 7 } 
    });

    expect(demandResult).toBeDefined();
    expect(demandResult.itemForecasts).toHaveLength(1);
    expect(demandResult.summary).toBeDefined();

    // Test revenue prediction
    const revenueResult = await forecastAgent.process({ 
      type: 'predict_revenue', 
      data: { restaurantId: 1, forecastDays: 7 } 
    });

    expect(revenueResult).toBeDefined();
    expect(revenueResult.itemRevenues).toHaveLength(1);
    expect(revenueResult.totalProjections.revenue).toBeGreaterThan(0);
    expect(revenueResult.profitabilityMetrics).toBeDefined();

    expect(forecastAgent.metrics.requests).toBe(2);
  });

  test('should maintain state consistency across multiple requests', async () => {
    jest.spyOn(forecastAgent, 'getHistoricalSalesData').mockResolvedValue([]);
    jest.spyOn(forecastAgent, 'getSeasonalSalesData').mockResolvedValue([]);

    await forecastAgent.process({ type: 'forecast_demand', data: { restaurantId: 1 } });
    await forecastAgent.process({ type: 'analyze_seasonal_trends', data: { restaurantId: 1 } });

    expect(forecastAgent.metrics.requests).toBe(2);
    expect(forecastAgent.name).toBe('ForecastAgent');
  });
});
