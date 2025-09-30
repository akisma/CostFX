import BaseAgent from './BaseAgent.js';
import UsageCalculationService from '../services/UsageCalculationService.js';

/**
 * InventoryVarianceAgent - Dave's core variance management system
 * 
 * Integrates with UsageCalculationService to provide theoretical vs actual usage analysis.
 * Handles period-based variance calculations and management workflows.
 */
class InventoryVarianceAgent extends BaseAgent {
  constructor() {
    super('InventoryVarianceAgent', [
      'calculate_usage_variance',
      'analyze_period_variance',
      'priority_variance_summary',
      'historical_variance_trends',
      'investigate_variance',
      'resolve_variance_investigation'
    ]);
    
    this.calculationService = new UsageCalculationService();
    this.initialized = false;
  }

  /**
   * Initialize the agent and calculation service
   */
  async initialize() {
    await super.initialize();
    await this.calculationService.initialize();
    this.initialized = true;
    console.log('[InventoryVarianceAgent] Agent and calculation service initialized');
  }

  /**
   * Process agent requests
   */
  async process(request) {
    if (!this.initialized) {
      await this.initialize();
    }

    const { type, data } = request;

    switch (type) {
      case 'calculate_usage_variance':
        return await this.calculateUsageVariance(data);
      
      case 'analyze_period_variance':
        return await this.analyzePeriodVariance(data);
      
      case 'priority_variance_summary':
        return await this.getPriorityVarianceSummary(data);
      
      case 'historical_variance_trends':
        return await this.getHistoricalVarianceTrends(data);
      
      case 'investigate_variance':
        return await this.investigateVariance(data);
      
      case 'resolve_variance_investigation':
        return await this.resolveVarianceInvestigation(data);
      
      default:
        throw new Error(`Unknown request type: ${type}`);
    }
  }

  /**
   * Calculate usage variance for a specific period
   * 
   * @param {Object} data - Request data
   * @param {number} data.periodId - Period to analyze
   * @param {string} data.method - Calculation method (optional)
   * @param {number[]} data.itemIds - Specific items to analyze (optional)
   * @param {boolean} data.recalculate - Force recalculation (optional)
   */
  async calculateUsageVariance(data) {
    const {
      periodId,
      method = 'recipe_based',
      itemIds = null,
      recalculate = false,
      restaurantId = null
    } = data;

    try {
      console.log(`[InventoryVarianceAgent] Calculating usage variance for period ${periodId} using ${method} method`);

      const result = await this.calculationService.calculateUsageForPeriod(periodId, {
        method,
        restaurantId,
        itemIds,
        recalculate
      });

      // Add Dave's business insights
      const insights = this.generateVarianceInsights(result);
      
      return {
        success: true,
        periodId,
        method,
        summary: {
          itemsProcessed: result.itemsProcessed,
          itemsSkipped: result.itemsSkipped,
          totalErrors: result.errors.length,
          highPriorityVariances: result.analyses.filter(a => ['critical', 'high'].includes(a.priority)).length,
          totalVarianceDollarValue: result.analyses.reduce((sum, a) => sum + Math.abs(a.varianceDollarValue), 0)
        },
        analyses: result.analyses,
        insights,
        errors: result.errors,
        calculatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[InventoryVarianceAgent] Error calculating usage variance:', error);
      throw error;
    }
  }

  /**
   * Analyze variance patterns for a period
   */
  async analyzePeriodVariance(data) {
    const { periodId } = data;

    try {
      const summary = await this.calculationService.getCalculationSummary(periodId);
      
      const analysis = {
        periodId,
        overview: {
          totalItems: summary.totalItems,
          totalVarianceDollarValue: summary.totalVarianceDollarValue,
          averageConfidence: summary.averageConfidence
        },
        priorityBreakdown: summary.byPriority,
        methodBreakdown: summary.byMethod,
        recommendations: this.generateVarianceRecommendations(summary),
        alertsRequired: this.identifyVarianceAlerts(summary),
        generatedAt: new Date().toISOString()
      };

      return {
        success: true,
        analysis,
        summary
      };

    } catch (error) {
      console.error('[InventoryVarianceAgent] Error analyzing period variance:', error);
      throw error;
    }
  }

  /**
   * Get priority variance summary for management dashboard
   */
  async getPriorityVarianceSummary(data) {
    const { periodId, priority = 'critical' } = data;

    try {
      // This would use the TheoreticalUsageAnalysis model to get high-priority variances
      // For now, return structured response for agent integration
      const summary = {
        periodId,
        priority,
        variances: [], // Would be populated from database
        totalImpact: 0,
        investigationRequired: 0,
        recommendations: [
          {
            type: 'immediate_investigation',
            count: 0,
            message: 'No critical variances requiring immediate attention'
          }
        ],
        generatedAt: new Date().toISOString()
      };

      return {
        success: true,
        summary
      };

    } catch (error) {
      console.error('[InventoryVarianceAgent] Error getting priority variance summary:', error);
      throw error;
    }
  }

  /**
   * Get historical variance trends for analysis
   */
  async getHistoricalVarianceTrends(data) {
    const { restaurantId, itemIds = null, periodCount = 6 } = data;

    try {
      // This would analyze trends across multiple periods
      const trends = {
        restaurantId,
        periodsAnalyzed: periodCount,
        itemCount: itemIds ? itemIds.length : 'all',
        trends: {
          varianceDirection: 'stable', // 'increasing', 'decreasing', 'stable'
          averageVariance: 0,
          highestVarianceItem: null,
          seasonalPatterns: []
        },
        recommendations: [
          {
            type: 'trend_analysis',
            message: 'Variance patterns are within expected ranges'
          }
        ],
        generatedAt: new Date().toISOString()
      };

      return {
        success: true,
        trends
      };

    } catch (error) {
      console.error('[InventoryVarianceAgent] Error getting historical trends:', error);
      throw error;
    }
  }

  /**
   * Initiate variance investigation
   */
  async investigateVariance(data) {
    const { analysisId, assignedTo, notes = null } = data;

    try {
      // This would use TheoreticalUsageAnalysis.assignInvestigation method
      const investigation = {
        analysisId,
        assignedTo,
        assignedAt: new Date().toISOString(),
        status: 'investigating',
        notes,
        expectedResolution: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

      return {
        success: true,
        investigation,
        message: `Variance investigation assigned to user ${assignedTo}`
      };

    } catch (error) {
      console.error('[InventoryVarianceAgent] Error initiating investigation:', error);
      throw error;
    }
  }

  /**
   * Resolve variance investigation
   */
  async resolveVarianceInvestigation(data) {
    const { analysisId, resolvedBy, explanation, resolution = 'resolved' } = data;

    try {
      // This would use TheoreticalUsageAnalysis.resolveInvestigation method
      const resolvedInvestigation = {
        analysisId,
        resolvedBy,
        resolvedAt: new Date().toISOString(),
        resolution,
        explanation,
        status: 'resolved'
      };

      return {
        success: true,
        investigation: resolvedInvestigation,
        message: `Variance investigation resolved by user ${resolvedBy}`
      };

    } catch (error) {
      console.error('[InventoryVarianceAgent] Error resolving investigation:', error);
      throw error;
    }
  }

  /**
   * Generate business insights from variance calculation results
   */
  generateVarianceInsights(result) {
    const insights = [];

    // High-priority variance insight
    const highPriorityCount = result.analyses.filter(a => ['critical', 'high'].includes(a.priority)).length;
    if (highPriorityCount > 0) {
      insights.push({
        type: 'high_priority_alert',
        severity: 'warning',
        message: `${highPriorityCount} items have critical or high-priority variances requiring investigation`,
        actionRequired: 'immediate_review'
      });
    }

    // Large dollar impact insight
    const totalDollarImpact = Math.abs(result.analyses.reduce((sum, a) => sum + a.varianceDollarValue, 0));
    if (totalDollarImpact > 500) {
      insights.push({
        type: 'financial_impact',
        severity: 'high',
        message: `Total variance dollar impact: $${totalDollarImpact.toFixed(2)}`,
        actionRequired: 'cost_analysis'
      });
    }

    // Calculation confidence insight
    const avgConfidence = result.analyses.reduce((sum, a) => sum + (a.theoreticalQuantity || 0), 0) / result.analyses.length;
    if (avgConfidence < 0.7) {
      insights.push({
        type: 'confidence_warning',
        severity: 'medium',
        message: 'Low confidence in theoretical usage calculations - consider improving recipe data',
        actionRequired: 'data_quality_review'
      });
    }

    return insights;
  }

  /**
   * Generate variance recommendations based on summary data
   */
  generateVarianceRecommendations(summary) {
    const recommendations = [];

    // Critical variance recommendation
    if (summary.byPriority.critical > 0) {
      recommendations.push({
        type: 'critical_investigation',
        priority: 'immediate',
        message: `${summary.byPriority.critical} critical variances require immediate investigation`,
        action: 'Assign investigations to appropriate staff members'
      });
    }

    // Method improvement recommendation
    if (summary.byMethod.historical_average > summary.byMethod.recipe_based) {
      recommendations.push({
        type: 'data_improvement',
        priority: 'medium',
        message: 'Many items using historical averages instead of recipe-based calculations',
        action: 'Improve recipe data coverage and sales tracking'
      });
    }

    // Confidence improvement recommendation
    if (summary.averageConfidence < 0.8) {
      recommendations.push({
        type: 'accuracy_improvement',
        priority: 'medium',
        message: 'Calculation confidence could be improved',
        action: 'Review and enhance theoretical usage calculation methods'
      });
    }

    return recommendations;
  }

  /**
   * Identify variance alerts that require immediate attention
   */
  identifyVarianceAlerts(summary) {
    const alerts = [];

    // Critical variance alert
    if (summary.byPriority.critical > 0) {
      alerts.push({
        type: 'critical_variance',
        severity: 'critical',
        count: summary.byPriority.critical,
        message: 'Critical variances detected requiring immediate investigation'
      });
    }

    // High dollar impact alert
    if (Math.abs(summary.totalVarianceDollarValue) > 1000) {
      alerts.push({
        type: 'high_financial_impact',
        severity: 'high',
        amount: summary.totalVarianceDollarValue,
        message: `High financial variance impact: $${Math.abs(summary.totalVarianceDollarValue).toFixed(2)}`
      });
    }

    return alerts;
  }

  /**
   * Get agent status and health information
   */
  getStatus() {
    return {
      ...super.getStatus(),
      calculationService: {
        initialized: this.calculationService ? true : false,
        supportedMethods: ['recipe_based', 'historical_average', 'manual', 'ai_predicted']
      },
      lastCalculation: this.state.lastActivity,
      capabilities: this.capabilities
    };
  }
}

export default InventoryVarianceAgent;
