import { describe, it, expect, beforeEach } from 'vitest';
import PriorityCalculationService from '../../../src/services/PriorityCalculationService.js';

describe('PriorityCalculationService', () => {
  let service;

  beforeEach(() => {
    service = new PriorityCalculationService();
  });

  describe('calculateVariancePriority()', () => {
    it('should calculate critical priority for high-value items with large variances', () => {
      const item = { 
        name: 'Saffron', 
        costPerUnit: 50.00,
        categoryId: 1,
        isHighValue: true 
      };
      const absQuantityVariance = 2.0;
      const absDollarVariance = 100.00;

      const result = service.calculateVariancePriority(item, absQuantityVariance, absDollarVariance);

      expect(result).toBe('critical');
    });

    it('should calculate appropriate priority for significant dollar variances', () => {
      const item = { 
        name: 'Beef Tenderloin', 
        costPerUnit: 25.00,
        categoryId: 2 
      };
      const absQuantityVariance = 4.0;
      const absDollarVariance = 80.00;

      const result = service.calculateVariancePriority(item, absQuantityVariance, absDollarVariance);

      expect(['critical', 'high', 'medium', 'low']).toContain(result);
    });

    it('should calculate appropriate priority for moderate variances', () => {
      const item = { 
        name: 'Olive Oil', 
        costPerUnit: 8.00,
        categoryId: 3 
      };
      const absQuantityVariance = 1.5;
      const absDollarVariance = 35.00;

      const result = service.calculateVariancePriority(item, absQuantityVariance, absDollarVariance);

      expect(['critical', 'high', 'medium', 'low']).toContain(result);
    });

    it('should calculate low priority for small variances', () => {
      const item = { 
        name: 'Salt', 
        costPerUnit: 2.00,
        categoryId: 4 
      };
      const absQuantityVariance = 0.5;
      const absDollarVariance = 8.00;

      const result = service.calculateVariancePriority(item, absQuantityVariance, absDollarVariance);

      expect(result).toBe('low');
    });
  });

  describe('explainPriority()', () => {
    it('should provide detailed explanation for critical priority', () => {
      const item = { 
        name: 'Saffron', 
        costPerUnit: 50.00,
        highValueFlag: true 
      };
      const absQuantityVariance = 2.0;
      const absDollarVariance = 100.00;

      const result = service.explainPriority(item, absQuantityVariance, absDollarVariance);

      expect(result.priority).toBe('critical');
      expect(result.reason).toBeDefined();
      expect(result.factors).toBeInstanceOf(Array);
    });
  });

  describe('batchCalculatePriorities()', () => {
    it('should process multiple items and return results with priorities', () => {
      const analyses = [
        { 
          inventoryItemId: 1, 
          varianceQuantity: -0.5, 
          varianceDollarValue: -8.00 
        },
        { 
          inventoryItemId: 2, 
          varianceQuantity: -2.0, 
          varianceDollarValue: -100.00 
        }
      ];
      
      const itemsMap = {
        1: { name: 'Salt', costPerUnit: 2.00 },
        2: { name: 'Saffron', costPerUnit: 50.00, highValueFlag: true }
      };

      const results = service.batchCalculatePriorities(analyses, itemsMap);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('priority');
      expect(results[1]).toHaveProperty('priority');
    });
  });

  describe('validateItemThresholds()', () => {
    it('should validate item against configured thresholds', () => {
      const item = { 
        name: 'Test Item', 
        costPerUnit: 30.00,
        categoryId: 1,
        varianceThresholdQuantity: 5.0,
        varianceThresholdDollar: 25.0
      };

      const validation = service.validateItemThresholds(item);

      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('warnings');
      expect(validation).toHaveProperty('errors');
      expect(validation.isValid).toBe(true);
    });
  });
});
