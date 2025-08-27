import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ForecastChart from '../../src/components/forecast/ForecastChart'

describe('ForecastChart Component', () => {
  describe('Data Structure Handling', () => {
    it('should handle empty data gracefully', () => {
      render(<ForecastChart data={[]} title="Empty Chart" />)

      expect(screen.getByText('No data available')).toBeInTheDocument()
    })

    it('should handle null data gracefully', () => {
      render(<ForecastChart data={null} title="Null Data Chart" />)

      expect(screen.getByText('No data available')).toBeInTheDocument()
    })

    it('should render with valid data', () => {
      const validData = [
        { label: 'Day 1', value: 100 },
        { label: 'Day 2', value: 120 }
      ]

      render(<ForecastChart data={validData} title="Test Chart" />)

      expect(screen.getByText('Test Chart')).toBeInTheDocument()
      // Component exists and doesn't crash
      expect(screen.queryByText('No data available')).not.toBeInTheDocument()
    })
  })

  describe('Trend Calculation', () => {
    it('should not crash with trend calculation', () => {
      const trendData = [
        { label: 'Start', value: 100 },
        { label: 'End', value: 150 }
      ]

      render(<ForecastChart data={trendData} title="Trend Test" showTrend={true} />)

      expect(screen.getByText('Trend Test')).toBeInTheDocument()
    })
  })
})
