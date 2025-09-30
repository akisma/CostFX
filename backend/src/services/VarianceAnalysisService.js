/**
 * VarianceAnalysisService - Dave's Core Variance Business Logic
 * 
 * Handles all variance calculation and analysis business logic that was previously
 * embedded in the TheoreticalUsageAnalysis model. This service maintains clean
 * separation between data persistence (models) and business logic (services).
 * 
 * Key Responsibilities:
 * - Calculate absolute variance values
 * - Determine variance impact and priority
 * - Analyze variance directions (overage/shortage)
 * - Compute efficiency ratios
 * - Format variance data for display
 * 
 * Author: Architecture Refactoring - Sept 2025
 */

class VarianceAnalysisService {
  
  /**
   * Calculate absolute variance values from analysis data
   * Dave cares about absolute impact regardless of direction
   * 
   * @param {Object} analysis - TheoreticalUsageAnalysis data object with varianceQuantity, varianceDollarValue, variancePercentage
   * @returns {Object} Absolute variance quantities, dollar values, and percentages
   */
  getAbsoluteVariance(analysis) {
    return {
      quantity: Math.abs(parseFloat(analysis.varianceQuantity) || 0),
      dollarValue: Math.abs(parseFloat(analysis.varianceDollarValue) || 0),
      percentage: Math.abs(analysis.variancePercentage || 0)
    };
  }

  /**
   * Determine if variance requires immediate attention
   * Dave's logic: high-impact variances need immediate attention
   * 
   * @param {Object} analysis - TheoreticalUsageAnalysis data object with varianceDollarValue, priority
   * @returns {boolean} True if variance is high impact
   */
  isHighImpactVariance(analysis) {
    const absVariance = Math.abs(parseFloat(analysis.varianceDollarValue) || 0);
    return absVariance >= 100 || 
           analysis.priority === 'critical' || 
           analysis.priority === 'high';
  }

  /**
   * Determine variance direction (overage, shortage, or none)
   * 
   * @param {Object} analysis - TheoreticalUsageAnalysis data object with varianceQuantity
   * @returns {string} 'overage', 'shortage', or 'none'
   */
  getVarianceDirection(analysis) {
    const variance = parseFloat(analysis.varianceQuantity) || 0;
    if (variance > 0) return 'overage';
    if (variance < 0) return 'shortage';
    return 'none';
  }

  /**
   * Calculate actual vs theoretical efficiency ratio
   * 
   * @param {Object} analysis - TheoreticalUsageAnalysis data object with theoreticalQuantity, actualQuantity
   * @returns {number|null} Efficiency ratio or null if theoretical is zero
   */
  getEfficiencyRatio(analysis) {
    const theoretical = parseFloat(analysis.theoreticalQuantity) || 0;
    const actual = parseFloat(analysis.actualQuantity) || 0;
    
    if (theoretical === 0) return null;
    return Number((actual / theoretical).toFixed(4));
  }

  /**
   * Format variance data for display in Dave's interface
   * 
   * @param {Object} analysis - TheoreticalUsageAnalysis data object with variance properties
   * @returns {Object} Formatted display strings with proper signs and formatting
   */
  getDisplayVariance(analysis) {
    const quantity = parseFloat(analysis.varianceQuantity);
    const percentage = parseFloat(analysis.variancePercentage);
    const dollarValue = parseFloat(analysis.varianceDollarValue);
    
    return {
      quantity: isNaN(quantity) ? '0' : `${quantity > 0 ? '+' : ''}${quantity}`,
      percentage: isNaN(percentage) ? 'N/A' : `${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%`,
      dollar: isNaN(dollarValue) ? '$0.00' : dollarValue === 0 ? '$0.00' : `${dollarValue > 0 ? '+' : '-'}$${Math.abs(dollarValue).toFixed(2)}`
    };
  }

  /**
   * Calculate variance priority using Dave's business rules
   * This method handles the core priority determination logic
   * 
   * @param {Object} item - Inventory item data
   * @param {number} absQuantityVariance - Absolute quantity variance
   * @param {number} absDollarVariance - Absolute dollar variance
   * @returns {string} Priority level: 'critical', 'high', 'medium', or 'low'
   */
  calculateVariancePriority(item, absQuantityVariance, absDollarVariance) {
    // Critical: Very high dollar impact regardless of item
    if (absDollarVariance >= 500) return 'critical';
    
    // High: Significant dollar impact or high-value items with any variance
    if (absDollarVariance >= 100) return 'high';
    if (item.unitCost >= 50 && absQuantityVariance > 0) return 'high';
    
    // Medium: Moderate impact
    if (absDollarVariance >= 25) return 'medium';
    if (absQuantityVariance >= (item.parLevel || 10) * 0.2) return 'medium';
    
    return 'low';
  }

  /**
   * Determine if variance is significant enough to warrant investigation
   * Dave's significance threshold logic
   * 
   * @param {Object} analysis - TheoreticalUsageAnalysis data object
   * @param {Object} item - Related inventory item data
   * @returns {boolean} True if variance is significant
   */
  isVarianceSignificant(analysis, item) {
    const absDollarVariance = Math.abs(parseFloat(analysis.varianceDollarValue) || 0);
    const absQuantityVariance = Math.abs(parseFloat(analysis.varianceQuantity) || 0);
    const absPercentageVariance = Math.abs(analysis.variancePercentage || 0);
    
    // Always significant if high dollar impact
    if (absDollarVariance >= 100) return true;
    
    // Significant if high percentage variance with meaningful dollar impact
    if (absPercentageVariance >= 25 && absDollarVariance >= 25) return true;
    
    // Significant for expensive items with any notable variance
    if (item.unitCost >= 50 && absQuantityVariance > 0) return true;
    
    return false;
  }

  /**
   * Enrich analysis data with calculated business logic values
   * This method adds all computed fields to the analysis object
   * 
   * @param {Object} analysis - TheoreticalUsageAnalysis data object
   * @param {Object} item - Related inventory item data (optional)
   * @returns {Object} Enriched analysis object with computed fields
   */
  enrichAnalysisData(analysis, item = null) {
    const enriched = { ...analysis };
    
    // Add calculated variance fields
    enriched.absoluteVariance = this.getAbsoluteVariance(analysis);
    enriched.isHighImpact = this.isHighImpactVariance(analysis);
    enriched.varianceDirection = this.getVarianceDirection(analysis);
    enriched.efficiencyRatio = this.getEfficiencyRatio(analysis);
    enriched.displayVariance = this.getDisplayVariance(analysis);
    
    // Add significance if item data is provided
    if (item) {
      enriched.isSignificantCalculated = this.isVarianceSignificant(analysis, item);
    }
    
    return enriched;
  }

  /**
   * Analyze variance trends across multiple periods
   * Dave's trend analysis for identifying patterns
   * 
   * @param {Array} analyses - Array of TheoreticalUsageAnalysis objects across periods
   * @returns {Object} Trend analysis results
   */
  analyzeVarianceTrends(analyses) {
    if (!analyses || analyses.length < 2) {
      return { 
        trend: 'insufficient_data', 
        message: 'Need at least 2 periods for trend analysis' 
      };
    }

    const sortedAnalyses = analyses.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const recentVariances = sortedAnalyses.map(a => parseFloat(a.varianceDollarValue) || 0);
    
    // Calculate trend direction
    const firstHalf = recentVariances.slice(0, Math.floor(recentVariances.length / 2));
    const secondHalf = recentVariances.slice(Math.floor(recentVariances.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + Math.abs(val), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + Math.abs(val), 0) / secondHalf.length;
    
    const trendDirection = secondAvg > firstAvg * 1.1 ? 'worsening' : 
                          secondAvg < firstAvg * 0.9 ? 'improving' : 'stable';
    
    return {
      trend: trendDirection,
      firstPeriodAverage: firstAvg,
      recentPeriodAverage: secondAvg,
      changePercentage: ((secondAvg - firstAvg) / firstAvg * 100).toFixed(2),
      periodsAnalyzed: analyses.length,
      recommendation: this._getTrendRecommendation(trendDirection, secondAvg)
    };
  }

  /**
   * Get Dave's recommendation based on trend analysis
   * @private
   */
  _getTrendRecommendation(trend, recentAverage) {
    if (trend === 'worsening' && recentAverage > 50) {
      return 'immediate_investigation_required';
    } else if (trend === 'worsening') {
      return 'monitor_closely';
    } else if (trend === 'improving') {
      return 'continue_current_practices';
    } else {
      return 'maintain_monitoring';
    }
  }
}

module.exports = VarianceAnalysisService;
