/**
 * UnitInferrer - Pattern Matching for Measurement Unit Inference
 * 
 * Infers measurement units from item names and variations using regex pattern matching.
 * Handles common restaurant inventory units across different formats and naming conventions.
 * 
 * Supported Units:
 * - Weight: oz, lb, kg, g
 * - Volume: gal, qt, pt, fl oz, L, mL, cup
 * - Count: ea, each, count, pc, piece
 * - Container: case, box, bag, can, jar, bottle
 * - Bulk: bulk
 * 
 * Features:
 * - Pattern matching with 15+ unit type patterns
 * - Confidence scoring based on match context
 * - Handles abbreviations and variations (e.g., "oz", "ounce", "ounces")
 * - Case-insensitive matching
 * - Defaults to 'lb' for unmapped items (most common restaurant unit)
 * 
 * @module services/helpers/UnitInferrer
 */

import logger from '../../utils/logger.js';

/**
 * Unit patterns with regex and confidence scoring
 * Higher confidence = more specific/explicit unit indicators
 */
const UNIT_PATTERNS = [
    // Weight units (high confidence)
    { pattern: /(\d+\s*)(oz|ounce|ounces)(\b|$)/i, unit: 'oz', confidence: 0.95 },
    { pattern: /(\d+\s*)(lb|lbs|pound|pounds)(\b|$)/i, unit: 'lb', confidence: 0.95 },
    { pattern: /(\d+\s*)(kg|kilogram|kilograms)(\b|$)/i, unit: 'kg', confidence: 0.95 },
    { pattern: /(\d+\s*)(g|gram|grams)(\b|$)/i, unit: 'g', confidence: 0.9 },
    
    // Volume units (high confidence)
    { pattern: /(\d+\s*)(gal|gallon|gallons)(\b|$)/i, unit: 'gal', confidence: 0.95 },
    { pattern: /(\d+\s*)(qt|quart|quarts)(\b|$)/i, unit: 'qt', confidence: 0.95 },
    { pattern: /(\d+\s*)(pt|pint|pints)(\b|$)/i, unit: 'pt', confidence: 0.95 },
    { pattern: /(\d+\s*)(fl\s*oz|fluid\s*ounce|fluid\s*ounces)(\b|$)/i, unit: 'fl oz', confidence: 0.95 },
    { pattern: /(\d+\s*)(L|liter|liters|litre|litres)(\b|$)/i, unit: 'L', confidence: 0.95 },
    { pattern: /(\d+\s*)(mL|ml|milliliter|milliliters)(\b|$)/i, unit: 'mL', confidence: 0.95 },
    { pattern: /(\d+\s*)(cup|cups)(\b|$)/i, unit: 'cup', confidence: 0.9 },
    
    // Count units (medium confidence)
    { pattern: /(\d+\s*)(ea|each)(\b|$)/i, unit: 'ea', confidence: 0.9 },
    { pattern: /(\d+\s*)(pc|pcs|piece|pieces)(\b|$)/i, unit: 'ea', confidence: 0.85 },
    { pattern: /(\d+\s*)(count)(\b|$)/i, unit: 'ea', confidence: 0.85 },
    { pattern: /\b(whole|individual)\b/i, unit: 'ea', confidence: 0.7 },
    
    // Container units (medium confidence)
    { pattern: /(\d+\s*)(case|cases)(\b|$)/i, unit: 'case', confidence: 0.9 },
    { pattern: /(\d+\s*)(box|boxes)(\b|$)/i, unit: 'box', confidence: 0.85 },
    { pattern: /(\d+\s*)(bag|bags)(\b|$)/i, unit: 'bag', confidence: 0.85 },
    { pattern: /(\d+\s*)(can|cans)(\b|$)/i, unit: 'can', confidence: 0.85 },
    { pattern: /(\d+\s*)(jar|jars)(\b|$)/i, unit: 'jar', confidence: 0.85 },
    { pattern: /(\d+\s*)(bottle|bottles)(\b|$)/i, unit: 'bottle', confidence: 0.85 },
    { pattern: /(\d+\s*)(container|containers)(\b|$)/i, unit: 'container', confidence: 0.8 },
    
    // Bulk indicator (lower confidence)
    { pattern: /\b(bulk|wholesale)\b/i, unit: 'bulk', confidence: 0.7 },
];

/**
 * Default units by category (fallback when no pattern matches)
 */
const CATEGORY_DEFAULTS = {
    'produce': 'lb',
    'proteins': 'lb',
    'dairy': 'gal',
    'dry_goods': 'lb',
    'beverages': 'gal',
    'frozen': 'lb',
    'paper_disposables': 'ea',
    'cleaning_chemicals': 'gal',
};

/**
 * UnitInferrer class - Infers measurement units from item names
 */
class UnitInferrer {
    constructor() {
        this.patterns = UNIT_PATTERNS;
        this.categoryDefaults = CATEGORY_DEFAULTS;
        this.globalDefault = 'lb'; // Most common restaurant unit
    }
    
    /**
     * Infer measurement unit from item name and optional category
     * @param {string} itemName - Item name (e.g., "Tomatoes 5 lb", "Chicken Breast")
     * @param {Object} options - Optional configuration
     * @param {string} options.variationName - Variation name for additional context
     * @param {string} options.category - Ingredient category for fallback default
     * @returns {Object} Inference result
     * @returns {string} result.unit - Inferred unit (e.g., "lb", "gal", "ea")
     * @returns {number} result.confidence - Confidence score (0-1)
     * @returns {string} result.matchType - 'pattern', 'category_default', or 'global_default'
     * @returns {string|null} result.matchedPattern - Matched pattern string (if applicable)
     */
    inferUnit(itemName, options = {}) {
        if (!itemName || typeof itemName !== 'string') {
            logger.warn('UnitInferrer: Invalid itemName input', { itemName });
            return {
                unit: this.globalDefault,
                confidence: 0.5,
                matchType: 'global_default',
                matchedPattern: null
            };
        }
        
        const { variationName, category } = options;
        
        // Combine item name and variation name for pattern matching
        const searchText = [itemName, variationName]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        
        // Try pattern matching
        let bestMatch = null;
        let bestConfidence = 0;
        
        for (const { pattern, unit, confidence } of this.patterns) {
            if (pattern.test(searchText)) {
                if (confidence > bestConfidence) {
                    bestMatch = {
                        unit,
                        confidence,
                        matchType: 'pattern',
                        matchedPattern: pattern.source
                    };
                    bestConfidence = confidence;
                }
            }
        }
        
        if (bestMatch) {
            logger.debug('UnitInferrer: Pattern match found', {
                itemName,
                variationName,
                searchText,
                ...bestMatch
            });
            return bestMatch;
        }
        
        // Try category default
        if (category && this.categoryDefaults[category]) {
            logger.debug('UnitInferrer: Using category default', {
                itemName,
                category,
                unit: this.categoryDefaults[category]
            });
            return {
                unit: this.categoryDefaults[category],
                confidence: 0.6,
                matchType: 'category_default',
                matchedPattern: null
            };
        }
        
        // Fall back to global default
        logger.info('UnitInferrer: Using global default', {
            itemName,
            category,
            unit: this.globalDefault
        });
        return {
            unit: this.globalDefault,
            confidence: 0.5,
            matchType: 'global_default',
            matchedPattern: null
        };
    }
    
    /**
     * Get all supported units
     * @returns {string[]} Array of supported unit types
     */
    getSupportedUnits() {
        const patternUnits = [...new Set(this.patterns.map(p => p.unit))];
        const categoryUnits = [...new Set(Object.values(this.categoryDefaults))];
        return [...new Set([...patternUnits, ...categoryUnits, this.globalDefault])];
    }
    
    /**
     * Add custom pattern (for testing or runtime extension)
     * @param {RegExp} pattern - Regex pattern to match
     * @param {string} unit - Target unit
     * @param {number} confidence - Confidence score (0-1)
     */
    addPattern(pattern, unit, confidence = 0.8) {
        this.patterns.push({ pattern, unit, confidence });
        logger.debug('UnitInferrer: Custom pattern added', {
            pattern: pattern.source,
            unit,
            confidence
        });
    }
}

export default UnitInferrer;
