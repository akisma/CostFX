import { validationResult } from 'express-validator';
import InventoryVarianceAgent from '../agents/InventoryVarianceAgent.js';

/**
 * Variance Controller - Task 10
 * 
 * Thin controller wrappers around InventoryVarianceAgent methods.
 * Provides standardized API responses for Dave's variance analysis system.
 * 
 * Architecture: Hybrid approach with minimal business logic in controllers,
 * delegating core functionality to the specialized agent layer.
 */

// Initialize the agent instance (singleton pattern)
const varianceAgent = new InventoryVarianceAgent();

/**
 * @desc Analyze variance for a specific period
 * @route POST /api/v1/variance/period-analysis
 * @access Private
 */
export const analyzePeriodVariance = async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const {
    periodId,
    method = 'recipe_based',
    itemIds = null,
    recalculate = false,
    priority = null,
    includeInsights = true
  } = req.body;

  // Extract restaurant ID from auth context (would be set by auth middleware)
  const restaurantId = req.user?.restaurantId || 1; // Default for development

  try {
    console.log(`[VarianceController] Analyzing period variance for period ${periodId}`);

    // Delegate to InventoryVarianceAgent
    const varianceResult = await varianceAgent.process({
      type: 'calculate_usage_variance',
      data: {
        periodId,
        method,
        itemIds,
        recalculate,
        restaurantId
      }
    });

    // Get period analysis for additional context
    const periodAnalysis = await varianceAgent.process({
      type: 'analyze_period_variance',
      data: { periodId }
    });

    // Filter by priority if specified
    let filteredAnalyses = varianceResult.analyses;
    if (priority) {
      filteredAnalyses = varianceResult.analyses.filter(analysis => 
        analysis.priority === priority
      );
    }

    // Build response
    const response = {
      success: true,
      data: {
        periodId,
        method,
        analysisType: 'period_variance',
        summary: {
          ...varianceResult.summary,
          filteredItemCount: filteredAnalyses.length,
          filter: priority ? { priority } : null
        },
        analyses: filteredAnalyses,
        periodOverview: periodAnalysis.analysis?.overview,
        priorityBreakdown: periodAnalysis.analysis?.priorityBreakdown,
        methodBreakdown: periodAnalysis.analysis?.methodBreakdown
      },
      meta: {
        calculatedAt: varianceResult.calculatedAt,
        includeInsights,
        hasErrors: varianceResult.errors.length > 0,
        errorCount: varianceResult.errors.length
      }
    };

    // Include insights if requested
    if (includeInsights && varianceResult.insights) {
      response.data.insights = varianceResult.insights;
    }

    // Include recommendations
    if (periodAnalysis.analysis?.recommendations) {
      response.data.recommendations = periodAnalysis.analysis.recommendations;
    }

    // Include errors if any
    if (varianceResult.errors.length > 0) {
      response.errors = varianceResult.errors;
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('[VarianceController] Error analyzing period variance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze period variance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc Get hierarchical category variance breakdown for a period
 * @route GET /api/v1/variance/categories
 * @access Private
 */
export const getCategoryVarianceBreakdown = async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',  
      errors: errors.array()
    });
  }

  const {
    periodId,
    priority = null,
    minVarianceAmount = null,
    includeZeroVariance = false,
    sortBy = 'variance_amount',
    sortOrder = 'desc'
  } = req.query;

  // Extract restaurant ID from auth context
  const restaurantId = req.user?.restaurantId || 1;

  try {
    console.log(`[VarianceController] Getting category variance breakdown for period ${periodId}`);

    // Get variance data from agent
    const varianceResult = await varianceAgent.process({
      type: 'calculate_usage_variance',
      data: {
        periodId: parseInt(periodId),
        method: 'recipe_based', // Default method for category breakdown
        restaurantId
      }
    });

    // Process and categorize the variance data
    const categoryBreakdown = await processCategoryBreakdown(
      varianceResult.analyses,
      {
        priority,
        minVarianceAmount: minVarianceAmount ? parseFloat(minVarianceAmount) : null,
        includeZeroVariance: includeZeroVariance === 'true',
        sortBy,
        sortOrder
      }
    );

    const response = {
      success: true,
      data: {
        periodId: parseInt(periodId),
        analysisType: 'category_breakdown',
        filters: {
          priority,
          minVarianceAmount,
          includeZeroVariance,
          sortBy,
          sortOrder
        },
        summary: {
          totalCategories: categoryBreakdown.categories.length,
          totalItems: categoryBreakdown.totalItems,
          totalVarianceDollarValue: categoryBreakdown.totalVarianceDollarValue,
          highestVarianceCategory: categoryBreakdown.highestVarianceCategory
        },
        categories: categoryBreakdown.categories
      },
      meta: {
        calculatedAt: varianceResult.calculatedAt,
        hasErrors: varianceResult.errors.length > 0,
        errorCount: varianceResult.errors.length
      }
    };

    // Include errors if any
    if (varianceResult.errors.length > 0) {
      response.errors = varianceResult.errors;
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('[VarianceController] Error getting category variance breakdown:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get category variance breakdown',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc Get priority variance summary for a period
 * @route GET /api/v1/variance/summary/:periodId
 * @access Private
 */
export const getPriorityVarianceSummary = async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { periodId } = req.params;
  const { priority = 'critical' } = req.query;

  try {
    console.log(`[VarianceController] Getting priority variance summary for period ${periodId}`);

    // Delegate to InventoryVarianceAgent
    const summaryResult = await varianceAgent.process({
      type: 'priority_variance_summary',
      data: {
        periodId: parseInt(periodId),
        priority
      }
    });

    const response = {
      success: true,
      data: {
        periodId: parseInt(periodId),
        priority,
        summary: summaryResult.summary
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('[VarianceController] Error getting priority variance summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get priority variance summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc Get historical variance trends
 * @route GET /api/v1/variance/trends
 * @access Private
 */
export const getHistoricalVarianceTrends = async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const {
    restaurantId,
    itemIds = null,
    periodCount = 6
  } = req.query;

  try {
    console.log(`[VarianceController] Getting historical variance trends for restaurant ${restaurantId}`);

    // Process itemIds if provided
    const processedItemIds = itemIds ? 
      (Array.isArray(itemIds) ? itemIds.map(id => parseInt(id)) : [parseInt(itemIds)]) :
      null;

    // Delegate to InventoryVarianceAgent
    const trendsResult = await varianceAgent.process({
      type: 'historical_variance_trends',
      data: {
        restaurantId: parseInt(restaurantId),
        itemIds: processedItemIds,
        periodCount: parseInt(periodCount)
      }
    });

    const response = {
      success: true,
      data: {
        restaurantId: parseInt(restaurantId),
        periodCount: parseInt(periodCount),
        itemIds: processedItemIds,
        trends: trendsResult
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('[VarianceController] Error getting historical variance trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get historical variance trends',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Helper function to process category breakdown from variance analyses
 * Organizes items by their ingredient categories with hierarchical structure
 */
async function processCategoryBreakdown(analyses, options) {
  const {
    priority,
    minVarianceAmount,
    includeZeroVariance,
    sortBy,
    sortOrder
  } = options;

  // Filter analyses based on criteria
  let filteredAnalyses = analyses;

  if (priority) {
    filteredAnalyses = filteredAnalyses.filter(analysis => analysis.priority === priority);
  }

  if (minVarianceAmount !== null) {
    filteredAnalyses = filteredAnalyses.filter(analysis => 
      Math.abs(analysis.varianceDollarValue) >= minVarianceAmount
    );
  }

  if (!includeZeroVariance) {
    filteredAnalyses = filteredAnalyses.filter(analysis => 
      analysis.varianceDollarValue !== 0
    );
  }

  // Group by category (simulated hierarchy - in real implementation would use ltree paths)
  const categoryMap = new Map();
  let totalVarianceDollarValue = 0;
  let totalItems = 0;

  filteredAnalyses.forEach(analysis => {
    // Simulate category path - in real implementation would come from InventoryItem.category_path
    const categoryPath = analysis.item?.category_path || 'ingredients.uncategorized';
    const categoryParts = categoryPath.split('.');
    const mainCategory = categoryParts[1] || 'uncategorized';
    
    if (!categoryMap.has(mainCategory)) {
      categoryMap.set(mainCategory, {
        categoryName: mainCategory,
        categoryPath: `ingredients.${mainCategory}`,
        items: [],
        totalVarianceDollarValue: 0,
        itemCount: 0,
        averagePriority: 'low',
        subcategories: new Map()
      });
    }

    const category = categoryMap.get(mainCategory);
    category.items.push(analysis);
    category.totalVarianceDollarValue += analysis.varianceDollarValue;
    category.itemCount++;
    
    // Update totals
    totalVarianceDollarValue += analysis.varianceDollarValue;
    totalItems++;

    // Handle subcategories if they exist
    if (categoryParts.length > 2) {
      const subCategoryName = categoryParts[2];
      if (!category.subcategories.has(subCategoryName)) {
        category.subcategories.set(subCategoryName, {
          categoryName: subCategoryName,
          categoryPath: categoryPath,
          items: [],
          totalVarianceDollarValue: 0,
          itemCount: 0
        });
      }
      
      const subCategory = category.subcategories.get(subCategoryName);
      subCategory.items.push(analysis);
      subCategory.totalVarianceDollarValue += analysis.varianceDollarValue;
      subCategory.itemCount++;
    }
  });

  // Convert categories to array and sort
  const categories = Array.from(categoryMap.values()).map(category => ({
    ...category,
    subcategories: Array.from(category.subcategories.values()),
    averageVariancePercentage: category.itemCount > 0 ? 
      category.items.reduce((sum, item) => sum + Math.abs(item.variancePercentage || 0), 0) / category.itemCount : 0
  }));

  // Sort categories
  categories.sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'variance_amount':
        aValue = Math.abs(a.totalVarianceDollarValue);
        bValue = Math.abs(b.totalVarianceDollarValue);
        break;
      case 'variance_percentage':
        aValue = a.averageVariancePercentage;
        bValue = b.averageVariancePercentage;
        break;
      case 'item_name':
        aValue = a.categoryName.toLowerCase();
        bValue = b.categoryName.toLowerCase();
        break;
      default:
        aValue = Math.abs(a.totalVarianceDollarValue);
        bValue = Math.abs(b.totalVarianceDollarValue);
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Find highest variance category
  const highestVarianceCategory = categories.length > 0 ? 
    categories.reduce((max, category) => 
      Math.abs(category.totalVarianceDollarValue) > Math.abs(max.totalVarianceDollarValue) ? category : max
    ) : null;

  return {
    categories,
    totalItems,
    totalVarianceDollarValue,
    highestVarianceCategory: highestVarianceCategory ? {
      name: highestVarianceCategory.categoryName,
      varianceDollarValue: highestVarianceCategory.totalVarianceDollarValue,
      itemCount: highestVarianceCategory.itemCount
    } : null
  };
}
