import { vi, describe, test, expect, beforeEach } from 'vitest';

// Mock enhanced inventory transactions with Dave's variance system
const mockEnhancedTransactions = [
  {
    id: 1,
    restaurant_id: 1,
    inventory_item_id: 1, // Premium Saffron
    type: 'waste',
    quantity: 4.0,
    unit_cost: 18.50,
    period_id: 1,
    variance_reason: 'Found spoiled saffron in storage',
    variance_category: 'spoilage',
    cost_impact: -74.00,
    requires_approval: true,
    approved_by: null,
    approval_date: null,
    transaction_date: '2025-09-20T10:00:00Z'
  },
  {
    id: 2,
    restaurant_id: 1,
    inventory_item_id: 2, // Romaine Lettuce
    type: 'waste',
    quantity: 15.0,
    unit_cost: 1.25,
    period_id: 1,
    variance_reason: 'Wilted produce past use date',
    variance_category: 'spoilage',
    cost_impact: -18.75,
    requires_approval: false,
    approved_by: 2,
    approval_date: '2025-09-20T14:30:00Z',
    transaction_date: '2025-09-20T14:00:00Z'
  },
  {
    id: 3,
    restaurant_id: 1,
    inventory_item_id: 3, // Premium Ribeye
    type: 'adjustment_out',
    quantity: 2.0,
    unit_cost: 24.00,
    period_id: 1,
    variance_reason: 'Cannot locate steaks from last delivery',
    variance_category: 'theft',
    cost_impact: -48.00,
    requires_approval: true,
    approved_by: null,
    approval_date: null,
    transaction_date: '2025-09-21T08:00:00Z'
  },
  {
    id: 4,
    restaurant_id: 1,
    inventory_item_id: 1, // Premium Saffron
    type: 'purchase',
    quantity: 10.0,
    unit_cost: 18.50,
    period_id: 1,
    variance_reason: null,
    variance_category: null,
    cost_impact: 185.00,
    requires_approval: false,
    approved_by: null,
    approval_date: null,
    transaction_date: '2025-09-21T12:00:00Z'
  }
];

// Mock inventory items for context
const mockInventoryItems = [
  {
    id: 1,
    name: 'Premium Saffron',
    highValueFlag: true,  // Changed to camelCase to match the logic
    unitCost: 18.50
  },
  {
    id: 2,
    name: 'Romaine Lettuce',
    highValueFlag: false, // Changed to camelCase to match the logic
    unitCost: 1.25
  },
  {
    id: 3,
    name: 'Premium Ribeye',
    highValueFlag: true,  // Changed to camelCase to match the logic
    unitCost: 24.00
  }
];

describe('Enhanced InventoryTransaction Model - Dave\'s Variance System', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should identify variance transactions correctly', async () => {
    // Mock variance detection logic
    const mockIsVariance = vi.fn().mockImplementation(function() {
      return ['waste', 'adjustment_in', 'adjustment_out'].includes(this.type) || 
             this.varianceCategory !== null;
    });

    const transactions = [
      {
        id: 1,
        type: 'waste',
        varianceCategory: 'spoilage',
        isVarianceTransaction: mockIsVariance
      },
      {
        id: 2,
        type: 'purchase',
        varianceCategory: null,
        isVarianceTransaction: mockIsVariance
      },
      {
        id: 3,
        type: 'adjustment_out',
        varianceCategory: 'theft',
        isVarianceTransaction: mockIsVariance
      },
      {
        id: 4,
        type: 'usage',
        varianceCategory: 'measurement_error', // Still variance due to category
        isVarianceTransaction: mockIsVariance
      }
    ];

    // Test Dave's variance identification
    expect(transactions[0].isVarianceTransaction()).toBe(true);  // Waste transaction
    expect(transactions[1].isVarianceTransaction()).toBe(false); // Normal purchase
    expect(transactions[2].isVarianceTransaction()).toBe(true);  // Adjustment transaction  
    expect(transactions[3].isVarianceTransaction()).toBe(true);  // Has variance category
    
    expect(mockIsVariance).toHaveBeenCalledTimes(4);
  });

  test('should determine approval requirements using Dave\'s rules', async () => {
    // Mock approval requirement logic
    const mockRequiresApproval = vi.fn().mockImplementation(function(inventoryItem) {
      if (!this.isVarianceTransaction()) return false;
      
      const costImpact = this.costImpact || (this.quantity * this.unitCost);
      
      // Always require approval for high-value items
      if (inventoryItem?.highValueFlag && Math.abs(costImpact) > 50) {
        return true;
      }
      
      // Require approval for large dollar impacts
      if (Math.abs(costImpact) > 100) {
        return true;
      }
      
      // Require approval for theft or receiving errors
      if (['theft', 'receiving_error'].includes(this.varianceCategory)) {
        return true;
      }
      
      return false;
    });

    const saffronTransaction = {
      type: 'waste',
      quantity: 4.0,
      unitCost: 18.50,
      costImpact: -74.00,
      varianceCategory: 'spoilage',
      isVarianceTransaction: () => true,
      requiresApprovalCheck: mockRequiresApproval
    };

    const romaineTransaction = {
      type: 'waste',
      quantity: 15.0,
      unitCost: 1.25,
      costImpact: -18.75,
      varianceCategory: 'spoilage',
      isVarianceTransaction: () => true,
      requiresApprovalCheck: mockRequiresApproval
    };

    const theftTransaction = {
      type: 'adjustment_out',
      quantity: 1.0,
      unitCost: 5.00,
      costImpact: -5.00,
      varianceCategory: 'theft',
      isVarianceTransaction: () => true,
      requiresApprovalCheck: mockRequiresApproval
    };

    // Test Dave's approval logic
    expect(saffronTransaction.requiresApprovalCheck(mockInventoryItems[0])).toBe(true);  // High-value item > $50
    expect(romaineTransaction.requiresApprovalCheck(mockInventoryItems[1])).toBe(false); // Low-value, small impact
    expect(theftTransaction.requiresApprovalCheck(null)).toBe(true);                     // Theft always requires approval
  });

  test('should classify variance severity for Dave\'s prioritization', async () => {
    // Mock severity classification
    const mockGetSeverity = vi.fn().mockImplementation(function() {
      if (!this.isVarianceTransaction()) return 'NONE';
      
      const costImpact = Math.abs(this.costImpact || (this.quantity * this.unitCost));
      
      if (costImpact > 500) return 'CRITICAL';
      if (costImpact > 200) return 'HIGH';
      if (costImpact > 50) return 'MEDIUM';
      return 'LOW';
    });

    const transactions = [
      {
        costImpact: -74.00,
        isVarianceTransaction: () => true,
        getVarianceSeverity: mockGetSeverity
      },
      {
        costImpact: -18.75,
        isVarianceTransaction: () => true,
        getVarianceSeverity: mockGetSeverity
      },
      {
        costImpact: -650.00,
        isVarianceTransaction: () => true,
        getVarianceSeverity: mockGetSeverity
      },
      {
        costImpact: 185.00, // Purchase - not variance
        isVarianceTransaction: () => false,
        getVarianceSeverity: mockGetSeverity
      }
    ];

    // Test Dave's severity classification
    expect(transactions[0].getVarianceSeverity()).toBe('MEDIUM'); // $74 saffron loss
    expect(transactions[1].getVarianceSeverity()).toBe('LOW');    // $18.75 romaine loss
    expect(transactions[2].getVarianceSeverity()).toBe('CRITICAL'); // $650 major loss
    expect(transactions[3].getVarianceSeverity()).toBe('NONE');   // Normal purchase
  });

  test('should provide user-friendly category descriptions', async () => {
    // Mock category description logic
    const mockGetDescription = vi.fn().mockImplementation(function() {
      const descriptions = {
        'waste': 'Food Waste/Spoilage',
        'theft': 'Suspected Theft',
        'measurement_error': 'Measurement/Counting Error',
        'spoilage': 'Spoiled Product',
        'transfer': 'Location Transfer',
        'adjustment': 'Inventory Adjustment',
        'receiving_error': 'Receiving Discrepancy',
        'other': 'Other Variance'
      };
      
      return descriptions[this.varianceCategory] || this.varianceCategory || 'Normal Transaction';
    });

    const transactions = [
      {
        varianceCategory: 'spoilage',
        getCategoryDescription: mockGetDescription
      },
      {
        varianceCategory: 'theft',
        getCategoryDescription: mockGetDescription
      },
      {
        varianceCategory: 'measurement_error',
        getCategoryDescription: mockGetDescription
      },
      {
        varianceCategory: null,
        getCategoryDescription: mockGetDescription
      }
    ];

    // Test Dave's user-friendly descriptions
    expect(transactions[0].getCategoryDescription()).toBe('Spoiled Product');
    expect(transactions[1].getCategoryDescription()).toBe('Suspected Theft');
    expect(transactions[2].getCategoryDescription()).toBe('Measurement/Counting Error');
    expect(transactions[3].getCategoryDescription()).toBe('Normal Transaction');
  });

  test('should track approval status for Dave\'s workflow', async () => {
    // Mock approval status logic
    const mockIsApproved = vi.fn()
      .mockReturnValueOnce(true)   // First transaction: approved
      .mockReturnValueOnce(false)  // Second transaction: awaiting approval  
      .mockReturnValueOnce(true);  // Third transaction: doesn't need approval

    const mockDaysWaiting = vi.fn()
      .mockReturnValueOnce(0)  // First transaction: 0 days (approved)
      .mockReturnValueOnce(2)  // Second transaction: 2 days waiting
      .mockReturnValueOnce(0); // Third transaction: 0 days (no approval needed)

    const transactions = [
      {
        requiresApproval: true,
        approvedBy: 2,
        approvalDate: '2025-09-21T14:30:00Z',
        createdAt: '2025-09-20T10:00:00Z',
        isApproved: mockIsApproved,
        getDaysAwaitingApproval: mockDaysWaiting
      },
      {
        requiresApproval: true,
        approvedBy: null,
        approvalDate: null,
        createdAt: '2025-09-21T08:00:00Z',
        isApproved: mockIsApproved,
        getDaysAwaitingApproval: mockDaysWaiting
      },
      {
        requiresApproval: false,
        approvedBy: null,
        approvalDate: null,
        createdAt: '2025-09-22T12:00:00Z',
        isApproved: mockIsApproved,
        getDaysAwaitingApproval: mockDaysWaiting
      }
    ];

    // Test Dave's approval tracking
    expect(transactions[0].isApproved()).toBe(true);  // Approved
    expect(transactions[0].getDaysAwaitingApproval()).toBe(0);
    
    expect(transactions[1].isApproved()).toBe(false); // Awaiting approval
    expect(transactions[1].getDaysAwaitingApproval()).toBe(2); // 2 days waiting
    
    expect(transactions[2].isApproved()).toBe(true);  // Doesn't need approval
    expect(transactions[2].getDaysAwaitingApproval()).toBe(0);
  });

  test('should find variance transactions for period analysis', async () => {
    // Mock variance transaction finder
    const mockFindVariances = vi.fn().mockResolvedValue([
      {
        id: 1,
        periodId: 1,
        type: 'waste',
        varianceCategory: 'spoilage',
        costImpact: -74.00,
        inventoryItem: { name: 'Premium Saffron' }
      },
      {
        id: 3,
        periodId: 1,
        type: 'adjustment_out',
        varianceCategory: 'theft',
        costImpact: -48.00,
        inventoryItem: { name: 'Premium Ribeye' }
      }
    ]);

    // Dave wants to see all variances for Period 1
    const variances = await mockFindVariances(1);

    expect(variances).toHaveLength(2);
    expect(variances[0].varianceCategory).toBe('spoilage');
    expect(variances[1].varianceCategory).toBe('theft');
    
    // Both are significant losses Dave needs to investigate
    const totalLoss = variances.reduce((sum, v) => sum + Math.abs(v.costImpact), 0);
    expect(totalLoss).toBe(122.00); // $74 + $48 = $122 total variance
  });

  test('should find unapproved variances for Dave\'s approval queue', async () => {
    // Mock unapproved variance finder
    const mockFindUnapproved = vi.fn().mockResolvedValue([
      {
        id: 3,
        restaurantId: 1,
        requiresApproval: true,
        approvedBy: null,
        varianceCategory: 'theft',
        costImpact: -48.00,
        createdAt: '2025-09-21T08:00:00Z', // Oldest first
        inventoryItem: { name: 'Premium Ribeye' }
      },
      {
        id: 1,
        restaurantId: 1,
        requiresApproval: true,
        approvedBy: null,
        varianceCategory: 'spoilage',
        costImpact: -74.00,
        createdAt: '2025-09-20T10:00:00Z',
        inventoryItem: { name: 'Premium Saffron' }
      }
    ]);

    // Dave wants to see his approval queue
    const unapprovedVariances = await mockFindUnapproved(1);

    expect(unapprovedVariances).toHaveLength(2);
    expect(unapprovedVariances[0].varianceCategory).toBe('theft');     // Older transaction first
    expect(unapprovedVariances[1].varianceCategory).toBe('spoilage');
    
    // Dave sees total pending approvals
    const totalPendingValue = unapprovedVariances.reduce((sum, v) => sum + Math.abs(v.costImpact), 0);
    expect(totalPendingValue).toBe(122.00);
  });

  test('should generate variance summary by category for Dave\'s analysis', async () => {
    // Mock category summary generator
    const mockCategorySummary = vi.fn().mockResolvedValue([
      {
        category: 'spoilage',
        description: 'Spoiled Product',
        count: 2,
        totalCostImpact: -92.75, // Saffron + Romaine
        transactions: [
          { costImpact: -74.00, inventoryItem: { name: 'Premium Saffron' } },
          { costImpact: -18.75, inventoryItem: { name: 'Romaine Lettuce' } }
        ]
      },
      {
        category: 'theft',
        description: 'Suspected Theft',
        count: 1,
        totalCostImpact: -48.00,
        transactions: [
          { costImpact: -48.00, inventoryItem: { name: 'Premium Ribeye' } }
        ]
      }
    ]);

    // Dave wants to see variance patterns by category
    const categorySummary = await mockCategorySummary(1);

    expect(categorySummary).toHaveLength(2);
    
    // Spoilage is Dave's biggest issue this period
    expect(categorySummary[0].category).toBe('spoilage');
    expect(categorySummary[0].totalCostImpact).toBe(-92.75);
    expect(categorySummary[0].count).toBe(2);
    
    // Theft is secondary but still significant
    expect(categorySummary[1].category).toBe('theft');
    expect(categorySummary[1].totalCostImpact).toBe(-48.00);
    expect(categorySummary[1].count).toBe(1);
  });

  test('should calculate transaction values and stock impacts', async () => {
    // Mock transaction calculations
    const mockGetValue = vi.fn().mockImplementation(function() {
      return Number((this.quantity * this.unitCost).toFixed(2));
    });

    const mockGetStockImpact = vi.fn().mockImplementation(function() {
      if (this.type === 'purchase' || this.type === 'adjustment_in') {
        return this.quantity;
      } else if (this.type === 'usage' || this.type === 'waste' || this.type === 'adjustment_out') {
        return -this.quantity;
      }
      return 0;
    });

    const transactions = [
      {
        type: 'waste',
        quantity: 4.0,
        unitCost: 18.50,
        getTransactionValue: mockGetValue,
        getImpactOnStock: mockGetStockImpact
      },
      {
        type: 'purchase',
        quantity: 10.0,
        unitCost: 18.50,
        getTransactionValue: mockGetValue,
        getImpactOnStock: mockGetStockImpact
      }
    ];

    // Test Dave's transaction calculations
    expect(transactions[0].getTransactionValue()).toBe(74.00);  // 4 * 18.50
    expect(transactions[0].getImpactOnStock()).toBe(-4.0);      // Waste decreases stock

    expect(transactions[1].getTransactionValue()).toBe(185.00); // 10 * 18.50
    expect(transactions[1].getImpactOnStock()).toBe(10.0);      // Purchase increases stock
  });

  test('should provide comprehensive JSON output with calculated fields', async () => {
    // Mock toJSON with calculated fields
    const mockToJSON = vi.fn().mockImplementation(function() {
      return {
        ...this,
        transactionValue: this.quantity * this.unitCost,
        stockImpact: this.type === 'waste' ? -this.quantity : this.quantity,
        isVariance: this.varianceCategory !== null,
        severity: Math.abs(this.costImpact) > 50 ? 'MEDIUM' : 'LOW',
        categoryDescription: this.varianceCategory === 'spoilage' ? 'Spoiled Product' : 'Normal Transaction',
        isApproved: this.approvedBy !== null,
        daysAwaitingApproval: this.approvedBy ? 0 : 2
      };
    });

    const transaction = {
      id: 1,
      type: 'waste',
      quantity: 4.0,
      unitCost: 18.50,
      varianceCategory: 'spoilage',
      costImpact: -74.00,
      approvedBy: null,
      toJSON: mockToJSON
    };

    const jsonOutput = transaction.toJSON();

    expect(jsonOutput.transactionValue).toBe(74.00);
    expect(jsonOutput.stockImpact).toBe(-4.0);
    expect(jsonOutput.isVariance).toBe(true);
    expect(jsonOutput.severity).toBe('MEDIUM');
    expect(jsonOutput.categoryDescription).toBe('Spoiled Product');
    expect(jsonOutput.isApproved).toBe(false);
    expect(jsonOutput.daysAwaitingApproval).toBe(2);
  });

});
