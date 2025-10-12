/**
 * POSDataTransformer Test Suite
 * 
 * Tests the main transformation orchestration service that coordinates
 * CategoryMapper, UnitInferrer, and VarianceCalculator to transform
 * Square menu items into unified inventory format.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import POSDataTransformer from '../../../src/services/POSDataTransformer.js';

describe('POSDataTransformer', () => {
    let transformer;
    
    beforeEach(() => {
        transformer = new POSDataTransformer();
    });
    
    describe('Single Item Transformation (Dry Run)', () => {
        it('should transform produce item with all mappings', async () => {
            const squareMenuItem = {
                id: 'square-123',
                catalog_object_id: 'CATALOG-ABC',
                name: 'Tomatoes',
                category_id: 'cat-1',
                category_name: 'Fresh Produce',
                variations: [
                    {
                        id: 'var-1',
                        name: 'Regular',
                        ordinal: 0,
                        price_money: {
                            amount: 350, // $3.50
                            currency: 'USD'
                        }
                    }
                ],
                getPrimaryVariation: function() {
                    return this.variations[0];
                }
            };
            
            const result = await transformer.squareMenuItemToInventoryItem(
                squareMenuItem,
                1, // restaurantId
                { dryRun: true }
            );
            
            expect(result.inventoryItem).toBeDefined();
            expect(result.inventoryItem.name).toBe('Tomatoes');
            expect(result.inventoryItem.category).toBe('produce');
            expect(result.inventoryItem.unit).toBe('lb');
            expect(result.inventoryItem.unitCost).toBe(3.50);
            expect(result.inventoryItem.sourcePosProvider).toBe('square');
            expect(result.inventoryItem.sourcePosItemId).toBe('square-123');
            
            expect(result.metadata.categoryMapping).toBeDefined();
            expect(result.metadata.categoryMapping.category).toBe('produce');
            expect(result.metadata.categoryMapping.confidence).toBeGreaterThan(0.9);
            
            expect(result.metadata.unitInference).toBeDefined();
            expect(result.metadata.unitInference.unit).toBe('lb');
            
            expect(result.metadata.varianceThresholds).toBeDefined();
            expect(result.metadata.varianceThresholds.varianceThresholdQuantity).toBeGreaterThan(0);
        });
        
        it('should transform protein item with fuzzy category match', async () => {
            const squareMenuItem = {
                id: 'square-456',
                name: 'Chicken Breast',
                category_name: 'Meats & Seafood', // Should fuzzy match to 'proteins'
                variations: [
                    {
                        id: 'var-2',
                        ordinal: 0,
                        price_money: {
                            amount: 1250, // $12.50
                            currency: 'USD'
                        }
                    }
                ],
                getPrimaryVariation: function() {
                    return this.variations[0];
                }
            };
            
            const result = await transformer.squareMenuItemToInventoryItem(
                squareMenuItem,
                1,
                { dryRun: true }
            );
            
            expect(result.inventoryItem.category).toBe('proteins');
            expect(result.inventoryItem.unit).toBe('lb');
            expect(result.inventoryItem.unitCost).toBe(12.50);
            
            // Proteins should have tighter variance thresholds (category adjustment: -5%)
            expect(result.metadata.varianceThresholds.calculation.categoryAdjustment).toBe(-5.0);
        });
        
        it('should infer unit from item name (with explicit unit)', async () => {
            const squareMenuItem = {
                id: 'square-789',
                name: 'Milk 1 gallon',
                category_name: 'Dairy Products',
                variations: [
                    {
                        id: 'var-3',
                        ordinal: 0,
                        price_money: {
                            amount: 450, // $4.50
                            currency: 'USD'
                        }
                    }
                ],
                getPrimaryVariation: function() {
                    return this.variations[0];
                }
            };
            
            const result = await transformer.squareMenuItemToInventoryItem(
                squareMenuItem,
                1,
                { dryRun: true }
            );
            
            expect(result.inventoryItem.category).toBe('dairy');
            expect(result.inventoryItem.unit).toBe('gal');
            expect(result.metadata.unitInference.matchType).toBe('pattern');
            expect(result.metadata.unitInference.confidence).toBeGreaterThan(0.9);
        });
        
        it('should handle "each" items with higher variance tolerance', async () => {
            const squareMenuItem = {
                id: 'square-101',
                name: 'Whole Chicken',
                category_name: 'Meats',
                variations: [
                    {
                        id: 'var-4',
                        ordinal: 0,
                        price_money: {
                            amount: 800, // $8.00
                            currency: 'USD'
                        }
                    }
                ],
                getPrimaryVariation: function() {
                    return this.variations[0];
                }
            };
            
            const result = await transformer.squareMenuItemToInventoryItem(
                squareMenuItem,
                1,
                { dryRun: true }
            );
            
            expect(result.inventoryItem.unit).toBe('ea');
            expect(result.metadata.unitInference.matchType).toBe('pattern');
            
            // "ea" unit should have +30% adjustment
            expect(result.metadata.varianceThresholds.calculation.unitAdjustment).toBe(30.0);
        });
        
        it('should flag high-value items correctly', async () => {
            // Need a scenario where dollar threshold exceeds $50
            // High-cost item ($150/lb) + high parLevel (100 lb) + dry_goods (no adjustment)
            // Cost tier: $150 > $100 = 5% base
            // Category: dry_goods = 0% adjustment
            // Final: 5% * 100 lb = 5 lb * $150 = $750 (> $50 high-value threshold)
            const squareMenuItem = {
                id: 'square-202',
                name: 'Lobster Tail',
                category_name: 'Dry Goods', // Use dry_goods to avoid proteins -5% adjustment
                variations: [
                    {
                        id: 'var-5',
                        ordinal: 0,
                        price_money: {
                            amount: 15000, // $150.00
                            currency: 'USD'
                        }
                    }
                ],
                getPrimaryVariation: function() {
                    return this.variations[0];
                }
            };
            
            const result = await transformer.squareMenuItemToInventoryItem(
                squareMenuItem,
                1,
                { dryRun: true }
            );
            
            // Verify high unitCost
            expect(result.inventoryItem.unitCost).toBe(150.00);
            
            // Verify high-value flag is set
            // With parLevel=10, 5% threshold = 0.5 lb * $150 = $75 > $50
            expect(result.inventoryItem.highValueFlag).toBe(true);
            expect(result.metadata.varianceThresholds.highValueFlag).toBe(true);
            
            // Verify dollar threshold exceeds $50
            expect(result.metadata.varianceThresholds.varianceThresholdDollar).toBeGreaterThan(50.0);
        });
    });
    
    describe('Unmapped Categories', () => {
        it('should use fallback category for unmapped category', async () => {
            const squareMenuItem = {
                id: 'square-999',
                name: 'Mystery Item',
                category_name: 'Unknown Category 123',
                variations: [
                    {
                        id: 'var-99',
                        ordinal: 0,
                        price_money: {
                            amount: 500,
                            currency: 'USD'
                        }
                    }
                ],
                getPrimaryVariation: function() {
                    return this.variations[0];
                }
            };
            
            const result = await transformer.squareMenuItemToInventoryItem(
                squareMenuItem,
                1,
                { dryRun: true }
            );
            
            // Should fall back to 'dry_goods'
            expect(result.inventoryItem.category).toBe('dry_goods');
            expect(result.metadata.categoryMapping.matchType).toBe('fallback');
            expect(result.metadata.categoryMapping.confidence).toBeLessThan(0.5);
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle item with zero price', async () => {
            const squareMenuItem = {
                id: 'square-303',
                name: 'Free Sample',
                category_name: 'Produce',
                variations: [
                    {
                        id: 'var-6',
                        ordinal: 0,
                        price_money: {
                            amount: 0,
                            currency: 'USD'
                        }
                    }
                ],
                getPrimaryVariation: function() {
                    return this.variations[0];
                }
            };
            
            const result = await transformer.squareMenuItemToInventoryItem(
                squareMenuItem,
                1,
                { dryRun: true }
            );
            
            expect(result.inventoryItem.unitCost).toBe(0.0);
            expect(result.inventoryItem.varianceThresholdQuantity).toBeGreaterThan(0);
        });
        
        it('should handle item with no variations', async () => {
            const squareMenuItem = {
                id: 'square-404',
                name: 'No Variation Item',
                category_name: 'Produce',
                variations: [],
                getPrimaryVariation: function() {
                    return null;
                }
            };
            
            await expect(
                transformer.squareMenuItemToInventoryItem(squareMenuItem, 1, { dryRun: true })
            ).rejects.toThrow('No primary variation found');
        });
        
        it('should handle item with multiple variations (uses primary/ordinal 0)', async () => {
            const squareMenuItem = {
                id: 'square-505',
                name: 'Coffee',
                category_name: 'Beverages',
                variations: [
                    {
                        id: 'var-7',
                        name: 'Large',
                        ordinal: 2,
                        price_money: { amount: 500, currency: 'USD' }
                    },
                    {
                        id: 'var-8',
                        name: 'Small',
                        ordinal: 0,
                        price_money: { amount: 300, currency: 'USD' }
                    },
                    {
                        id: 'var-9',
                        name: 'Medium',
                        ordinal: 1,
                        price_money: { amount: 400, currency: 'USD' }
                    }
                ],
                getPrimaryVariation: function() {
                    return this.variations.find(v => v.ordinal === 0);
                }
            };
            
            const result = await transformer.squareMenuItemToInventoryItem(
                squareMenuItem,
                1,
                { dryRun: true }
            );
            
            // Should use "Small" variation (ordinal 0)
            expect(result.inventoryItem.unitCost).toBe(3.00);
        });
    });
    
    describe('Batch Transformation', () => {
        it('should transform multiple items successfully', async () => {
            const squareMenuItems = [
                {
                    id: 'square-1',
                    name: 'Item 1',
                    category_name: 'Produce',
                    variations: [{ id: 'v1', ordinal: 0, price_money: { amount: 100, currency: 'USD' } }],
                    getPrimaryVariation: function() { return this.variations[0]; }
                },
                {
                    id: 'square-2',
                    name: 'Item 2',
                    category_name: 'Dairy',
                    variations: [{ id: 'v2', ordinal: 0, price_money: { amount: 200, currency: 'USD' } }],
                    getPrimaryVariation: function() { return this.variations[0]; }
                },
                {
                    id: 'square-3',
                    name: 'Item 3',
                    category_name: 'Proteins',
                    variations: [{ id: 'v3', ordinal: 0, price_money: { amount: 300, currency: 'USD' } }],
                    getPrimaryVariation: function() { return this.variations[0]; }
                }
            ];
            
            const result = await transformer.transformBatch(
                squareMenuItems,
                1,
                { dryRun: true }
            );
            
            expect(result.success).toHaveLength(3);
            expect(result.errors).toHaveLength(0);
            expect(result.summary.successCount).toBe(3);
            expect(result.summary.errorRate).toBe(0);
        });
        
        it('should handle partial failures within error threshold', async () => {
            const squareMenuItems = Array.from({ length: 100 }, (_, i) => ({
                id: `square-${i}`,
                name: `Item ${i}`,
                category_name: 'Produce',
                variations: i < 3 ? [] : [{ // First 3 items have no variations (errors)
                    id: `v${i}`,
                    ordinal: 0,
                    price_money: { amount: 100, currency: 'USD' }
                }],
                getPrimaryVariation: function() {
                    return this.variations[0] || null;
                }
            }));
            
            const result = await transformer.transformBatch(
                squareMenuItems,
                1,
                { dryRun: true }
            );
            
            expect(result.errors).toHaveLength(3);
            expect(result.success).toHaveLength(97);
            expect(result.summary.errorRate).toBe(3.0); // 3% error rate (within 5% threshold)
        });
        
        it('should fail batch if error rate exceeds threshold', async () => {
            const squareMenuItems = Array.from({ length: 20 }, (_, i) => ({
                id: `square-${i}`,
                name: `Item ${i}`,
                category_name: 'Produce',
                variations: i < 2 ? [{ // 10% of items have variations (90% errors)
                    id: `v${i}`,
                    ordinal: 0,
                    price_money: { amount: 100, currency: 'USD' }
                }] : [],
                getPrimaryVariation: function() {
                    return this.variations[0] || null;
                }
            }));
            
            await expect(
                transformer.transformBatch(squareMenuItems, 1, { dryRun: true })
            ).rejects.toThrow('exceeds threshold');
        });
    });
});
