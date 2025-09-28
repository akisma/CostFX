import { describe, it, expect, beforeEach, vi } from 'vitest';
import VarianceAnalysisService from '../../../src/services/VarianceAnalysisService.js';

/**
 * Test suite for VarianceAnalysisService
 * Testing Dave's business scenarios and variance calculation logic
 */
describe('VarianceAnalysisService', () => {
    let service;
    let saffronAnalysis;
    let romaineAnalysis;

    beforeEach(() => {
        service = new VarianceAnalysisService();
        
        // Dave's saffron scenario - high value, small quantity
        saffronAnalysis = {
            id: 1,
            theoreticalQuantity: '4.00',
            actualQuantity: '4.25',
            varianceQuantity: '0.25',
            variancePercentage: 6.25,
            varianceDollarValue: '37.50',
            priority: 'high'
        };

        // Dave's romaine scenario - low value, large quantity
        romaineAnalysis = {
            id: 2,
            theoreticalQuantity: '20.00',
            actualQuantity: '40.00',
            varianceQuantity: '20.00',
            variancePercentage: 100.0,
            varianceDollarValue: '50.00',
            priority: 'low'
        };
    });

    describe('getAbsoluteVariance', () => {
        it('should return 0 when theoretical and actual usage are equal', () => {
            const noVarianceAnalysis = {
                varianceQuantity: '0',
                variancePercentage: 0,
                varianceDollarValue: '0'
            };
            const result = service.getAbsoluteVariance(noVarianceAnalysis);
            expect(result.quantity).toBe(0);
            expect(result.dollarValue).toBe(0);
            expect(result.percentage).toBe(0);
        });

        it('should return absolute values for positive variances (overuse)', () => {
            const result = service.getAbsoluteVariance(saffronAnalysis);
            expect(result.quantity).toBe(0.25);
            expect(result.dollarValue).toBe(37.5);
            expect(result.percentage).toBe(6.25);
        });

        it('should return absolute values for negative variances (underuse)', () => {
            const shortageAnalysis = {
                varianceQuantity: '-0.5',
                variancePercentage: -12.5,
                varianceDollarValue: '-75.0'
            };
            const result = service.getAbsoluteVariance(shortageAnalysis);
            expect(result.quantity).toBe(0.5);
            expect(result.dollarValue).toBe(75.0);
            expect(result.percentage).toBe(12.5);
        });

        it('should handle zero theoretical usage (Dave\'s edge case)', () => {
            const unplannedUsage = {
                varianceQuantity: '50.0',
                variancePercentage: null,
                varianceDollarValue: '500.0'
            };
            const result = service.getAbsoluteVariance(unplannedUsage);
            expect(result.quantity).toBe(50.0);
            expect(result.dollarValue).toBe(500.0);
            expect(result.percentage).toBe(0);
        });

        it('should handle decimal values correctly (saffron vs romaine principle)', () => {
            // Saffron: small quantities, high precision needed
            const saffronResult = service.getAbsoluteVariance(saffronAnalysis);
            expect(saffronResult.quantity).toBe(0.25);
            expect(saffronResult.dollarValue).toBe(37.5);

            // Romaine: large quantities
            const romaineResult = service.getAbsoluteVariance(romaineAnalysis);
            expect(romaineResult.quantity).toBe(20.0);
            expect(romaineResult.dollarValue).toBe(50.0);
        });
    });

    describe('isHighImpactVariance', () => {
        it('should identify high impact based on priority (high)', () => {
            const result = service.isHighImpactVariance(saffronAnalysis);
            expect(result).toBe(true); // priority is 'high'
        });

        it('should identify low impact when priority is low and dollar value below threshold', () => {
            const result = service.isHighImpactVariance(romaineAnalysis);
            expect(result).toBe(false); // priority is 'low' and $50 < $100 threshold
        });

        it('should identify high impact when dollar variance exceeds $100 threshold', () => {
            const highDollarAnalysis = {
                varianceDollarValue: '150.00',
                priority: 'low'
            };
            const result = service.isHighImpactVariance(highDollarAnalysis);
            expect(result).toBe(true);
        });

        it('should identify high impact for critical priority regardless of dollar amount', () => {
            const criticalAnalysis = {
                varianceDollarValue: '10.00',
                priority: 'critical'
            };
            const result = service.isHighImpactVariance(criticalAnalysis);
            expect(result).toBe(true);
        });

        it('should handle zero dollar variance with low priority', () => {
            const zeroVariance = {
                varianceDollarValue: '0.00',
                priority: 'low'
            };
            const result = service.isHighImpactVariance(zeroVariance);
            expect(result).toBe(false);
        });

        it('should handle negative dollar values (shortages)', () => {
            const shortageAnalysis = {
                varianceDollarValue: '-150.00', // Large shortage
                priority: 'medium'
            };
            const result = service.isHighImpactVariance(shortageAnalysis);
            expect(result).toBe(true); // Absolute value $150 > $100 threshold
        });
    });

    describe('getVarianceDirection', () => {
        it('should identify overage correctly', () => {
            const result = service.getVarianceDirection(saffronAnalysis);
            expect(result).toBe('overage');
        });

        it('should identify shortage correctly', () => {
            const shortageAnalysis = {
                varianceQuantity: '-0.5'
            };
            const result = service.getVarianceDirection(shortageAnalysis);
            expect(result).toBe('shortage');
        });

        it('should handle zero variance', () => {
            const noVariance = {
                varianceQuantity: '0'
            };
            const result = service.getVarianceDirection(noVariance);
            expect(result).toBe('none');
        });
    });

    describe('getEfficiencyRatio', () => {
        it('should calculate efficiency ratio correctly', () => {
            const result = service.getEfficiencyRatio(saffronAnalysis);
            expect(result).toBeCloseTo(1.0625, 4); // 4.25 / 4.00
        });

        it('should handle zero theoretical quantity', () => {
            const zeroTheoretical = {
                theoreticalQuantity: '0',
                actualQuantity: '5.0'
            };
            const result = service.getEfficiencyRatio(zeroTheoretical);
            expect(result).toBeNull();
        });

        it('should handle perfect efficiency', () => {
            const perfectEfficiency = {
                theoreticalQuantity: '10.0',
                actualQuantity: '10.0'
            };
            const result = service.getEfficiencyRatio(perfectEfficiency);
            expect(result).toBe(1.0000);
        });
    });

    describe('getDisplayVariance', () => {
        it('should format positive variances correctly', () => {
            const result = service.getDisplayVariance(saffronAnalysis);
            expect(result.quantity).toBe('+0.25');
            expect(result.percentage).toBe('+6.25%');
            expect(result.dollar).toBe('+$37.50');
        });

        it('should format negative variances correctly', () => {
            const shortageAnalysis = {
                varianceQuantity: '-0.5',
                variancePercentage: -12.5,
                varianceDollarValue: '-75.0'
            };
            const result = service.getDisplayVariance(shortageAnalysis);
            expect(result.quantity).toBe('-0.5');
            expect(result.percentage).toBe('-12.50%');
            expect(result.dollar).toBe('-$75.00');
        });

        it('should handle zero variance', () => {
            const zeroVariance = {
                varianceQuantity: '0',
                variancePercentage: 0,
                varianceDollarValue: '0'
            };
            const result = service.getDisplayVariance(zeroVariance);
            expect(result.quantity).toBe('0');
            expect(result.percentage).toBe('0.00%');
            expect(result.dollar).toBe('$0.00');
        });

        it('should handle invalid/null values', () => {
            const invalidVariance = {
                varianceQuantity: null,
                variancePercentage: undefined,
                varianceDollarValue: 'invalid'
            };
            const result = service.getDisplayVariance(invalidVariance);
            expect(result.quantity).toBe('0');
            expect(result.percentage).toBe('N/A');
            expect(result.dollar).toBe('$0.00');
        });
    });

    describe('Business Scenario Integration Tests', () => {
        it('should handle Dave\'s saffron overuse scenario', () => {
            const absoluteVariance = service.getAbsoluteVariance(saffronAnalysis);
            const isHighImpact = service.isHighImpactVariance(saffronAnalysis);
            const direction = service.getVarianceDirection(saffronAnalysis);
            const efficiency = service.getEfficiencyRatio(saffronAnalysis);
            const displayVariance = service.getDisplayVariance(saffronAnalysis);

            expect(absoluteVariance.quantity).toBe(0.25);
            expect(absoluteVariance.dollarValue).toBe(37.5);
            expect(isHighImpact).toBe(true); // High priority
            expect(direction).toBe('overage');
            expect(efficiency).toBeCloseTo(1.0625, 4);
            expect(displayVariance.quantity).toBe('+0.25');
        });

        it('should handle Dave\'s romaine overuse scenario', () => {
            const absoluteVariance = service.getAbsoluteVariance(romaineAnalysis);
            const isHighImpact = service.isHighImpactVariance(romaineAnalysis);
            const direction = service.getVarianceDirection(romaineAnalysis);
            const efficiency = service.getEfficiencyRatio(romaineAnalysis);
            const displayVariance = service.getDisplayVariance(romaineAnalysis);

            expect(absoluteVariance.quantity).toBe(20.0);
            expect(absoluteVariance.dollarValue).toBe(50.0);
            expect(isHighImpact).toBe(false); // Low priority, under $100 threshold
            expect(direction).toBe('overage');
            expect(efficiency).toBe(2.0000); // 40/20 = 2.0
            expect(displayVariance.quantity).toBe('+20');
        });

        it('should handle shortage scenario', () => {
            const shortageAnalysis = {
                theoreticalQuantity: '5.00',
                actualQuantity: '4.50',
                varianceQuantity: '-0.50',
                variancePercentage: -10.0,
                varianceDollarValue: '-15.00',
                priority: 'medium'
            };

            const absoluteVariance = service.getAbsoluteVariance(shortageAnalysis);
            const direction = service.getVarianceDirection(shortageAnalysis);
            const efficiency = service.getEfficiencyRatio(shortageAnalysis);
            const displayVariance = service.getDisplayVariance(shortageAnalysis);

            expect(absoluteVariance.quantity).toBe(0.5);
            expect(absoluteVariance.dollarValue).toBe(15.0);
            expect(direction).toBe('shortage');
            expect(efficiency).toBe(0.9000); // 4.5/5.0 = 0.9
            expect(displayVariance.quantity).toBe('-0.5');
            expect(displayVariance.dollar).toBe('-$15.00');
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle missing variance data gracefully', () => {
            const missingData = {};
            const result = service.getAbsoluteVariance(missingData);
            expect(result.quantity).toBe(0);
            expect(result.dollarValue).toBe(0);
            expect(result.percentage).toBe(0);
        });

        it('should handle invalid string values', () => {
            const invalidData = {
                varianceQuantity: 'invalid',
                variancePercentage: null,
                varianceDollarValue: undefined
            };
            const result = service.getAbsoluteVariance(invalidData);
            expect(result.quantity).toBe(0);
            expect(result.dollarValue).toBe(0);
            expect(result.percentage).toBe(0);
        });

        it('should handle very small precision values', () => {
            const tinyVariance = {
                varianceQuantity: '0.001',
                variancePercentage: 0.1,
                varianceDollarValue: '0.05'
            };
            const result = service.getAbsoluteVariance(tinyVariance);
            expect(result.quantity).toBe(0.001);
            expect(result.dollarValue).toBe(0.05);
            expect(result.percentage).toBe(0.1);
        });

        it('should handle very large variance values', () => {
            const hugeVariance = {
                varianceQuantity: '1000000',
                variancePercentage: 5000,
                varianceDollarValue: '50000'
            };
            const result = service.getAbsoluteVariance(hugeVariance);
            expect(result.quantity).toBe(1000000);
            expect(result.dollarValue).toBe(50000);
            expect(result.percentage).toBe(5000);
        });
    });
});
