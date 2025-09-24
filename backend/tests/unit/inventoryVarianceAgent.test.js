import { describe, test, expect, beforeEach, vi } from 'vitest';
import InventoryVarianceAgent from '../../src/agents/InventoryVarianceAgent.js';

// Mock the UsageCalculationService
vi.mock('../../src/services/UsageCalculationService.js', () => ({
  default: class MockUsageCalculationService {
    constructor() {
      this.models = null;
    }
    
    async initialize() {
      this.models = {};
    }
    
    async calculateUsageForPeriod(periodId, options) {
      return {
        periodId,
        method: options.method || 'recipe_based',
        itemsProcessed: 3,
        itemsSkipped: 0,
        analyses: [
          {
            inventoryItemId: 1,
            itemName: 'Premium Saffron',
            theoreticalQuantity: 8.5,
            actualQuantity: 10.0,
            varianceQuantity: 1.5,
            varianceDollarValue: 28.5,
            priority: 'critical'
          },
          {
            inventoryItemId: 2,
            itemName: 'Romaine Lettuce',
            theoreticalQuantity: 15.0,
            actualQuantity: 12.0,
            varianceQuantity: -3.0,
            varianceDollarValue: -3.75,
            priority: 'medium'
          },
          {
            inventoryItemId: 3,
            itemName: 'Olive Oil',
            theoreticalQuantity: 32.0,
            actualQuantity: 31.5,
            varianceQuantity: -0.5,
            varianceDollarValue: -0.075,
            priority: 'low'
          }
        ],
        errors: []
      };
    }
    
    async getCalculationSummary(periodId) {
      return {
        periodId,
        totalItems: 3,
        byPriority: {
          critical: 1,
          high: 0,
          medium: 1,
          low: 1
        },
        byMethod: {
          recipe_based: 3,
          historical_average: 0,
          manual: 0,
          ai_predicted: 0
        },
        totalVarianceDollarValue: 24.675, // 28.5 - 3.75 - 0.075
        averageConfidence: 0.85
      };
    }
  }
}));

describe('InventoryVarianceAgent', () => {
  let agent;

  beforeEach(async () => {
    agent = new InventoryVarianceAgent();
  });

  describe('Agent Structure', () => {
    test('should create agent with expected capabilities', () => {
      expect(agent).toBeInstanceOf(InventoryVarianceAgent);
      expect(agent.name).toBe('InventoryVarianceAgent');
      expect(agent.capabilities).toContain('calculate_usage_variance');
      expect(agent.capabilities).toContain('analyze_period_variance');
      expect(agent.capabilities).toContain('priority_variance_summary');
      expect(agent.capabilities).toContain('historical_variance_trends');
    });

    test('should initialize calculation service', async () => {
      await agent.initialize();
      expect(agent.initialized).toBe(true);
      expect(agent.calculationService).toBeDefined();
    });

    test('should provide status information', async () => {
      await agent.initialize();
      const status = agent.getStatus();
      
      expect(status.calculationService).toBeDefined();
      expect(status.calculationService.initialized).toBe(true);
      expect(status.calculationService.supportedMethods).toContain('recipe_based');
      expect(status.capabilities).toEqual(agent.capabilities);
    });
  });

  describe('Usage Variance Calculation', () => {
    test('should process calculate_usage_variance request', async () => {
      const request = {
        type: 'calculate_usage_variance',
        data: {
          periodId: 1,
          method: 'recipe_based',
          recalculate: true
        }
      };

      const result = await agent.process(request);

      expect(result.success).toBe(true);
      expect(result.periodId).toBe(1);
      expect(result.method).toBe('recipe_based');
      expect(result.summary).toBeDefined();
      expect(result.summary.itemsProcessed).toBe(3);
      expect(result.summary.highPriorityVariances).toBe(1); // 1 critical
      expect(result.analyses).toHaveLength(3);
      expect(result.insights).toBeDefined();
    });

    test('should generate appropriate insights', async () => {
      const request = {
        type: 'calculate_usage_variance',
        data: { periodId: 1 }
      };

      const result = await agent.process(request);
      const insights = result.insights;

      expect(insights).toBeInstanceOf(Array);
      
      // Should have high priority alert
      const highPriorityInsight = insights.find(i => i.type === 'high_priority_alert');
      expect(highPriorityInsight).toBeDefined();
      expect(highPriorityInsight.actionRequired).toBe('immediate_review');
    });

    test('should handle different calculation methods', async () => {
      const request = {
        type: 'calculate_usage_variance',
        data: {
          periodId: 1,
          method: 'historical_average'
        }
      };

      const result = await agent.process(request);

      expect(result.success).toBe(true);
      expect(result.method).toBe('historical_average');
    });
  });

  describe('Period Variance Analysis', () => {
    test('should analyze period variance patterns', async () => {
      const request = {
        type: 'analyze_period_variance',
        data: { periodId: 1 }
      };

      const result = await agent.process(request);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis.periodId).toBe(1);
      expect(result.analysis.overview).toBeDefined();
      expect(result.analysis.priorityBreakdown).toBeDefined();
      expect(result.analysis.recommendations).toBeDefined();
      expect(result.analysis.alertsRequired).toBeDefined();
    });

    test('should generate recommendations based on variance data', async () => {
      const request = {
        type: 'analyze_period_variance',
        data: { periodId: 1 }
      };

      const result = await agent.process(request);
      const recommendations = result.analysis.recommendations;

      expect(recommendations).toBeInstanceOf(Array);
      
      // Should recommend critical investigation
      const criticalRec = recommendations.find(r => r.type === 'critical_investigation');
      expect(criticalRec).toBeDefined();
      expect(criticalRec.priority).toBe('immediate');
    });

    test('should identify alerts requiring attention', async () => {
      const request = {
        type: 'analyze_period_variance',
        data: { periodId: 1 }
      };

      const result = await agent.process(request);
      const alerts = result.analysis.alertsRequired;

      expect(alerts).toBeInstanceOf(Array);
      
      // Should have critical variance alert
      const criticalAlert = alerts.find(a => a.type === 'critical_variance');
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert.severity).toBe('critical');
    });
  });

  describe('Priority Variance Summary', () => {
    test('should get priority variance summary', async () => {
      const request = {
        type: 'priority_variance_summary',
        data: {
          periodId: 1,
          priority: 'critical'
        }
      };

      const result = await agent.process(request);

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.periodId).toBe(1);
      expect(result.summary.priority).toBe('critical');
      expect(result.summary.recommendations).toBeDefined();
    });
  });

  describe('Historical Variance Trends', () => {
    test('should analyze historical variance trends', async () => {
      const request = {
        type: 'historical_variance_trends',
        data: {
          restaurantId: 1,
          periodCount: 6
        }
      };

      const result = await agent.process(request);

      expect(result.success).toBe(true);
      expect(result.trends).toBeDefined();
      expect(result.trends.restaurantId).toBe(1);
      expect(result.trends.periodsAnalyzed).toBe(6);
      expect(result.trends.trends).toBeDefined();
      expect(result.trends.recommendations).toBeDefined();
    });
  });

  describe('Investigation Management', () => {
    test('should initiate variance investigation', async () => {
      const request = {
        type: 'investigate_variance',
        data: {
          analysisId: 123,
          assignedTo: 'user456',
          notes: 'High saffron variance needs investigation'
        }
      };

      const result = await agent.process(request);

      expect(result.success).toBe(true);
      expect(result.investigation).toBeDefined();
      expect(result.investigation.analysisId).toBe(123);
      expect(result.investigation.assignedTo).toBe('user456');
      expect(result.investigation.status).toBe('investigating');
      expect(result.message).toContain('assigned to user user456');
    });

    test('should resolve variance investigation', async () => {
      const request = {
        type: 'resolve_variance_investigation',
        data: {
          analysisId: 123,
          resolvedBy: 'manager789',
          explanation: 'Recipe portion sizes were updated mid-period',
          resolution: 'resolved'
        }
      };

      const result = await agent.process(request);

      expect(result.success).toBe(true);
      expect(result.investigation).toBeDefined();
      expect(result.investigation.analysisId).toBe(123);
      expect(result.investigation.resolvedBy).toBe('manager789');
      expect(result.investigation.status).toBe('resolved');
      expect(result.investigation.explanation).toContain('Recipe portion sizes');
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown request types', async () => {
      const request = {
        type: 'unknown_request_type',
        data: {}
      };

      await expect(agent.process(request)).rejects.toThrow('Unknown request type: unknown_request_type');
    });

    test('should auto-initialize when processing requests', async () => {
      expect(agent.initialized).toBe(false);

      const request = {
        type: 'calculate_usage_variance',
        data: { periodId: 1 }
      };

      const result = await agent.process(request);

      expect(agent.initialized).toBe(true);
      expect(result.success).toBe(true);
    });
  });

  describe('Business Logic', () => {
    test('should generate financial impact insights for large variances', async () => {
      // Mock calculation service to return large dollar impact
      agent.calculationService.calculateUsageForPeriod = vi.fn().mockResolvedValue({
        periodId: 1,
        method: 'recipe_based',
        itemsProcessed: 1,
        itemsSkipped: 0,
        analyses: [
          {
            inventoryItemId: 1,
            itemName: 'Expensive Item',
            theoreticalQuantity: 10.0,
            actualQuantity: 5.0,
            varianceQuantity: -5.0,
            varianceDollarValue: -750.0, // Large impact
            priority: 'critical'
          }
        ],
        errors: []
      });

      const request = {
        type: 'calculate_usage_variance',
        data: { periodId: 1 }
      };

      const result = await agent.process(request);
      const financialInsight = result.insights.find(i => i.type === 'financial_impact');

      expect(financialInsight).toBeDefined();
      expect(financialInsight.severity).toBe('high');
      expect(financialInsight.message).toContain('$750.00');
    });

    test('should recommend data improvement when using mostly historical methods', () => {
      const summary = {
        byMethod: {
          recipe_based: 2,
          historical_average: 8,
          manual: 0,
          ai_predicted: 0
        },
        byPriority: { critical: 0, high: 0, medium: 5, low: 5 },
        averageConfidence: 0.6
      };

      const recommendations = agent.generateVarianceRecommendations(summary);
      const dataImprovement = recommendations.find(r => r.type === 'data_improvement');

      expect(dataImprovement).toBeDefined();
      expect(dataImprovement.action).toContain('recipe data coverage');
    });
  });
});
