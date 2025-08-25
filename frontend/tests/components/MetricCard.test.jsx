import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DollarSign } from 'lucide-react'
import MetricCard from '../../src/components/dashboard/MetricCard'

describe('MetricCard Component', () => {
  const basicProps = {
    title: 'Total Revenue',
    value: '$45,650',
    icon: DollarSign,
    color: 'blue'
  }

  it('renders the basic metric card correctly', () => {
    render(<MetricCard {...basicProps} />)
    
    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    expect(screen.getByText('$45,650')).toBeInTheDocument()
  })

  it('renders positive trend correctly', () => {
    const positiveProps = {
      ...basicProps,
      trend: { value: 12.5, isPositive: true }
    }
    
    render(<MetricCard {...positiveProps} />)
    
    // Check that trend percentage is displayed (the value is split with %)
    expect(screen.getByText(/12\.5/)).toBeInTheDocument()
    expect(screen.getByText(/%/)).toBeInTheDocument()
    
    // Should have positive styling - check for green text color in span
    const trendSpan = screen.getByText(/12\.5/).closest('span')
    expect(trendSpan).toHaveClass('text-green-600')
  })

  it('renders negative trend correctly', () => {
    const negativeProps = {
      ...basicProps,
      trend: { value: -5.2, isPositive: false }
    }
    
    render(<MetricCard {...negativeProps} />)
    
    // Check that trend percentage is displayed (the value is split with %)
    expect(screen.getByText(/-5\.2/)).toBeInTheDocument()
    expect(screen.getByText(/%/)).toBeInTheDocument()
    
    // Should have negative styling - check for red text color in span
    const trendSpan = screen.getByText(/-5\.2/).closest('span')
    expect(trendSpan).toHaveClass('text-red-600')
  })

  it('renders without trend when not provided', () => {
    render(<MetricCard {...basicProps} />)
    
    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    expect(screen.getByText('$45,650')).toBeInTheDocument()
    // Trend section should not exist
    expect(screen.queryByText(/vs last week/)).not.toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(<MetricCard {...basicProps} />)
    
    // The icon should be rendered as an SVG - find by class or container
    const iconContainer = document.querySelector('.lucide-dollar-sign')
    expect(iconContainer).toBeInTheDocument()
  })

  it('applies correct color styling', () => {
    const greenProps = { ...basicProps, color: 'green' }
    render(<MetricCard {...greenProps} />)
    
    // Find the icon container and check it has green styling
    const iconContainer = document.querySelector('.bg-green-50')
    expect(iconContainer).toBeInTheDocument()
    expect(iconContainer).toHaveClass('text-green-600')
  })
})
