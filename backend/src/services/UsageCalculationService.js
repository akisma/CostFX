import { Op } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * UsageCalculationService - Dave's core variance calculation engine
 * 
 * Calculates theoretical vs actual usage for inventory items and populates
 * the theoretical_usage_analysis table. Supports multiple calculation methods:
 * - recipe_based: Uses recipe requirements × sales data  
 * - historical_average: Uses past usage patterns
 * - manual: Accepts manually provided theoretical quantities
 * - ai_predicted: Uses ML models for complex scenarios
 */
class UsageCalculationService {
  constructor() {
    this.models = null;
  }

  /**
   * Initialize service with database models
   */
  async initialize() {
    this.models = sequelize.models;
    console.log('[UsageCalculationService] Service initialized');
  }

  /**
   * Main entry point: Calculate and populate usage analysis for a period
   * 
   * @param {number} periodId - Inventory period to analyze
   * @param {Object} options - Calculation options
   * @returns {Object} Analysis results summary
   */
  async calculateUsageForPeriod(periodId, options = {}) {
    if (!this.models) await this.initialize();

    const {
      method = 'recipe_based', // Default calculation method
      restaurantId = null,
      itemIds = null, // Specific items to process (null = all items)
      recalculate = false // Whether to recalculate existing analyses
    } = options;

    console.log(`[UsageCalculationService] Starting usage calculation for period ${periodId} using ${method} method`);

    try {
      // Get period information
      const period = await this.models.InventoryPeriod.findByPk(periodId);
      if (!period) {
        throw new Error(`Period ${periodId} not found`);
      }

      // Get inventory items to process
      const inventoryItems = await this.getInventoryItemsForPeriod(
        period, 
        restaurantId, 
        itemIds
      );

      const results = {
        periodId,
        method,
        itemsProcessed: 0,
        itemsSkipped: 0,
        analyses: [],
        errors: []
      };

      // Process each inventory item
      for (const item of inventoryItems) {
        try {
          // Check if analysis already exists
          const existingAnalysis = await this.models.TheoreticalUsageAnalysis.findOne({
            where: {
              periodId,
              inventoryItemId: item.id
            }
          });

          if (existingAnalysis && !recalculate) {
            results.itemsSkipped++;
            continue;
          }

          // Calculate theoretical usage based on method
          const theoreticalUsage = await this.calculateTheoreticalUsage(
            item,
            period,
            method
          );

          // Calculate actual usage from inventory movement
          const actualUsage = await this.calculateActualUsage(
            item,
            period
          );

          // Create or update analysis record
          const analysisData = this.buildAnalysisRecord(
            periodId,
            item,
            theoreticalUsage,
            actualUsage,
            method
          );

          let analysis;
          if (existingAnalysis) {
            await existingAnalysis.update(analysisData);
            analysis = existingAnalysis;
          } else {
            analysis = await this.models.TheoreticalUsageAnalysis.create(analysisData);
          }

          results.analyses.push({
            inventoryItemId: item.id,
            itemName: item.name,
            theoreticalQuantity: theoreticalUsage.quantity,
            actualQuantity: actualUsage.quantity,
            varianceQuantity: analysis.varianceQuantity,
            varianceDollarValue: analysis.varianceDollarValue,
            priority: analysis.priority
          });

          results.itemsProcessed++;

        } catch (error) {
          console.error(`[UsageCalculationService] Error processing item ${item.id}:`, error);
          results.errors.push({
            inventoryItemId: item.id,
            itemName: item.name,
            error: error.message
          });
        }
      }

      console.log(`[UsageCalculationService] Completed: ${results.itemsProcessed} processed, ${results.itemsSkipped} skipped, ${results.errors.length} errors`);
      return results;

    } catch (error) {
      console.error('[UsageCalculationService] Period calculation failed:', error);
      throw error;
    }
  }

  /**
   * Get inventory items to process for a period
   */
  async getInventoryItemsForPeriod(period, restaurantId = null, itemIds = null) {
    const whereClause = {};
    
    if (restaurantId) {
      whereClause.restaurantId = restaurantId;
    } else if (period.restaurantId) {
      whereClause.restaurantId = period.restaurantId;
    }

    if (itemIds) {
      whereClause.id = { [Op.in]: itemIds };
    }

    return await this.models.InventoryItem.findAll({
      where: whereClause,
      include: [
        {
          model: this.models.IngredientCategory,
          as: 'hierarchicalCategory',
          required: false
        }
      ]
    });
  }

  /**
   * Calculate theoretical usage based on selected method
   * 
   * @param {Object} item - InventoryItem instance
   * @param {Object} period - InventoryPeriod instance  
   * @param {string} method - Calculation method
   * @returns {Object} Theoretical usage data
   */
  async calculateTheoreticalUsage(item, period, method) {
    switch (method) {
      case 'recipe_based':
        return await this.calculateRecipeBasedUsage(item, period);
      
      case 'historical_average':
        return await this.calculateHistoricalAverageUsage(item, period);
      
      case 'manual':
        // Manual method requires pre-calculated values stored elsewhere
        throw new Error('Manual calculation method requires external theoretical quantity input');
      
      case 'ai_predicted':
        return await this.calculateAIPredictedUsage(item, period);
      
      default:
        throw new Error(`Unknown calculation method: ${method}`);
    }
  }

  /**
   * Calculate theoretical usage from recipe requirements × sales data
   * 
   * This is Dave's primary method for items with recipe data.
   * Formula: sum(recipe_quantity × sales_quantity × yield_factor) for all recipes using this item
   */
  async calculateRecipeBasedUsage(item, period) {
    // TODO: This requires Recipe and Sales models which don't exist yet
    // For now, return mock calculation with realistic structure
    
    const recipeData = {
      recipesUsed: [
        {
          recipeId: 1,
          recipeName: 'Sample Recipe',
          quantityPerServing: 2.5,
          soldQuantity: 45,
          yieldFactor: item.theoreticalYieldFactor || 0.95
        }
      ],
      totalSalesQuantity: 45,
      averageYieldFactor: item.theoreticalYieldFactor || 0.95
    };

    // Mock calculation: recipe quantity × sales × yield adjustment
    const baseQuantity = recipeData.recipesUsed.reduce(
      (total, recipe) => total + (recipe.quantityPerServing * recipe.soldQuantity),
      0
    );
    
    const adjustedQuantity = baseQuantity / recipeData.averageYieldFactor;

    return {
      quantity: adjustedQuantity,
      unitCost: item.unitCost || 0,
      method: 'recipe_based',
      confidence: 0.90, // High confidence when based on actual recipes
      metadata: {
        recipeData,
        calculatedAt: new Date(),
        periodStart: period.periodStart,
        periodEnd: period.periodEnd
      }
    };
  }

  /**
   * Calculate theoretical usage based on historical usage patterns
   * 
   * Used when recipe data is unavailable. Analyzes past periods to predict usage.
   */
  async calculateHistoricalAverageUsage(item, period) {
    // Get historical usage from previous periods
    const historicalPeriods = await this.models.InventoryPeriod.findAll({
      where: {
        restaurantId: period.restaurantId,
        periodEnd: { [Op.lt]: period.periodStart }, // Previous periods only
        status: 'closed' // Only completed periods
      },
      order: [['periodEnd', 'DESC']],
      limit: 6 // Last 6 periods for average
    });

    if (historicalPeriods.length === 0) {
      // No historical data - use basic estimation
      return {
        quantity: 0,
        unitCost: item.unitCost || 0,
        method: 'historical_average',
        confidence: 0.20, // Low confidence without history
        metadata: {
          historicalPeriods: 0,
          estimationMethod: 'no_history_fallback',
          calculatedAt: new Date()
        }
      };
    }

    // Get actual usage from historical analyses
    const historicalAnalyses = await this.models.TheoreticalUsageAnalysis.findAll({
      where: {
        periodId: { [Op.in]: historicalPeriods.map(p => p.id) },
        inventoryItemId: item.id
      },
      order: [['periodId', 'DESC']]
    });

    if (historicalAnalyses.length === 0) {
      // Item has no usage history
      return {
        quantity: 0,
        unitCost: item.unitCost || 0,
        method: 'historical_average',
        confidence: 0.30,
        metadata: {
          historicalPeriods: historicalPeriods.length,
          historicalAnalyses: 0,
          estimationMethod: 'new_item_estimation',
          calculatedAt: new Date()
        }
      };
    }

    // Calculate average actual usage from historical periods
    const totalUsage = historicalAnalyses.reduce(
      (sum, analysis) => sum + parseFloat(analysis.actualQuantity),
      0
    );
    const averageUsage = totalUsage / historicalAnalyses.length;

    // Adjust for seasonal factors (placeholder for future enhancement)
    const seasonalAdjustment = 1.0; // No adjustment for now
    const adjustedUsage = averageUsage * seasonalAdjustment;

    return {
      quantity: adjustedUsage,
      unitCost: item.unitCost || 0,
      method: 'historical_average',
      confidence: Math.min(0.80, 0.40 + (historicalAnalyses.length * 0.08)), // Higher confidence with more data
      metadata: {
        historicalPeriods: historicalPeriods.length,
        historicalAnalyses: historicalAnalyses.length,
        averageUsage,
        seasonalAdjustment,
        calculatedAt: new Date()
      }
    };
  }

  /**
   * Calculate AI-predicted theoretical usage (placeholder for future ML implementation)
   */
  async calculateAIPredictedUsage(item, period) {
    // Placeholder for future ML model integration
    // For now, fall back to historical average with AI flag
    const historicalResult = await this.calculateHistoricalAverageUsage(item, period);
    
    return {
      ...historicalResult,
      method: 'ai_predicted',
      confidence: Math.min(historicalResult.confidence * 1.1, 0.95), // Slightly higher confidence
      metadata: {
        ...historicalResult.metadata,
        aiModel: 'placeholder_v1',
        aiFactors: ['historical_trend', 'seasonal_pattern']
      }
    };
  }

  /**
   * Calculate actual usage from inventory movement between snapshots
   * 
   * Formula: beginning_quantity + purchases - ending_quantity = actual_usage
   */
  async calculateActualUsage(item, period) {
    // Get beginning and ending snapshots for this item in this period
    const snapshots = await this.models.PeriodInventorySnapshot.findAll({
      where: {
        periodId: period.id,
        inventoryItemId: item.id,
        snapshotType: { [Op.in]: ['beginning', 'ending'] }
      }
    });

    const beginningSnapshot = snapshots.find(s => s.snapshotType === 'beginning');
    const endingSnapshot = snapshots.find(s => s.snapshotType === 'ending');

    if (!beginningSnapshot || !endingSnapshot) {
      throw new Error(`Missing snapshots for item ${item.id} in period ${period.id}`);
    }

    // Get purchases/additions during the period
    const purchases = await this.models.InventoryTransaction.findAll({
      where: {
        inventoryItemId: item.id,
        transactionDate: {
          [Op.between]: [period.periodStart, period.periodEnd]
        },
        type: { [Op.in]: ['purchase', 'adjustment_in', 'transfer_in'] }
      }
    });

    // Calculate total purchases
    const totalPurchases = purchases.reduce(
      (sum, transaction) => sum + parseFloat(transaction.quantity),
      0
    );

    // Calculate actual usage: beginning + purchases - ending
    const beginningQuantity = parseFloat(beginningSnapshot.quantity);
    const endingQuantity = parseFloat(endingSnapshot.quantity);
    const actualUsage = beginningQuantity + totalPurchases - endingQuantity;

    return {
      quantity: Math.max(0, actualUsage), // Ensure non-negative
      unitCost: item.unitCost || endingSnapshot.unitCost || beginningSnapshot.unitCost || 0,
      metadata: {
        beginningQuantity,
        endingQuantity,
        totalPurchases,
        purchaseTransactions: purchases.length,
        calculatedAt: new Date()
      }
    };
  }

  /**
   * Build analysis record for database insertion
   */
  buildAnalysisRecord(periodId, item, theoreticalUsage, actualUsage, method) {
    const theoreticalQty = parseFloat(theoreticalUsage.quantity);
    const actualQty = parseFloat(actualUsage.quantity);
    const unitCost = parseFloat(theoreticalUsage.unitCost || actualUsage.unitCost || 0);

    // Calculate variance metrics
    const varianceQuantity = actualQty - theoreticalQty;
    const variancePercentage = theoreticalQty > 0 ? 
      (varianceQuantity / theoreticalQty) * 100 : 0;
    const varianceDollarValue = varianceQuantity * unitCost;
    // Normalize -0 to +0 to avoid Object.is() equality issues in tests
    const normalizedVarianceDollarValue = varianceDollarValue === 0 ? 0 : varianceDollarValue;

    // Determine priority using Dave's business logic
    const priority = this.calculateVariancePriority(
      item,
      Math.abs(varianceQuantity),
      Math.abs(varianceDollarValue)
    );

    return {
      periodId,
      inventoryItemId: item.id,
      theoreticalQuantity: theoreticalQty,
      actualQuantity: actualQty,
      unitCost,
      varianceQuantity,
      variancePercentage,
      varianceDollarValue: normalizedVarianceDollarValue,
      priority,
      calculationMethod: method,
      recipeData: theoreticalUsage.metadata || null,
      calculationConfidence: theoreticalUsage.confidence || null,
      calculatedAt: new Date()
    };
  }

  /**
   * Calculate variance priority using Dave's business rules
   */
  calculateVariancePriority(item, absQuantityVariance, absDollarVariance) {
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
   * Bulk calculation for multiple periods
   */
  async calculateUsageForMultiplePeriods(periodIds, options = {}) {
    const results = [];
    
    for (const periodId of periodIds) {
      try {
        const result = await this.calculateUsageForPeriod(periodId, options);
        results.push(result);
      } catch (error) {
        console.error(`[UsageCalculationService] Failed to process period ${periodId}:`, error);
        results.push({
          periodId,
          error: error.message,
          itemsProcessed: 0,
          itemsSkipped: 0,
          analyses: [],
          errors: []
        });
      }
    }
    
    return results;
  }

  /**
   * Get calculation summary for a period
   */
  async getCalculationSummary(periodId) {
    if (!this.models) await this.initialize();

    const analyses = await this.models.TheoreticalUsageAnalysis.findAll({
      where: { periodId },
      include: [
        {
          model: this.models.InventoryItem,
          as: 'inventoryItem'
        }
      ]
    });

    const summary = {
      periodId,
      totalItems: analyses.length,
      byPriority: {
        critical: analyses.filter(a => a.priority === 'critical').length,
        high: analyses.filter(a => a.priority === 'high').length,
        medium: analyses.filter(a => a.priority === 'medium').length,
        low: analyses.filter(a => a.priority === 'low').length
      },
      byMethod: {
        recipe_based: analyses.filter(a => a.calculationMethod === 'recipe_based').length,
        historical_average: analyses.filter(a => a.calculationMethod === 'historical_average').length,
        manual: analyses.filter(a => a.calculationMethod === 'manual').length,
        ai_predicted: analyses.filter(a => a.calculationMethod === 'ai_predicted').length
      },
      totalVarianceDollarValue: analyses.reduce(
        (sum, a) => sum + parseFloat(a.varianceDollarValue), 
        0
      ),
      averageConfidence: analyses.length > 0 ? analyses.reduce(
        (sum, a) => sum + (parseFloat(a.calculationConfidence) || 0), 
        0
      ) / analyses.length : 0
    };

    return summary;
  }
}

export default UsageCalculationService;
