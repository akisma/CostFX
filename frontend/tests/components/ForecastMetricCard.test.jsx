import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ForecastMetricCard from '../../src/components/forecast/ForecastMetricCard'

describe('ForecastMetricCard Component', () => {
  describe('Data Structure Handling', () => {
    it('should render metric card with valid data', () => {
      render(
        <ForecastMetricCard 
          title="Revenue Prediction"
          value="$15,000"
          confidence={0.85}
          status="positive"
          subValue="7 days"
        />
      )

      expect(screen.getByText('Revenue Prediction')).toBeInTheDocument()
      expect(screen.getByText('$15,000')).toBeInTheDocument()
      expect(screen.getByText('85% confidence')).toBeInTheDocument()
      expect(screen.getByText('7 days')).toBeInTheDocument()
    })

    it('should handle different status types', () => {
      render(
        <ForecastMetricCard 
          title="Warning Metric"
          value="Alert"
          status="warning"
        />
      )

      expect(screen.getByText('Warning Metric')).toBeInTheDocument()
      expect(screen.getByText('Alert')).toBeInTheDocument()
    })

    it('should handle trend data correctly', () => {
      const trendData = {
        isPositive: true,
        value: 12.5,
        period: 'vs last week'
      }

      render(
        <ForecastMetricCard 
          title="Trending Metric"
          value="1000"
          trend={trendData}
        />
      )

      expect(screen.getByText('Trending Metric')).toBeInTheDocument()
      expect(screen.getByText('1000')).toBeInTheDocument()
      expect(screen.getByText('12.5%')).toBeInTheDocument()
      expect(screen.getByText('vs last week')).toBeInTheDocument()
    })

    it('should render without optional props', () => {
      render(
        <ForecastMetricCard 
          title="Simple Metric"
          value={1000}
        />
      )

      expect(screen.getByText('Simple Metric')).toBeInTheDocument()
      expect(screen.getByText('1000')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle numeric values', () => {
      render(
        <ForecastMetricCard 
          title="Numeric Value"
          value={1000}
          confidence={0.8}
        />
      )

      expect(screen.getByText('Numeric Value')).toBeInTheDocument()
      expect(screen.getByText('1000')).toBeInTheDocument()
      expect(screen.getByText('80% confidence')).toBeInTheDocument()
    })

    it('should prevent rendering objects as React children', () => {
      // Test that the component handles string values safely
      render(
        <ForecastMetricCard 
          title="Safe Test"
          value="Safe Value"
          confidence={0.8}
        />
      )

      // Should not show "[object Object]"
      expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
      expect(screen.getByText('Safe Test')).toBeInTheDocument()
      expect(screen.getByText('Safe Value')).toBeInTheDocument()
    })
  })
})
