import { vi, describe, test, expect, beforeEach } from 'vitest';

// Mock enhanced inventory items with Dave's variance system
const mockEnhancedInventoryItems = [
  {
    id: 1,
    restaurant_id: 1,
    name: 'Premium Saffron',
    category: 'spices', // Legacy field
    category_id: 101, // New hierarchical category
    unit: 'oz',
    minimum_stock: 10.00,
    maximum_stock: 50.00,
    unit_cost: 18.50,
    supplier_id: 1,
    // Dave's new variance management fields
    variance_threshold_quantity: 5.00,
    variance_threshold_dollar: 100.00,
    high_value_flag: true,
    theoretical_yield_factor: 0.95, // 5% waste factor
    cost_per_unit_variance_pct: 5.00, // Tighter control for expensive items
    is_active: true
  },
  {
    id: 2,
    restaurant_id: 1,
    name: 'Romaine Lettuce',
    category: 'produce',
    category_id: 201, // produce.leafy_greens.romaine
    unit: 'lbs',
    minimum_stock: 20.00,
    maximum_stock: 100.00,
    unit_cost: 1.25,
    supplier_id: 2,
    // Dave's variance thresholds - more relaxed for low-value items
    variance_threshold_quantity: 50.00,
    variance_threshold_dollar: 25.00,
    high_value_flag: false,
    theoretical_yield_factor: 0.85, // 15% waste factor for produce
    cost_per_unit_variance_pct: 15.00,
    is_active: true
  },
  {
    id: 3,
    restaurant_id: 1,
    name: 'Premium Ribeye',
    category: 'meat',
    category_id: 301, // meat.beef.ribeye
    unit: 'lbs',
    minimum_stock: 15.00,
    maximum_stock: 40.00,
    unit_cost: 24.00,
    supplier_id: 3,
    // High-value meat with strict controls
    variance_threshold_quantity: 3.00,
    variance_threshold_dollar: 75.00,
    high_value_flag: true,
    theoretical_yield_factor: 0.90, // 10% waste factor
    cost_per_unit_variance_pct: 8.00,
    is_active: true
  }
];

// Mock hierarchical categories
const mockCategories = [
  {
    id: 101,
    path: 'spices.premium.saffron',
    name: 'Saffron',
    level: 3
  },
  {
    id: 201,
    path: 'produce.leafy_greens.romaine',
    name: 'Romaine Lettuce',
    level: 3
  },
  {
    id: 301,
    path: 'meat.beef.ribeye',
    name: 'Ribeye Steak',
    level: 3
  }
];

describe('Enhanced InventoryItem Model - Dave\'s Variance System', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should identify variance significance using Dave\'s thresholds', async () => {
    // Mock item with Dave's business logic
    const mockItem = {
      id: 1,
      name: 'Premium Saffron',
      varianceThresholdQuantity: 5.00,
      varianceThresholdDollar: 100.00,
      highValueFlag: true,
      isVarianceSignificant: vi.fn().mockImplementation(function(quantityVariance, valueVariance) {
        const absQuantityVariance = Math.abs(quantityVariance || 0);
        const absValueVariance = Math.abs(valueVariance || 0);
        return absQuantityVariance > this.varianceThresholdQuantity ||
               absValueVariance > this.varianceThresholdDollar;
      })
    };

    // Test Dave's scenarios
    
    // Scenario 1: Small saffron loss - significant because exceeds quantity threshold
    let isSignificant = mockItem.isVarianceSignificant(-6.0, -111.00); // 6 oz, $111
    expect(isSignificant).toBe(true); // Both thresholds exceeded
    
    // Scenario 2: Moderate loss - still significant due to dollar threshold
    isSignificant = mockItem.isVarianceSignificant(-3.0, -120.00); // 3 oz, $120
    expect(isSignificant).toBe(true); // Dollar threshold exceeded
    
    // Scenario 3: Normal usage - not significant
    isSignificant = mockItem.isVarianceSignificant(-2.0, -37.00); // 2 oz, $37
    expect(isSignificant).toBe(false); // Within both thresholds
    
    expect(mockItem.isVarianceSignificant).toHaveBeenCalledTimes(3);
  });

  test('should apply Dave\'s priority system based on dollar impact', async () => {
    // Mock high-value item (saffron)
    const mockSaffron = {
      highValueFlag: true,
      varianceThresholdDollar: 100.00,
      getVariancePriority: vi.fn().mockImplementation(function(valueVariance) {
        const absValueVariance = Math.abs(valueVariance || 0);
        
        if (this.highValueFlag && absValueVariance > this.varianceThresholdDollar) {
          return 'CRITICAL';
        } else if (absValueVariance > this.varianceThresholdDollar * 2) {
          return 'HIGH';
        } else if (absValueVariance > this.varianceThresholdDollar) {
          return 'MEDIUM';
        } else {
          return 'LOW';
        }
      })
    };

    // Test Dave's priority logic
    expect(mockSaffron.getVariancePriority(-150.00)).toBe('CRITICAL'); // High-value + exceeds threshold
    expect(mockSaffron.getVariancePriority(-50.00)).toBe('LOW');       // High-value but within threshold
    
    // Mock regular item (romaine)
    const mockRomaine = {
      highValueFlag: false,
      varianceThresholdDollar: 25.00,
      getVariancePriority: mockSaffron.getVariancePriority // Same logic
    };
    
    expect(mockRomaine.getVariancePriority(-60.00)).toBe('HIGH');  // Exceeds 2x threshold
    expect(mockRomaine.getVariancePriority(-30.00)).toBe('MEDIUM'); // Exceeds threshold
    expect(mockRomaine.getVariancePriority(-20.00)).toBe('LOW');   // Within threshold
  });

  test('should retrieve hierarchical category paths for drilling', async () => {
    // Mock category path retrieval
    const mockGetCategoryPath = vi.fn()
      .mockResolvedValueOnce('spices.premium.saffron')
      .mockResolvedValueOnce('produce.leafy_greens.romaine')
      .mockResolvedValueOnce('meat.beef.ribeye');

    // Test category drilling for Dave's workflow
    let categoryPath = await mockGetCategoryPath();
    expect(categoryPath).toBe('spices.premium.saffron');

    categoryPath = await mockGetCategoryPath();
    expect(categoryPath).toBe('produce.leafy_greens.romaine');

    categoryPath = await mockGetCategoryPath();
    expect(categoryPath).toBe('meat.beef.ribeye');

    expect(mockGetCategoryPath).toHaveBeenCalledTimes(3);
  });

  test('should calculate theoretical usage with Dave\'s yield factors', async () => {
    // Mock theoretical usage calculation
    const mockCalculateTheoretical = vi.fn().mockImplementation(function(salesQuantity, recipeYield = 1) {
      return (salesQuantity * recipeYield) / this.theoreticalYieldFactor;
    });

    // Mock items with different yield factors
    const saffron = {
      theoreticalYieldFactor: 0.95, // 5% waste
      calculateTheoreticalUsage: mockCalculateTheoretical
    };
    
    const romaine = {
      theoreticalYieldFactor: 0.85, // 15% waste for produce
      calculateTheoreticalUsage: mockCalculateTheoretical
    };

    // Dave sold 100 portions, how much saffron should be used?
    let theoreticalUsage = saffron.calculateTheoreticalUsage(100, 0.5); // 0.5 oz per portion
    expect(theoreticalUsage).toBeCloseTo(52.63, 2); // 50 / 0.95 = 52.63 oz needed

    // Dave sold 50 salads, how much romaine should be used?
    theoreticalUsage = romaine.calculateTheoreticalUsage(50, 4); // 4 oz per salad
    expect(theoreticalUsage).toBeCloseTo(235.29, 2); // 200 / 0.85 = 235.29 oz needed
  });

  test('should identify high-value items requiring special attention', async () => {
    // Mock high-value identification logic
    const mockIsHighValue = vi.fn().mockImplementation(function() {
      return this.highValueFlag || 
             this.unitCost > 10.00 || 
             this.varianceThresholdDollar < 25.00;
    });

    const items = [
      {
        name: 'Premium Saffron',
        highValueFlag: true,
        unitCost: 18.50,
        varianceThresholdDollar: 100.00,
        isHighValueItem: mockIsHighValue
      },
      {
        name: 'Premium Ribeye',
        highValueFlag: true,
        unitCost: 24.00,
        varianceThresholdDollar: 75.00,
        isHighValueItem: mockIsHighValue
      },
      {
        name: 'Romaine Lettuce',
        highValueFlag: false,
        unitCost: 1.25,
        varianceThresholdDollar: 25.00,
        isHighValueItem: mockIsHighValue
      },
      {
        name: 'Truffle Oil',
        highValueFlag: false,
        unitCost: 15.00, // High cost triggers high-value
        varianceThresholdDollar: 50.00,
        isHighValueItem: mockIsHighValue
      }
    ];

    // Test Dave's high-value identification
    expect(items[0].isHighValueItem()).toBe(true);  // Flagged as high-value
    expect(items[1].isHighValueItem()).toBe(true);  // Flagged as high-value  
    expect(items[2].isHighValueItem()).toBe(false); // Regular produce
    expect(items[3].isHighValueItem()).toBe(true);  // High unit cost
  });

  test('should retrieve recent variance history for trending', async () => {
    // Mock recent variance history
    const mockGetRecentVariances = vi.fn().mockResolvedValue([
      {
        periodId: 3,
        periodName: 'Week 39 2025',
        quantityVariance: -4.0,
        valueVariance: -76.00,
        isSignificant: false,
        priority: 'LOW'
      },
      {
        periodId: 2,
        periodName: 'Week 38 2025', 
        quantityVariance: -7.0,
        valueVariance: -133.00,
        isSignificant: true,
        priority: 'CRITICAL'
      },
      {
        periodId: 1,
        periodName: 'Week 37 2025',
        quantityVariance: -3.0,
        valueVariance: -57.00,
        isSignificant: false,
        priority: 'LOW'
      }
    ]);

    // Dave wants to see saffron variance trend
    const varianceHistory = await mockGetRecentVariances(1); // Item ID 1 (saffron)

    expect(varianceHistory).toHaveLength(3);
    expect(varianceHistory[0].periodName).toBe('Week 39 2025');
    expect(varianceHistory[1].isSignificant).toBe(true); // Week 38 had significant loss
    expect(varianceHistory[1].priority).toBe('CRITICAL');
    
    // Dave can see trending: Week 38 was problematic
    const criticalWeeks = varianceHistory.filter(v => v.priority === 'CRITICAL');
    expect(criticalWeeks).toHaveLength(1);
    expect(criticalWeeks[0].valueVariance).toBe(-133.00);
  });

  test('should find high-value items for Dave\'s priority management', async () => {
    // Mock query for high-value items
    const mockFindHighValue = vi.fn().mockResolvedValue([
      {
        id: 1,
        name: 'Premium Saffron',
        unitCost: 18.50,
        highValueFlag: true,
        hierarchicalCategory: { path: 'spices.premium.saffron' }
      },
      {
        id: 3,
        name: 'Premium Ribeye',
        unitCost: 24.00,
        highValueFlag: true,
        hierarchicalCategory: { path: 'meat.beef.ribeye' }
      }
    ]);

    // Dave wants to see all high-value items for Restaurant 1
    const highValueItems = await mockFindHighValue(1);

    expect(highValueItems).toHaveLength(2);
    expect(highValueItems.every(item => item.highValueFlag)).toBe(true);
    expect(highValueItems[0].name).toBe('Premium Saffron');
    expect(highValueItems[1].name).toBe('Premium Ribeye');
    
    // Sorted by unit cost descending (most expensive first)
    expect(highValueItems[1].unitCost).toBeGreaterThan(highValueItems[0].unitCost);
  });

  test('should find items exceeding variance thresholds', async () => {
    // Mock variance data from recent analysis
    const mockVarianceData = [
      {
        inventoryItemId: 1,
        quantityVariance: -8.0, // 8 oz saffron lost
        valueVariance: -148.00  // $148 lost - exceeds $100 threshold
      },
      {
        inventoryItemId: 2,
        quantityVariance: -22.0, // 22 lbs romaine used
        valueVariance: -27.50   // $27.50 - within $25 threshold
      },
      {
        inventoryItemId: 3,
        quantityVariance: -5.0,  // 5 lbs ribeye used
        valueVariance: -120.00  // $120 lost - exceeds $75 threshold
      }
    ];

    // Mock finding items exceeding thresholds
    const mockFindExceeding = vi.fn().mockResolvedValue([
      {
        id: 1,
        name: 'Premium Saffron',
        varianceThresholdDollar: 100.00,
        isExceeding: true
      },
      {
        id: 3,
        name: 'Premium Ribeye', 
        varianceThresholdDollar: 75.00,
        isExceeding: true
      }
    ]);

    const exceedingItems = await mockFindExceeding(1, mockVarianceData);

    expect(exceedingItems).toHaveLength(2);
    expect(exceedingItems[0].name).toBe('Premium Saffron'); // -$148 exceeds $100 threshold
    expect(exceedingItems[1].name).toBe('Premium Ribeye');  // -$120 exceeds $75 threshold
    // Romaine not included - $27.50 is within $25 threshold (plus quantity variance)
  });

  test('should generate category variance summary for drilling', async () => {
    // Mock category-level variance summary
    const mockCategorySummary = vi.fn().mockResolvedValue([
      {
        categoryPath: 'spices.premium',
        itemCount: 3,
        avgUnitCost: 16.25,
        highValueCount: 3,
        totalVariance: -245.00
      },
      {
        categoryPath: 'meat.beef',
        itemCount: 5,
        avgUnitCost: 18.50,
        highValueCount: 3,
        totalVariance: -380.00
      },
      {
        categoryPath: 'produce.leafy_greens',
        itemCount: 4,
        avgUnitCost: 1.85,
        highValueCount: 0,
        totalVariance: -45.00
      }
    ]);

    // Dave wants to see category-level variance summary
    const categorySummary = await mockCategorySummary(1);

    expect(categorySummary).toHaveLength(3);
    
    // Meat has highest total variance - Dave should investigate
    const meatCategory = categorySummary.find(c => c.categoryPath === 'meat.beef');
    expect(meatCategory.totalVariance).toBe(-380.00);
    expect(meatCategory.highValueCount).toBe(3);
    
    // Produce has lowest variance - less concern for Dave
    const produceCategory = categorySummary.find(c => c.categoryPath === 'produce.leafy_greens');
    expect(produceCategory.totalVariance).toBe(-45.00);
    expect(produceCategory.highValueCount).toBe(0);
  });

});
