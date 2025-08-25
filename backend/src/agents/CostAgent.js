import BaseAgent from './BaseAgent.js';

/**
 * CostAgent - Specialized agent for cost analysis and optimization
 * Handles recipe costing, margin analysis, and cost optimization recommendations
 */
class CostAgent extends BaseAgent {
  constructor() {
    super('CostAgent', [
      'calculate_recipe_cost',
      'analyze_margins',
      'optimize_costs',
      'generate_insights',
      'cost_trends'
    ]);
    
    // Cost analysis configuration
    this.config = {
      targetMargin: 0.65, // 65% target margin
      warningThreshold: 0.55, // Warn if margin below 55%
      criticalThreshold: 0.45, // Critical if margin below 45%
      inflationRate: 0.03 // 3% annual inflation estimate
    };
  }

  /**
   * Process different types of cost-related requests
   */
  async process(request) {
    switch (request.type) {
      case 'calculate_recipe_cost':
        return await this.calculateRecipeCost(request);
      
      case 'analyze_margins':
        return await this.analyzeMargins(request);
      
      case 'optimize_costs':
        return await this.optimizeCosts(request);
      
      case 'generate_insights':
        return await this.generateCostInsights(request);
      
      case 'cost_trends':
        return await this.analyzeCostTrends(request);
      
      default:
        throw new Error(`Unknown request type: ${request.type}`);
    }
  }

  /**
   * Calculate the total cost of a recipe including ingredients and labor
   */
  async calculateRecipeCost(request) {
    const { recipeId, ingredients, portions = 1 } = request.data;
    
    if (!ingredients || !Array.isArray(ingredients)) {
      throw new Error('Ingredients array is required for recipe cost calculation');
    }

    let totalIngredientCost = 0;
    const costBreakdown = [];

    // Calculate ingredient costs
    for (const ingredient of ingredients) {
      const { name, quantity, unit, costPerUnit } = ingredient;
      const ingredientCost = quantity * costPerUnit;
      totalIngredientCost += ingredientCost;
      
      costBreakdown.push({
        ingredient: name,
        quantity,
        unit,
        costPerUnit,
        totalCost: Math.round(ingredientCost * 100) / 100,
        percentage: 0 // Will calculate after total
      });
    }

    // Add labor cost (estimate 20% of ingredient cost)
    const laborCost = totalIngredientCost * 0.20;
    
    // Add overhead (estimate 15% of total)
    const subtotal = totalIngredientCost + laborCost;
    const overheadCost = subtotal * 0.15;
    
    const totalCost = subtotal + overheadCost;
    const costPerPortion = totalCost / portions;

    // Calculate percentages
    costBreakdown.forEach(item => {
      item.percentage = Math.round((item.totalCost / totalIngredientCost) * 100);
    });

    return {
      recipeId,
      costAnalysis: {
        totalCost: Math.round(totalCost * 100) / 100,
        costPerPortion: Math.round(costPerPortion * 100) / 100,
        portions,
        breakdown: {
          ingredients: Math.round(totalIngredientCost * 100) / 100,
          labor: Math.round(laborCost * 100) / 100,
          overhead: Math.round(overheadCost * 100) / 100
        },
        ingredientDetails: costBreakdown
      },
      recommendations: this.generateCostRecommendations(costPerPortion)
    };
  }

  /**
   * Analyze profit margins for menu items
   */
  async analyzeMargins(request) {
    const { menuItems } = request.data;
    
    if (!menuItems || !Array.isArray(menuItems)) {
      throw new Error('Menu items array is required for margin analysis');
    }

    const marginAnalysis = [];
    let totalRevenue = 0;
    let totalCost = 0;

    for (const item of menuItems) {
      const { name, sellingPrice, cost, salesVolume = 1 } = item;
      const margin = (sellingPrice - cost) / sellingPrice;
      const marginPercent = Math.round(margin * 100);
      
      const itemRevenue = sellingPrice * salesVolume;
      const itemCost = cost * salesVolume;
      
      totalRevenue += itemRevenue;
      totalCost += itemCost;

      marginAnalysis.push({
        name,
        sellingPrice,
        cost,
        margin: marginPercent,
        status: this.getMarginStatus(margin),
        revenue: itemRevenue,
        profit: itemRevenue - itemCost,
        salesVolume
      });
    }

    const overallMargin = (totalRevenue - totalCost) / totalRevenue;

    return {
      marginAnalysis: {
        items: marginAnalysis,
        overall: {
          margin: Math.round(overallMargin * 100),
          status: this.getMarginStatus(overallMargin),
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          totalProfit: Math.round((totalRevenue - totalCost) * 100) / 100
        }
      },
      recommendations: this.generateMarginRecommendations(marginAnalysis)
    };
  }

  /**
   * Generate cost optimization recommendations
   */
  async optimizeCosts(request) {
    const { currentCosts, targetMargin } = request.data;
    const target = targetMargin || this.config.targetMargin;

    const optimizations = [];

    // Analyze each cost component
    for (const cost of currentCosts) {
      const { category, amount, percentage } = cost;
      
      if (category === 'ingredients' && percentage > 35) {
        optimizations.push({
          type: 'ingredient_substitution',
          category,
          currentAmount: amount,
          potentialSavings: amount * 0.15,
          recommendation: 'Consider alternative ingredients or suppliers',
          priority: 'high'
        });
      }
      
      if (category === 'labor' && percentage > 25) {
        optimizations.push({
          type: 'process_optimization',
          category,
          currentAmount: amount,
          potentialSavings: amount * 0.10,
          recommendation: 'Streamline preparation processes',
          priority: 'medium'
        });
      }
    }

    return {
      optimizations,
      targetMargin: target,
      estimatedSavings: optimizations.reduce((sum, opt) => sum + opt.potentialSavings, 0)
    };
  }

  /**
   * Generate cost-related insights for a restaurant
   */
  // eslint-disable-next-line no-unused-vars
  async generateCostInsights(data) {
    const insights = [];
    
    // Simulated cost analysis - in real implementation, would query database
    const mockData = {
      averageMargin: 0.58,
      topCostDrivers: ['ingredients', 'labor'],
      recentCostIncrease: 0.08,
      wastageRate: 0.12
    };

    // Margin insights
    if (mockData.averageMargin < this.config.targetMargin) {
      insights.push({
        type: 'margin_warning',
        priority: mockData.averageMargin < this.config.criticalThreshold ? 'high' : 'medium',
        message: `Average margin of ${Math.round(mockData.averageMargin * 100)}% is below target`,
        impact: 'financial',
        recommendation: 'Review pricing strategy or reduce costs',
        agent: this.name
      });
    }

    // Cost trend insights
    if (mockData.recentCostIncrease > 0.05) {
      insights.push({
        type: 'cost_increase',
        priority: 'high',
        message: `Costs increased by ${Math.round(mockData.recentCostIncrease * 100)}% recently`,
        impact: 'financial',
        recommendation: 'Investigate supplier pricing and consider alternatives',
        agent: this.name
      });
    }

    // Waste insights
    if (mockData.wastageRate > 0.10) {
      insights.push({
        type: 'waste_alert',
        priority: 'medium',
        message: `Food waste at ${Math.round(mockData.wastageRate * 100)}% is above optimal`,
        impact: 'cost_efficiency',
        recommendation: 'Implement better inventory management',
        agent: this.name
      });
    }

    return { insights };
  }

  /**
   * Analyze cost trends over time
   */
  async analyzeCostTrends(request) {
    const { timeframe = '30d' } = request.data;
    
    // Mock trend data - in real implementation, would analyze historical data
    const trends = {
      timeframe,
      costCategories: {
        ingredients: { trend: 'increasing', change: 8.5 },
        labor: { trend: 'stable', change: 2.1 },
        utilities: { trend: 'increasing', change: 12.3 },
        overhead: { trend: 'stable', change: -1.2 }
      },
      predictions: {
        nextMonth: {
          expectedIncrease: 5.2,
          confidence: 85
        }
      }
    };

    return { trends };
  }

  /**
   * Generate cost-specific recommendations
   */
  generateCostRecommendations(costPerPortion) {
    const recommendations = [];
    
    if (costPerPortion > 8) {
      recommendations.push({
        type: 'high_cost_warning',
        message: 'Recipe cost is high - consider ingredient substitutions',
        priority: 'medium'
      });
    }
    
    if (costPerPortion < 3) {
      recommendations.push({
        type: 'pricing_opportunity',
        message: 'Low cost allows for competitive pricing or higher margins',
        priority: 'low'
      });
    }
    
    return recommendations;
  }

  /**
   * Generate margin-specific recommendations
   */
  generateMarginRecommendations(marginAnalysis) {
    const recommendations = [];
    const lowMarginItems = marginAnalysis.filter(item => item.margin < 50);
    
    if (lowMarginItems.length > 0) {
      recommendations.push({
        type: 'margin_improvement',
        message: `${lowMarginItems.length} items have margins below 50%`,
        items: lowMarginItems.map(item => item.name),
        priority: 'high'
      });
    }
    
    return recommendations;
  }

  /**
   * Determine margin status based on thresholds
   */
  getMarginStatus(margin) {
    if (margin >= this.config.targetMargin) return 'excellent';
    if (margin >= this.config.warningThreshold) return 'good';
    if (margin >= this.config.criticalThreshold) return 'warning';
    return 'critical';
  }
}

export default CostAgent;
