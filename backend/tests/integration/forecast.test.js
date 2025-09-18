import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import agentService from '../../src/agents/AgentService.js';

describe('ForecastAgent Integration', () => {
  beforeAll(async () => {
    // Initialize the agent service
    await agentService.initialize();
  });

  afterAll(async () => {
    // Cleanup
    await agentService.shutdown();
  });

  describe('Demand Forecasting', () => {
    test('should forecast demand through agent service', async () => {
      const result = await agentService.forecastDemand(1, {
        forecastDays: 7,
        menuItems: [1, 2],
        includeConfidenceIntervals: true
      });

      expect(result).toBeDefined();
      expect(result.restaurantId).toBe(1);
      expect(result.forecastPeriod).toBeDefined();
      expect(result.forecastPeriod.days).toBe(7);
      expect(result.itemForecasts).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
      expect(result.metadata).toBeDefined();
    });
  });

  describe('Seasonal Analysis', () => {
    test('should analyze seasonal trends through agent service', async () => {
      const result = await agentService.analyzeSeasonalTrends(1, {
        analysisMonths: 12,
        includeYearOverYear: true
      });

      expect(result).toBeDefined();
      expect(result.restaurantId).toBe(1);
      expect(result.analysisPeriod).toBeDefined();
      expect(result.seasonalTrends).toBeDefined();
      expect(result.weeklyPatterns).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Revenue Prediction', () => {
    test('should predict revenue through agent service', async () => {
      const result = await agentService.predictRevenue(1, {
        forecastDays: 30,
        scenario: 'optimistic',
        includeProfitability: true
      });

      expect(result).toBeDefined();
      expect(result.restaurantId).toBe(1);
      expect(result.scenario).toBe('optimistic');
      expect(result.totalProjections).toBeDefined();
      expect(result.totalProjections.revenue).toBeGreaterThanOrEqual(0);
      expect(result.profitabilityMetrics).toBeDefined();
      expect(result.insights).toBeInstanceOf(Array);
    });
  });

  describe('Capacity Optimization', () => {
    test('should optimize capacity through agent service', async () => {
      const currentCapacity = {
        staff: 10,
        seating: 50,
        kitchen: 30
      };

      const result = await agentService.optimizeCapacity(1, {
        forecastDays: 30,
        currentCapacity,
        optimizationGoal: 'balanced'
      });

      expect(result).toBeDefined();
      expect(result.restaurantId).toBe(1);
      expect(result.currentCapacity).toEqual(currentCapacity);
      expect(result.capacityAnalysis).toBeDefined();
      expect(result.optimizations).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Ingredient Forecasting', () => {
    test('should forecast ingredient needs through agent service', async () => {
      const result = await agentService.forecastIngredientNeeds(1, {
        forecastDays: 14,
        includeBuffer: true,
        bufferPercentage: 20
      });

      expect(result).toBeDefined();
      expect(result.restaurantId).toBe(1);
      expect(result.forecastPeriod).toBeDefined();
      expect(result.ingredientForecasts).toBeInstanceOf(Array);
      expect(result.procurementPlan).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.bufferIncluded).toBe(true);
      expect(result.summary.bufferPercentage).toBe(20);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid restaurant ID', async () => {
      await expect(agentService.forecastDemand(null)).rejects.toThrow();
    });

    test('should handle invalid forecast parameters', async () => {
      await expect(agentService.forecastDemand(1, {
        forecastDays: -5
      })).rejects.toThrow();
    });
  });
});
