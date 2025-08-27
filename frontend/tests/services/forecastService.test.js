import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { forecastService } from '../../src/services/forecastService'

// Mock the api module
vi.mock('../../src/services/api', () => ({
  default: {
    post: vi.fn()
  }
}))

import api from '../../src/services/api'

describe('ForecastService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getDemandForecast', () => {
    it('should call the correct endpoint with default parameters', async () => {
      const mockResponse = {
        data: {
          restaurantId: 1,
          forecastPeriod: { days: 7, startDate: '2025-08-27', endDate: '2025-09-03' },
          itemForecasts: [],
          summary: { totalForecastUnits: 0, dailyAverageUnits: 0 }
        }
      }
      
      api.post.mockResolvedValue(mockResponse)

      const result = await forecastService.getDemandForecast()

      expect(api.post).toHaveBeenCalledWith('/agents/forecast/demand', {
        days: 7,
        menuItems: ['Classic Burger', 'Caesar Salad', 'Margherita Pizza'],
        restaurantId: 1
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle API response with correct data structure', async () => {
      const mockApiResponse = {
        data: {
          restaurantId: 1,
          forecastPeriod: {
            startDate: '2025-08-27T00:00:00.000Z',
            endDate: '2025-09-03T00:00:00.000Z',
            days: 7
          },
          itemForecasts: [
            {
              itemId: 1,
              itemName: 'Classic Burger',
              forecastUnits: 150,
              confidence: 0.85
            }
          ],
          summary: {
            totalItems: 1,
            totalForecastUnits: 150,
            dailyAverageUnits: 21.4,
            averageConfidence: 0.85,
            forecastAccuracy: 'high'
          },
          metadata: {
            modelVersion: '1.0',
            confidence: 0.85,
            generatedAt: '2025-08-27T00:00:00.000Z'
          }
        }
      }

      api.post.mockResolvedValue(mockApiResponse)

      const result = await forecastService.getDemandForecast()

      // Verify the exact data structure we expect in components
      expect(result.forecastPeriod.days).toBe(7)
      expect(result.summary.totalForecastUnits).toBe(150)
      expect(result.summary.dailyAverageUnits).toBe(21.4)
      expect(result.itemForecasts).toHaveLength(1)
      expect(result.itemForecasts[0].itemName).toBe('Classic Burger')
      expect(result.itemForecasts[0].forecastUnits).toBe(150)
    })

    it('should handle custom parameters', async () => {
      const customParams = {
        days: 14,
        menuItems: ['Special Pizza'],
        restaurantId: 2
      }

      api.post.mockResolvedValue({ data: {} })

      await forecastService.getDemandForecast(customParams)

      expect(api.post).toHaveBeenCalledWith('/agents/forecast/demand', customParams)
    })
  })

  describe('getRevenuePrediction', () => {
    it('should handle revenue forecast response structure', async () => {
      const mockApiResponse = {
        data: {
          restaurantId: 1,
          scenario: 'optimistic',
          forecastPeriod: {
            startDate: '2025-08-27T00:00:00.000Z',
            endDate: '2025-09-10T00:00:00.000Z',
            days: 14
          },
          itemRevenues: [
            {
              itemId: 1,
              itemName: 'Classic Burger',
              forecastUnits: 200,
              pricePerUnit: 12.99,
              totalRevenue: 2598,
              totalCost: 900
            }
          ],
          totalProjections: {
            revenue: 2598,
            dailyAverage: 185.57
          },
          profitabilityMetrics: {
            projectedRevenue: 2598,
            projectedCost: 900,
            grossProfit: 1698,
            marginPercentage: 65.35
          },
          insights: [
            {
              type: 'top_performer',
              message: 'Classic Burger projected to generate highest revenue',
              impact: 'high'
            }
          ]
        }
      }

      api.post.mockResolvedValue(mockApiResponse)

      const result = await forecastService.getRevenuePrediction()

      // Test the exact properties our components expect
      expect(result.totalProjections.revenue).toBe(2598)
      expect(result.totalProjections.dailyAverage).toBe(185.57)
      expect(result.profitabilityMetrics.marginPercentage).toBe(65.35)
      expect(result.itemRevenues).toHaveLength(1)
      expect(result.itemRevenues[0].totalRevenue).toBe(2598)
      expect(result.insights).toHaveLength(1)
    })
  })

  describe('getSeasonalTrends', () => {
    it('should handle seasonal trends response structure', async () => {
      const mockApiResponse = {
        data: {
          restaurantId: 1,
          analysisPeriod: {
            months: 12,
            startDate: '2024-08-27T00:00:00.000Z',
            endDate: '2025-08-27T00:00:00.000Z'
          },
          seasonalTrends: {
            spring: { averageGrowth: 10, confidence: 0.8 },
            summer: { averageGrowth: 25, confidence: 0.9 },
            fall: { averageGrowth: 5, confidence: 0.75 },
            winter: { averageGrowth: -10, confidence: 0.7 }
          },
          weeklyPatterns: {
            monday: 0.8,
            friday: 1.3,
            saturday: 1.4
          },
          recommendations: [
            {
              type: 'seasonal',
              priority: 'high',
              recommendation: 'Increase staff during summer peak season',
              impact: 'Revenue increase potential of 25%'
            }
          ]
        }
      }

      api.post.mockResolvedValue(mockApiResponse)

      const result = await forecastService.getSeasonalTrends()

      // Test the seasonal trends object structure
      expect(result.seasonalTrends.spring.averageGrowth).toBe(10)
      expect(result.seasonalTrends.summer.confidence).toBe(0.9)
      expect(result.recommendations).toHaveLength(1)
      expect(result.recommendations[0].recommendation).toContain('summer peak season')
    })
  })

  describe('getCapacityOptimization', () => {
    it('should handle capacity optimization response structure', async () => {
      const mockApiResponse = {
        data: {
          restaurantId: 1,
          currentCapacity: 100,
          forecastPeriod: {
            startDate: '2025-08-27T00:00:00.000Z',
            endDate: '2025-09-26T00:00:00.000Z',
            days: 30
          },
          capacityAnalysis: {
            peakDemand: 3894.8,
            currentCapacity: 100,
            utilizationRate: 0.75,
            recommendation: 'adequate'
          },
          recommendations: [
            {
              priority: 'medium',
              action: 'Adjust staffing from 10 to 12',
              benefit: 'Improved service during peak hours'
            }
          ]
        }
      }

      api.post.mockResolvedValue(mockApiResponse)

      const result = await forecastService.getCapacityOptimization()

      // Test capacity analysis structure
      expect(result.capacityAnalysis.utilizationRate).toBe(0.75)
      expect(result.capacityAnalysis.peakDemand).toBe(3894.8)
      expect(result.capacityAnalysis.recommendation).toBe('adequate')
      expect(result.recommendations).toHaveLength(1)
      expect(result.recommendations[0].priority).toBe('medium')
    })
  })

  describe('getIngredientForecast', () => {
    it('should handle ingredient forecast response structure', async () => {
      const mockApiResponse = {
        data: {
          restaurantId: 1,
          forecastPeriod: {
            startDate: '2025-08-27T00:00:00.000Z',
            endDate: '2025-09-10T00:00:00.000Z',
            days: 14
          },
          ingredientForecasts: [
            {
              ingredient: 'Ground Beef',
              totalNeeded: 100,
              bufferAmount: 15,
              finalQuantity: 115
            },
            {
              ingredient: 'Lettuce',
              totalNeeded: 50,
              bufferAmount: 7.5,
              finalQuantity: 57.5
            }
          ],
          procurementPlan: {
            totalCost: 500,
            orderFrequency: 'weekly',
            suppliers: ['Supplier A', 'Supplier B']
          },
          summary: {
            totalIngredients: 2,
            estimatedCost: 500,
            bufferIncluded: true,
            bufferPercentage: 15
          }
        }
      }

      api.post.mockResolvedValue(mockApiResponse)

      const result = await forecastService.getIngredientForecast()

      // Test ingredient forecast structure
      expect(result.forecastPeriod.days).toBe(14)
      expect(result.ingredientForecasts).toHaveLength(2)
      expect(result.ingredientForecasts[0].ingredient).toBe('Ground Beef')
      expect(result.ingredientForecasts[0].finalQuantity).toBe(115)
      expect(result.summary.bufferPercentage).toBe(15)
      expect(result.procurementPlan.suppliers).toHaveLength(2)
    })
  })

  describe('Error Handling', () => {
    it('should propagate API errors', async () => {
      const apiError = new Error('Network error')
      api.post.mockRejectedValue(apiError)

      await expect(forecastService.getDemandForecast()).rejects.toThrow('Network error')
    })

    it('should handle malformed API responses gracefully', async () => {
      // Test with missing required fields
      const malformedResponse = {
        data: {
          // Missing required fields like restaurantId, forecastPeriod, etc.
          someRandomField: 'value'
        }
      }

      api.post.mockResolvedValue(malformedResponse)

      const result = await forecastService.getDemandForecast()

      // Should still return the data, even if malformed
      expect(result).toEqual(malformedResponse.data)
    })
  })
})
