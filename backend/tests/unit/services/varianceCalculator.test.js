/**
 * VarianceCalculator Test Suite
 * 
 * Tests pre-computed variance threshold calculation with multi-factor rules.
 * Covers cost tiers, category adjustments, unit adjustments, and high-value flagging.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import VarianceCalculator from '../../../src/services/helpers/VarianceCalculator.js';

describe('VarianceCalculator', () => {
    let calculator;
    
    beforeEach(() => {
        calculator = new VarianceCalculator();
    });
    
    describe('Cost Tier Thresholds', () => {
        it('should use 20% threshold for items under $5', () => {
            const result = calculator.calculate({
                unitCost: 3.0,
                unit: 'lb',
                category: 'dry_goods',
                parLevel: 10.0
            });
            
            expect(result.calculation.basePct).toBe(20.0);
            expect(result.calculation.finalPct).toBe(20.0); // No adjustments for dry_goods/lb
            expect(result.varianceThresholdQuantity).toBe(2.0); // 10 * 20% = 2
            expect(result.varianceThresholdDollar).toBe(6.0); // 2 * $3 = $6
        });
        
        it('should use 15% threshold for items $5-20', () => {
            const result = calculator.calculate({
                unitCost: 12.0,
                unit: 'lb',
                category: 'dry_goods',
                parLevel: 10.0
            });
            
            expect(result.calculation.basePct).toBe(15.0);
            expect(result.varianceThresholdQuantity).toBe(1.5); // 10 * 15% = 1.5
            expect(result.varianceThresholdDollar).toBe(18.0); // 1.5 * $12 = $18
        });
        
        it('should use 10% threshold for items $20-100', () => {
            const result = calculator.calculate({
                unitCost: 50.0,
                unit: 'lb',
                category: 'dry_goods',
                parLevel: 10.0
            });
            
            expect(result.calculation.basePct).toBe(10.0);
            expect(result.varianceThresholdQuantity).toBe(1.0); // 10 * 10% = 1
            expect(result.varianceThresholdDollar).toBe(50.0); // 1 * $50 = $50
        });
        
        it('should use 5% threshold for items over $100', () => {
            const result = calculator.calculate({
                unitCost: 150.0,
                unit: 'lb',
                category: 'dry_goods',
                parLevel: 10.0
            });
            
            expect(result.calculation.basePct).toBe(5.0);
            expect(result.varianceThresholdQuantity).toBe(0.5); // 10 * 5% = 0.5
            expect(result.varianceThresholdDollar).toBe(75.0); // 0.5 * $150 = $75
        });
    });
    
    describe('Category Adjustments', () => {
        it('should apply +5% adjustment for produce', () => {
            const result = calculator.calculate({
                unitCost: 2.0, // Base tier: 20%
                unit: 'lb',
                category: 'produce',
                parLevel: 10.0
            });
            
            expect(result.calculation.basePct).toBe(20.0);
            expect(result.calculation.categoryAdjustment).toBe(5.0);
            expect(result.calculation.finalPct).toBe(25.0); // 20% + 5%
            expect(result.varianceThresholdQuantity).toBe(2.5); // 10 * 25% = 2.5
        });
        
        it('should apply -5% adjustment for proteins', () => {
            const result = calculator.calculate({
                unitCost: 2.0, // Base tier: 20%
                unit: 'lb',
                category: 'proteins',
                parLevel: 10.0
            });
            
            expect(result.calculation.categoryAdjustment).toBe(-5.0);
            expect(result.calculation.finalPct).toBe(15.0); // 20% - 5%
            expect(result.varianceThresholdQuantity).toBe(1.5); // 10 * 15% = 1.5
        });
        
        it('should apply +10% adjustment for beverages', () => {
            const result = calculator.calculate({
                unitCost: 2.0, // Base tier: 20%
                unit: 'gal',
                category: 'beverages',
                parLevel: 5.0
            });
            
            expect(result.calculation.categoryAdjustment).toBe(10.0);
            expect(result.calculation.finalPct).toBe(30.0); // 20% + 10%
            expect(result.varianceThresholdQuantity).toBe(1.5); // 5 * 30% = 1.5
        });
        
        it('should apply no adjustment for dry goods', () => {
            const result = calculator.calculate({
                unitCost: 2.0, // Base tier: 20%
                unit: 'lb',
                category: 'dry_goods',
                parLevel: 10.0
            });
            
            expect(result.calculation.categoryAdjustment).toBe(0.0);
            expect(result.calculation.finalPct).toBe(20.0); // No change
        });
    });
    
    describe('Unit Adjustments', () => {
        it('should apply +30% adjustment for "ea" unit', () => {
            const result = calculator.calculate({
                unitCost: 2.0, // Base tier: 20%
                unit: 'ea',
                category: 'dry_goods',
                parLevel: 10.0
            });
            
            expect(result.calculation.unitAdjustment).toBe(30.0);
            expect(result.calculation.finalPct).toBe(50.0); // 20% + 30%
            expect(result.varianceThresholdQuantity).toBe(5.0); // 10 * 50% = 5
        });
        
        it('should apply -5% adjustment for "case" unit', () => {
            const result = calculator.calculate({
                unitCost: 2.0, // Base tier: 20%
                unit: 'case',
                category: 'dry_goods',
                parLevel: 10.0
            });
            
            expect(result.calculation.unitAdjustment).toBe(-5.0);
            expect(result.calculation.finalPct).toBe(15.0); // 20% - 5%
            expect(result.varianceThresholdQuantity).toBe(1.5); // 10 * 15% = 1.5
        });
        
        it('should apply no adjustment for common units (lb, gal)', () => {
            const resultLb = calculator.calculate({
                unitCost: 2.0,
                unit: 'lb',
                category: 'dry_goods',
                parLevel: 10.0
            });
            
            expect(resultLb.calculation.unitAdjustment).toBe(0.0);
            
            const resultGal = calculator.calculate({
                unitCost: 2.0,
                unit: 'gal',
                category: 'dry_goods',
                parLevel: 10.0
            });
            
            expect(resultGal.calculation.unitAdjustment).toBe(0.0);
        });
    });
    
    describe('Multi-Factor Calculation', () => {
        it('should combine all adjustments correctly', () => {
            // Produce ($2/lb) + ea unit: 20% (base) + 5% (produce) + 30% (ea) = 55%
            const result = calculator.calculate({
                unitCost: 2.0,
                unit: 'ea',
                category: 'produce',
                parLevel: 10.0
            });
            
            expect(result.calculation.basePct).toBe(20.0);
            expect(result.calculation.categoryAdjustment).toBe(5.0);
            expect(result.calculation.unitAdjustment).toBe(30.0);
            expect(result.calculation.finalPct).toBe(55.0);
            expect(result.varianceThresholdQuantity).toBe(5.5); // 10 * 55% = 5.5
        });
        
        it('should enforce minimum 1% threshold', () => {
            // Proteins ($150/lb) + case: 5% (base) - 5% (proteins) - 5% (case) = 1% min
            const result = calculator.calculate({
                unitCost: 150.0,
                unit: 'case',
                category: 'proteins',
                parLevel: 10.0
            });
            
            expect(result.calculation.finalPct).toBeGreaterThanOrEqual(1.0);
        });
    });
    
    describe('High-Value Flagging', () => {
        it('should flag items with dollar threshold >= $50', () => {
            const result = calculator.calculate({
                unitCost: 100.0, // $100/lb
                unit: 'lb',
                category: 'proteins',
                parLevel: 10.0 // 10 lb par
            });
            
            // 5% (base) - 5% (proteins) = 0% -> min 1% = 0.1 lb threshold
            // 0.1 lb * $100/lb = $10 ... wait, this should be higher
            // Let me recalculate: proteins should be -5%, but base at $100 is 5%
            // So it's max(1%, 5% - 5%) = max(1%, 0%) = 1%
            // 10 lb * 1% = 0.1 lb * $100 = $10
            
            // Actually the tier for $100 is "< 100" which is 10%, not 5%
            // Let's use $101 to get 5% tier
            const resultHighCost = calculator.calculate({
                unitCost: 101.0,
                unit: 'lb',
                category: 'dry_goods',
                parLevel: 100.0
            });
            
            // 5% base * 100 lb = 5 lb * $101 = $505
            expect(resultHighCost.varianceThresholdDollar).toBeGreaterThan(50.0);
            expect(resultHighCost.highValueFlag).toBe(true);
        });
        
        it('should not flag items with dollar threshold < $50', () => {
            const result = calculator.calculate({
                unitCost: 2.0,
                unit: 'lb',
                category: 'dry_goods',
                parLevel: 10.0
            });
            
            // 20% * 10 lb = 2 lb * $2 = $4
            expect(result.varianceThresholdDollar).toBeLessThan(50.0);
            expect(result.highValueFlag).toBe(false);
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle zero parLevel gracefully', () => {
            const result = calculator.calculate({
                unitCost: 10.0,
                unit: 'lb',
                category: 'produce',
                parLevel: 0
            });
            
            expect(result.varianceThresholdQuantity).toBe(0.0);
            expect(result.varianceThresholdDollar).toBe(0.0);
        });
        
        it('should handle negative unitCost gracefully', () => {
            const result = calculator.calculate({
                unitCost: -5.0,
                unit: 'lb',
                category: 'produce',
                parLevel: 10.0
            });
            
            expect(result.varianceThresholdQuantity).toBe(0.0);
            expect(result.varianceThresholdDollar).toBe(0.0);
            expect(result.calculation.error).toBeDefined();
        });
        
        it('should handle unknown category gracefully', () => {
            const result = calculator.calculate({
                unitCost: 10.0,
                unit: 'lb',
                category: 'unknown_category',
                parLevel: 10.0
            });
            
            // Should use base tier with no category adjustment
            expect(result.calculation.categoryAdjustment).toBe(0.0);
            expect(result.varianceThresholdQuantity).toBeGreaterThan(0);
        });
        
        it('should handle unknown unit gracefully', () => {
            const result = calculator.calculate({
                unitCost: 10.0,
                unit: 'unknown_unit',
                category: 'produce',
                parLevel: 10.0
            });
            
            // Should use base tier + category adjustment with no unit adjustment
            expect(result.calculation.unitAdjustment).toBe(0.0);
            expect(result.varianceThresholdQuantity).toBeGreaterThan(0);
        });
    });
    
    describe('Configuration Methods', () => {
        it('should allow updating high-value threshold', () => {
            calculator.setHighValueThreshold(100.0);
            
            const result = calculator.calculate({
                unitCost: 50.0,
                unit: 'lb',
                category: 'dry_goods',
                parLevel: 10.0
            });
            
            // 10% * 10 lb = 1 lb * $50 = $50 (< $100 threshold)
            expect(result.highValueFlag).toBe(false);
        });
        
        it('should allow adding custom category adjustment', () => {
            calculator.setCategoryAdjustment('test_category', 25.0);
            
            const result = calculator.calculate({
                unitCost: 2.0,
                unit: 'lb',
                category: 'test_category',
                parLevel: 10.0
            });
            
            expect(result.calculation.categoryAdjustment).toBe(25.0);
            expect(result.calculation.finalPct).toBe(45.0); // 20% + 25%
        });
        
        it('should allow adding custom unit adjustment', () => {
            calculator.setUnitAdjustment('test_unit', 15.0);
            
            const result = calculator.calculate({
                unitCost: 2.0,
                unit: 'test_unit',
                category: 'dry_goods',
                parLevel: 10.0
            });
            
            expect(result.calculation.unitAdjustment).toBe(15.0);
            expect(result.calculation.finalPct).toBe(35.0); // 20% + 15%
        });
    });
});
