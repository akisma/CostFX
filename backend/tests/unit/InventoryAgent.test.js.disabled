import { jest } from '@jest/globals';
import InventoryAgent from '../../src/agents/InventoryAgent.js';

// Mock the helper functions
jest.unstable_mockModule('../../src/utils/helpers.js', () => ({
  calculateReorderPoint: jest.fn((dailyUsage, leadTime, safetyStock) => 
    dailyUsage * leadTime + safetyStock
  ),
  calculateEconomicOrderQuantity: jest.fn((annualDemand, orderCost, holdingCost) => 
    Math.sqrt((2 * annualDemand * orderCost) / holdingCost)
  )
}));

// Mock Sequelize models
jest.unstable_mockModule('../../src/models/index.js', () => ({
  InventoryItem: {
    findAll: jest.fn()
  },
  InventoryTransaction: {
    findAll: jest.fn()
  },
  Supplier: {
    findAll: jest.fn()
  }
}));

describe('InventoryAgent', () => {
  let inventoryAgent;
  
  beforeEach(() => {
    inventoryAgent = new InventoryAgent();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with correct name and capabilities', () => {
      expect(inventoryAgent.name).toBe('InventoryAgent');
      expect(inventoryAgent.capabilities).toEqual([
        'track_inventory_levels',
        'predict_reorder_needs',
        'monitor_expiration_dates',
        'analyze_waste_patterns',
        'optimize_stock_levels'
      ]);
    });

    test('should initialize with default configuration', () => {
      expect(inventoryAgent.config).toEqual({
        defaultSafetyStockDays: 3,
        expirationWarningDays: 5,
        highWasteThreshold: 0.15,
        lowStockMultiplier: 1.2,
        overstockMultiplier: 0.9
      });
    });
  });

  describe('process method', () => {
    test('should route track_levels request correctly', async () => {
      const mockResult = { inventoryItems: [], summary: {} };
      jest.spyOn(inventoryAgent, 'trackInventoryLevels').mockResolvedValue(mockResult);

      const request = {
        type: 'track_levels',
        data: { restaurantId: 1 }
      };

      const result = await inventoryAgent.process(request);
      
      expect(inventoryAgent.trackInventoryLevels).toHaveBeenCalledWith({ restaurantId: 1 });
      expect(result).toBe(mockResult);
      expect(inventoryAgent.metrics.requests).toBe(1);
    });

    test('should route predict_reorder request correctly', async () => {
      const mockResult = { recommendations: [], summary: {} };
      jest.spyOn(inventoryAgent, 'predictReorderNeeds').mockResolvedValue(mockResult);

      const request = {
        type: 'predict_reorder',
        data: { restaurantId: 1 }
      };

      const result = await inventoryAgent.process(request);
      
      expect(inventoryAgent.predictReorderNeeds).toHaveBeenCalledWith({ restaurantId: 1 });
      expect(result).toBe(mockResult);
    });

    test('should throw error for unknown request type', async () => {
      const request = {
        type: 'unknown_type',
        data: { restaurantId: 1 }
      };

      await expect(inventoryAgent.process(request)).rejects.toThrow('Unknown request type: unknown_type');
    });

    test('should update metrics on successful request', async () => {
      const mockResult = { inventoryItems: [] };
      jest.spyOn(inventoryAgent, 'trackInventoryLevels').mockResolvedValue(mockResult);
      jest.spyOn(inventoryAgent, 'updateMetrics').mockImplementation(() => {});

      const request = {
        type: 'track_levels',
        data: { restaurantId: 1 }
      };

      await inventoryAgent.process(request);
      
      expect(inventoryAgent.updateMetrics).toHaveBeenCalledWith(expect.any(Number), true);
    });

    test('should update metrics on failed request', async () => {
      jest.spyOn(inventoryAgent, 'trackInventoryLevels').mockRejectedValue(new Error('Test error'));
      jest.spyOn(inventoryAgent, 'updateMetrics').mockImplementation(() => {});

      const request = {
        type: 'track_levels',
        data: { restaurantId: 1 }
      };

      await expect(inventoryAgent.process(request)).rejects.toThrow('Test error');
      expect(inventoryAgent.updateMetrics).toHaveBeenCalledWith(expect.any(Number), false);
    });
  });

  describe('trackInventoryLevels', () => {
    test('should analyze inventory items and return summary', async () => {
      const mockInventory = [
        {
          id: 1,
          name: 'Test Item 1',
          currentStock: 10,
          minimumStock: 15,
          maximumStock: 100,
          unitCost: 5.00,
          expirationDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
        },
        {
          id: 2,
          name: 'Test Item 2',
          currentStock: 0,
          minimumStock: 5,
          maximumStock: 50,
          unitCost: 3.00,
          expirationDate: null
        }
      ];

      jest.spyOn(inventoryAgent, 'getCurrentInventory').mockResolvedValue(mockInventory);

      const result = await inventoryAgent.trackInventoryLevels({ restaurantId: 1 });

      expect(result.inventoryItems).toHaveLength(2);
      expect(result.inventoryItems[0].status).toBe('low_stock');
      expect(result.inventoryItems[1].status).toBe('out_of_stock');
      expect(result.summary.totalItems).toBe(2);
      expect(result.summary.totalValue).toBe(50.00); // 10 * 5.00 + 0 * 3.00
      expect(result.summary.lowStockItems).toBe(1);
      expect(result.summary.outOfStockItems).toBe(1);
    });

    test('should detect expiring items', async () => {
      const mockInventory = [
        {
          id: 1,
          name: 'Expiring Item',
          currentStock: 20,
          minimumStock: 10,
          maximumStock: 100,
          unitCost: 2.00,
          expirationDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
        }
      ];

      jest.spyOn(inventoryAgent, 'getCurrentInventory').mockResolvedValue(mockInventory);

      const result = await inventoryAgent.trackInventoryLevels({ restaurantId: 1 });

      expect(result.inventoryItems[0].status).toBe('expiring_soon');
      expect(result.inventoryItems[0].alerts).toContain('Expires in 2 days');
      expect(result.summary.expiringItems).toBe(1);
    });
  });

  describe('predictReorderNeeds', () => {
    test('should predict reorder needs and sort by priority', async () => {
      const mockInventory = [
        {
          id: 1,
          name: 'High Priority Item',
          currentStock: 5,
          minimumStock: 10,
          dailyUsage: 8,
          leadTimeDays: 2,
          unitCost: 4.50,
          supplierId: 1,
          supplierName: 'Supplier A'
        },
        {
          id: 2,
          name: 'Low Priority Item',
          currentStock: 50,
          minimumStock: 20,
          dailyUsage: 5,
          leadTimeDays: 1,
          unitCost: 2.25,
          supplierId: 2,
          supplierName: 'Supplier B'
        }
      ];

      jest.spyOn(inventoryAgent, 'getInventoryItemsWithUsage').mockResolvedValue(mockInventory);

      const result = await inventoryAgent.predictReorderNeeds({ restaurantId: 1, forecastDays: 7 });

      expect(result.recommendations).toHaveLength(2);
      expect(result.recommendations[0].priority).toBe('high'); // High priority item should be first
      expect(result.recommendations[0].needsReorder).toBe(true);
      expect(result.summary.itemsNeedingReorder).toBeGreaterThan(0);
      expect(result.summary.totalEstimatedCost).toBeGreaterThan(0);
    });
  });

  describe('monitorExpirationDates', () => {
    test('should categorize items by expiration urgency', async () => {
      const mockInventory = [
        {
          id: 1,
          name: 'Critical Item',
          currentStock: 10,
          unitCost: 5.00,
          expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
          category: 'produce',
          unit: 'lbs'
        },
        {
          id: 2,
          name: 'Warning Item',
          currentStock: 15,
          unitCost: 3.00,
          expirationDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
          category: 'dairy',
          unit: 'gallons'
        }
      ];

      jest.spyOn(inventoryAgent, 'getExpiringItems').mockResolvedValue(mockInventory);

      const result = await inventoryAgent.monitorExpirationDates({ restaurantId: 1 });

      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0].severity).toBe('critical');
      expect(result.alerts[1].severity).toBe('warning');
      expect(result.summary.criticalItems).toBe(1);
      expect(result.summary.warningItems).toBe(1);
      expect(result.summary.totalPotentialWasteValue).toBe(95.00); // 10*5 + 15*3
    });
  });

  describe('analyzeWastePatterns', () => {
    test('should analyze waste by item and generate recommendations', async () => {
      const mockWasteData = [
        {
          itemName: 'Lettuce',
          category: 'produce',
          wasteQuantity: 8,
          totalQuantity: 40,
          reason: 'spoilage'
        },
        {
          itemName: 'Lettuce',
          category: 'produce',
          wasteQuantity: 5,
          totalQuantity: 35,
          reason: 'spoilage'
        },
        {
          itemName: 'Chicken',
          category: 'meat',
          wasteQuantity: 2,
          totalQuantity: 50,
          reason: 'expiration'
        }
      ];

      jest.spyOn(inventoryAgent, 'getWasteData').mockResolvedValue(mockWasteData);

      const result = await inventoryAgent.analyzeWastePatterns({ restaurantId: 1, timeframeDays: 30 });

      expect(result.wasteAnalysis).toHaveLength(2); // Grouped by item name
      expect(result.wasteAnalysis[0].itemName).toBe('Lettuce');
      expect(result.wasteAnalysis[0].wastePercentage).toBeGreaterThan(0);
      expect(result.recommendations).toBeDefined();
      expect(result.summary.totalTransactions).toBe(3);
    });
  });

  describe('optimizeStockLevels', () => {
    test('should calculate optimal stock levels and potential savings', async () => {
      const mockInventory = [
        {
          id: 1,
          name: 'Test Item',
          minimumStock: 30,
          maximumStock: 150,
          dailyUsage: 10,
          leadTimeDays: 3,
          unitCost: 5.00,
          holdingCostRate: 0.20,
          orderCost: 25,
          seasonalVariation: 0.15
        }
      ];

      jest.spyOn(inventoryAgent, 'getInventoryItemsWithUsage').mockResolvedValue(mockInventory);

      const result = await inventoryAgent.optimizeStockLevels({ 
        restaurantId: 1, 
        optimizationGoal: 'balanced' 
      });

      expect(result.optimizations).toHaveLength(1);
      expect(result.optimizations[0].current.minStock).toBe(30);
      expect(result.optimizations[0].current.maxStock).toBe(150);
      expect(result.optimizations[0].optimized).toBeDefined();
      expect(result.optimizations[0].impact).toBeDefined();
      expect(result.summary.totalItems).toBe(1);
    });
  });

  describe('Helper methods', () => {
    test('getDaysUntilExpiration should calculate days correctly', () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      const result = inventoryAgent.getDaysUntilExpiration(futureDate);
      expect(result).toBe(5);
    });

    test('getDaysUntilExpiration should return null for null date', () => {
      const result = inventoryAgent.getDaysUntilExpiration(null);
      expect(result).toBeNull();
    });

    test('estimateDailyUsage should return reasonable values', () => {
      const item = { 
        category: 'produce', 
        maximumStock: 100 
      };
      const result = inventoryAgent.estimateDailyUsage(item);
      expect(result).toBe(15); // 15% of 100
    });

    test('estimateSeasonalVariation should return category-specific values', () => {
      expect(inventoryAgent.estimateSeasonalVariation('produce')).toBe(0.25);
      expect(inventoryAgent.estimateSeasonalVariation('meat')).toBe(0.15);
      expect(inventoryAgent.estimateSeasonalVariation('unknown')).toBe(0.15);
    });
  });

  describe('generateWasteRecommendations', () => {
    test('should generate recommendations for high waste items', () => {
      const wasteAnalysis = [
        {
          itemName: 'Lettuce',
          category: 'produce',
          wastePercentage: 20,
          severity: 'high',
          primaryReason: 'spoilage',
          totalWaste: 10
        },
        {
          itemName: 'Bread',
          category: 'bakery',
          wastePercentage: 5,
          severity: 'low',
          primaryReason: 'expiration',
          totalWaste: 2
        }
      ];

      const recommendations = inventoryAgent.generateWasteRecommendations(wasteAnalysis);

      expect(recommendations).toHaveLength(2); // One for inventory management, one for storage
      expect(recommendations[0].type).toBe('inventory-management');
      expect(recommendations[0].priority).toBe('high');
      expect(recommendations[1].type).toBe('storage-optimization');
    });
  });

  describe('generateStockRecommendations', () => {
    test('should generate specific stock optimization recommendations', () => {
      const item = {
        minimumStock: 20,
        maximumStock: 100,
        seasonalVariation: 0.25
      };

      const recommendations = inventoryAgent.generateStockRecommendations(item, 15, 80, 25);

      expect(recommendations).toContain('Reduce minimum stock level to lower holding costs');
      expect(recommendations).toContain('Adjust maximum stock level based on Economic Order Quantity');
      expect(recommendations).toContain('Consider seasonal stock adjustments for this item');
    });
  });
});

describe('InventoryAgent Integration', () => {
  let inventoryAgent;

  beforeEach(() => {
    inventoryAgent = new InventoryAgent();
  });

  test('should handle complete workflow from request to response', async () => {
    // Mock all dependencies for integration test
    jest.spyOn(inventoryAgent, 'getCurrentInventory').mockResolvedValue([
      {
        id: 1,
        name: 'Test Item',
        currentStock: 10,
        minimumStock: 15,
        maximumStock: 100,
        unitCost: 5.00,
        expirationDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      }
    ]);

    const request = {
      type: 'track_levels',
      data: { restaurantId: 1 }
    };

    const result = await inventoryAgent.process(request);

    expect(result).toBeDefined();
    expect(result.inventoryItems).toHaveLength(1);
    expect(result.summary).toBeDefined();
    expect(result.generatedAt).toBeDefined();
    expect(inventoryAgent.metrics.requests).toBe(1);
  });

  test('should maintain state consistency across multiple requests', async () => {
    jest.spyOn(inventoryAgent, 'getCurrentInventory').mockResolvedValue([]);

    await inventoryAgent.process({ type: 'track_levels', data: { restaurantId: 1 } });
    await inventoryAgent.process({ type: 'track_levels', data: { restaurantId: 1 } });

    expect(inventoryAgent.metrics.requests).toBe(2);
    expect(inventoryAgent.name).toBe('InventoryAgent');
  });
});
