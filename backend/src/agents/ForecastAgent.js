import BaseAgent from './BaseAgent.js';

/**
 * ForecastAgent - Specialized agent for demand forecasting and revenue prediction
 * Handles demand forecasting, seasonal trend analysis, revenue prediction, and capacity planning
 */
class ForecastAgent extends BaseAgent {
  constructor() {
    super('ForecastAgent', [
      'forecast_demand',
      'analyze_seasonal_trends',
      'predict_revenue',
      'optimize_capacity',
      'forecast_ingredients'
    ]);
    
    // Forecasting configuration
    this.config = {
      defaultForecastDays: 30,
      seasonalFactors: {
        spring: { multiplier: 1.1, peak_months: [3, 4, 5] },
        summer: { multiplier: 1.25, peak_months: [6, 7, 8] },
        fall: { multiplier: 1.05, peak_months: [9, 10, 11] },
        winter: { multiplier: 0.9, peak_months: [12, 1, 2] }
      },
      weekdayFactors: {
        monday: 0.8,
        tuesday: 0.85,
        wednesday: 0.9,
        thursday: 1.0,
        friday: 1.3,
        saturday: 1.4,
        sunday: 1.1
      },
      confidenceThresholds: {
        high: 0.85,
        medium: 0.65,
        low: 0.45
      }
    };
  }

  /**
   * Process different types of forecasting requests
   */
  async process(request) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (request.type) {
        case 'forecast_demand':
          result = await this.forecastDemand(request.data);
          break;
        
        case 'analyze_seasonal_trends':
          result = await this.analyzeSeasonalTrends(request.data);
          break;
        
        case 'predict_revenue':
          result = await this.predictRevenue(request.data);
          break;
        
        case 'optimize_capacity':
          result = await this.optimizeCapacity(request.data);
          break;
        
        case 'forecast_ingredients':
          result = await this.forecastIngredientNeeds(request.data);
          break;
        
        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }

      this.updateMetrics(Date.now() - startTime, true);
      return result;
      
    } catch (error) {
      this.updateMetrics(Date.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Forecast demand for menu items based on historical data
   */
  async forecastDemand(data) {
    const { 
      restaurantId, 
      forecastDays = this.config.defaultForecastDays,
      menuItems = null,
      includeConfidenceIntervals = true 
    } = data;

    // Validate required parameters
    if (!restaurantId) {
      throw new Error('Restaurant ID is required for demand forecasting');
    }

    if (forecastDays <= 0) {
      throw new Error('Forecast days must be greater than 0');
    }

    // Get historical sales data
    const historicalData = await this.getHistoricalSalesData(restaurantId, menuItems);
    
    // Apply forecasting models
    const forecasts = [];
    
    for (const item of historicalData) {
      const forecast = this.generateItemForecast(item, forecastDays);
      
      if (includeConfidenceIntervals) {
        forecast.confidenceIntervals = this.calculateConfidenceIntervals(
          forecast.dailyForecasts,
          item.historicalVariance
        );
      }
      
      forecasts.push(forecast);
    }

    // Calculate aggregate metrics
    const summary = this.calculateForecastSummary(forecasts, forecastDays);

    return {
      restaurantId,
      forecastPeriod: {
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + forecastDays * 24 * 60 * 60 * 1000).toISOString(),
        days: forecastDays
      },
      itemForecasts: forecasts,
      summary,
      metadata: {
        modelVersion: '1.0',
        confidence: summary.averageConfidence,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Analyze seasonal trends and patterns
   */
  async analyzeSeasonalTrends(data) {
    const { restaurantId, analysisMonths = 12, includeYearOverYear = true } = data;

    // Get extended historical data for seasonal analysis
    const seasonalData = await this.getSeasonalSalesData(restaurantId, analysisMonths);
    
    // Analyze seasonal patterns
    const seasonalAnalysis = this.analyzeSeasonal(seasonalData);
    
    // Analyze weekly patterns
    const weeklyPatterns = this.analyzeWeeklyPatterns(seasonalData);
    
    // Year-over-year comparison if requested
    let yearOverYear = null;
    if (includeYearOverYear && analysisMonths >= 24) {
      yearOverYear = this.analyzeYearOverYear(seasonalData);
    }

    // Generate seasonal recommendations
    const recommendations = this.generateSeasonalRecommendations(seasonalAnalysis, weeklyPatterns);

    return {
      restaurantId,
      analysisPeriod: {
        months: analysisMonths,
        startDate: new Date(Date.now() - analysisMonths * 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      },
      seasonalTrends: seasonalAnalysis,
      weeklyPatterns,
      yearOverYear,
      recommendations,
      metadata: {
        dataPoints: seasonalData.length,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Predict revenue based on demand forecasts and pricing
   */
  async predictRevenue(data) {
    const { 
      restaurantId, 
      forecastDays = this.config.defaultForecastDays,
      scenario = 'current', // current, optimistic, conservative
      includeProfitability = true 
    } = data;

    // Get demand forecasts
    const demandForecast = await this.forecastDemand({ restaurantId, forecastDays });
    
    // Get menu pricing data
    const pricingData = await this.getMenuPricing(restaurantId);
    
    // Calculate revenue projections
    const revenueForecasts = [];
    let totalProjectedRevenue = 0;
    let totalProjectedCost = 0;

    for (const itemForecast of demandForecast.itemForecasts) {
      const pricing = pricingData.find(p => p.itemId === itemForecast.itemId);
      if (!pricing) continue;

      const itemRevenue = this.calculateItemRevenue(itemForecast, pricing, scenario);
      revenueForecasts.push(itemRevenue);
      
      totalProjectedRevenue += itemRevenue.totalRevenue;
      if (includeProfitability) {
        totalProjectedCost += itemRevenue.totalCost || 0;
      }
    }

    // Calculate profitability metrics
    let profitabilityMetrics = null;
    if (includeProfitability) {
      const grossProfit = totalProjectedRevenue - totalProjectedCost;
      profitabilityMetrics = {
        projectedRevenue: Math.round(totalProjectedRevenue * 100) / 100,
        projectedCost: Math.round(totalProjectedCost * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        marginPercentage: Math.round((grossProfit / totalProjectedRevenue) * 100 * 100) / 100
      };
    }

    // Generate revenue insights
    const insights = this.generateRevenueInsights(revenueForecasts, profitabilityMetrics);

    return {
      restaurantId,
      scenario,
      forecastPeriod: demandForecast.forecastPeriod,
      itemRevenues: revenueForecasts,
      totalProjections: {
        revenue: Math.round(totalProjectedRevenue * 100) / 100,
        dailyAverage: Math.round((totalProjectedRevenue / forecastDays) * 100) / 100
      },
      profitabilityMetrics,
      insights,
      metadata: {
        basedOnDemandForecast: demandForecast.metadata,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Optimize capacity planning based on demand forecasts
   */
  async optimizeCapacity(data) {
    const { 
      restaurantId, 
      forecastDays = this.config.defaultForecastDays,
      currentCapacity,
      optimizationGoal = 'balanced' // efficiency, growth, balanced
    } = data;

    // Get demand forecasts
    const demandForecast = await this.forecastDemand({ restaurantId, forecastDays });
    
    // Analyze capacity requirements
    const capacityAnalysis = this.analyzeCapacityNeeds(demandForecast, currentCapacity);
    
    // Generate optimization recommendations
    const optimizations = this.generateCapacityOptimizations(
      capacityAnalysis, 
      optimizationGoal,
      currentCapacity
    );

    return {
      restaurantId,
      currentCapacity,
      forecastPeriod: demandForecast.forecastPeriod,
      capacityAnalysis,
      optimizations,
      recommendations: this.generateCapacityRecommendations(optimizations),
      metadata: {
        optimizationGoal,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Forecast ingredient needs based on demand predictions
   */
  async forecastIngredientNeeds(data) {
    const { 
      restaurantId, 
      forecastDays = this.config.defaultForecastDays,
      includeBuffer = true,
      bufferPercentage = 15 
    } = data;

    // Get demand forecasts
    const demandForecast = await this.forecastDemand({ restaurantId, forecastDays });
    
    // Get recipe ingredient mappings
    const recipeIngredients = await this.getRecipeIngredients(restaurantId);
    
    // Calculate ingredient needs
    const ingredientForecasts = this.calculateIngredientNeeds(
      demandForecast,
      recipeIngredients,
      includeBuffer ? bufferPercentage : 0
    );

    // Add procurement recommendations
    const procurementPlan = this.generateProcurementPlan(ingredientForecasts);

    return {
      restaurantId,
      forecastPeriod: demandForecast.forecastPeriod,
      ingredientForecasts,
      procurementPlan,
      summary: {
        totalIngredients: ingredientForecasts.length,
        estimatedCost: procurementPlan.totalCost,
        bufferIncluded: includeBuffer,
        bufferPercentage: includeBuffer ? bufferPercentage : 0
      },
      metadata: {
        basedOnDemandForecast: demandForecast.metadata,
        generatedAt: new Date().toISOString()
      }
    };
  }

  // Helper methods for forecasting algorithms

  /**
   * Generate forecast for a single menu item
   */
  generateItemForecast(item, forecastDays) {
    const { itemId, itemName, historicalSales, trend, seasonality } = item;
    
    // Apply simple exponential smoothing with trend and seasonality
    const alpha = 0.3; // Smoothing parameter
    const beta = 0.1;  // Trend parameter
    const gamma = 0.1; // Seasonality parameter
    
    const dailyForecasts = [];
    let baseLevel = historicalSales[historicalSales.length - 1].quantity;
    let trendLevel = trend || 0;
    
    for (let day = 1; day <= forecastDays; day++) {
      // Apply trend
      const trendAdjusted = baseLevel + (trendLevel * day);
      
      // Apply seasonality (day of week)
      const dayOfWeek = new Date(Date.now() + day * 24 * 60 * 60 * 1000).getDay();
      const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const weekdayFactor = this.config.weekdayFactors[weekdayNames[dayOfWeek]];
      
      // Apply seasonal factor (month)
      const monthFactor = this.getSeasonalFactor(new Date(Date.now() + day * 24 * 60 * 60 * 1000));
      
      const forecastQuantity = Math.max(0, Math.round(trendAdjusted * weekdayFactor * monthFactor));
      
      dailyForecasts.push({
        date: new Date(Date.now() + day * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        forecastQuantity,
        confidence: this.calculateForecastConfidence(item, day)
      });
    }
    
    const totalForecast = dailyForecasts.reduce((sum, day) => sum + day.forecastQuantity, 0);
    const avgConfidence = dailyForecasts.reduce((sum, day) => sum + day.confidence, 0) / dailyForecasts.length;
    
    return {
      itemId,
      itemName,
      dailyForecasts,
      summary: {
        totalForecast,
        dailyAverage: Math.round(totalForecast / forecastDays),
        peakDay: dailyForecasts.reduce((max, day) => 
          day.forecastQuantity > max.forecastQuantity ? day : max
        ),
        confidence: Math.round(avgConfidence * 100) / 100
      }
    };
  }

  /**
   * Get seasonal factor for a given date
   */
  getSeasonalFactor(date) {
    const month = date.getMonth() + 1; // 1-12
    
    for (const [season, config] of Object.entries(this.config.seasonalFactors)) {
      if (config.peak_months.includes(month)) {
        return config.multiplier;
      }
    }
    
    return 1.0; // Default multiplier
  }

  /**
   * Calculate forecast confidence based on historical variance and forecast horizon
   */
  calculateForecastConfidence(item, dayAhead) {
    const baseConfidence = 0.85;
    const variancePenalty = (item.historicalVariance || 0.2) * 0.5;
    const horizonPenalty = (dayAhead - 1) * 0.01; // Confidence decreases over time
    
    const confidence = Math.max(0.3, baseConfidence - variancePenalty - horizonPenalty);
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Mock method to get historical sales data
   * In production, this would query the database
   */
  async getHistoricalSalesData(restaurantId, menuItems = null) {
    // Mock historical data for demonstration
    const mockData = [
      {
        itemId: 1,
        itemName: 'Classic Burger',
        historicalSales: this.generateMockSalesHistory(45, 25),
        trend: 0.1,
        seasonality: 'summer_peak',
        historicalVariance: 0.15
      },
      {
        itemId: 2,
        itemName: 'Caesar Salad',
        historicalSales: this.generateMockSalesHistory(30, 15),
        trend: -0.05,
        seasonality: 'year_round',
        historicalVariance: 0.25
      },
      {
        itemId: 3,
        itemName: 'Fish Tacos',
        historicalSales: this.generateMockSalesHistory(20, 8),
        trend: 0.2,
        seasonality: 'summer_peak',
        historicalVariance: 0.3
      }
    ];

    return menuItems ? mockData.filter(item => menuItems.includes(item.itemId)) : mockData;
  }

  /**
   * Generate mock sales history for testing
   */
  generateMockSalesHistory(avgDaily, variance) {
    const history = [];
    const days = 90; // 90 days of history
    
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000);
      const randomVariation = (Math.random() - 0.5) * variance * 2;
      const quantity = Math.max(0, Math.round(avgDaily + randomVariation));
      
      history.push({
        date: date.toISOString().split('T')[0],
        quantity
      });
    }
    
    return history;
  }

  /**
   * Other helper methods would be implemented here...
   * (analyzeSeasonal, analyzeWeeklyPatterns, calculateItemRevenue, etc.)
   */
  
  // Placeholder implementations for other helper methods
  async getSeasonalSalesData(restaurantId, months) {
    return this.generateMockSalesHistory(30, 10);
  }

  analyzeSeasonal(data) {
    return {
      spring: { averageGrowth: 10, confidence: 0.8 },
      summer: { averageGrowth: 25, confidence: 0.9 },
      fall: { averageGrowth: 5, confidence: 0.75 },
      winter: { averageGrowth: -10, confidence: 0.7 }
    };
  }

  analyzeWeeklyPatterns(data) {
    return {
      monday: 0.8,
      tuesday: 0.85,
      wednesday: 0.9,
      thursday: 1.0,
      friday: 1.3,
      saturday: 1.4,
      sunday: 1.1
    };
  }

  generateSeasonalRecommendations(seasonal, weekly) {
    return [
      {
        type: 'seasonal',
        priority: 'high',
        recommendation: 'Increase staff during summer peak season',
        impact: 'Revenue increase potential of 25%'
      },
      {
        type: 'weekly',
        priority: 'medium',
        recommendation: 'Optimize weekend staffing for 40% higher demand',
        impact: 'Improved service quality and customer satisfaction'
      }
    ];
  }

  async getMenuPricing(restaurantId) {
    return [
      { itemId: 1, price: 12.99, cost: 4.50 },
      { itemId: 2, price: 9.99, cost: 3.25 },
      { itemId: 3, price: 11.99, cost: 4.75 }
    ];
  }

  calculateItemRevenue(forecast, pricing, scenario) {
    const multiplier = scenario === 'optimistic' ? 1.1 : scenario === 'conservative' ? 0.9 : 1.0;
    const adjustedForecast = Math.round(forecast.summary.totalForecast * multiplier);
    
    return {
      itemId: forecast.itemId,
      itemName: forecast.itemName,
      forecastUnits: adjustedForecast,
      pricePerUnit: pricing.price,
      totalRevenue: adjustedForecast * pricing.price,
      totalCost: adjustedForecast * (pricing.cost || 0),
      scenario
    };
  }

  generateRevenueInsights(revenues, profitability) {
    return [
      {
        type: 'top_performer',
        message: `${revenues[0]?.itemName || 'Top item'} projected to generate highest revenue`,
        impact: 'high'
      },
      {
        type: 'profitability',
        message: profitability ? 
          `Projected margin of ${profitability.marginPercentage}%` :
          'Consider cost analysis for better margin insights',
        impact: 'medium'
      }
    ];
  }

  calculateForecastSummary(forecasts, days) {
    const totalForecast = forecasts.reduce((sum, f) => sum + f.summary.totalForecast, 0);
    const avgConfidence = forecasts.reduce((sum, f) => sum + f.summary.confidence, 0) / forecasts.length;
    
    return {
      totalItems: forecasts.length,
      totalForecastUnits: totalForecast,
      dailyAverageUnits: Math.round(totalForecast / days),
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      forecastAccuracy: avgConfidence > 0.8 ? 'high' : avgConfidence > 0.6 ? 'medium' : 'low'
    };
  }

  // Additional placeholder methods
  analyzeCapacityNeeds(forecast, currentCapacity) {
    return {
      peakDemand: forecast.summary.totalForecastUnits * 1.4,
      currentCapacity: currentCapacity || 1000,
      utilizationRate: 0.75,
      recommendation: 'adequate'
    };
  }

  generateCapacityOptimizations(analysis, goal, current) {
    return [
      {
        area: 'staffing',
        current: current?.staff || 10,
        recommended: 12,
        impact: 'Improved service during peak hours'
      }
    ];
  }

  generateCapacityRecommendations(optimizations) {
    return optimizations.map(opt => ({
      priority: 'medium',
      action: `Adjust ${opt.area} from ${opt.current} to ${opt.recommended}`,
      benefit: opt.impact
    }));
  }

  async getRecipeIngredients(restaurantId) {
    return [
      { itemId: 1, ingredients: [{ name: 'Ground Beef', quantityPer: 0.25 }] },
      { itemId: 2, ingredients: [{ name: 'Lettuce', quantityPer: 0.1 }] }
    ];
  }

  calculateIngredientNeeds(demandForecast, recipes, buffer) {
    return recipes.map(recipe => ({
      ingredient: recipe.ingredients[0].name,
      totalNeeded: 100, // Calculated based on demand
      bufferAmount: buffer > 0 ? 15 : 0,
      finalQuantity: 115
    }));
  }

  generateProcurementPlan(ingredients) {
    return {
      totalCost: 500,
      orderFrequency: 'weekly',
      suppliers: ['Supplier A', 'Supplier B']
    };
  }

  calculateConfidenceIntervals(forecasts, variance) {
    return forecasts.map(forecast => ({
      date: forecast.date,
      lower: Math.round(forecast.forecastQuantity * (1 - variance)),
      upper: Math.round(forecast.forecastQuantity * (1 + variance))
    }));
  }

  analyzeYearOverYear(data) {
    return {
      growth: 15,
      trend: 'positive',
      confidence: 0.8
    };
  }
}

export default ForecastAgent;
