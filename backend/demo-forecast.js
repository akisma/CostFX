/**
 * ForecastAgent Demo - Phase 4 Implementation
 * This demonstrates the new forecasting capabilities added to CostFX
 */

import agentService from './src/agents/AgentService.js';

async function runForecastDemo() {
  console.log('🔮 ForecastAgent Demo - Phase 4 Implementation\n');
  
  try {
    // Initialize the agent service
    await agentService.initialize();
    console.log('✅ All agents initialized successfully\n');

    const restaurantId = 1;

    // Demo 1: Demand Forecasting
    console.log('📊 1. Demand Forecasting for Next 7 Days');
    console.log('==========================================');
    
    const demandForecast = await agentService.forecastDemand(restaurantId, {
      forecastDays: 7,
      includeConfidenceIntervals: true
    });
    
    console.log(`Restaurant ID: ${demandForecast.restaurantId}`);
    console.log(`Forecast Period: ${demandForecast.forecastPeriod.days} days`);
    console.log(`Total Items Forecasted: ${demandForecast.summary.totalItems}`);
    console.log(`Total Forecast Units: ${demandForecast.summary.totalForecastUnits}`);
    console.log(`Daily Average: ${demandForecast.summary.dailyAverageUnits} units`);
    console.log(`Overall Confidence: ${demandForecast.summary.averageConfidence}`);
    
    // Show top performing item
    const topItem = demandForecast.itemForecasts[0];
    console.log(`\nTop Item: ${topItem.itemName}`);
    console.log(`  - Total Forecast: ${topItem.summary.totalForecast} units`);
    console.log(`  - Daily Average: ${topItem.summary.dailyAverage} units`);
    console.log(`  - Confidence: ${topItem.summary.confidence}`);
    console.log(`  - Peak Day: ${topItem.summary.peakDay.date} (${topItem.summary.peakDay.forecastQuantity} units)`);

    // Demo 2: Seasonal Analysis
    console.log('\n\n🌍 2. Seasonal Trends Analysis');
    console.log('===============================');
    
    const seasonalAnalysis = await agentService.analyzeSeasonalTrends(restaurantId, {
      analysisMonths: 12,
      includeYearOverYear: true
    });
    
    console.log(`Analysis Period: ${seasonalAnalysis.analysisPeriod.months} months`);
    console.log('Seasonal Trends:');
    Object.entries(seasonalAnalysis.seasonalTrends).forEach(([season, data]) => {
      console.log(`  - ${season}: ${data.averageGrowth}% growth (confidence: ${data.confidence})`);
    });
    
    console.log('\nWeekly Patterns:');
    Object.entries(seasonalAnalysis.weeklyPatterns).forEach(([day, multiplier]) => {
      console.log(`  - ${day}: ${(multiplier * 100).toFixed(0)}% of average`);
    });

    // Demo 3: Revenue Prediction
    console.log('\n\n💰 3. Revenue Prediction (Optimistic Scenario)');
    console.log('==============================================');
    
    const revenuePrediction = await agentService.predictRevenue(restaurantId, {
      forecastDays: 30,
      scenario: 'optimistic',
      includeProfitability: true
    });
    
    console.log(`Scenario: ${revenuePrediction.scenario}`);
    console.log(`Forecast Period: ${revenuePrediction.forecastPeriod.days} days`);
    console.log(`Total Projected Revenue: $${revenuePrediction.totalProjections.revenue.toFixed(2)}`);
    console.log(`Daily Average Revenue: $${revenuePrediction.totalProjections.dailyAverage.toFixed(2)}`);
    
    if (revenuePrediction.profitabilityMetrics) {
      console.log(`\nProfitability Analysis:`);
      console.log(`  - Projected Cost: $${revenuePrediction.profitabilityMetrics.projectedCost.toFixed(2)}`);
      console.log(`  - Gross Profit: $${revenuePrediction.profitabilityMetrics.grossProfit.toFixed(2)}`);
      console.log(`  - Margin: ${revenuePrediction.profitabilityMetrics.marginPercentage}%`);
    }

    // Demo 4: Capacity Optimization
    console.log('\n\n🏭 4. Capacity Optimization');
    console.log('============================');
    
    const capacityOptimization = await agentService.optimizeCapacity(restaurantId, {
      forecastDays: 30,
      currentCapacity: { staff: 10, seating: 50, kitchen: 30 },
      optimizationGoal: 'balanced'
    });
    
    console.log(`Current Capacity: ${JSON.stringify(capacityOptimization.currentCapacity)}`);
    console.log(`Peak Demand: ${capacityOptimization.capacityAnalysis.peakDemand} units`);
    console.log(`Current Utilization: ${(capacityOptimization.capacityAnalysis.utilizationRate * 100).toFixed(1)}%`);
    console.log(`Recommendation: ${capacityOptimization.capacityAnalysis.recommendation}`);

    // Demo 5: Ingredient Forecasting
    console.log('\n\n🥗 5. Ingredient Needs Forecasting');
    console.log('===================================');
    
    const ingredientForecast = await agentService.forecastIngredientNeeds(restaurantId, {
      forecastDays: 14,
      includeBuffer: true,
      bufferPercentage: 15
    });
    
    console.log(`Forecast Period: ${ingredientForecast.forecastPeriod.days} days`);
    console.log(`Total Ingredients: ${ingredientForecast.summary.totalIngredients}`);
    console.log(`Estimated Cost: $${ingredientForecast.summary.estimatedCost}`);
    console.log(`Buffer Included: ${ingredientForecast.summary.bufferIncluded ? 'Yes' : 'No'} (${ingredientForecast.summary.bufferPercentage}%)`);
    console.log(`Order Frequency: ${ingredientForecast.procurementPlan.orderFrequency}`);

    console.log('\n✨ Phase 4 ForecastAgent Demo Complete!');
    console.log('\nKey Features Implemented:');
    console.log('• Demand forecasting with confidence intervals');
    console.log('• Seasonal trend analysis and weekly patterns');
    console.log('• Revenue prediction with multiple scenarios');
    console.log('• Capacity optimization recommendations');
    console.log('• Ingredient procurement planning');
    console.log('• Machine learning-ready architecture');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  } finally {
    // Cleanup
    await agentService.shutdown();
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runForecastDemo().catch(console.error);
}

export default runForecastDemo;
