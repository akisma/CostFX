import forecastService from '../services/forecastService.js'

/**
 * Demo script to test forecast functionality in the frontend
 */
async function testForecastFrontend() {
  console.log('🧪 Testing Frontend Forecast Integration...\n')

  try {
    // Test 1: Demand Forecast
    console.log('1️⃣ Testing Demand Forecast...')
    const demandData = await forecastService.getDemandForecast()
    console.log('✅ Demand forecast:', {
      totalDemand: demandData.summary?.totalForecastUnits || 0,
      confidence: demandData.metadata?.confidence || 'N/A',
      forecastPeriod: demandData.forecastPeriod?.days || 7
    })

    // Test 2: Revenue Prediction
    console.log('\n2️⃣ Testing Revenue Prediction...')
    const revenueData = await forecastService.getRevenuePrediction()
    console.log('✅ Revenue prediction:', {
      totalRevenue: revenueData.totalRevenue || 0,
      margin: revenueData.grossMargin || 'N/A',
      period: revenueData.forecastPeriod || 14
    })

    // Test 3: Seasonal Analysis
    console.log('\n3️⃣ Testing Seasonal Analysis...')
    const seasonalData = await forecastService.getSeasonalTrends()
    console.log('✅ Seasonal analysis:', {
      trends: seasonalData.trends?.length || 0,
      recommendations: seasonalData.recommendations?.length || 0
    })

    // Test 4: Capacity Optimization
    console.log('\n4️⃣ Testing Capacity Optimization...')
    const capacityData = await forecastService.getCapacityOptimization()
    console.log('✅ Capacity optimization:', {
      utilization: capacityData.currentUtilization || 'N/A',
      recommendation: capacityData.recommendation || 'N/A'
    })

    // Test 5: Ingredient Forecast
    console.log('\n5️⃣ Testing Ingredient Forecast...')
    const ingredientData = await forecastService.getIngredientForecast()
    console.log('✅ Ingredient forecast:', {
      period: ingredientData.forecastPeriod || 14,
      cost: ingredientData.estimatedCost || 'N/A',
      ingredients: ingredientData.ingredients?.length || 0
    })

    console.log('\n🎉 All forecast API tests completed successfully!')
    console.log('\n📊 Frontend is ready to display forecast data!')
    
  } catch (error) {
    console.error('❌ Frontend test failed:', error.message)
    console.error('Make sure both backend (port 3003) and frontend (port 3002) are running')
  }
}

export default testForecastFrontend
