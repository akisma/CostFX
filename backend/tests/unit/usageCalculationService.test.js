import { describe, test, expect, beforeEach, vi } from 'vitest';
import UsageCalculationService from '../../src/services/UsageCalculationService.js';

describe('UsageCalculationService - Unit Tests', () => {
  let service;
  let mockModels;

  beforeEach(() => {
    // Setup mock models
    mockModels = {
      InventoryPeriod: {
        findByPk: vi.fn(),
        findAll: vi.fn()
      },
      InventoryItem: {
        findAll: vi.fn()
      },
      PeriodInventorySnapshot: {
        findAll: vi.fn()
      },
      InventoryTransaction: {
        findAll: vi.fn()
      },
      TheoreticalUsageAnalysis: {
        findOne: vi.fn(),
        findAll: vi.fn(),
        create: vi.fn()
      }
    };

    service = new UsageCalculationService();
    service.models = mockModels;
  });

  describe('Service Structure', () => {
    test('should create service instance with expected methods', () => {
      expect(service).toBeInstanceOf(UsageCalculationService);
      expect(typeof service.calculateUsageForPeriod).toBe('function');
      expect(typeof service.calculateTheoreticalUsage).toBe('function');
      expect(typeof service.calculateActualUsage).toBe('function');
      expect(typeof service.calculateVariancePriority).toBe('function');
    });

    test('should initialize models manually for testing', async () => {
      const newService = new UsageCalculationService();
      expect(newService.models).toBeNull();
      
      // For unit tests, we manually set models instead of importing database
      newService.models = mockModels;
      expect(newService.models).toBeDefined();
      expect(newService.models.TheoreticalUsageAnalysis).toBeDefined();
    });
  });

  describe('Variance Priority Calculation', () => {
    test('should assign critical priority for high-value items', () => {
      const highValueItem = {
        highValueFlag: true,
        varianceThresholdQuantity: 2.0,
        varianceThresholdDollar: 50.0
      };
      
      const priority = service.calculateVariancePriority(highValueItem, 1.0, 10.0);
      expect(priority).toBe('critical');
    });

    test('should assign critical priority for large dollar impact', () => {
      const item = {
        highValueFlag: false,
        varianceThresholdQuantity: 3.0,
        varianceThresholdDollar: 15.0
      };
      
      const largeDollarVariance = 35.0; // 15 * 2.5 > threshold * 2
      const priority = service.calculateVariancePriority(item, 1.0, largeDollarVariance);
      expect(priority).toBe('critical');
    });

    test('should assign high priority when both thresholds exceeded', () => {
      const item = {
        highValueFlag: false,
        varianceThresholdQuantity: 3.0,
        varianceThresholdDollar: 15.0
      };
      
      const quantityVariance = 3.5; // > 3.0
      const dollarVariance = 18.0; // > 15.0
      const priority = service.calculateVariancePriority(item, quantityVariance, dollarVariance);
      expect(priority).toBe('high');
    });

    test('should assign medium priority for significant single threshold', () => {
      const item = {
        highValueFlag: false,
        varianceThresholdQuantity: 8.0,
        varianceThresholdDollar: 5.0
      };
      
      const quantityVariance = 14.0; // 8 * 1.5 = 12, so 14 > 12 (medium)
      const dollarVariance = 2.0; // Below threshold
      const priority = service.calculateVariancePriority(item, quantityVariance, dollarVariance);
      expect(priority).toBe('medium');
    });

    test('should assign low priority for minor variances', () => {
      const item = {
        highValueFlag: false,
        varianceThresholdQuantity: 8.0,
        varianceThresholdDollar: 5.0
      };
      
      const quantityVariance = 1.0; // Below threshold
      const dollarVariance = 1.0; // Below threshold
      const priority = service.calculateVariancePriority(item, quantityVariance, dollarVariance);
      expect(priority).toBe('low');
    });

    test('should handle items with no thresholds', () => {
      const item = {
        highValueFlag: false
        // No variance thresholds defined
      };
      
      const priority = service.calculateVariancePriority(item, 1.0, 10.0);
      expect(['critical', 'high', 'medium', 'low']).toContain(priority);
    });
  });

  describe('Analysis Record Building', () => {
    test('should build complete analysis record with all fields', () => {
      const periodId = 1;
      const item = {
        id: 1,
        name: 'Premium Saffron',
        highValueFlag: true,
        varianceThresholdQuantity: 2.0,
        varianceThresholdDollar: 50.0
      };
      const theoreticalUsage = {
        quantity: 8.5,
        unitCost: 19.00,
        confidence: 0.90,
        metadata: { test: 'data' }
      };
      const actualUsage = {
        quantity: 10.0,
        unitCost: 19.00,
        metadata: { actual: 'data' }
      };

      const record = service.buildAnalysisRecord(
        periodId,
        item,
        theoreticalUsage,
        actualUsage,
        'recipe_based'
      );

      expect(record).toMatchObject({
        periodId: 1,
        inventoryItemId: 1,
        theoreticalQuantity: 8.5,
        actualQuantity: 10.0,
        unitCost: 19.00,
        varianceQuantity: 1.5, // 10 - 8.5
        variancePercentage: expect.closeTo(17.65, 1), // (1.5 / 8.5) * 100
        varianceDollarValue: 28.5, // 1.5 * 19
        priority: 'critical', // High-value item
        calculationMethod: 'recipe_based',
        recipeData: { test: 'data' },
        calculationConfidence: 0.90,
        calculatedAt: expect.any(Date)
      });
    });

    test('should handle zero theoretical quantity in percentage calculation', () => {
      const periodId = 1;
      const item = {
        id: 2,
        name: 'Test Item',
        highValueFlag: false,
        varianceThresholdQuantity: 3.0,
        varianceThresholdDollar: 15.0
      };
      const theoreticalUsage = { quantity: 0, unitCost: 1.25 };
      const actualUsage = { quantity: 5.0, unitCost: 1.25 };

      const record = service.buildAnalysisRecord(
        periodId,
        item,
        theoreticalUsage,
        actualUsage,
        'historical_average'
      );

      expect(record.variancePercentage).toBe(0);
      expect(record.varianceQuantity).toBe(5.0);
      expect(record.varianceDollarValue).toBe(6.25); // 5 * 1.25
    });

    test('should handle negative variance (actual < theoretical)', () => {
      const periodId = 1;
      const item = {
        id: 3,
        name: 'Test Item',
        highValueFlag: false,
        varianceThresholdQuantity: 5.0,
        varianceThresholdDollar: 25.0
      };
      const theoreticalUsage = { quantity: 10.0, unitCost: 2.50 };
      const actualUsage = { quantity: 7.5, unitCost: 2.50 };

      const record = service.buildAnalysisRecord(
        periodId,
        item,
        theoreticalUsage,
        actualUsage,
        'recipe_based'
      );

      expect(record.varianceQuantity).toBe(-2.5); // 7.5 - 10.0
      expect(record.variancePercentage).toBeCloseTo(-25, 1); // (-2.5 / 10) * 100
      expect(record.varianceDollarValue).toBe(-6.25); // -2.5 * 2.50
    });
  });

  describe('Recipe-Based Calculation', () => {
    test('should calculate theoretical usage with recipe data structure', async () => {
      const item = {
        id: 1,
        name: 'Premium Saffron',
        unitCost: 19.00,
        theoreticalYieldFactor: 0.95
      };
      const period = {
        id: 1,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-07')
      };

      const result = await service.calculateRecipeBasedUsage(item, period);

      expect(result).toMatchObject({
        quantity: expect.any(Number),
        unitCost: 19.00,
        method: 'recipe_based',
        confidence: 0.90
      });

      expect(result.quantity).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.recipeData).toBeDefined();
      expect(result.metadata.recipeData.recipesUsed).toBeInstanceOf(Array);
      expect(result.metadata.calculatedAt).toBeInstanceOf(Date);
    });

    test('should apply yield factor correctly', async () => {
      const item = {
        id: 1,
        name: 'Test Item',
        unitCost: 5.00,
        theoreticalYieldFactor: 0.80 // 20% waste factor
      };
      const period = {
        id: 1,
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-07')
      };

      const result = await service.calculateRecipeBasedUsage(item, period);

      // With 20% waste, we need more raw material
      // Base calculation / 0.80 should be > base calculation
      expect(result.quantity).toBeGreaterThan(
        result.metadata.recipeData.recipesUsed[0].quantityPerServing * 
        result.metadata.recipeData.recipesUsed[0].soldQuantity
      );
    });
  });

  describe('Historical Average Calculation', () => {
    test('should return zero usage with no historical data', async () => {
      const item = { id: 1, unitCost: 1.25 };
      const period = { 
        id: 1, 
        restaurantId: 1,
        periodStart: new Date('2025-01-01') 
      };

      // Mock no historical periods
      mockModels.InventoryPeriod.findAll.mockResolvedValue([]);

      const result = await service.calculateHistoricalAverageUsage(item, period);

      expect(result).toMatchObject({
        quantity: 0,
        unitCost: 1.25,
        method: 'historical_average',
        confidence: 0.20
      });

      expect(result.metadata.historicalPeriods).toBe(0);
      expect(result.metadata.estimationMethod).toBe('no_history_fallback');
    });

    test('should calculate average from historical analyses', async () => {
      const item = { id: 1, unitCost: 1.25 };
      const period = { 
        id: 5, 
        restaurantId: 1,
        periodStart: new Date('2025-01-01') 
      };

      // Mock historical periods
      const historicalPeriods = [
        { id: 1, periodEnd: new Date('2024-12-31') },
        { id: 2, periodEnd: new Date('2024-12-24') },
        { id: 3, periodEnd: new Date('2024-12-17') }
      ];
      mockModels.InventoryPeriod.findAll.mockResolvedValue(historicalPeriods);

      // Mock historical analyses with actual usage data
      const historicalAnalyses = [
        { periodId: 1, inventoryItemId: 1, actualQuantity: 15.5 },
        { periodId: 2, inventoryItemId: 1, actualQuantity: 12.0 },
        { periodId: 3, inventoryItemId: 1, actualQuantity: 18.5 }
      ];
      mockModels.TheoreticalUsageAnalysis.findAll.mockResolvedValue(historicalAnalyses);

      const result = await service.calculateHistoricalAverageUsage(item, period);

      const expectedAverage = (15.5 + 12.0 + 18.5) / 3; // 15.33
      expect(result.quantity).toBeCloseTo(expectedAverage, 2);
      expect(result.confidence).toBeGreaterThan(0.40); // Higher with more data
      expect(result.metadata.historicalAnalyses).toBe(3);
    });

    test('should handle new item with no usage history', async () => {
      const item = { id: 999, unitCost: 5.00 };
      const period = { 
        id: 1, 
        restaurantId: 1,
        periodStart: new Date('2025-01-01') 
      };

      // Mock historical periods exist but no analyses for this item
      mockModels.InventoryPeriod.findAll.mockResolvedValue([
        { id: 1, periodEnd: new Date('2024-12-31') }
      ]);
      mockModels.TheoreticalUsageAnalysis.findAll.mockResolvedValue([]);

      const result = await service.calculateHistoricalAverageUsage(item, period);

      expect(result).toMatchObject({
        quantity: 0,
        unitCost: 5.00,
        method: 'historical_average',
        confidence: 0.30
      });

      expect(result.metadata.estimationMethod).toBe('new_item_estimation');
      expect(result.metadata.historicalAnalyses).toBe(0);
    });
  });

  describe('AI-Predicted Calculation', () => {
    test('should enhance historical calculation with AI metadata', async () => {
      const item = { id: 1, unitCost: 2.50 };
      const period = { 
        id: 1, 
        restaurantId: 1,
        periodStart: new Date('2025-01-01') 
      };

      // Mock no historical data for simplicity
      mockModels.InventoryPeriod.findAll.mockResolvedValue([]);

      const result = await service.calculateAIPredictedUsage(item, period);

      expect(result.method).toBe('ai_predicted');
      expect(result.metadata.aiModel).toBe('placeholder_v1');
      expect(result.metadata.aiFactors).toContain('historical_trend');
      expect(result.metadata.aiFactors).toContain('seasonal_pattern');
      expect(result.confidence).toBeGreaterThanOrEqual(0.20);
    });
  });

  describe('Actual Usage Calculation', () => {
    test('should calculate usage from snapshots without purchases', async () => {
      const item = { id: 1, unitCost: 19.00 };
      const period = { id: 1, periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-01-07') };

      // Mock snapshots
      const snapshots = [
        { snapshotType: 'beginning', quantity: 50.0, unitCost: 19.00 },
        { snapshotType: 'ending', quantity: 45.0, unitCost: 19.00 }
      ];
      mockModels.PeriodInventorySnapshot.findAll.mockResolvedValue(snapshots);

      // Mock no purchases
      mockModels.InventoryTransaction.findAll.mockResolvedValue([]);

      const result = await service.calculateActualUsage(item, period);

      expect(result.quantity).toBe(5.0); // 50 - 0 - 45 = 5
      expect(result.unitCost).toBe(19.00);
      expect(result.metadata.beginningQuantity).toBe(50);
      expect(result.metadata.endingQuantity).toBe(45);
      expect(result.metadata.totalPurchases).toBe(0);
    });

    test('should include purchases in usage calculation', async () => {
      const item = { id: 2, unitCost: 1.25 };
      const period = { id: 1, periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-01-07') };

      // Mock snapshots
      const snapshots = [
        { snapshotType: 'beginning', quantity: 25.0, unitCost: 1.25 },
        { snapshotType: 'ending', quantity: 20.0, unitCost: 1.25 }
      ];
      mockModels.PeriodInventorySnapshot.findAll.mockResolvedValue(snapshots);

      // Mock purchases
      const purchases = [
        { quantity: 10.0, type: 'purchase' }
      ];
      mockModels.InventoryTransaction.findAll.mockResolvedValue(purchases);

      const result = await service.calculateActualUsage(item, period);

      expect(result.quantity).toBe(15.0); // 25 + 10 - 20 = 15
      expect(result.metadata.totalPurchases).toBe(10.0);
      expect(result.metadata.purchaseTransactions).toBe(1);
    });

    test('should ensure non-negative usage', async () => {
      const item = { id: 3, unitCost: 3.00 };
      const period = { id: 1, periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-01-07') };

      // Mock snapshots where ending > beginning (negative usage scenario)
      const snapshots = [
        { snapshotType: 'beginning', quantity: 10.0, unitCost: 3.00 },
        { snapshotType: 'ending', quantity: 15.0, unitCost: 3.00 }
      ];
      mockModels.PeriodInventorySnapshot.findAll.mockResolvedValue(snapshots);
      mockModels.InventoryTransaction.findAll.mockResolvedValue([]);

      const result = await service.calculateActualUsage(item, period);

      expect(result.quantity).toBe(0); // Should be 0, not negative
    });

    test('should throw error for missing snapshots', async () => {
      const item = { id: 4, unitCost: 5.00 };
      const period = { id: 1 };

      // Mock missing ending snapshot
      const snapshots = [
        { snapshotType: 'beginning', quantity: 10.0, unitCost: 5.00 }
      ];
      mockModels.PeriodInventorySnapshot.findAll.mockResolvedValue(snapshots);

      await expect(
        service.calculateActualUsage(item, period)
      ).rejects.toThrow('Missing snapshots for item 4 in period 1');
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown calculation method', async () => {
      const item = { id: 1 };
      const period = { id: 1 };

      await expect(
        service.calculateTheoreticalUsage(item, period, 'unknown_method')
      ).rejects.toThrow('Unknown calculation method: unknown_method');
    });

    test('should handle manual method without external data', async () => {
      const item = { id: 1 };
      const period = { id: 1 };

      await expect(
        service.calculateTheoreticalUsage(item, period, 'manual')
      ).rejects.toThrow('Manual calculation method requires external theoretical quantity input');
    });
  });
});
