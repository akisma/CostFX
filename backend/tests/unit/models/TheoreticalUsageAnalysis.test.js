import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database configuration
vi.mock('../../../src/config/database.js', () => ({
  default: {
    models: {},
    Sequelize: { Op: {} },
    fn: vi.fn(),
    col: vi.fn(),
    literal: vi.fn()
  }
}));

// Create a mock TheoreticalUsageAnalysis class for testing business logic
class MockTheoreticalUsageAnalysis {
  constructor(data) {
    Object.assign(this, data);
  }
}

describe('TheoreticalUsageAnalysis Model', () => {
  let testAnalysis;

  beforeEach(() => {
    // Create test analysis data with Dave's saffron scenario
    testAnalysis = {
      id: 1,
      periodId: 1,
      inventoryItemId: 1,
      theoreticalQuantity: '4.00',  // Should have used 4 oz
      actualQuantity: '4.25',       // Actually used 4.25 oz
      unitCost: '150.00',           // $150 per oz (expensive!)
      varianceQuantity: '0.25',     // 0.25 oz overage
      variancePercentage: 6.25,     // 6.25% overage
      varianceDollarValue: '37.50', // $37.50 overage
      priority: 'high',
      isSignificant: true,
      requiresInvestigation: true,
      investigationStatus: 'pending',
      calculationMethod: 'recipe_based',
      calculationConfidence: 0.95,
      assignedTo: null,
      investigatedBy: null,
      assignedAt: null,
      resolvedAt: null,
      investigationNotes: null,
      explanation: null,
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:00:00Z')
    };

    // Add business logic methods to test object
    testAnalysis.getAbsoluteVariance = TheoreticalUsageAnalysis.prototype.getAbsoluteVariance.bind(testAnalysis);
    testAnalysis.isHighImpactVariance = TheoreticalUsageAnalysis.prototype.isHighImpactVariance.bind(testAnalysis);
    testAnalysis.getVarianceDirection = TheoreticalUsageAnalysis.prototype.getVarianceDirection.bind(testAnalysis);
    testAnalysis.getEfficiencyRatio = TheoreticalUsageAnalysis.prototype.getEfficiencyRatio.bind(testAnalysis);
    testAnalysis.getDaysInInvestigation = TheoreticalUsageAnalysis.prototype.getDaysInInvestigation.bind(testAnalysis);
    testAnalysis.canBeResolved = TheoreticalUsageAnalysis.prototype.canBeResolved.bind(testAnalysis);
    Object.defineProperty(testAnalysis, 'displayVariance', {
      get: TheoreticalUsageAnalysis.prototype.displayVariance.get.bind(testAnalysis)
    });
    Object.defineProperty(testAnalysis, 'investigationSummary', {
      get: TheoreticalUsageAnalysis.prototype.investigationSummary.get.bind(testAnalysis)
    });
  });

  describe('Basic Model Functionality', () => {
    it('should create theoretical usage analysis record', () => {
      expect(testAnalysis.id).toBeDefined();
      expect(testAnalysis.periodId).toBe(1);
      expect(testAnalysis.inventoryItemId).toBe(1);
      expect(testAnalysis.theoreticalQuantity).toBe('4.00');
      expect(testAnalysis.actualQuantity).toBe('4.25');
      expect(testAnalysis.unitCost).toBe('150.00');
      expect(testAnalysis.varianceQuantity).toBe('0.25');
      expect(testAnalysis.priority).toBe('high');
    });

    it('should have expected data structure for Dave\'s variance system', () => {
      expect(testAnalysis.varianceDollarValue).toBe('37.50');
      expect(testAnalysis.isSignificant).toBe(true);
      expect(testAnalysis.requiresInvestigation).toBe(true);
      expect(testAnalysis.investigationStatus).toBe('pending');
      expect(testAnalysis.calculationMethod).toBe('recipe_based');
      expect(testAnalysis.calculationConfidence).toBe(0.95);
    });
  });

  describe('Dave\'s Business Logic Methods', () => {
    describe('getAbsoluteVariance()', () => {
      it('should return absolute values for Dave\'s variance metrics', () => {
        const absVariance = testAnalysis.getAbsoluteVariance();
        
        expect(absVariance.quantity).toBe(0.25);
        expect(absVariance.dollarValue).toBe(37.5);
        expect(absVariance.percentage).toBe(6.25);
      });

      it('should handle negative variances (shortages)', () => {
        const shortage = {
          varianceQuantity: '-0.5',
          variancePercentage: -12.5,
          varianceDollarValue: '-75.0'
        };
        shortage.getAbsoluteVariance = TheoreticalUsageAnalysis.prototype.getAbsoluteVariance.bind(shortage);

        const absVariance = shortage.getAbsoluteVariance();
        expect(absVariance.quantity).toBe(0.5);
        expect(absVariance.dollarValue).toBe(75.0);
        expect(absVariance.percentage).toBe(12.5);
      });
    });

    describe('isHighImpactVariance()', () => {
      it('should identify high-impact variances for Dave', () => {
        expect(testAnalysis.isHighImpactVariance()).toBe(false); // $37.50 < $100 threshold
      });

      it('should identify critical variances', async () => {
        const criticalVariance = await TheoreticalUsageAnalysis.create({
          periodId: inventoryPeriod.id,
          inventoryItemId: inventoryItem.id,
          theoreticalQuantity: 4.0,
          actualQuantity: 5.0,
          unitCost: 150.00,
          varianceQuantity: 1.0,
          varianceDollarValue: 150.0, // Above $100 threshold
          priority: 'critical'
        });

        expect(criticalVariance.isHighImpactVariance()).toBe(true);
      });

      it('should consider priority level for high impact', async () => {
        const highPriority = await TheoreticalUsageAnalysis.create({
          periodId: inventoryPeriod.id,
          inventoryItemId: inventoryItem.id,
          theoreticalQuantity: 4.0,
          actualQuantity: 4.1,
          unitCost: 150.00,
          varianceQuantity: 0.1,
          varianceDollarValue: 15.0, // Below $100 threshold
          priority: 'high'          // But high priority
        });

        expect(highPriority.isHighImpactVariance()).toBe(true);
      });
    });

    describe('getVarianceDirection()', () => {
      it('should identify overage correctly', () => {
        expect(testAnalysis.getVarianceDirection()).toBe('overage');
      });

      it('should identify shortage correctly', async () => {
        const shortage = await TheoreticalUsageAnalysis.create({
          periodId: inventoryPeriod.id,
          inventoryItemId: inventoryItem.id,
          theoreticalQuantity: 4.0,
          actualQuantity: 3.5,
          unitCost: 150.00,
          varianceQuantity: -0.5,
          varianceDollarValue: -75.0
        });

        expect(shortage.getVarianceDirection()).toBe('shortage');
      });

      it('should handle zero variance', async () => {
        const noVariance = await TheoreticalUsageAnalysis.create({
          periodId: inventoryPeriod.id,
          inventoryItemId: inventoryItem.id,
          theoreticalQuantity: 4.0,
          actualQuantity: 4.0,
          unitCost: 150.00,
          varianceQuantity: 0,
          varianceDollarValue: 0
        });

        expect(noVariance.getVarianceDirection()).toBe('none');
      });
    });

    describe('getEfficiencyRatio()', () => {
      it('should calculate efficiency ratio correctly', () => {
        const ratio = testAnalysis.getEfficiencyRatio();
        expect(ratio).toBe(1.0625); // 4.25 / 4.0
      });

      it('should handle zero theoretical quantity', async () => {
        const zeroTheoretical = await TheoreticalUsageAnalysis.create({
          periodId: inventoryPeriod.id,
          inventoryItemId: inventoryItem.id,
          theoreticalQuantity: 0,
          actualQuantity: 1.0,
          unitCost: 150.00,
          varianceQuantity: 1.0,
          varianceDollarValue: 150.0
        });

        expect(zeroTheoretical.getEfficiencyRatio()).toBe(null);
      });
    });
  });

  describe('Investigation Workflow', () => {
    describe('assignInvestigation()', () => {
      it('should assign investigation to user', async () => {
        await testAnalysis.assignInvestigation(user.id, 'Check saffron usage vs recipes');

        await testAnalysis.reload();
        expect(testAnalysis.assignedTo).toBe(user.id);
        expect(testAnalysis.investigationStatus).toBe('investigating');
        expect(testAnalysis.assignedAt).toBeDefined();
        expect(testAnalysis.investigationNotes).toBe('Check saffron usage vs recipes');
      });

      it('should preserve existing notes when not provided', async () => {
        testAnalysis.investigationNotes = 'Original notes';
        await testAnalysis.save();

        await testAnalysis.assignInvestigation(user.id);

        await testAnalysis.reload();
        expect(testAnalysis.investigationNotes).toBe('Original notes');
      });
    });

    describe('resolveInvestigation()', () => {
      beforeEach(async () => {
        await testAnalysis.assignInvestigation(user.id, 'Initial notes');
      });

      it('should resolve investigation with findings', async () => {
        await testAnalysis.resolveInvestigation(
          investigator.id,
          'Chef used extra saffron for special dish - approved variance',
          'resolved'
        );

        await testAnalysis.reload();
        expect(testAnalysis.investigatedBy).toBe(investigator.id);
        expect(testAnalysis.investigationStatus).toBe('resolved');
        expect(testAnalysis.resolvedAt).toBeDefined();
        expect(testAnalysis.explanation).toBe('Chef used extra saffron for special dish - approved variance');
      });

      it('should auto-mark as accepted for acceptable explanations', async () => {
        await testAnalysis.resolveInvestigation(
          investigator.id,
          'Usage was within acceptable range for premium dishes'
        );

        await testAnalysis.reload();
        expect(testAnalysis.investigationStatus).toBe('accepted');
      });
    });

    describe('getDaysInInvestigation()', () => {
      it('should return 0 for pending investigations', () => {
        expect(testAnalysis.getDaysInInvestigation()).toBe(0);
      });

      it('should calculate days correctly for active investigations', async () => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        await testAnalysis.update({
          investigationStatus: 'investigating',
          assignedAt: twoDaysAgo
        });

        expect(testAnalysis.getDaysInInvestigation()).toBe(2);
      });

      it('should calculate days to resolution for completed investigations', async () => {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        await testAnalysis.update({
          investigationStatus: 'resolved',
          assignedAt: threeDaysAgo,
          resolvedAt: oneDayAgo
        });

        expect(testAnalysis.getDaysInInvestigation()).toBe(2);
      });
    });

    describe('canBeResolved()', () => {
      it('should return false for pending investigations', () => {
        expect(testAnalysis.canBeResolved()).toBe(false);
      });

      it('should return true for complete investigations', async () => {
        await testAnalysis.update({
          investigationStatus: 'investigating',
          investigatedBy: investigator.id,
          investigationNotes: 'Complete investigation notes'
        });

        expect(testAnalysis.canBeResolved()).toBe(true);
      });

      it('should return false for incomplete investigations', async () => {
        await testAnalysis.update({
          investigationStatus: 'investigating',
          investigatedBy: investigator.id
          // Missing investigation notes
        });

        expect(testAnalysis.canBeResolved()).toBe(false);
      });
    });
  });

  describe('Dave\'s Management Queries', () => {
    let romaineLettuce, criticalVariance, lowPriorityVariance;

    beforeEach(async () => {
      // Create romaine lettuce (Dave's low-priority example)
      romaineLettuce = await InventoryItem.create({
        restaurantId: restaurant.id,
        name: 'Romaine Lettuce',
        unit: 'lbs',
        categoryPath: 'Produce > Greens',
        minimumQuantity: 5.0,
        varianceThresholdQuantity: 2.0,
        varianceThresholdPercentage: 15.0,
        varianceThresholdDollar: 10.0
      });

      // Critical saffron variance (Dave cares about this)
      criticalVariance = await TheoreticalUsageAnalysis.create({
        periodId: inventoryPeriod.id,
        inventoryItemId: inventoryItem.id,
        theoreticalQuantity: 2.0,
        actualQuantity: 4.0,
        unitCost: 150.00,
        varianceQuantity: 2.0,
        varianceDollarValue: 300.0,
        priority: 'critical',
        isSignificant: true,
        requiresInvestigation: true
      });

      // Low priority romaine variance (Dave doesn't care)
      lowPriorityVariance = await TheoreticalUsageAnalysis.create({
        periodId: inventoryPeriod.id,
        inventoryItemId: romaineLettuce.id,
        theoreticalQuantity: 20.0,
        actualQuantity: 40.0,
        unitCost: 2.50,
        varianceQuantity: 20.0,    // 20 pounds!
        varianceDollarValue: 50.0, // But only $50
        priority: 'low',
        isSignificant: false,
        requiresInvestigation: false
      });
    });

    describe('findHighPriorityVariances()', () => {
      it('should find critical and high priority variances', async () => {
        const highPriority = await TheoreticalUsageAnalysis.findHighPriorityVariances(inventoryPeriod.id);
        
        expect(highPriority).toHaveLength(2); // testAnalysis (high) + criticalVariance (critical)
        expect(highPriority[0].priority).toBe('critical'); // Should be sorted by priority
        expect(highPriority[1].priority).toBe('high');
        
        // Should not include low priority romaine
        const itemNames = highPriority.map(h => h.inventoryItem.name);
        expect(itemNames).toContain('Saffron Threads');
        expect(itemNames).not.toContain('Romaine Lettuce');
      });

      it('should sort by dollar impact within same priority', async () => {
        const highPriority = await TheoreticalUsageAnalysis.findHighPriorityVariances(inventoryPeriod.id);
        
        // Critical variance should be first (higher dollar impact)
        expect(highPriority[0].varianceDollarValue).toBe('300.00');
        expect(highPriority[1].varianceDollarValue).toBe('37.50');
      });
    });

    describe('findPendingInvestigations()', () => {
      beforeEach(async () => {
        await criticalVariance.assignInvestigation(user.id, 'Investigate high saffron usage');
      });

      it('should find all pending investigations', async () => {
        const pending = await TheoreticalUsageAnalysis.findPendingInvestigations();
        
        expect(pending.length).toBeGreaterThanOrEqual(1);
        const statuses = pending.map(p => p.investigationStatus);
        expect(statuses).toContain('investigating');
      });

      it('should filter by assignee', async () => {
        const userInvestigations = await TheoreticalUsageAnalysis.findPendingInvestigations(user.id);
        
        expect(userInvestigations).toHaveLength(1);
        expect(userInvestigations[0].assignedTo).toBe(user.id);
        expect(userInvestigations[0].assignee.name).toBe('Kitchen Manager');
      });

      it('should order by assignment date (oldest first)', async () => {
        // Create another investigation with older date
        const olderVariance = await TheoreticalUsageAnalysis.create({
          periodId: inventoryPeriod.id,
          inventoryItemId: inventoryItem.id,
          theoreticalQuantity: 1.0,
          actualQuantity: 1.5,
          unitCost: 150.00,
          varianceQuantity: 0.5,
          varianceDollarValue: 75.0,
          priority: 'high'
        });

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await olderVariance.assignInvestigation(user.id, 'Older investigation');
        await olderVariance.update({ assignedAt: yesterday });

        const pending = await TheoreticalUsageAnalysis.findPendingInvestigations(user.id);
        
        expect(pending).toHaveLength(2);
        expect(pending[0].assignedAt < pending[1].assignedAt).toBe(true);
      });
    });

    describe('getVarianceSummaryByPeriod()', () => {
      it('should provide comprehensive period summary for Dave', async () => {
        const summary = await TheoreticalUsageAnalysis.getVarianceSummaryByPeriod(inventoryPeriod.id);
        
        expect(summary.totalVariances).toBe(3); // testAnalysis + criticalVariance + lowPriorityVariance
        expect(summary.totalDollarImpact).toBe(387.5); // |37.5| + |300| + |50|
        
        expect(summary.byPriority.critical).toBe(1);
        expect(summary.byPriority.high).toBe(1);
        expect(summary.byPriority.low).toBe(1);
        
        expect(summary.significantCount).toBe(2); // testAnalysis + criticalVariance
        
        // Top variances should be sorted by dollar impact
        expect(summary.topVariances).toHaveLength(3);
        expect(summary.topVariances[0].dollarVariance).toBe('300.00');
        expect(summary.topVariances[1].dollarVariance).toBe('50.00');
        expect(summary.topVariances[2].dollarVariance).toBe('37.50');
      });

      it('should calculate investigation metrics', async () => {
        await criticalVariance.assignInvestigation(user.id);
        
        const summary = await TheoreticalUsageAnalysis.getVarianceSummaryByPeriod(inventoryPeriod.id);
        
        expect(summary.investigationMetrics.totalAssigned).toBe(1);
        expect(summary.investigationMetrics.pendingCount).toBe(1);
      });
    });

    describe('findByDollarThreshold()', () => {
      it('should find variances exceeding Dave\'s threshold', async () => {
        const highDollar = await TheoreticalUsageAnalysis.findByDollarThreshold(100, inventoryPeriod.id);
        
        expect(highDollar).toHaveLength(1); // Only critical variance ($300)
        expect(highDollar[0].varianceDollarValue).toBe('300.00');
      });

      it('should include negative variances (shortages)', async () => {
        await TheoreticalUsageAnalysis.create({
          periodId: inventoryPeriod.id,
          inventoryItemId: inventoryItem.id,
          theoreticalQuantity: 4.0,
          actualQuantity: 2.0,
          unitCost: 150.00,
          varianceQuantity: -2.0,
          varianceDollarValue: -300.0, // Large shortage
          priority: 'critical'
        });

        const highDollar = await TheoreticalUsageAnalysis.findByDollarThreshold(100, inventoryPeriod.id);
        
        expect(highDollar).toHaveLength(2);
        const dollarValues = highDollar.map(h => parseFloat(h.varianceDollarValue));
        expect(dollarValues).toContain(300.0);
        expect(dollarValues).toContain(-300.0);
      });
    });

    describe('getInvestigationWorkload()', () => {
      beforeEach(async () => {
        await criticalVariance.assignInvestigation(user.id, 'High priority investigation');
        await testAnalysis.assignInvestigation(investigator.id, 'Another investigation');
      });

      it('should provide investigation workload metrics', async () => {
        const workload = await TheoreticalUsageAnalysis.getInvestigationWorkload();
        
        expect(workload.totalInvestigating).toBe(2);
        expect(workload.totalPending).toBe(1); // lowPriorityVariance still pending
        
        expect(workload.byAssignee['Kitchen Manager'].investigating).toBe(1);
        expect(workload.byAssignee['Dave (Owner)'].investigating).toBe(1);
        
        expect(workload.highestDollarImpact.varianceDollarValue).toBe('300.00');
      });

      it('should track oldest pending investigation', async () => {
        const workload = await TheoreticalUsageAnalysis.getInvestigationWorkload();
        
        expect(workload.oldestPending).toBeDefined();
        expect(workload.oldestPending.investigationStatus).toBe('pending');
      });
    });
  });

  describe('Display and JSON Serialization', () => {
    describe('displayVariance getter', () => {
      it('should format variance for display', () => {
        const display = testAnalysis.displayVariance;
        
        expect(display.quantity).toBe('+0.25');
        expect(display.percentage).toBe('+6.25%');
        expect(display.dollar).toBe('+$37.50');
      });

      it('should handle negative variances', async () => {
        const shortage = await TheoreticalUsageAnalysis.create({
          periodId: inventoryPeriod.id,
          inventoryItemId: inventoryItem.id,
          theoreticalQuantity: 4.0,
          actualQuantity: 3.5,
          unitCost: 150.00,
          varianceQuantity: -0.5,
          variancePercentage: -12.5,
          varianceDollarValue: -75.0
        });

        const display = shortage.displayVariance;
        expect(display.quantity).toBe('-0.5');
        expect(display.percentage).toBe('-12.50%');
        expect(display.dollar).toBe('+$75.00'); // Always show absolute dollar value
      });

      it('should handle null percentage', async () => {
        const noPercentage = await TheoreticalUsageAnalysis.create({
          periodId: inventoryPeriod.id,
          inventoryItemId: inventoryItem.id,
          theoreticalQuantity: 4.0,
          actualQuantity: 4.25,
          unitCost: 150.00,
          varianceQuantity: 0.25,
          variancePercentage: null,
          varianceDollarValue: 37.5
        });

        const display = noPercentage.displayVariance;
        expect(display.percentage).toBe('N/A');
      });
    });

    describe('investigationSummary getter', () => {
      it('should provide investigation summary', () => {
        const summary = testAnalysis.investigationSummary;
        
        expect(summary.status).toBe('pending');
        expect(summary.assignedTo).toBe(null);
        expect(summary.daysInProgress).toBe(0);
        expect(summary.canResolve).toBe(false);
        expect(summary.hasExplanation).toBe(false);
      });

      it('should update with investigation progress', async () => {
        await testAnalysis.assignInvestigation(user.id, 'Investigation notes');
        await testAnalysis.update({
          explanation: 'Preliminary findings'
        });

        const summary = testAnalysis.investigationSummary;
        expect(summary.status).toBe('investigating');
        expect(summary.assignedTo).toBe(user.id);
        expect(summary.hasExplanation).toBe(true);
      });
    });

    describe('toJSON()', () => {
      it('should include all calculated fields for Dave\'s interface', () => {
        const json = testAnalysis.toJSON();
        
        expect(json.absoluteVariance).toBeDefined();
        expect(json.isHighImpact).toBe(false);
        expect(json.varianceDirection).toBe('overage');
        expect(json.efficiencyRatio).toBe(1.0625);
        expect(json.daysInInvestigation).toBe(0);
        expect(json.displayVariance).toBeDefined();
        expect(json.investigationSummary).toBeDefined();
      });
    });
  });

  describe('Validation and Constraints', () => {
    it('should enforce required fields', async () => {
      await expect(TheoreticalUsageAnalysis.create({
        // Missing required fields
        periodId: inventoryPeriod.id
      })).rejects.toThrow();
    });

    it('should validate minimum values', async () => {
      await expect(TheoreticalUsageAnalysis.create({
        periodId: inventoryPeriod.id,
        inventoryItemId: inventoryItem.id,
        theoreticalQuantity: -1.0, // Invalid negative
        actualQuantity: 4.0,
        unitCost: 150.0,
        varianceQuantity: 0,
        varianceDollarValue: 0
      })).rejects.toThrow();
    });

    it('should validate enum values', async () => {
      await expect(TheoreticalUsageAnalysis.create({
        periodId: inventoryPeriod.id,
        inventoryItemId: inventoryItem.id,
        theoreticalQuantity: 4.0,
        actualQuantity: 4.0,
        unitCost: 150.0,
        varianceQuantity: 0,
        varianceDollarValue: 0,
        priority: 'invalid_priority' // Invalid enum value
      })).rejects.toThrow();
    });

    it('should validate calculation confidence range', async () => {
      await expect(TheoreticalUsageAnalysis.create({
        periodId: inventoryPeriod.id,
        inventoryItemId: inventoryItem.id,
        theoreticalQuantity: 4.0,
        actualQuantity: 4.0,
        unitCost: 150.0,
        varianceQuantity: 0,
        varianceDollarValue: 0,
        calculationConfidence: 1.5 // Invalid > 1.0
      })).rejects.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very small variances', async () => {
      const tinyVariance = await TheoreticalUsageAnalysis.create({
        periodId: inventoryPeriod.id,
        inventoryItemId: inventoryItem.id,
        theoreticalQuantity: 4.0,
        actualQuantity: 4.001,
        unitCost: 150.0,
        varianceQuantity: 0.001,
        varianceDollarValue: 0.15,
        priority: 'low'
      });

      expect(tinyVariance.getAbsoluteVariance().quantity).toBe(0.001);
      expect(tinyVariance.isHighImpactVariance()).toBe(false);
    });

    it('should handle large variances', async () => {
      const hugeVariance = await TheoreticalUsageAnalysis.create({
        periodId: inventoryPeriod.id,
        inventoryItemId: inventoryItem.id,
        theoreticalQuantity: 1.0,
        actualQuantity: 100.0,
        unitCost: 150.0,
        varianceQuantity: 99.0,
        varianceDollarValue: 14850.0,
        priority: 'critical'
      });

      expect(hugeVariance.getEfficiencyRatio()).toBe(100);
      expect(hugeVariance.isHighImpactVariance()).toBe(true);
    });

    it('should handle zero quantities appropriately', async () => {
      const zeroActual = await TheoreticalUsageAnalysis.create({
        periodId: inventoryPeriod.id,
        inventoryItemId: inventoryItem.id,
        theoreticalQuantity: 4.0,
        actualQuantity: 0,
        unitCost: 150.0,
        varianceQuantity: -4.0,
        varianceDollarValue: -600.0,
        priority: 'critical'
      });

      expect(zeroActual.getEfficiencyRatio()).toBe(0);
      expect(zeroActual.getVarianceDirection()).toBe('shortage');
    });
  });
});
