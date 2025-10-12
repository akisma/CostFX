/**
 * UnitInferrer Test Suite
 * 
 * Tests pattern matching for measurement unit inference from item names.
 * Covers weight, volume, count, container units, and fallback logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import UnitInferrer from '../../../src/services/helpers/UnitInferrer.js';

describe('UnitInferrer', () => {
    let inferrer;
    
    beforeEach(() => {
        inferrer = new UnitInferrer();
    });
    
    describe('Weight Units', () => {
        it('should infer oz from "Tomatoes 16 oz"', () => {
            const result = inferrer.inferUnit('Tomatoes 16 oz');
            expect(result.unit).toBe('oz');
            expect(result.matchType).toBe('pattern');
            expect(result.confidence).toBeGreaterThan(0.9);
        });
        
        it('should infer lb from "Chicken Breast 5 lbs"', () => {
            const result = inferrer.inferUnit('Chicken Breast 5 lbs');
            expect(result.unit).toBe('lb');
            expect(result.matchType).toBe('pattern');
            expect(result.confidence).toBeGreaterThan(0.9);
        });
        
        it('should infer lb from "10 pound beef"', () => {
            const result = inferrer.inferUnit('10 pound beef');
            expect(result.unit).toBe('lb');
            expect(result.matchType).toBe('pattern');
        });
        
        it('should infer kg from "Rice 25kg bag"', () => {
            const result = inferrer.inferUnit('Rice 25kg bag');
            expect(result.unit).toBe('kg');
            expect(result.matchType).toBe('pattern');
        });
    });
    
    describe('Volume Units', () => {
        it('should infer gal from "Milk 1 gallon"', () => {
            const result = inferrer.inferUnit('Milk 1 gallon');
            expect(result.unit).toBe('gal');
            expect(result.matchType).toBe('pattern');
            expect(result.confidence).toBeGreaterThan(0.9);
        });
        
        it('should infer qt from "Heavy Cream 2 qt"', () => {
            const result = inferrer.inferUnit('Heavy Cream 2 qt');
            expect(result.unit).toBe('qt');
            expect(result.matchType).toBe('pattern');
        });
        
        it('should infer L from "Olive Oil 5L"', () => {
            const result = inferrer.inferUnit('Olive Oil 5L');
            expect(result.unit).toBe('L');
            expect(result.matchType).toBe('pattern');
        });
        
        it('should infer fl oz from "Vanilla Extract 16 fl oz"', () => {
            const result = inferrer.inferUnit('Vanilla Extract 16 fl oz');
            expect(result.unit).toBe('fl oz');
            expect(result.matchType).toBe('pattern');
        });
    });
    
    describe('Count Units', () => {
        it('should infer ea from "Avocado 1 ea"', () => {
            const result = inferrer.inferUnit('Avocado 1 ea');
            expect(result.unit).toBe('ea');
            expect(result.matchType).toBe('pattern');
        });
        
        it('should infer ea from "Whole Chicken"', () => {
            const result = inferrer.inferUnit('Whole Chicken');
            expect(result.unit).toBe('ea');
            expect(result.matchType).toBe('pattern');
            expect(result.confidence).toBeGreaterThan(0.6);
        });
        
        it('should infer ea from "Individual Cake 12 pc"', () => {
            const result = inferrer.inferUnit('Individual Cake 12 pc');
            expect(result.unit).toBe('ea');
            expect(result.matchType).toBe('pattern');
        });
    });
    
    describe('Container Units', () => {
        it('should infer case from "Soda 1 case"', () => {
            const result = inferrer.inferUnit('Soda 1 case');
            expect(result.unit).toBe('case');
            expect(result.matchType).toBe('pattern');
        });
        
        it('should infer bag from "Flour 50 lb bag"', () => {
            // Note: "lb" pattern should match first (higher confidence)
            const result = inferrer.inferUnit('Flour 50 lb bag');
            expect(result.unit).toBe('lb');
            expect(result.matchType).toBe('pattern');
        });
        
        it('should infer can from "Tomato Sauce 6 cans"', () => {
            const result = inferrer.inferUnit('Tomato Sauce 6 cans');
            expect(result.unit).toBe('can');
            expect(result.matchType).toBe('pattern');
        });
    });
    
    describe('Variation Name Context', () => {
        it('should use variation name for unit inference', () => {
            const result = inferrer.inferUnit('Chicken', { variationName: '5 lb package' });
            expect(result.unit).toBe('lb');
            expect(result.matchType).toBe('pattern');
        });
        
        it('should combine item name and variation name', () => {
            const result = inferrer.inferUnit('Tomatoes', { variationName: 'Roma 10 lb' });
            expect(result.unit).toBe('lb');
            expect(result.matchType).toBe('pattern');
        });
    });
    
    describe('Category Fallback', () => {
        it('should use category default for produce without pattern', () => {
            const result = inferrer.inferUnit('Lettuce', { category: 'produce' });
            expect(result.unit).toBe('lb');
            expect(result.matchType).toBe('category_default');
            expect(result.confidence).toBe(0.6);
        });
        
        it('should use category default for beverages without pattern', () => {
            const result = inferrer.inferUnit('Orange Juice', { category: 'beverages' });
            expect(result.unit).toBe('gal');
            expect(result.matchType).toBe('category_default');
        });
        
        it('should use category default for paper goods', () => {
            const result = inferrer.inferUnit('Paper Plates', { category: 'paper_disposables' });
            expect(result.unit).toBe('ea');
            expect(result.matchType).toBe('category_default');
        });
        
        it('should prefer pattern match over category default', () => {
            const result = inferrer.inferUnit('Lettuce 5 oz', { category: 'produce' });
            expect(result.unit).toBe('oz');
            expect(result.matchType).toBe('pattern');
        });
    });
    
    describe('Global Default Fallback', () => {
        it('should use global default for unknown item without category', () => {
            const result = inferrer.inferUnit('Mystery Item');
            expect(result.unit).toBe('lb');
            expect(result.matchType).toBe('global_default');
            expect(result.confidence).toBe(0.5);
        });
        
        it('should use global default for empty string', () => {
            const result = inferrer.inferUnit('');
            expect(result.unit).toBe('lb');
            expect(result.matchType).toBe('global_default');
        });
        
        it('should use global default for null input', () => {
            const result = inferrer.inferUnit(null);
            expect(result.unit).toBe('lb');
            expect(result.matchType).toBe('global_default');
        });
    });
    
    describe('Case Insensitivity', () => {
        it('should match uppercase units', () => {
            const result = inferrer.inferUnit('MILK 1 GAL');
            expect(result.unit).toBe('gal');
            expect(result.matchType).toBe('pattern');
        });
        
        it('should match mixed case units', () => {
            const result = inferrer.inferUnit('Chicken 5 LBS');
            expect(result.unit).toBe('lb');
            expect(result.matchType).toBe('pattern');
        });
    });
    
    describe('Utility Methods', () => {
        it('should return all supported units', () => {
            const units = inferrer.getSupportedUnits();
            expect(units).toContain('oz');
            expect(units).toContain('lb');
            expect(units).toContain('gal');
            expect(units).toContain('ea');
            expect(units).toContain('case');
        });
        
        it('should return unique units only', () => {
            const units = inferrer.getSupportedUnits();
            const uniqueUnits = [...new Set(units)];
            expect(units.length).toBe(uniqueUnits.length);
        });
    });
    
    describe('Custom Patterns', () => {
        it('should allow adding custom pattern at runtime', () => {
            inferrer.addPattern(/tray/i, 'tray', 0.9);
            const result = inferrer.inferUnit('Cupcakes 1 tray');
            expect(result.unit).toBe('tray');
            expect(result.matchType).toBe('pattern');
        });
    });
});
