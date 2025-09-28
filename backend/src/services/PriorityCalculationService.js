/**
 * PriorityCalculationService - Dave's Priority Calculation Business Logic
 * 
 * Handles all priority calculation business logic that was previously
 * embedded in the UsageCalculationService. This service maintains clean
 * separation between usage calculations and priority determination logic.
 * 
 * Key Responsibilities:
 * - Calculate variance priority based on Dave's business rules
 * - Apply threshold-based priority determination
 * - Handle high-value item priority escalation
 * - Provide consistent priority calculation across the system
 * 
 * Author: Architecture Refactoring - Sept 2025
 */

class PriorityCalculationService {

  /**
   * Calculate variance priority using Dave's comprehensive business rules
   * 
   * @param {Object} item - Inventory item data with thresholds and flags
   * @param {number} absQuantityVariance - Absolute quantity variance value
   * @param {number} absDollarVariance - Absolute dollar variance value
   * @returns {string} Priority level: 'critical', 'high', 'medium', or 'low'
   */
  calculateVariancePriority(item, absQuantityVariance, absDollarVariance) {
    // Input validation
    if (!item || typeof absQuantityVariance !== 'number' || typeof absDollarVariance !== 'number') {
      throw new Error('Invalid parameters for priority calculation');
    }

    // Get thresholds with defaults
    const quantityThreshold = item.varianceThresholdQuantity || 5.0;
    const dollarThreshold = item.varianceThresholdDollar || 25.0;
    
    // Critical: High-value items or large dollar impact
    if (item.highValueFlag || absDollarVariance >= dollarThreshold * 2) {
      return 'critical';
    }
    
    // High: Exceeds both quantity and dollar thresholds
    if (absQuantityVariance >= quantityThreshold && absDollarVariance >= dollarThreshold) {
      return 'high';
    }
    
    // Medium: Exceeds one threshold significantly
    if (absQuantityVariance >= quantityThreshold * 1.5 || absDollarVariance >= dollarThreshold * 1.5) {
      return 'medium';
    }
    
    // Low: Below thresholds
    return 'low';
  }

  /**
   * Calculate priority based on variance analysis data
   * This method works with analysis objects that contain variance information
   * 
   * @param {Object} analysis - Analysis data with variance quantities and dollar values
   * @param {Object} item - Inventory item data with thresholds and flags
   * @returns {string} Priority level: 'critical', 'high', 'medium', or 'low'
   */
  calculatePriorityFromAnalysis(analysis, item) {
    const absQuantityVariance = Math.abs(parseFloat(analysis.varianceQuantity) || 0);
    const absDollarVariance = Math.abs(parseFloat(analysis.varianceDollarValue) || 0);
    
    return this.calculateVariancePriority(item, absQuantityVariance, absDollarVariance);
  }

  /**
   * Get priority score for sorting/ranking
   * Higher scores indicate higher priority
   * 
   * @param {string} priority - Priority level string
   * @returns {number} Numeric priority score
   */
  getPriorityScore(priority) {
    const scores = {
      'critical': 4,
      'high': 3,
      'medium': 2,
      'low': 1
    };

    return scores[priority] || 0;
  }

  /**
   * Determine if a priority level requires immediate attention
   * Dave's rules for what constitutes urgent action
   * 
   * @param {string} priority - Priority level string
   * @returns {boolean} True if priority requires immediate attention
   */
  requiresImmediateAttention(priority) {
    return ['critical', 'high'].includes(priority);
  }

  /**
   * Calculate priority thresholds for an item
   * Provides the actual threshold values used in calculations
   * 
   * @param {Object} item - Inventory item data
   * @returns {Object} Threshold values and multipliers
   */
  calculateThresholds(item) {
    const quantityThreshold = item.varianceThresholdQuantity || 5.0;
    const dollarThreshold = item.varianceThresholdDollar || 25.0;

    return {
      quantity: {
        base: quantityThreshold,
        medium: quantityThreshold * 1.5,
        high: quantityThreshold
      },
      dollar: {
        base: dollarThreshold,
        medium: dollarThreshold * 1.5,
        high: dollarThreshold,
        critical: dollarThreshold * 2
      },
      highValueFlag: item.highValueFlag || false
    };
  }

  /**
   * Explain why a specific priority was assigned
   * Dave's debugging and audit trail needs
   * 
   * @param {Object} item - Inventory item data
   * @param {number} absQuantityVariance - Absolute quantity variance
   * @param {number} absDollarVariance - Absolute dollar variance
   * @returns {Object} Priority explanation with reasoning
   */
  explainPriority(item, absQuantityVariance, absDollarVariance) {
    const priority = this.calculateVariancePriority(item, absQuantityVariance, absDollarVariance);
    const thresholds = this.calculateThresholds(item);
    
    const explanation = {
      priority,
      reason: '',
      factors: [],
      thresholds
    };

    // Build explanation based on priority logic
    if (priority === 'critical') {
      if (item.highValueFlag) {
        explanation.reason = 'High-value item flagged for critical priority';
        explanation.factors.push('High-value item flag set');
      } else {
        explanation.reason = 'Dollar variance exceeds critical threshold';
        explanation.factors.push(`Dollar variance (${absDollarVariance}) >= critical threshold (${thresholds.dollar.critical})`);
      }
    } else if (priority === 'high') {
      explanation.reason = 'Exceeds both quantity and dollar thresholds';
      explanation.factors.push(`Quantity variance (${absQuantityVariance}) >= threshold (${thresholds.quantity.high})`);
      explanation.factors.push(`Dollar variance (${absDollarVariance}) >= threshold (${thresholds.dollar.high})`);
    } else if (priority === 'medium') {
      if (absQuantityVariance >= thresholds.quantity.medium) {
        explanation.factors.push(`Quantity variance (${absQuantityVariance}) >= medium threshold (${thresholds.quantity.medium})`);
      }
      if (absDollarVariance >= thresholds.dollar.medium) {
        explanation.factors.push(`Dollar variance (${absDollarVariance}) >= medium threshold (${thresholds.dollar.medium})`);
      }
      explanation.reason = 'Exceeds one threshold significantly';
    } else {
      explanation.reason = 'Below all significant thresholds';
      explanation.factors.push('Both quantity and dollar variances below thresholds');
    }

    return explanation;
  }

  /**
   * Batch calculate priorities for multiple variance analyses
   * Efficient processing for Dave's reporting needs
   * 
   * @param {Array} analyses - Array of variance analysis objects
   * @param {Object} itemsMap - Map of item IDs to item data
   * @returns {Array} Analyses enriched with priority information
   */
  batchCalculatePriorities(analyses, itemsMap) {
    if (!Array.isArray(analyses)) {
      throw new Error('Analyses must be an array');
    }

    return analyses.map(analysis => {
      const item = itemsMap[analysis.inventoryItemId];
      if (!item) {
        return {
          ...analysis,
          priority: 'low',
          priorityScore: 1,
          priorityExplanation: 'Item not found - defaulted to low priority'
        };
      }

      const absQuantityVariance = Math.abs(parseFloat(analysis.varianceQuantity) || 0);
      const absDollarVariance = Math.abs(parseFloat(analysis.varianceDollarValue) || 0);
      
      const priority = this.calculateVariancePriority(item, absQuantityVariance, absDollarVariance);
      const priorityScore = this.getPriorityScore(priority);
      const priorityExplanation = this.explainPriority(item, absQuantityVariance, absDollarVariance);

      return {
        ...analysis,
        priority,
        priorityScore,
        requiresImmediateAttention: this.requiresImmediateAttention(priority),
        priorityExplanation
      };
    });
  }

  /**
   * Get priority distribution statistics
   * Dave's management dashboard needs
   * 
   * @param {Array} priorities - Array of priority strings
   * @returns {Object} Priority distribution statistics
   */
  getPriorityDistribution(priorities) {
    const distribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: 0
    };

    if (!Array.isArray(priorities)) {
      return distribution;
    }

    priorities.forEach(priority => {
      if (distribution.hasOwnProperty(priority)) {
        distribution[priority]++;
      }
      distribution.total++;
    });

    // Calculate percentages
    if (distribution.total > 0) {
      distribution.percentages = {
        critical: Math.round((distribution.critical / distribution.total) * 100),
        high: Math.round((distribution.high / distribution.total) * 100),
        medium: Math.round((distribution.medium / distribution.total) * 100),
        low: Math.round((distribution.low / distribution.total) * 100)
      };
    }

    return distribution;
  }

  /**
   * Validate item thresholds for priority calculation
   * Ensure thresholds are reasonable for Dave's business
   * 
   * @param {Object} item - Inventory item with threshold values
   * @returns {Object} Validation results with warnings/errors
   */
  validateItemThresholds(item) {
    const validation = {
      isValid: true,
      warnings: [],
      errors: []
    };

    if (!item) {
      validation.isValid = false;
      validation.errors.push('Item is required');
      return validation;
    }

    // Check quantity threshold
    const quantityThreshold = item.varianceThresholdQuantity;
    if (quantityThreshold !== undefined && quantityThreshold <= 0) {
      validation.warnings.push('Quantity threshold should be positive');
    }

    // Check dollar threshold
    const dollarThreshold = item.varianceThresholdDollar;
    if (dollarThreshold !== undefined && dollarThreshold <= 0) {
      validation.warnings.push('Dollar threshold should be positive');
    }

    // Check for extremely high thresholds that might never trigger
    if (quantityThreshold > 1000) {
      validation.warnings.push('Quantity threshold seems very high - may never trigger priorities');
    }

    if (dollarThreshold > 1000) {
      validation.warnings.push('Dollar threshold seems very high - may never trigger priorities');
    }

    // Check high-value flag consistency
    if (item.highValueFlag && (!item.unitCost || item.unitCost < 10)) {
      validation.warnings.push('High-value flag set but unit cost is low');
    }

    return validation;
  }
}

export default PriorityCalculationService;
