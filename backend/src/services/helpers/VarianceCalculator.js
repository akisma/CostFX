/**
 * VarianceCalculator - Pre-computed Variance Threshold Calculation
 * 
 * Calculates variance thresholds (quantity and dollar) for inventory items based on
 * multi-factor rules. These thresholds are pre-computed during POS data transformation
 * and stored in the inventory_items table for fast SQL queries and filtering.
 * 
 * Multi-Factor Rules:
 * 1. Cost-based tiers (4 levels): Higher cost items = tighter thresholds
 * 2. Category adjustments: Different categories have different variance tolerances
 * 3. Unit-specific rules: "Each" items more variable, bulk items less variable
 * 
 * Pre-computed Approach (chosen based on user requirements):
 * - Thresholds calculated during transformation, stored in DB
 * - Enables fast SQL queries: "SELECT * FROM inventory_items WHERE variance_significant = true"
 * - Supports filtering by high-value items in dashboards
 * - Acceptable staleness: Recalculated on next sync when costs change
 * 
 * @module services/helpers/VarianceCalculator
 */

import logger from '../../utils/logger.js';

/**
 * Cost tier thresholds (quantity variance percentages)
 * Lower cost items = higher tolerance (more variance acceptable)
 * Higher cost items = lower tolerance (tighter variance control)
 */
const COST_TIERS = [
    { maxCost: 5, quantityPct: 20.0 },      // Under $5: ±20%
    { maxCost: 20, quantityPct: 15.0 },     // $5-20: ±15%
    { maxCost: 100, quantityPct: 10.0 },    // $20-100: ±10%
    { maxCost: Infinity, quantityPct: 5.0 } // Over $100: ±5%
];

/**
 * Category-specific adjustments (applied to base threshold)
 * Positive = looser threshold (more variance acceptable)
 * Negative = tighter threshold (less variance acceptable)
 */
const CATEGORY_ADJUSTMENTS = {
    'produce': 5.0,              // +5% (produce spoils, more waste expected)
    'proteins': -5.0,            // -5% (expensive, tighter control)
    'dairy': 3.0,                // +3% (moderate spoilage)
    'dry_goods': 0.0,            // No adjustment (stable)
    'beverages': 10.0,           // +10% (pour variance, spillage)
    'frozen': 0.0,               // No adjustment (stable)
    'paper_disposables': 15.0,   // +15% (high variability in usage)
    'cleaning_chemicals': 5.0    // +5% (moderate variability)
};

/**
 * Unit-specific adjustments (applied to base threshold)
 * "Each" items have higher variance (countable, portion inconsistency)
 * Bulk items have lower variance (more stable measurements)
 */
const UNIT_ADJUSTMENTS = {
    'ea': 30.0,      // +30% ("each" items highly variable)
    'case': -5.0,    // -5% (bulk, more stable)
    'box': -5.0,     // -5% (bulk, more stable)
    'bag': -5.0,     // -5% (bulk, more stable)
    'bulk': -5.0     // -5% (bulk, more stable)
};

/**
 * High-value item threshold (dollar amount)
 * Items with dollar variance > this amount are flagged as high-value
 */
const HIGH_VALUE_THRESHOLD = 50.0;

/**
 * VarianceCalculator class - Calculates pre-computed variance thresholds
 */
class VarianceCalculator {
    constructor() {
        this.costTiers = COST_TIERS;
        this.categoryAdjustments = CATEGORY_ADJUSTMENTS;
        this.unitAdjustments = UNIT_ADJUSTMENTS;
        this.highValueThreshold = HIGH_VALUE_THRESHOLD;
    }
    
    /**
     * Calculate variance thresholds for an inventory item
     * @param {Object} item - Inventory item data
     * @param {number} item.unitCost - Unit cost per measurement unit (e.g., $2.50/lb)
     * @param {string} item.unit - Measurement unit (e.g., "lb", "gal", "ea")
     * @param {string} item.category - Ingredient category (e.g., "produce", "proteins")
     * @param {number} item.parLevel - Expected inventory level (for quantity threshold calculation)
     * @returns {Object} Calculated thresholds
     * @returns {number} result.varianceThresholdQuantity - Quantity variance threshold (in units)
     * @returns {number} result.varianceThresholdDollar - Dollar variance threshold
     * @returns {boolean} result.highValueFlag - True if dollar threshold exceeds high-value threshold
     * @returns {Object} result.calculation - Calculation details for debugging
     */
    calculate(item) {
        const { unitCost, unit, category, parLevel } = item;
        
        // Validate inputs
        if (typeof unitCost !== 'number' || unitCost < 0) {
            logger.warn('VarianceCalculator: Invalid unitCost', { item });
            return this.getDefaultThresholds();
        }
        
        if (typeof parLevel !== 'number' || parLevel <= 0) {
            logger.warn('VarianceCalculator: Invalid parLevel', { item });
            return this.getDefaultThresholds();
        }
        
        // Step 1: Determine base threshold percentage from cost tier
        const basePct = this.getBasePctFromCostTier(unitCost);
        
        // Step 2: Apply category adjustment
        const categoryAdjustment = this.categoryAdjustments[category] || 0.0;
        
        // Step 3: Apply unit adjustment
        const unitAdjustment = this.unitAdjustments[unit] || 0.0;
        
        // Step 4: Calculate final threshold percentage
        const finalPct = Math.max(1.0, basePct + categoryAdjustment + unitAdjustment);
        
        // Step 5: Calculate quantity threshold (in units)
        const varianceThresholdQuantity = (parLevel * finalPct) / 100.0;
        
        // Step 6: Calculate dollar threshold
        const varianceThresholdDollar = varianceThresholdQuantity * unitCost;
        
        // Step 7: Determine high-value flag
        const highValueFlag = varianceThresholdDollar >= this.highValueThreshold;
        
        const calculation = {
            unitCost,
            unit,
            category,
            parLevel,
            basePct,
            categoryAdjustment,
            unitAdjustment,
            finalPct,
            varianceThresholdQuantity: Math.round(varianceThresholdQuantity * 100) / 100,
            varianceThresholdDollar: Math.round(varianceThresholdDollar * 100) / 100,
            highValueFlag
        };
        
        logger.debug('VarianceCalculator: Thresholds calculated', calculation);
        
        return {
            varianceThresholdQuantity: calculation.varianceThresholdQuantity,
            varianceThresholdDollar: calculation.varianceThresholdDollar,
            highValueFlag,
            calculation
        };
    }
    
    /**
     * Get base threshold percentage from cost tier
     * @param {number} unitCost - Unit cost
     * @returns {number} Base threshold percentage
     * @private
     */
    getBasePctFromCostTier(unitCost) {
        for (const tier of this.costTiers) {
            if (unitCost < tier.maxCost) {
                return tier.quantityPct;
            }
        }
        // Fallback (should never reach due to Infinity tier)
        return 5.0;
    }
    
    /**
     * Get default thresholds for invalid inputs
     * @returns {Object} Default thresholds
     * @private
     */
    getDefaultThresholds() {
        return {
            varianceThresholdQuantity: 0.0,
            varianceThresholdDollar: 0.0,
            highValueFlag: false,
            calculation: {
                error: 'Invalid inputs - using default thresholds'
            }
        };
    }
    
    /**
     * Update high-value threshold (for configuration changes)
     * @param {number} threshold - New high-value dollar threshold
     */
    setHighValueThreshold(threshold) {
        if (typeof threshold === 'number' && threshold > 0) {
            this.highValueThreshold = threshold;
            logger.info('VarianceCalculator: High-value threshold updated', { threshold });
        } else {
            logger.warn('VarianceCalculator: Invalid high-value threshold', { threshold });
        }
    }
    
    /**
     * Add custom category adjustment (for configuration changes)
     * @param {string} category - Category name
     * @param {number} adjustment - Adjustment percentage
     */
    setCategoryAdjustment(category, adjustment) {
        if (typeof adjustment === 'number') {
            this.categoryAdjustments[category] = adjustment;
            logger.info('VarianceCalculator: Category adjustment updated', { category, adjustment });
        } else {
            logger.warn('VarianceCalculator: Invalid category adjustment', { category, adjustment });
        }
    }
    
    /**
     * Add custom unit adjustment (for configuration changes)
     * @param {string} unit - Unit type
     * @param {number} adjustment - Adjustment percentage
     */
    setUnitAdjustment(unit, adjustment) {
        if (typeof adjustment === 'number') {
            this.unitAdjustments[unit] = adjustment;
            logger.info('VarianceCalculator: Unit adjustment updated', { unit, adjustment });
        } else {
            logger.warn('VarianceCalculator: Invalid unit adjustment', { unit, adjustment });
        }
    }
}

export default VarianceCalculator;
