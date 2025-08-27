import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ForecastView from '../../src/components/analysis/ForecastView'

// Mock the forecast service
vi.mock('../../src/services/forecastService', () => ({
  default: {
    getDemandForecast: vi.fn(),
    getRevenuePrediction: vi.fn(),
    getSeasonalTrends: vi.fn(),
    getCapacityOptimization: vi.fn(),
    getIngredientForecast: vi.fn()
  }
}))

import forecastService from '../../src/services/forecastService'

describe('ForecastView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Data Structure Handling', () => {
    it('should handle demand forecast data structure correctly', async () => {
      const mockDemandData = {
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
          dailyAverageUnits: 21,
          averageConfidence: 0.85,
          forecastAccuracy: 'high'
        },
        metadata: {
          modelVersion: '1.0',
          confidence: 0.85,
          generatedAt: '2025-08-27T00:00:00.000Z'
        }
      }

      forecastService.getDemandForecast.mockResolvedValue(mockDemandData)
      
      render(<ForecastView />)

      // Wait for the component to load data
      await waitFor(() => {
        expect(screen.getByText('150 units')).toBeInTheDocument()
        expect(screen.getByText('7 days')).toBeInTheDocument()
        expect(screen.getByText('21 units')).toBeInTheDocument()
      })

      // Verify no "[object Object]" appears
      expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
    })

    it('should handle revenue forecast data structure correctly', async () => {
      const mockRevenueData = {
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
          dailyAverage: 186
        },
        profitabilityMetrics: {
          projectedRevenue: 2598,
          projectedCost: 900,
          grossProfit: 1698,
          marginPercentage: 65.35
        }
      }

      forecastService.getRevenuePrediction.mockResolvedValue(mockRevenueData)
      
      render(<ForecastView />)

      // Switch to revenue tab
      fireEvent.click(screen.getByText('Revenue Prediction'))

      await waitFor(() => {
        expect(screen.getAllByText('$2,598')).toHaveLength(2) // Appears in both metric card and breakdown
        expect(screen.getByText('$186')).toBeInTheDocument()
        expect(screen.getByText('65.3%')).toBeInTheDocument() // From profitabilityMetrics.marginPercentage: 65.35 -> 65.3%
        expect(screen.getByText('65.4% margin')).toBeInTheDocument() // From item breakdown
      })

      // Verify no "[object Object]" appears
      expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
    })

    it('should handle seasonal trends data structure correctly', async () => {
      const mockSeasonalData = {
        restaurantId: 1,
        seasonalTrends: {
          spring: { averageGrowth: 10, confidence: 0.8 },
          summer: { averageGrowth: 25, confidence: 0.9 },
          fall: { averageGrowth: 5, confidence: 0.75 },
          winter: { averageGrowth: -10, confidence: 0.7 }
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

      forecastService.getSeasonalTrends.mockResolvedValue(mockSeasonalData)
      
      render(<ForecastView />)

      // Switch to seasonal tab
      fireEvent.click(screen.getByText('Seasonal Trends'))

      await waitFor(() => {
        expect(screen.getByText('Spring')).toBeInTheDocument()
        expect(screen.getByText('+10%')).toBeInTheDocument()
        expect(screen.getByText('80% confidence')).toBeInTheDocument()
        expect(screen.getByText('-10%')).toBeInTheDocument() // Winter decline
      })

      // Verify no "[object Object]" appears
      expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
    })

    it('should handle capacity planning data structure correctly', async () => {
      const mockCapacityData = {
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

      forecastService.getCapacityOptimization.mockResolvedValue(mockCapacityData)
      
      render(<ForecastView />)

      // Switch to capacity tab
      fireEvent.click(screen.getByText('Capacity Planning'))

      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument()
        expect(screen.getByText('3,895 units')).toBeInTheDocument()
        expect(screen.getByText('adequate')).toBeInTheDocument()
      })

      // Verify no "[object Object]" appears
      expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
    })

    it('should handle ingredient planning data structure correctly', async () => {
      const mockIngredientData = {
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

      forecastService.getIngredientForecast.mockResolvedValue(mockIngredientData)
      
      render(<ForecastView />)

      // Switch to ingredients tab
      fireEvent.click(screen.getByText('Ingredient Planning'))

      await waitFor(() => {
        expect(screen.getByText('14 days')).toBeInTheDocument()
        expect(screen.getByText('15%')).toBeInTheDocument()
        expect(screen.getAllByText('$500')).toHaveLength(2) // Multiple $500 values expected
        expect(screen.getByText('Ground Beef')).toBeInTheDocument()
      })

      // Verify no "[object Object]" appears
      expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty/null data gracefully', async () => {
      const emptyData = {
        restaurantId: 1,
        forecastPeriod: { days: 0 },
        itemForecasts: [],
        summary: {
          totalItems: 0,
          totalForecastUnits: 0,
          dailyAverageUnits: 0
        }
      }

      forecastService.getDemandForecast.mockResolvedValue(emptyData)
      
      render(<ForecastView />)

      await waitFor(() => {
        expect(screen.getAllByText('0 units')).toHaveLength(2) // Multiple 0 units expected
        // Component should render without crashing, even with empty data
        expect(screen.getByText('Forecast Intelligence')).toBeInTheDocument()
      })

      // Should not crash or show "[object Object]"
      expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
    })

    it('should handle missing nested properties gracefully', async () => {
      const malformedData = {
        restaurantId: 1,
        // Missing forecastPeriod, summary, etc.
      }

      forecastService.getDemandForecast.mockResolvedValue(malformedData)
      
      render(<ForecastView />)

      await waitFor(() => {
        // Should show default values, not crash
        expect(screen.getAllByText('0 units')).toHaveLength(2) // Multiple 0 units expected
        // Component should render without crashing
        expect(screen.getByText('Forecast Intelligence')).toBeInTheDocument()
      })

      // Should not show "[object Object]"
      expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
    })

    it('should display error message when API call fails', async () => {
      forecastService.getDemandForecast.mockRejectedValue(new Error('API Error'))
      
      render(<ForecastView />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load demand forecast/)).toBeInTheDocument()
      })
    })

    it('should handle refresh button correctly', async () => {
      forecastService.getDemandForecast.mockResolvedValue({
        summary: { totalForecastUnits: 100 },
        forecastPeriod: { days: 7 }
      })
      
      render(<ForecastView />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('100 units')).toBeInTheDocument()
      })

      // Click refresh
      fireEvent.click(screen.getByText('Refresh'))

      // Should call the service again
      await waitFor(() => {
        expect(forecastService.getDemandForecast).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Number Formatting', () => {
    it('should format large numbers with commas', async () => {
      const mockData = {
        summary: { totalForecastUnits: 12345 },
        forecastPeriod: { days: 30 },
        totalProjections: { revenue: 98765.43 }
      }

      forecastService.getDemandForecast.mockResolvedValue(mockData)
      
      render(<ForecastView />)

      await waitFor(() => {
        expect(screen.getByText('12,345 units')).toBeInTheDocument()
      })
    })

    it('should handle percentage calculations correctly', async () => {
      const mockCapacityData = {
        capacityAnalysis: {
          utilizationRate: 0.8567 // Should round to 86%
        }
      }

      forecastService.getCapacityOptimization.mockResolvedValue(mockCapacityData)
      
      render(<ForecastView />)

      fireEvent.click(screen.getByText('Capacity Planning'))

      await waitFor(() => {
        expect(screen.getByText('86%')).toBeInTheDocument()
      })
    })
  })
})
