/**
 * CategoryMapper Test Suite
 * 
 * Tests fuzzy string matching for POS category to ingredient category mapping.
 * Covers exact matches, fuzzy matches, edge cases, and confidence scoring.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import CategoryMapper from '../../../src/services/helpers/CategoryMapper.js';

describe('CategoryMapper', () => {
    let mapper;
    
    beforeEach(() => {
        mapper = new CategoryMapper();
    });
    
    describe('Exact Matches', () => {
        it('should map exact produce category', () => {
            const result = mapper.mapSquareCategory('produce');
            expect(result).toEqual({
                category: 'produce',
                confidence: 1.0,
                matchType: 'exact'
            });
        });
        
        it('should map exact proteins category', () => {
            const result = mapper.mapSquareCategory('meats & seafood');
            expect(result).toEqual({
                category: 'proteins',
                confidence: 1.0,
                matchType: 'exact'
            });
        });
        
        it('should map exact dairy category with case insensitivity', () => {
            const result = mapper.mapSquareCategory('DAIRY PRODUCTS');
            expect(result).toEqual({
                category: 'dairy',
                confidence: 1.0,
                matchType: 'exact'
            });
        });
        
        it('should map exact dry goods category', () => {
            const result = mapper.mapSquareCategory('pantry staples');
            expect(result).toEqual({
                category: 'dry_goods',
                confidence: 1.0,
                matchType: 'exact'
            });
        });
    });
    
    describe('Fuzzy Matches', () => {
        it('should match "produc" to produce (1 char typo)', () => {
            const result = mapper.mapSquareCategory('produc');
            expect(result).not.toBeNull();
            expect(result.category).toBe('produce');
            expect(result.matchType).toBe('fuzzy');
            expect(result.confidence).toBeGreaterThan(0.7);
        });
        
        it('should match "fresh producs" to produce (1 char typo)', () => {
            const result = mapper.mapSquareCategory('fresh producs');
            expect(result).not.toBeNull();
            expect(result.category).toBe('produce');
            expect(result.matchType).toBe('fuzzy');
        });
        
        it('should match "meats & seafod" to proteins (1 char typo)', () => {
            const result = mapper.mapSquareCategory('meats & seafod');
            expect(result).not.toBeNull();
            expect(result.category).toBe('proteins');
            expect(result.matchType).toBe('fuzzy');
        });
        
        it('should match "dairy product" to dairy (singular vs plural)', () => {
            const result = mapper.mapSquareCategory('dairy product');
            expect(result).not.toBeNull();
            expect(result.category).toBe('dairy');
            expect(result.matchType).toBe('fuzzy');
        });
        
        it('should handle extra whitespace in fuzzy match', () => {
            const result = mapper.mapSquareCategory('  fresh   produce  ');
            expect(result).not.toBeNull();
            expect(result.category).toBe('produce');
        });
    });
    
    describe('Unmapped Categories', () => {
        it('should return null for completely unknown category', () => {
            const result = mapper.mapSquareCategory('unicorn food');
            expect(result).toBeNull();
        });
        
        it('should return null for category with too many typos', () => {
            const result = mapper.mapSquareCategory('prodxyz'); // 3+ char difference
            expect(result).toBeNull();
        });
        
        it('should return null for empty string', () => {
            const result = mapper.mapSquareCategory('');
            expect(result).toBeNull();
        });
        
        it('should return null for null input', () => {
            const result = mapper.mapSquareCategory(null);
            expect(result).toBeNull();
        });
        
        it('should return null for undefined input', () => {
            const result = mapper.mapSquareCategory(undefined);
            expect(result).toBeNull();
        });
    });
    
    describe('Confidence Scoring', () => {
        it('should have confidence 1.0 for exact matches', () => {
            const result = mapper.mapSquareCategory('produce');
            expect(result.confidence).toBe(1.0);
        });
        
        it('should have high confidence for 1-char typo on short word', () => {
            const result = mapper.mapSquareCategory('meats'); // exact match actually
            expect(result.confidence).toBe(1.0);
        });
        
        it('should have lower confidence for fuzzy match on longer word', () => {
            const result = mapper.mapSquareCategory('fresh producs'); // 1 typo in 13 chars
            expect(result.confidence).toBeGreaterThan(0.7);
            expect(result.confidence).toBeLessThan(1.0);
        });
    });
    
    describe('Custom Mappings', () => {
        it('should allow adding custom mapping at runtime', () => {
            mapper.addMapping('test category', 'produce');
            const result = mapper.mapSquareCategory('test category');
            expect(result).toEqual({
                category: 'produce',
                confidence: 1.0,
                matchType: 'exact'
            });
        });
        
        it('should normalize custom mapping pattern', () => {
            mapper.addMapping('  TEST   CATEGORY  ', 'dairy');
            const result = mapper.mapSquareCategory('test category');
            expect(result.category).toBe('dairy');
        });
    });
    
    describe('Utility Methods', () => {
        it('should return all supported categories', () => {
            const categories = mapper.getSupportedCategories();
            expect(categories).toContain('produce');
            expect(categories).toContain('proteins');
            expect(categories).toContain('dairy');
            expect(categories).toContain('dry_goods');
            expect(categories).toContain('beverages');
            expect(categories).toContain('frozen');
            expect(categories).toContain('paper_disposables');
            expect(categories).toContain('cleaning_chemicals');
        });
        
        it('should return unique categories only', () => {
            const categories = mapper.getSupportedCategories();
            const uniqueCategories = [...new Set(categories)];
            expect(categories.length).toBe(uniqueCategories.length);
        });
    });
});
