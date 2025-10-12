/**
 * CategoryMapper - Fuzzy String Matching for POS Category to Ingredient Category Mapping
 * 
 * Maps POS system category names (e.g., "Fresh Produce", "Meats & Seafood") to standardized
 * ingredient categories (e.g., "produce", "proteins"). Uses fuzzy string matching with
 * Levenshtein distance to handle variations in naming conventions across different POS systems.
 * 
 * Features:
 * - 100+ predefined category mappings with fuzzy matching
 * - Confidence scoring (0-1) based on string similarity
 * - Case-insensitive matching with normalized whitespace
 * - Handles plural/singular variations (e.g., "vegetable" vs "vegetables")
 * - Returns null for unmapped categories (queued for user confirmation)
 * 
 * @module services/helpers/CategoryMapper
 */

import logger from '../../utils/logger.js';

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

/**
 * Normalize string for comparison (lowercase, trim, collapse whitespace)
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
function normalizeString(str) {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Calculate confidence score based on Levenshtein distance
 * @param {number} distance - Levenshtein distance
 * @param {number} maxLength - Length of longer string
 * @returns {number} Confidence score (0-1)
 */
function calculateConfidence(distance, maxLength) {
    if (maxLength === 0) return 1.0;
    return Math.max(0, 1 - (distance / maxLength));
}

/**
 * Predefined category mappings (100+ variations)
 * Structure: { posPattern: 'ingredientCategory' }
 */
const CATEGORY_MAPPINGS = {
    // Produce variations
    'produce': 'produce',
    'fresh produce': 'produce',
    'fruits': 'produce',
    'fruit': 'produce',
    'vegetables': 'produce',
    'vegetable': 'produce',
    'veggies': 'produce',
    'veggie': 'produce',
    'fresh fruit': 'produce',
    'fresh vegetables': 'produce',
    'fresh veggies': 'produce',
    'greens': 'produce',
    'leafy greens': 'produce',
    'salad greens': 'produce',
    'herbs': 'produce',
    'fresh herbs': 'produce',
    
    // Protein variations
    'proteins': 'proteins',
    'protein': 'proteins',
    'meat': 'proteins',
    'meats': 'proteins',
    'poultry': 'proteins',
    'chicken': 'proteins',
    'beef': 'proteins',
    'pork': 'proteins',
    'seafood': 'proteins',
    'fish': 'proteins',
    'shellfish': 'proteins',
    'meats & seafood': 'proteins',
    'meat & seafood': 'proteins',
    'meats and seafood': 'proteins',
    'butcher': 'proteins',
    'fresh meat': 'proteins',
    'fresh seafood': 'proteins',
    
    // Dairy variations
    'dairy': 'dairy',
    'dairy products': 'dairy',
    'milk': 'dairy',
    'cheese': 'dairy',
    'cheeses': 'dairy',
    'cream': 'dairy',
    'butter': 'dairy',
    'yogurt': 'dairy',
    'eggs': 'dairy',
    'egg': 'dairy',
    'dairy & eggs': 'dairy',
    'dairy and eggs': 'dairy',
    'refrigerated dairy': 'dairy',
    
    // Dry goods variations
    'dry goods': 'dry_goods',
    'dry': 'dry_goods',
    'pantry': 'dry_goods',
    'pantry staples': 'dry_goods',
    'canned goods': 'dry_goods',
    'canned': 'dry_goods',
    'baking': 'dry_goods',
    'baking supplies': 'dry_goods',
    'flour': 'dry_goods',
    'sugar': 'dry_goods',
    'rice': 'dry_goods',
    'pasta': 'dry_goods',
    'grains': 'dry_goods',
    'cereals': 'dry_goods',
    'spices': 'dry_goods',
    'seasonings': 'dry_goods',
    'condiments': 'dry_goods',
    'sauces': 'dry_goods',
    'oils': 'dry_goods',
    'vinegars': 'dry_goods',
    
    // Beverage variations
    'beverages': 'beverages',
    'beverage': 'beverages',
    'drinks': 'beverages',
    'drink': 'beverages',
    'soda': 'beverages',
    'soft drinks': 'beverages',
    'juice': 'beverages',
    'juices': 'beverages',
    'coffee': 'beverages',
    'tea': 'beverages',
    'water': 'beverages',
    'bottled water': 'beverages',
    'sparkling water': 'beverages',
    'wine': 'beverages',
    'beer': 'beverages',
    'alcohol': 'beverages',
    'spirits': 'beverages',
    'liquor': 'beverages',
    
    // Frozen variations
    'frozen': 'frozen',
    'frozen foods': 'frozen',
    'frozen goods': 'frozen',
    'freezer': 'frozen',
    'ice cream': 'frozen',
    'frozen vegetables': 'frozen',
    'frozen fruit': 'frozen',
    'frozen meat': 'frozen',
    'frozen seafood': 'frozen',
    
    // Paper/disposables variations
    'paper': 'paper_disposables',
    'paper goods': 'paper_disposables',
    'paper products': 'paper_disposables',
    'disposables': 'paper_disposables',
    'disposable': 'paper_disposables',
    'to-go': 'paper_disposables',
    'takeout': 'paper_disposables',
    'packaging': 'paper_disposables',
    'containers': 'paper_disposables',
    'napkins': 'paper_disposables',
    'cups': 'paper_disposables',
    'plates': 'paper_disposables',
    'utensils': 'paper_disposables',
    
    // Cleaning/chemicals variations
    'cleaning': 'cleaning_chemicals',
    'cleaning supplies': 'cleaning_chemicals',
    'chemicals': 'cleaning_chemicals',
    'janitorial': 'cleaning_chemicals',
    'sanitation': 'cleaning_chemicals',
    'sanitizer': 'cleaning_chemicals',
    'disinfectant': 'cleaning_chemicals',
    'detergent': 'cleaning_chemicals',
    'soap': 'cleaning_chemicals',
};

/**
 * CategoryMapper class - Maps POS categories to ingredient categories
 */
class CategoryMapper {
    constructor() {
        this.mappings = CATEGORY_MAPPINGS;
        this.maxDistance = 3; // Max Levenshtein distance for fuzzy match
        this.minConfidence = 0.7; // Min confidence score (0-1)
    }
    
    /**
     * Map a POS category name to an ingredient category
     * @param {string} posCategory - POS category name (e.g., "Fresh Produce")
     * @returns {Object|null} Mapping result or null if no match
     * @returns {string} result.category - Mapped ingredient category
     * @returns {number} result.confidence - Confidence score (0-1)
     * @returns {string} result.matchType - 'exact' or 'fuzzy'
     */
    mapSquareCategory(posCategory) {
        if (!posCategory || typeof posCategory !== 'string') {
            logger.warn('CategoryMapper: Invalid posCategory input', { posCategory });
            return null;
        }
        
        const normalized = normalizeString(posCategory);
        
        // 1. Try exact match first
        if (this.mappings[normalized]) {
            logger.debug('CategoryMapper: Exact match found', {
                posCategory,
                mapped: this.mappings[normalized],
                confidence: 1.0
            });
            
            return {
                category: this.mappings[normalized],
                confidence: 1.0,
                matchType: 'exact'
            };
        }
        
        // 2. Try fuzzy matching
        let bestMatch = null;
        let bestDistance = Infinity;
        let bestPattern = null;
        
        for (const [pattern, category] of Object.entries(this.mappings)) {
            const distance = levenshteinDistance(normalized, pattern);
            
            if (distance < bestDistance && distance <= this.maxDistance) {
                bestDistance = distance;
                bestMatch = category;
                bestPattern = pattern;
            }
        }
        
        if (bestMatch) {
            const maxLength = Math.max(normalized.length, bestPattern.length);
            const confidence = calculateConfidence(bestDistance, maxLength);
            
            if (confidence >= this.minConfidence) {
                logger.debug('CategoryMapper: Fuzzy match found', {
                    posCategory,
                    pattern: bestPattern,
                    mapped: bestMatch,
                    distance: bestDistance,
                    confidence
                });
                
                return {
                    category: bestMatch,
                    confidence,
                    matchType: 'fuzzy'
                };
            }
        }
        
        // 3. No match found
        logger.info('CategoryMapper: No match found - queuing for user confirmation', {
            posCategory,
            normalized,
            bestDistance,
            bestPattern
        });
        
        return null;
    }
    
    /**
     * Get all supported ingredient categories
     * @returns {string[]} Array of unique ingredient categories
     */
    getSupportedCategories() {
        return [...new Set(Object.values(this.mappings))];
    }
    
    /**
     * Add custom mapping (for testing or runtime extension)
     * @param {string} posPattern - POS category pattern
     * @param {string} ingredientCategory - Target ingredient category
     */
    addMapping(posPattern, ingredientCategory) {
        const normalized = normalizeString(posPattern);
        this.mappings[normalized] = ingredientCategory;
        logger.debug('CategoryMapper: Custom mapping added', {
            posPattern,
            normalized,
            ingredientCategory
        });
    }
}

export default CategoryMapper;
