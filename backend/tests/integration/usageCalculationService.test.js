import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import UsageCalculationService from '../../src/services/UsageCalculationService.js';

// Mock the database models for integration testing
const mockSequelize = {
  models: {
    InventoryPeriod: {
      findByPk: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn()
    },
    InventoryItem: {
      findAll: vi.fn(),
      create: vi.fn()
    },
    IngredientCategory: {
      create: vi.fn()
    },
    PeriodInventorySnapshot: {
      findAll: vi.fn(),
      create: vi.fn()
    },
    InventoryTransaction: {
      findAll: vi.fn(),
      create: vi.fn()
    },
    TheoreticalUsageAnalysis: {
      findOne: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn()
    },
    Restaurant: {
      create: vi.fn()
    }
  }
};

// Mock the database import
vi.mock('../../src/config/database.js', () => ({
  default: mockSequelize
}));

describe('UsageCalculationService', () => {
  let service;
  let testRestaurant;
  let testPeriod;
  let testItems;
  let testSnapshots;

  // Test data setup
  beforeAll(async () => {
    // Setup test data objects
    testRestaurant = {
      id: 1,
      name: 'Test Restaurant - Usage Calc',
      location: 'Test Location',
      settings: {}
    };

    // Create service instance
    service = new UsageCalculationService();
    
    // Mock service initialization to use our mock sequelize
    service.models = mockSequelize.models;

    // Setup test data objects
    const spicesCategory = {
      id: 101,
      name: 'Spices',
      parentCategoryId: null,
      level: 1,
      categoryPath: 'spices',
      sortOrder: 1
    };

    const produceCategory = {
      id: 201,
      name: 'Produce', 
      parentCategoryId: null,
      level: 1,
      categoryPath: 'produce',
      sortOrder: 2
    };

    // Create test inventory items
    testItems = [
      {
        id: 1,
        restaurantId: testRestaurant.id,
        name: 'Premium Saffron',
        category: 'spices',
        categoryId: spicesCategory.id,
        unitType: 'weight',
        unit: 'oz',
        unitCost: 19.00,
        currentStock: 50.00,
        minimumStock: 10.00,
        maximumStock: 100.00,
        varianceThresholdQuantity: 2.00,
        varianceThresholdDollar: 50.00,
        highValueFlag: true,
        theoreticalYieldFactor: 0.95
      },
      {
        id: 2,
        restaurantId: testRestaurant.id,
        name: 'Romaine Lettuce',
        category: 'produce',
        categoryId: produceCategory.id,
        unitType: 'weight',
        unit: 'lb',
        unitCost: 1.25,
        currentStock: 25.00,
        minimumStock: 5.00,
        maximumStock: 50.00,
        varianceThresholdQuantity: 3.00,
        varianceThresholdDollar: 15.00,
        highValueFlag: false,
        theoreticalYieldFactor: 0.85
      },
      {
        id: 3,
        restaurantId: testRestaurant.id,
        name: 'Olive Oil',
        category: 'oils',
        unitType: 'volume',
        unit: 'fl oz',
        unitCost: 0.15,
        currentStock: 128.00,
        minimumStock: 32.00,
        maximumStock: 256.00,
        varianceThresholdQuantity: 8.00,
        varianceThresholdDollar: 5.00,
        highValueFlag: false,
        theoreticalYieldFactor: 0.98
      }
    ];

    // Create test period
    testPeriod = {
      id: 1,
      restaurantId: testRestaurant.id,
      periodName: 'Test Period - Week 1',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-07'),
      status: 'open'
    };

    // Create beginning and ending snapshots for each item
    testSnapshots = [];
    for (const item of testItems) {
      // Beginning snapshot
      const beginningSnapshot = {
        id: item.id * 10,
        periodId: testPeriod.id,
        inventoryItemId: item.id,
        snapshotType: 'beginning',
        quantity: item.currentStock,
        unitCost: item.unitCost,
        totalValue: item.currentStock * item.unitCost,
        countedBy: 1,
        countedAt: new Date('2025-01-01T08:00:00Z'),
        verified: true
      };

      // Ending snapshot (simulate some usage)
      const usageMultiplier = item.name === 'Premium Saffron' ? 0.9 : 0.8; // Different usage patterns
      const endingQuantity = item.currentStock * usageMultiplier;
      
      const endingSnapshot = {
        id: item.id * 10 + 1,
        periodId: testPeriod.id,
        inventoryItemId: item.id,
        snapshotType: 'ending',
        quantity: endingQuantity,
        unitCost: item.unitCost,
        totalValue: endingQuantity * item.unitCost,
        countedBy: 1,
        countedAt: new Date('2025-01-07T18:00:00Z'),
        verified: true
      };

      testSnapshots.push({ beginning: beginningSnapshot, ending: endingSnapshot });
    }
  });

  afterAll(async () => {
    // Cleanup mocks
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any test-specific data if needed
  });

  describe('Service Initialization', () => {
    test('should initialize with database models', async () => {
      const newService = new UsageCalculationService();
      expect(newService.models).toBeNull();
      
      await newService.initialize();
      expect(newService.models).toBeDefined();
      expect(newService.models.TheoreticalUsageAnalysis).toBeDefined();
    });
  });

  describe('Theoretical Usage Calculations', () => {
    test('should calculate recipe-based theoretical usage', async () => {
      const item = testItems[0]; // Premium Saffron
      const result = await service.calculateTheoreticalUsage(item, testPeriod, 'recipe_based');

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
    });

    test('should calculate historical average with no history', async () => {
      const item = testItems[1]; // Romaine Lettuce (no historical data)
      const result = await service.calculateHistoricalAverageUsage(item, testPeriod);

      expect(result).toMatchObject({
        quantity: 0,
        unitCost: 1.25,
        method: 'historical_average',
        confidence: 0.30
      });

      expect(result.metadata.historicalPeriods).toBe(0);
      expect(result.metadata.estimationMethod).toBe('no_history_fallback');
    });

    test('should calculate AI-predicted usage as enhanced historical', async () => {
      const item = testItems[2]; // Olive Oil
      const result = await service.calculateAIPredictedUsage(item, testPeriod);

      expect(result).toMatchObject({
        method: 'ai_predicted',
        unitCost: 0.15
      });

      expect(result.metadata.aiModel).toBe('placeholder_v1');
      expect(result.metadata.aiFactors).toContain('historical_trend');
      expect(result.confidence).toBeGreaterThanOrEqual(0.20);
    });

    test('should throw error for manual method without external data', async () => {
      const item = testItems[0];
      
      await expect(
        service.calculateTheoreticalUsage(item, testPeriod, 'manual')
      ).rejects.toThrow('Manual calculation method requires external theoretical quantity input');
    });

    test('should throw error for unknown method', async () => {
      const item = testItems[0];
      
      await expect(
        service.calculateTheoreticalUsage(item, testPeriod, 'unknown_method')
      ).rejects.toThrow('Unknown calculation method: unknown_method');
    });
  });

  describe('Actual Usage Calculations', () => {
    test('should calculate actual usage from snapshots without purchases', async () => {
      const item = testItems[0]; // Premium Saffron
      const result = await service.calculateActualUsage(item, testPeriod);

      // Expected: beginning(50) + purchases(0) - ending(45) = 5
      const expectedUsage = 50 - 45; // 5 oz used
      
      expect(result.quantity).toBeCloseTo(expectedUsage, 2);
      expect(result.unitCost).toBe(19.00);
      expect(result.metadata.beginningQuantity).toBe(50);
      expect(result.metadata.endingQuantity).toBe(45);
      expect(result.metadata.totalPurchases).toBe(0);
    });

    test('should calculate actual usage including purchases', async () => {
      const item = testItems[1]; // Romaine Lettuce (has purchase transaction)
      const result = await service.calculateActualUsage(item, testPeriod);

      // Expected: beginning(25) + purchases(10) - ending(20) = 15
      const expectedUsage = 25 + 10 - 20; // 15 lbs used
      
      expect(result.quantity).toBeCloseTo(expectedUsage, 2);
      expect(result.unitCost).toBe(1.25);
      expect(result.metadata.beginningQuantity).toBe(25);
      expect(result.metadata.endingQuantity).toBe(20);
      expect(result.metadata.totalPurchases).toBe(10);
      expect(result.metadata.purchaseTransactions).toBe(1);
    });

    test('should handle missing snapshots gracefully', async () => {
      // Create item without snapshots
      const orphanItem = await sequelize.models.InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Orphan Item',
        category: 'test',
        unitType: 'weight',
        unit: 'lb',
        unitCost: 5.00,
        currentStock: 10.00,
        minimumStock: 2.00,
        maximumStock: 20.00
      });

      await expect(
        service.calculateActualUsage(orphanItem, testPeriod)
      ).rejects.toThrow(`Missing snapshots for item ${orphanItem.id} in period ${testPeriod.id}`);

      // Cleanup
      await orphanItem.destroy();
    });

    test('should ensure non-negative actual usage', async () => {
      // Create a scenario where calculated usage would be negative
      const testItem = await sequelize.models.InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Negative Test Item',
        category: 'test',
        unitType: 'weight',
        unit: 'lb',
        unitCost: 3.00,
        currentStock: 10.00,
        minimumStock: 2.00,
        maximumStock: 20.00
      });

      // Beginning snapshot: 10
      await sequelize.models.PeriodInventorySnapshot.create({
        periodId: testPeriod.id,
        inventoryItemId: testItem.id,
        snapshotType: 'beginning',
        quantity: 10.00,
        unitCost: 3.00,
        totalValue: 30.00,
        countedBy: 1,
        countedAt: new Date('2025-01-01T08:00:00Z'),
        verified: true
      });

      // Ending snapshot: 15 (more than beginning, negative usage)
      await sequelize.models.PeriodInventorySnapshot.create({
        periodId: testPeriod.id,
        inventoryItemId: testItem.id,
        snapshotType: 'ending',
        quantity: 15.00,
        unitCost: 3.00,
        totalValue: 45.00,
        countedBy: 1,
        countedAt: new Date('2025-01-07T18:00:00Z'),
        verified: true
      });

      const result = await service.calculateActualUsage(testItem, testPeriod);
      
      // Should be 0, not negative
      expect(result.quantity).toBe(0);
      
      // Cleanup
      await testItem.destroy();
    });
  });

  describe('Variance Priority Calculation', () => {
    test('should assign critical priority for high-value items', () => {
      const highValueItem = testItems[0]; // Premium Saffron with highValueFlag: true
      const priority = service.calculateVariancePriority(highValueItem, 1.0, 10.0);
      
      expect(priority).toBe('critical');
    });

    test('should assign critical priority for large dollar impact', () => {
      const item = testItems[1]; // Romaine Lettuce
      const largeDollarVariance = (item.varianceThresholdDollar || 15) * 2.5; // 37.5
      const priority = service.calculateVariancePriority(item, 1.0, largeDollarVariance);
      
      expect(priority).toBe('critical');
    });

    test('should assign high priority when both thresholds exceeded', () => {
      const item = testItems[1]; // Romaine Lettuce
      const quantityVariance = (item.varianceThresholdQuantity || 3) * 1.2; // 3.6
      const dollarVariance = (item.varianceThresholdDollar || 15) * 1.2; // 18
      const priority = service.calculateVariancePriority(item, quantityVariance, dollarVariance);
      
      expect(priority).toBe('high');
    });

    test('should assign medium priority for significant single threshold', () => {
      const item = testItems[2]; // Olive Oil
      const quantityVariance = (item.varianceThresholdQuantity || 8) * 1.8; // 14.4
      const dollarVariance = 2.0; // Below threshold
      const priority = service.calculateVariancePriority(item, quantityVariance, dollarVariance);
      
      expect(priority).toBe('medium');
    });

    test('should assign low priority for minor variances', () => {
      const item = testItems[2]; // Olive Oil
      const quantityVariance = 1.0; // Below threshold
      const dollarVariance = 1.0; // Below threshold
      const priority = service.calculateVariancePriority(item, quantityVariance, dollarVariance);
      
      expect(priority).toBe('low');
    });
  });

  describe('Analysis Record Building', () => {
    test('should build complete analysis record with all fields', () => {
      const item = testItems[0]; // Premium Saffron
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
        testPeriod.id,
        item,
        theoreticalUsage,
        actualUsage,
        'recipe_based'
      );

      expect(record).toMatchObject({
        periodId: testPeriod.id,
        inventoryItemId: item.id,
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
      const item = testItems[1];
      const theoreticalUsage = { quantity: 0, unitCost: 1.25 };
      const actualUsage = { quantity: 5.0, unitCost: 1.25 };

      const record = service.buildAnalysisRecord(
        testPeriod.id,
        item,
        theoreticalUsage,
        actualUsage,
        'historical_average'
      );

      expect(record.variancePercentage).toBe(0);
      expect(record.varianceQuantity).toBe(5.0);
    });
  });

  describe('Period Usage Calculation', () => {
    test('should calculate usage for entire period successfully', async () => {
      const result = await service.calculateUsageForPeriod(testPeriod.id, {
        method: 'recipe_based',
        recalculate: true
      });

      expect(result).toMatchObject({
        periodId: testPeriod.id,
        method: 'recipe_based',
        itemsProcessed: 3,
        itemsSkipped: 0,
        analyses: expect.arrayContaining([
          expect.objectContaining({
            inventoryItemId: expect.any(Number),
            itemName: expect.any(String),
            theoreticalQuantity: expect.any(Number),
            actualQuantity: expect.any(Number),
            varianceQuantity: expect.any(Number),
            varianceDollarValue: expect.any(Number),
            priority: expect.stringMatching(/^(critical|high|medium|low)$/)
          })
        ]),
        errors: []
      });

      // Verify records were created in database
      const createdAnalyses = await sequelize.models.TheoreticalUsageAnalysis.findAll({
        where: { periodId: testPeriod.id }
      });

      expect(createdAnalyses).toHaveLength(3);
    });

    test('should skip existing analyses when recalculate is false', async () => {
      // First calculation
      await service.calculateUsageForPeriod(testPeriod.id, {
        method: 'historical_average',
        recalculate: true
      });

      // Second calculation without recalculate
      const result = await service.calculateUsageForPeriod(testPeriod.id, {
        method: 'historical_average',
        recalculate: false
      });

      expect(result.itemsSkipped).toBe(3);
      expect(result.itemsProcessed).toBe(0);
    });

    test('should handle period not found error', async () => {
      await expect(
        service.calculateUsageForPeriod(999999, { method: 'recipe_based' })
      ).rejects.toThrow('Period 999999 not found');
    });

    test('should filter by specific item IDs', async () => {
      const itemIds = [testItems[0].id, testItems[1].id]; // Only first two items
      
      const result = await service.calculateUsageForPeriod(testPeriod.id, {
        method: 'recipe_based',
        itemIds,
        recalculate: true
      });

      expect(result.itemsProcessed).toBe(2);
      expect(result.analyses).toHaveLength(2);
    });

    test('should handle individual item processing errors gracefully', async () => {
      // Mock a service method to throw an error for one item
      const originalMethod = service.calculateTheoreticalUsage;
      service.calculateTheoreticalUsage = vi.fn().mockImplementation(async (item, period, method) => {
        if (item.name === 'Premium Saffron') {
          throw new Error('Mocked calculation error');
        }
        return originalMethod.call(service, item, period, method);
      });

      const result = await service.calculateUsageForPeriod(testPeriod.id, {
        method: 'recipe_based',
        recalculate: true
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].itemName).toBe('Premium Saffron');
      expect(result.itemsProcessed).toBe(2); // Other items should still process

      // Restore original method
      service.calculateTheoreticalUsage = originalMethod;
    });
  });

  describe('Multiple Periods Calculation', () => {
    test('should calculate usage for multiple periods', async () => {
      // Create additional test period
      const secondPeriod = await sequelize.models.InventoryPeriod.create({
        restaurantId: testRestaurant.id,
        periodName: 'Test Period - Week 2',
        periodStart: new Date('2025-01-08'),
        periodEnd: new Date('2025-01-14'),
        status: 'open'
      });

      // Create snapshots for second period
      for (const item of testItems) {
        await sequelize.models.PeriodInventorySnapshot.create({
          periodId: secondPeriod.id,
          inventoryItemId: item.id,
          snapshotType: 'beginning',
          quantity: item.currentStock * 0.8,
          unitCost: item.unitCost,
          totalValue: item.currentStock * 0.8 * item.unitCost,
          countedBy: 1,
          countedAt: new Date('2025-01-08T08:00:00Z'),
          verified: true
        });

        await sequelize.models.PeriodInventorySnapshot.create({
          periodId: secondPeriod.id,
          inventoryItemId: item.id,
          snapshotType: 'ending',
          quantity: item.currentStock * 0.6,
          unitCost: item.unitCost,
          totalValue: item.currentStock * 0.6 * item.unitCost,
          countedBy: 1,
          countedAt: new Date('2025-01-14T18:00:00Z'),
          verified: true
        });
      }

      const results = await service.calculateUsageForMultiplePeriods(
        [testPeriod.id, secondPeriod.id],
        { method: 'recipe_based', recalculate: true }
      );

      expect(results).toHaveLength(2);
      expect(results[0].periodId).toBe(testPeriod.id);
      expect(results[1].periodId).toBe(secondPeriod.id);
      expect(results[0].itemsProcessed).toBe(3);
      expect(results[1].itemsProcessed).toBe(3);

      // Cleanup
      await secondPeriod.destroy();
    });

    test('should handle failed periods in batch calculation', async () => {
      const invalidPeriodId = 999999;
      
      const results = await service.calculateUsageForMultiplePeriods(
        [testPeriod.id, invalidPeriodId],
        { method: 'recipe_based' }
      );

      expect(results).toHaveLength(2);
      expect(results[0].periodId).toBe(testPeriod.id);
      expect(results[0].itemsProcessed).toBeGreaterThan(0);
      
      expect(results[1].periodId).toBe(invalidPeriodId);
      expect(results[1].error).toBeDefined();
      expect(results[1].itemsProcessed).toBe(0);
    });
  });

  describe('Calculation Summary', () => {
    test('should generate comprehensive calculation summary', async () => {
      // Ensure we have analyses to summarize
      await service.calculateUsageForPeriod(testPeriod.id, {
        method: 'recipe_based',
        recalculate: true
      });

      const summary = await service.getCalculationSummary(testPeriod.id);

      expect(summary).toMatchObject({
        periodId: testPeriod.id,
        totalItems: 3,
        byPriority: {
          critical: expect.any(Number),
          high: expect.any(Number),
          medium: expect.any(Number),
          low: expect.any(Number)
        },
        byMethod: {
          recipe_based: 3, // All should be recipe-based
          historical_average: 0,
          manual: 0,
          ai_predicted: 0
        },
        totalVarianceDollarValue: expect.any(Number),
        averageConfidence: expect.any(Number)
      });

      // Verify priority counts add up to total
      const priorityTotal = Object.values(summary.byPriority).reduce((sum, count) => sum + count, 0);
      expect(priorityTotal).toBe(summary.totalItems);

      // Verify method counts add up to total  
      const methodTotal = Object.values(summary.byMethod).reduce((sum, count) => sum + count, 0);
      expect(methodTotal).toBe(summary.totalItems);
    });

    test('should handle empty period summary', async () => {
      // Create period with no analyses
      const emptyPeriod = await sequelize.models.InventoryPeriod.create({
        restaurantId: testRestaurant.id,
        periodName: 'Empty Period',
        periodStart: new Date('2025-02-01'),
        periodEnd: new Date('2025-02-07'),
        status: 'open'
      });

      const summary = await service.getCalculationSummary(emptyPeriod.id);

      expect(summary).toMatchObject({
        periodId: emptyPeriod.id,
        totalItems: 0,
        byPriority: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        },
        byMethod: {
          recipe_based: 0,
          historical_average: 0,
          manual: 0,
          ai_predicted: 0
        },
        totalVarianceDollarValue: 0,
        averageConfidence: 0 // NaN becomes 0
      });

      // Cleanup
      await emptyPeriod.destroy();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle items with zero unit cost', async () => {
      const freeItem = await sequelize.models.InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Free Item',
        category: 'test',
        unitType: 'each',
        unit: 'piece',
        unitCost: 0.00,
        currentStock: 5.00,
        minimumStock: 1.00,
        maximumStock: 10.00
      });

      // Create snapshots
      await sequelize.models.PeriodInventorySnapshot.create({
        periodId: testPeriod.id,
        inventoryItemId: freeItem.id,
        snapshotType: 'beginning',
        quantity: 5.00,
        unitCost: 0.00,
        totalValue: 0.00,
        countedBy: 1,
        countedAt: new Date('2025-01-01T08:00:00Z'),
        verified: true
      });

      await sequelize.models.PeriodInventorySnapshot.create({
        periodId: testPeriod.id,
        inventoryItemId: freeItem.id,
        snapshotType: 'ending',
        quantity: 3.00,
        unitCost: 0.00,
        totalValue: 0.00,
        countedBy: 1,
        countedAt: new Date('2025-01-07T18:00:00Z'),
        verified: true
      });

      const result = await service.calculateUsageForPeriod(testPeriod.id, {
        itemIds: [freeItem.id],
        method: 'recipe_based',
        recalculate: true
      });

      expect(result.itemsProcessed).toBe(1);
      expect(result.analyses[0].varianceDollarValue).toBe(0);

      // Cleanup
      await freeItem.destroy();
    });

    test('should handle very large numbers gracefully', async () => {
      const largeItem = await sequelize.models.InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Large Quantity Item',
        category: 'test',
        unitType: 'weight',
        unit: 'ton',
        unitCost: 1000.00,
        currentStock: 50000.00,
        minimumStock: 1000.00,
        maximumStock: 100000.00
      });

      // Create snapshots with large quantities
      await sequelize.models.PeriodInventorySnapshot.create({
        periodId: testPeriod.id,
        inventoryItemId: largeItem.id,
        snapshotType: 'beginning',
        quantity: 50000.00,
        unitCost: 1000.00,
        totalValue: 50000000.00,
        countedBy: 1,
        countedAt: new Date('2025-01-01T08:00:00Z'),
        verified: true
      });

      await sequelize.models.PeriodInventorySnapshot.create({
        periodId: testPeriod.id,
        inventoryItemId: largeItem.id,
        snapshotType: 'ending',
        quantity: 45000.00,
        unitCost: 1000.00,
        totalValue: 45000000.00,
        countedBy: 1,
        countedAt: new Date('2025-01-07T18:00:00Z'),
        verified: true
      });

      const result = await service.calculateUsageForPeriod(testPeriod.id, {
        itemIds: [largeItem.id],
        method: 'recipe_based',
        recalculate: true
      });

      expect(result.itemsProcessed).toBe(1);
      expect(result.analyses[0].actualQuantity).toBe(5000); // 50000 - 45000
      expect(result.analyses[0].varianceDollarValue).toBeGreaterThan(1000000); // Large dollar impact

      // Cleanup
      await largeItem.destroy();
    });
  });
});
