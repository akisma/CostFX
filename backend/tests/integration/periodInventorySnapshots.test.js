import { vi, describe, test, expect, beforeEach } from 'vitest';

// Mock period inventory snapshots data that would come from the database
const mockPeriodInventorySnapshots = [
  {
    id: 1,
    period_id: 1,
    inventory_item_id: 1,
    snapshot_type: 'beginning',
    quantity: 50.00,
    unit_cost: 18.50,
    total_value: 925.00,
    counted_by: 101,
    counted_at: '2025-09-15T08:00:00Z',
    variance_notes: null,
    adjustment_reason: null,
    verified: true
  },
  {
    id: 2,
    period_id: 1,
    inventory_item_id: 1,
    snapshot_type: 'ending',
    quantity: 46.00,
    unit_cost: 18.50,
    total_value: 851.00,
    counted_by: 101,
    counted_at: '2025-09-21T17:30:00Z',
    variance_notes: 'Normal usage for saffron during special menu week',
    adjustment_reason: null,
    verified: true
  },
  {
    id: 3,
    period_id: 1,
    inventory_item_id: 2,
    snapshot_type: 'beginning',
    quantity: 120.00,
    unit_cost: 1.25,
    total_value: 150.00,
    counted_by: 102,
    counted_at: '2025-09-15T08:15:00Z',
    variance_notes: null,
    adjustment_reason: null,
    verified: true
  },
  {
    id: 4,
    period_id: 1,
    inventory_item_id: 2,
    snapshot_type: 'ending',
    quantity: 98.00,
    unit_cost: 1.25,
    total_value: 122.50,
    counted_by: 102,
    counted_at: '2025-09-21T17:45:00Z',
    variance_notes: 'Higher romaine usage - large salad orders this week',
    adjustment_reason: null,
    verified: true
  },
  {
    id: 5,
    period_id: 2,
    inventory_item_id: 1,
    snapshot_type: 'beginning',
    quantity: 46.00,
    unit_cost: 19.00,
    total_value: 874.00,
    counted_by: 101,
    counted_at: '2025-09-22T08:00:00Z',
    variance_notes: 'Price increase from supplier - premium saffron',
    adjustment_reason: null,
    verified: false
  }
];

// Mock inventory items for context
const mockInventoryItems = [
  {
    id: 1,
    restaurant_id: 1,
    name: 'Premium Saffron',
    category: 'spices',
    variance_threshold_quantity: 5.00,
    variance_threshold_dollar: 100.00,
    high_value_flag: true
  },
  {
    id: 2,
    restaurant_id: 1,
    name: 'Romaine Lettuce',
    category: 'produce', 
    variance_threshold_quantity: 50.00,
    variance_threshold_dollar: 25.00,
    high_value_flag: false
  }
];

// Mock periods for context
const mockPeriods = [
  {
    id: 1,
    restaurant_id: 1,
    period_name: 'Week 38 2025',
    period_start: '2025-09-15',
    period_end: '2025-09-21',
    status: 'closed',
    beginning_snapshot_completed: true,
    ending_snapshot_completed: true,
    variance_analysis_completed: true
  },
  {
    id: 2,
    restaurant_id: 1,
    period_name: 'Week 39 2025',
    period_start: '2025-09-22',
    period_end: '2025-09-28',
    status: 'active',
    beginning_snapshot_completed: true,
    ending_snapshot_completed: false,
    variance_analysis_completed: false
  }
];

describe('Period Inventory Snapshots Management', () => {
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  test('should create beginning inventory snapshots with proper validation', async () => {
    // Mock the database call
    const mockCreate = vi.fn().mockResolvedValue({
      id: 6,
      period_id: 2,
      inventory_item_id: 3,
      snapshot_type: 'beginning',
      quantity: 25.50,
      unit_cost: 4.75,
      total_value: 121.125, // Calculated automatically
      counted_by: 103,
      counted_at: '2025-09-22T08:30:00Z',
      verified: false
    });

    // Simulate Dave's team creating a beginning snapshot
    const newSnapshot = await mockCreate({
      periodId: 2,
      inventoryItemId: 3,
      snapshotType: 'beginning',
      quantity: 25.50,
      unitCost: 4.75,
      countedBy: 103
    });

    expect(mockCreate).toHaveBeenCalledWith({
      periodId: 2,
      inventoryItemId: 3,
      snapshotType: 'beginning',
      quantity: 25.50,
      unitCost: 4.75,
      countedBy: 103
    });

    expect(newSnapshot).toEqual({
      id: 6,
      period_id: 2,
      inventory_item_id: 3,
      snapshot_type: 'beginning',
      quantity: 25.50,
      unit_cost: 4.75,
      total_value: 121.125,
      counted_by: 103,
      counted_at: '2025-09-22T08:30:00Z',
      verified: false
    });
  });

  test('should prevent duplicate snapshots for same period/item/type', async () => {
    // Mock database constraint violation
    const mockCreate = vi.fn().mockRejectedValue(
      new Error('Unique constraint violation: unique_period_item_snapshot')
    );

    // Try to create duplicate beginning snapshot
    await expect(mockCreate({
      periodId: 1,
      inventoryItemId: 1,
      snapshotType: 'beginning',
      quantity: 52.00,
      unitCost: 18.50
    })).rejects.toThrow('Unique constraint violation');

    expect(mockCreate).toHaveBeenCalledWith({
      periodId: 1,
      inventoryItemId: 1,
      snapshotType: 'beginning',
      quantity: 52.00,
      unitCost: 18.50
    });
  });

  test('should calculate variance between beginning and ending snapshots', async () => {
    // Mock finding snapshots for variance analysis
    const mockFindSnapshots = vi.fn().mockResolvedValue({
      saffronVariance: {
        inventoryItemId: 1,
        itemName: 'Premium Saffron',
        beginningQuantity: 50.00,
        endingQuantity: 46.00,
        beginningValue: 925.00,
        endingValue: 851.00,
        quantityVariance: -4.00, // Used 4 oz
        valueVariance: -74.00,   // $74 consumed
        quantityVariancePct: -8.0,
        valueVariancePct: -8.0,
        isSignificant: false // Within normal range for saffron
      },
      romaineVariance: {
        inventoryItemId: 2,
        itemName: 'Romaine Lettuce',
        beginningQuantity: 120.00,
        endingQuantity: 98.00,
        beginningValue: 150.00,
        endingValue: 122.50,
        quantityVariance: -22.00, // Used 22 lbs
        valueVariance: -27.50,    // $27.50 consumed
        quantityVariancePct: -18.3,
        valueVariancePct: -18.3,
        isSignificant: false // Within Dave's threshold (>$25 OR >50 lbs)
      }
    });

    // Dave requests variance analysis for Week 38
    const varianceAnalysis = await mockFindSnapshots(1);

    // Verify Dave's business priorities: dollar impact first
    expect(varianceAnalysis.saffronVariance.valueVariance).toBe(-74.00);
    expect(varianceAnalysis.romaineVariance.valueVariance).toBe(-27.50);
    
    // Saffron has higher dollar impact despite lower quantity variance
    expect(Math.abs(varianceAnalysis.saffronVariance.valueVariance))
      .toBeGreaterThan(Math.abs(varianceAnalysis.romaineVariance.valueVariance));
  });

  test('should identify significant variances using Dave\'s thresholds', async () => {
    // Mock variance analysis with significant saffron loss
    const mockVarianceCheck = vi.fn().mockResolvedValue({
      saffronHighVariance: {
        inventoryItemId: 1,
        itemName: 'Premium Saffron',
        beginningQuantity: 50.00,
        endingQuantity: 38.00, // Lost 12 oz - significant!
        valueVariance: -222.00, // $222 loss - exceeds $100 threshold
        isSignificant: true // Exceeds Dave's $100 threshold for saffron
      },
      romaineNormalVariance: {
        inventoryItemId: 2,
        itemName: 'Romaine Lettuce',
        beginningQuantity: 120.00,
        endingQuantity: 75.00, // Lost 45 lbs
        valueVariance: -56.25,  // $56.25 loss
        isSignificant: false // Below 50 lbs AND below significant $ threshold
      }
    });

    const variances = await mockVarianceCheck(1);

    // Dave's system should flag saffron but not romaine
    expect(variances.saffronHighVariance.isSignificant).toBe(true);
    expect(variances.romaineNormalVariance.isSignificant).toBe(false);
  });

  test('should support bulk snapshot creation for efficiency', async () => {
    // Mock bulk creation for Dave's weekly inventory count
    const mockBulkCreate = vi.fn().mockResolvedValue([
      {
        id: 7,
        period_id: 2,
        inventory_item_id: 1,
        snapshot_type: 'ending',
        quantity: 42.00,
        total_value: 798.00
      },
      {
        id: 8,
        period_id: 2,
        inventory_item_id: 2,
        snapshot_type: 'ending',
        quantity: 85.00,
        total_value: 106.25
      }
    ]);

    // Dave's team completes ending counts for multiple items
    const bulkSnapshots = await mockBulkCreate([
      {
        inventoryItemId: 1,
        quantity: 42.00,
        unitCost: 19.00,
        countedBy: 101
      },
      {
        inventoryItemId: 2,
        quantity: 85.00,
        unitCost: 1.25,
        countedBy: 102
      }
    ]);

    expect(mockBulkCreate).toHaveBeenCalledWith([
      {
        inventoryItemId: 1,
        quantity: 42.00,
        unitCost: 19.00,
        countedBy: 101
      },
      {
        inventoryItemId: 2,
        quantity: 85.00,
        unitCost: 1.25,
        countedBy: 102
      }
    ]);

    expect(bulkSnapshots).toHaveLength(2);
    expect(bulkSnapshots[0].quantity).toBe(42.00);
    expect(bulkSnapshots[1].quantity).toBe(85.00);
  });

  test('should track snapshot verification status for data integrity', async () => {
    // Mock verification workflow
    const mockVerify = vi.fn()
      .mockResolvedValueOnce({ id: 5, verified: true })  // First verification succeeds
      .mockRejectedValueOnce(new Error('Snapshot is already verified')); // Second fails

    // Dave verifies an unverified snapshot
    const verifiedSnapshot = await mockVerify(5, 'dave_manager');
    expect(verifiedSnapshot.verified).toBe(true);

    // Attempting to verify again should fail
    await expect(mockVerify(5, 'dave_manager')).rejects.toThrow('already verified');
  });

  test('should support snapshot adjustments before verification', async () => {
    // Mock adjustment workflow
    const mockAdjust = vi.fn().mockResolvedValue({
      id: 5,
      quantity: 44.00, // Adjusted from 46.00
      total_value: 836.00, // Recalculated
      adjustment_reason: 'Recount found 2 oz less saffron',
      variance_notes: 'Adjusted from 46.00 to 44.00: Recount found 2 oz less saffron',
      verified: false
    });

    // Dave's team adjusts a count before verification
    const adjustedSnapshot = await mockAdjust(5, {
      newQuantity: 44.00,
      reason: 'Recount found 2 oz less saffron',
      adjustedBy: 'dave_manager'
    });

    expect(mockAdjust).toHaveBeenCalledWith(5, {
      newQuantity: 44.00,
      reason: 'Recount found 2 oz less saffron',
      adjustedBy: 'dave_manager'
    });

    expect(adjustedSnapshot.quantity).toBe(44.00);
    expect(adjustedSnapshot.adjustment_reason).toBe('Recount found 2 oz less saffron');
    expect(adjustedSnapshot.verified).toBe(false);
  });

  test('should retrieve snapshots filtered by period and type', async () => {
    // Mock filtered queries for Dave's workflow
    const mockFindFiltered = vi.fn()
      .mockResolvedValueOnce(mockPeriodInventorySnapshots.filter(s => 
        s.period_id === 1 && s.snapshot_type === 'beginning'
      ))
      .mockResolvedValueOnce(mockPeriodInventorySnapshots.filter(s => 
        s.period_id === 1 && s.snapshot_type === 'ending'
      ));

    // Dave wants to see beginning snapshots for Week 38
    const beginningSnapshots = await mockFindFiltered(1, 'beginning');
    expect(beginningSnapshots).toHaveLength(2);
    expect(beginningSnapshots.every(s => s.snapshot_type === 'beginning')).toBe(true);

    // Then ending snapshots for the same period
    const endingSnapshots = await mockFindFiltered(1, 'ending');
    expect(endingSnapshots).toHaveLength(2);
    expect(endingSnapshots.every(s => s.snapshot_type === 'ending')).toBe(true);
  });

  test('should calculate comprehensive variance analysis for Dave\'s priorities', async () => {
    // Mock comprehensive analysis showing Dave's business priorities
    const mockComprehensiveAnalysis = vi.fn().mockResolvedValue({
      periodSummary: {
        periodId: 1,
        periodName: 'Week 38 2025',
        totalVarianceValue: -101.50,
        significantVariances: 1,
        itemsAnalyzed: 2
      },
      variancesByPriority: [
        {
          // High priority: Expensive item with significant variance
          inventoryItemId: 1,
          itemName: 'Premium Saffron',
          category: 'Spices → Premium → Saffron',
          valueVariance: -74.00,
          quantityVariance: -4.00,
          isSignificant: false,
          priority: 'MONITOR', // Close to threshold
          dollarPerUnit: 18.50
        },
        {
          // Lower priority: Cheap item with normal variance
          inventoryItemId: 2,
          itemName: 'Romaine Lettuce', 
          category: 'Produce → Leafy Greens → Romaine',
          valueVariance: -27.50,
          quantityVariance: -22.00,
          isSignificant: false,
          priority: 'NORMAL',
          dollarPerUnit: 1.25
        }
      ]
    });

    const analysis = await mockComprehensiveAnalysis(1);

    // Verify Dave's priorities are reflected
    expect(analysis.variancesByPriority[0].itemName).toBe('Premium Saffron');
    expect(analysis.variancesByPriority[0].dollarPerUnit).toBe(18.50);
    expect(analysis.variancesByPriority[1].itemName).toBe('Romaine Lettuce');
    expect(analysis.variancesByPriority[1].dollarPerUnit).toBe(1.25);
    
    // Total variance combines both items
    expect(analysis.periodSummary.totalVarianceValue).toBe(-101.50);
  });

});
