/* eslint-disable react/prop-types */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from '../../src/components/dashboard/Dashboard.jsx';

// Mock recharts to avoid canvas issues in tests
vi.mock('recharts', () => ({
  AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
}));

// Mock the child components
vi.mock('../../src/components/dashboard/MetricCard', () => ({
  default: ({ title, value }) => (
    <div data-testid="metric-card">
      <span>{title}</span>
      <span>{value}</span>
    </div>
  )
}));

vi.mock('../../src/components/dashboard/ChartContainer', () => ({
  default: ({ title, children }) => (
    <div data-testid="chart-container">
      <span>{title}</span>
      {children}
    </div>
  )
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    render(<Dashboard />)
    
    // Should show loading state initially (check for spinner)
    expect(document.querySelector('.spinner')).toBeInTheDocument()
  })

  it('renders dashboard metrics after loading', async () => {
    render(<Dashboard />)
    
    // Wait for the loading to complete (simulated timeout in component)
    await waitFor(() => {
      expect(document.querySelector('.spinner')).not.toBeInTheDocument()
    }, { timeout: 2000 })

    // Should render metric cards
    const metricCards = screen.getAllByTestId('metric-card')
    expect(metricCards.length).toBeGreaterThan(0)
  })

  it('displays recent activity section', async () => {
    render(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText(/recent activity/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('displays alerts section', async () => {
    render(<Dashboard />)
    
    await waitFor(() => {
      // Look for specific alert messages that should be present
      expect(screen.getByText(/order more olive oil/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('shows revenue metrics', async () => {
    render(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getByText(/revenue/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('shows waste percentage metrics', async () => {
    render(<Dashboard />)
    
    await waitFor(() => {
      // Look specifically for the "Waste Percentage" metric card title
      expect(screen.getByText('Waste Percentage')).toBeInTheDocument()
    }, { timeout: 2000 })
  })
})
