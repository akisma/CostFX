import { describe, test, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock sequelize module to provide correct Op symbols
vi.mock('sequelize', async () => {
  const actual = await vi.importActual('sequelize');
  return {
    ...actual,
    Op: {
      between: 'between',
      in: 'in',
      gte: 'gte',
      lte: 'lte',
      lt: 'lt'
    }
  };
});

// Mock all external dependencies
vi.mock('../../src/config/database.js', () => {
  const mockModels = {
    InventoryPeriod: {
      findByPk: vi.fn((id) => {
        if (id === 1) return Promise.resolve({
          id: 1,
          restaurantId: 1,
          periodName: 'Test Period',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-01-07'),
          status: 'closed'
        });
        if (id === 2) return Promise.resolve({
          id: 2,
          restaurantId: 1,
          periodName: 'Second Period',
          periodStart: new Date('2025-01-08'),
          periodEnd: new Date('2025-01-14'),
          status: 'closed'
        });
        return Promise.resolve(null);
      }),
      findAll: vi.fn(() => Promise.resolve([])),
      create: vi.fn()
    },
    InventoryItem: {
      findAll: vi.fn((options) => {
        const allItems = [
          {
            id: 1,
            restaurantId: 1,
            name: 'Premium Saffron',
            category: 'spices',
            unitType: 'weight',
            unit: 'oz',
            unitCost: 19.00,
            currentStock: 50.0,
            minimumStock: 10.0,
            maximumStock: 100.0
          },
          {
            id: 2,
            restaurantId: 1,
            name: 'Romaine Lettuce',
            category: 'produce',
            unitType: 'weight',
            unit: 'lb',
            unitCost: 1.25,
            currentStock: 25.0,
            minimumStock: 5.0,
            maximumStock: 50.0
          },
          {
            id: 3,
            restaurantId: 1,
            name: 'Whole Milk',
            category: 'dairy',
            unitType: 'volume',
            unit: 'liter',
            unitCost: 3.50,
            currentStock: 8.0,
            minimumStock: 2.0,
            maximumStock: 15.0
          }
        ];
        
        // Filter by specific item IDs if provided (Op.in becomes the string 'in')
        const itemIdFilter = options?.where?.id?.in || options?.where?.id?.['in'];
        if (itemIdFilter) {
          let filteredItems = allItems.filter(item => itemIdFilter.includes(item.id));
          
          // Handle special test cases by creating items on demand
          itemIdFilter.forEach(itemId => {
            if (!filteredItems.find(item => item.id === itemId)) {
              // Create special items for edge case tests
              if (itemId === 999) {
                // Free item for zero cost test
                filteredItems.push({
                  id: 999,
                  restaurantId: 1,
                  name: 'Free Item',
                  category: 'test',
                  unitType: 'each',
                  unit: 'piece',
                  unitCost: 0.00,
                  currentStock: 5.00,
                  minimumStock: 1.00,
                  maximumStock: 10.00
                });
              } else if (itemId === 1001) {
                // Large number item test
                filteredItems.push({
                  id: 1001,
                  restaurantId: 1,
                  name: 'Large Quantity Item',
                  category: 'test',
                  unitType: 'weight',
                  unit: 'ton',
                  unitCost: 1000.00,
                  currentStock: 50000.00,
                  minimumStock: 1000.00,
                  maximumStock: 100000.00
                });
              }
            }
          });
          
          return Promise.resolve(filteredItems);
        }
        
        return Promise.resolve(allItems);
      }),
      create: vi.fn()
    },
    IngredientCategory: {
      create: vi.fn()
    },
    PeriodInventorySnapshot: {
      findAll: vi.fn((options) => {
        // Default snapshots for standard tests
        const defaultSnapshots = [
          // Item 1 snapshots (Premium Saffron - matches actual usage test expectations)
          {
            id: 1,
            periodId: 1,
            inventoryItemId: 1,
            snapshotType: 'beginning',
            quantity: 50.0,   // Test expects 50
            unitCost: 19.00,  // Test expects 19.00
            totalValue: 950.0,
            countedBy: 1,
            countedAt: new Date('2025-01-01T08:00:00Z'),
            verified: true
          },
          {
            id: 2,
            periodId: 1,
            inventoryItemId: 1,
            snapshotType: 'ending',
            quantity: 45.0,   // Test expects 45 (usage = 50-45 = 5)
            unitCost: 19.00,  // Test expects 19.00
            totalValue: 855.0,
            countedBy: 1,
            countedAt: new Date('2025-01-07T18:00:00Z'),
            verified: true
          },
          // Item 2 snapshots (Romaine Lettuce - matches purchase test expectations)
          {
            id: 3,
            periodId: 1,
            inventoryItemId: 2,
            snapshotType: 'beginning',
            quantity: 25.0,   // Test expects 25
            unitCost: 1.25,   // Test expects 1.25
            totalValue: 31.25,
            countedBy: 1,
            countedAt: new Date('2025-01-01T08:00:00Z'),
            verified: true
          },
          {
            id: 4,
            periodId: 1,
            inventoryItemId: 2,
            snapshotType: 'ending',
            quantity: 20.0,   // Test expects 20 (with 10 purchases, usage = 25+10-20 = 15)
            unitCost: 1.25,   // Test expects 1.25
            totalValue: 25.0,
            countedBy: 1,
            countedAt: new Date('2025-01-07T18:00:00Z'),
            verified: true
          },
          // Item 3 snapshots
          {
            id: 5,
            periodId: 1,
            inventoryItemId: 3,
            snapshotType: 'beginning',
            quantity: 8.0,
            unitCost: 3.50,
            totalValue: 28.0,
            countedBy: 1,
            countedAt: new Date('2025-01-01T08:00:00Z'),
            verified: true
          },
          {
            id: 6,
            periodId: 1,
            inventoryItemId: 3,
            snapshotType: 'ending',
            quantity: 6.0,
            unitCost: 3.50,
            totalValue: 21.0,
            countedBy: 1,
            countedAt: new Date('2025-01-07T18:00:00Z'),
            verified: true
          },
          
          // Period 2 snapshots for multi-period tests
          {
            id: 7,
            periodId: 2,
            inventoryItemId: 1,
            snapshotType: 'beginning',
            quantity: 45.0,
            unitCost: 19.00,
            totalValue: 855.0,
            countedBy: 1,
            countedAt: new Date('2025-01-08T08:00:00Z'),
            verified: true
          },
          {
            id: 8,
            periodId: 2,
            inventoryItemId: 1,
            snapshotType: 'ending',
            quantity: 40.0,
            unitCost: 19.00,
            totalValue: 760.0,
            countedBy: 1,
            countedAt: new Date('2025-01-14T18:00:00Z'),
            verified: true
          },
          {
            id: 9,
            periodId: 2,
            inventoryItemId: 2,
            snapshotType: 'beginning',
            quantity: 20.0,
            unitCost: 1.25,
            totalValue: 25.0,
            countedBy: 1,
            countedAt: new Date('2025-01-08T08:00:00Z'),
            verified: true
          },
          {
            id: 10,
            periodId: 2,
            inventoryItemId: 2,
            snapshotType: 'ending',
            quantity: 18.0,
            unitCost: 1.25,
            totalValue: 22.5,
            countedBy: 1,
            countedAt: new Date('2025-01-14T18:00:00Z'),
            verified: true
          },
          {
            id: 11,
            periodId: 2,
            inventoryItemId: 3,
            snapshotType: 'beginning',
            quantity: 6.0,
            unitCost: 3.50,
            totalValue: 21.0,
            countedBy: 1,
            countedAt: new Date('2025-01-08T08:00:00Z'),
            verified: true
          },
          {
            id: 12,
            periodId: 2,
            inventoryItemId: 3,
            snapshotType: 'ending',
            quantity: 4.0,
            unitCost: 3.50,
            totalValue: 14.0,
            countedBy: 1,
            countedAt: new Date('2025-01-14T18:00:00Z'),
            verified: true
          },
          // Special test case snapshots
          // Free item (ID 999) snapshots for zero cost test
          {
            id: 999,
            periodId: 1,
            inventoryItemId: 999,
            snapshotType: 'beginning',
            quantity: 5.00,
            unitCost: 0.00,
            totalValue: 0.00,
            countedBy: 1,
            countedAt: new Date('2025-01-01T08:00:00Z'),
            verified: true
          },
          {
            id: 1000,
            periodId: 1,
            inventoryItemId: 999,
            snapshotType: 'ending',
            quantity: 3.00,
            unitCost: 0.00,
            totalValue: 0.00,
            countedBy: 1,
            countedAt: new Date('2025-01-07T18:00:00Z'),
            verified: true
          },
          // Large number item (ID 1001) snapshots for large numbers test
          {
            id: 1001,
            periodId: 1,
            inventoryItemId: 1001,
            snapshotType: 'beginning',
            quantity: 50000.00,
            unitCost: 1000.00,
            totalValue: 50000000.00,
            countedBy: 1,
            countedAt: new Date('2025-01-01T08:00:00Z'),
            verified: true
          },
          {
            id: 1002,
            periodId: 1,
            inventoryItemId: 1001,
            snapshotType: 'ending',
            quantity: 45000.00,
            unitCost: 1000.00,
            totalValue: 45000000.00,
            countedBy: 1,
            countedAt: new Date('2025-01-07T18:00:00Z'),
            verified: true
          }
        ];

        // Return filtered results based on query
        let filteredSnapshots = defaultSnapshots;
        
        if (options?.where?.periodId) {
          filteredSnapshots = filteredSnapshots.filter(s => s.periodId === options.where.periodId);
        }
        
        if (options?.where?.inventoryItemId) {
          filteredSnapshots = filteredSnapshots.filter(s => s.inventoryItemId === options.where.inventoryItemId);
        }
        
        return Promise.resolve(filteredSnapshots);
      }),
      create: vi.fn()
    },
    InventoryTransaction: {
      findAll: vi.fn((options) => {
        // Return purchase transaction for item 2 (Romaine Lettuce)
        if (options?.where?.inventoryItemId === 2) {
          return Promise.resolve([
            {
              id: 1,
              periodId: 1,
              inventoryItemId: 2,
              transactionType: 'purchase',
              quantity: 10.0,  // Test expects 10 lbs purchased
              unitCost: 1.25,
              totalCost: 12.50,
              transactionDate: new Date('2025-01-03T10:00:00Z'),
              notes: 'Fresh lettuce delivery'
            }
          ]);
        }
        return Promise.resolve([]);
      }),
      create: vi.fn()
    },
    TheoreticalUsageAnalysis: {
      findOne: vi.fn((options) => {
        // Check if we've created analyses for this period+item combination
        const periodId = options?.where?.periodId;
        const inventoryItemId = options?.where?.inventoryItemId;
        
        // Simple stateful logic: if this is a repeated query, return existing analysis
        const callKey = `${periodId}-${inventoryItemId}`;
        if (!mockModels._analysisCreated) mockModels._analysisCreated = new Set();
        
        if (mockModels._analysisCreated.has(callKey)) {
          return Promise.resolve({
            id: Math.floor(Math.random() * 1000000),
            periodId,
            inventoryItemId,
            calculationMethod: 'historical_average',
            theoreticalQuantity: 0,
            actualQuantity: 5,
            varianceQuantity: -5,
            variancePercentage: -100,
            varianceDollarValue: -25,
            priority: 'medium',
            calculationConfidence: 0.2,
            update: vi.fn(() => Promise.resolve())
          });
        }
        
        return Promise.resolve(null);
      }),
      findAll: vi.fn((options) => {
        // Return existing analyses for summary calculations
        if (options?.where?.periodId === 1) {
          return Promise.resolve([
            {
              id: 1,
              periodId: 1,
              inventoryItemId: 1,
              calculationMethod: 'recipe_based',
              theoreticalQuantity: 3.0,
              actualQuantity: 5.0,
              varianceQuantity: 2.0,
              variancePercentage: 66.67,
              varianceDollarValue: 38.0,
              priority: 'medium',
              calculationConfidence: 0.9
            },
            {
              id: 2,
              periodId: 1,
              inventoryItemId: 2,
              calculationMethod: 'recipe_based',
              theoreticalQuantity: 10.0,
              actualQuantity: 15.0,
              varianceQuantity: 5.0,
              variancePercentage: 50.0,
              varianceDollarValue: 6.25,
              priority: 'low',
              calculationConfidence: 0.9
            },
            {
              id: 3,
              periodId: 1,
              inventoryItemId: 3,
              calculationMethod: 'recipe_based',
              theoreticalQuantity: 1.5,
              actualQuantity: 2.0,
              varianceQuantity: 0.5,
              variancePercentage: 33.33,
              varianceDollarValue: 1.75,
              priority: 'low',
              calculationConfidence: 0.9
            }
          ]);
        }
        return Promise.resolve([]);
      }),
      create: vi.fn((data) => {
        // Mark this analysis as created for future findOne calls
        const callKey = `${data.periodId}-${data.inventoryItemId}`;
        if (!mockModels._analysisCreated) mockModels._analysisCreated = new Set();
        mockModels._analysisCreated.add(callKey);
        
        // Return a proper analysis object with all expected properties
        return Promise.resolve({
          id: Math.floor(Math.random() * 1000000),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      })
    },
    Restaurant: {
      create: vi.fn()
    }
  };

  return {
    default: {
      models: mockModels,
      Sequelize: {
        Op: {
          between: 'between',
          in: 'in',
          gte: 'gte',
          lte: 'lte'
        }
      }
    }
  };
});

// Import after mocking
const { default: UsageCalculationService } = await import('../../src/services/UsageCalculationService.js');

describe('UsageCalculationService Integration', () => {
  let service;
  let testRestaurant, testItems, testPeriod, testSnapshots;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new UsageCalculationService();
    
    // Inject mocked models directly (no real DB needed)
    const mockDatabase = await import('../../src/config/database.js');
    service.models = mockDatabase.default.models;
  });

  beforeAll(async () => {

    // Setup test data objects
    testRestaurant = {
      id: 1,
      name: 'Test Restaurant',
      timezone: 'America/New_York',
      currency: 'USD'
    };

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
        confidence: 0.20  // Low confidence without history
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
      // Create mock item without snapshots (pure JS object - no DB)
      const orphanItem = {
        id: 998,
        restaurantId: testRestaurant.id,
        name: 'Orphan Item',
        category: 'test',
        unitType: 'weight',
        unit: 'lb',
        unitCost: 5.00,
        currentStock: 10.00,
        minimumStock: 2.00,
        maximumStock: 20.00
      };

      await expect(
        service.calculateActualUsage(orphanItem, testPeriod)
      ).rejects.toThrow(`Missing snapshots for item ${orphanItem.id} in period ${testPeriod.id}`);
    });

    test('should ensure non-negative actual usage', async () => {
      // Create mock item (pure JS object - no DB)
      const testItem = {
        id: 998,
        restaurantId: testRestaurant.id,
        name: 'Negative Test Item',
        category: 'test',
        unitType: 'weight',
        unit: 'lb',
        unitCost: 3.00,
        currentStock: 10.00,
        minimumStock: 2.00,
        maximumStock: 20.00
      };

      // Mock snapshots that would create negative usage (ending > beginning)
      const mockSnapshots = [
        {
          periodId: testPeriod.id,
          inventoryItemId: testItem.id,
          snapshotType: 'beginning',
          quantity: 10.00,
          unitCost: 3.00,
          totalValue: 30.00,
          countedBy: 1,
          countedAt: new Date('2025-01-01T08:00:00Z'),
          verified: true
        },
        {
          periodId: testPeriod.id,
          inventoryItemId: testItem.id,
          snapshotType: 'ending',
          quantity: 15.00,
          unitCost: 3.00,
          totalValue: 45.00,
          countedBy: 1,
          countedAt: new Date('2025-01-07T18:00:00Z'),
          verified: true
        }
      ];

      // Mock the snapshot query to return our test data
      const mockModels = await import('../../src/config/database.js');
      mockModels.default.models.PeriodInventorySnapshot.findAll.mockResolvedValueOnce(mockSnapshots);

      const result = await service.calculateActualUsage(testItem, testPeriod);
      
      // Should be 0, not negative
      expect(result.quantity).toBe(0);
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

      // Verify the service returns expected analysis count
      expect(result.itemsProcessed).toBe(3);
      expect(result.analyses).toHaveLength(3);
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
      // Create mock second period (pure JS object - no DB)
      const secondPeriod = {
        id: 2,
        restaurantId: testRestaurant.id,
        periodName: 'Test Period - Week 2',
        periodStart: new Date('2025-01-08'),
        periodEnd: new Date('2025-01-14'),
        status: 'open'
      };

      // Mock snapshots for second period would be handled by the service mocking
      // No direct database calls needed

      const results = await service.calculateUsageForMultiplePeriods(
        [testPeriod.id, secondPeriod.id],
        { method: 'recipe_based', recalculate: true }
      );

      expect(results).toHaveLength(2);
      expect(results[0].periodId).toBe(testPeriod.id);
      expect(results[1].periodId).toBe(secondPeriod.id);
      expect(results[0].itemsProcessed).toBe(3);
      expect(results[1].itemsProcessed).toBe(3);

      // Cleanup not needed with mock objects
    });

    test('should handle failed periods in batch calculation', async () => {
      const invalidPeriodId = 999999;
      
      const results = await service.calculateUsageForMultiplePeriods(
        [testPeriod.id, invalidPeriodId],
        { method: 'recipe_based', recalculate: true }
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
      const emptyPeriod = {
        id: 999,
        restaurantId: testRestaurant.id,
        periodName: 'Empty Period',
        periodStart: new Date('2025-02-01'),
        periodEnd: new Date('2025-02-07'),
        status: 'open'
      };

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

      // Cleanup not needed with mock objects
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle items with zero unit cost', async () => {
      const freeItem = {
        id: 999,
        restaurantId: testRestaurant.id,
        name: 'Free Item',
        category: 'test',
        unitType: 'each',
        unit: 'piece',
        unitCost: 0.00,
        currentStock: 5.00,
        minimumStock: 1.00,
        maximumStock: 10.00
      };

      // Create snapshots
      const freeItemSnapshots = [
        {
          id: 999,
          periodId: testPeriod.id,
          inventoryItemId: freeItem.id,
          snapshotType: 'beginning',
          quantity: 5.00,
          unitCost: 0.00,
          totalValue: 0.00,
          countedBy: 1,
          countedAt: new Date('2025-01-01T08:00:00Z'),
          verified: true
        },
        {
          id: 1000,
          periodId: testPeriod.id,
          inventoryItemId: freeItem.id,
          snapshotType: 'ending',
          quantity: 3.00,
          unitCost: 0.00,
          totalValue: 0.00,
          countedBy: 1,
          countedAt: new Date('2025-01-07T18:00:00Z'),
          verified: true
        }
      ];

      const result = await service.calculateUsageForPeriod(testPeriod.id, {
        itemIds: [freeItem.id],
        method: 'recipe_based',
        recalculate: true
      });

      expect(result.itemsProcessed).toBe(1);
      expect(result.analyses[0].varianceDollarValue).toBe(0);

      // Cleanup not needed with mock objects
    });

    test('should handle very large numbers gracefully', async () => {
      const largeItem = {
        id: 1001,
        restaurantId: testRestaurant.id,
        name: 'Large Quantity Item',
        category: 'test',
        unitType: 'weight',
        unit: 'ton',
        unitCost: 1000.00,
        currentStock: 50000.00,
        minimumStock: 1000.00,
        maximumStock: 100000.00
      };

      // Create snapshots with large quantities
      const largeItemSnapshots = [
        {
          id: 1001,
          periodId: testPeriod.id,
          inventoryItemId: largeItem.id,
          snapshotType: 'beginning',
          quantity: 50000.00,
          unitCost: 1000.00,
          totalValue: 50000000.00,
          countedBy: 1,
          countedAt: new Date('2025-01-01T08:00:00Z'),
          verified: true
        },
        {
          id: 1002,
          periodId: testPeriod.id,
          inventoryItemId: largeItem.id,
          snapshotType: 'ending',
          quantity: 45000.00,
          unitCost: 1000.00,
          totalValue: 45000000.00,
          countedBy: 1,
          countedAt: new Date('2025-01-07T18:00:00Z'),
          verified: true
        }
      ];

      const result = await service.calculateUsageForPeriod(testPeriod.id, {
        itemIds: [largeItem.id],
        method: 'recipe_based',
        recalculate: true
      });

      expect(result.itemsProcessed).toBe(1);
      expect(result.analyses[0].actualQuantity).toBe(5000); // 50000 - 45000
      expect(result.analyses[0].varianceDollarValue).toBeGreaterThan(1000000); // Large dollar impact

      // Cleanup not needed with mock objects
    });
  });
});