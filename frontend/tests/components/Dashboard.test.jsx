/* eslint-disable react/prop-types */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Dashboard from '../../src/components/dashboard/Dashboard.jsx';
import inventorySlice from '../../src/store/slices/inventorySlice.js';

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

// Mock PeriodSelector to avoid deep Redux integration complexity
vi.mock('../../src/components/inventory/PeriodSelector', () => ({
  default: ({ onPeriodSelect, onDateRangeSelect }) => (
    <div data-testid="period-selector">
      <button 
        onClick={() => onPeriodSelect({ id: '1', periodName: 'Test Period' })}
        data-testid="select-period-btn"
      >
        Select Period
      </button>
      <button 
        onClick={() => onDateRangeSelect({ from: new Date(), to: new Date() })}
        data-testid="select-date-range-btn"
      >
        Select Date Range
      </button>
    </div>
  )
}));

describe('Dashboard Component', () => {
  let store;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a test store with initial state
    store = configureStore({
      reducer: {
        inventory: inventorySlice
      },
      preloadedState: {
        inventory: {
          periods: [],
          periodSelection: {
            selectedPeriod: null,
            selectedDateRange: null,
            searchTerm: '',
            filterOptions: {
              type: 'all',
              status: 'all',
              limit: 50
            }
          },
          dashboard: null,
          loading: {
            periods: false,
            dashboard: false,
            createPeriod: false,
            updatePeriod: false
          },
          error: {
            periods: null,
            dashboard: null,
            createPeriod: null,
            updatePeriod: null
          }
        }
      }
    });
  });

  const renderWithStore = (component) => {
    return render(
      <Provider store={store}>
        {component}
      </Provider>
    );
  };

  it('renders loading state initially', () => {
    renderWithStore(<Dashboard />);
    
    // Should show loading state initially (check for spinner)
    expect(document.querySelector('.spinner')).toBeInTheDocument();
  });

  it('renders dashboard metrics after loading', async () => {
    renderWithStore(<Dashboard />);
    
    // Wait for the loading to complete (simulated timeout in component)
    await waitFor(() => {
      expect(document.querySelector('.spinner')).not.toBeInTheDocument()
    }, { timeout: 2000 })

    // Should render metric cards
    const metricCards = screen.getAllByTestId('metric-card')
    expect(metricCards.length).toBeGreaterThan(0)
  })

  it('displays recent activity section', async () => {
    renderWithStore(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/recent activity/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('displays alerts section', async () => {
    renderWithStore(<Dashboard />);
    
    await waitFor(() => {
      // Look for specific alert messages that should be present
      expect(screen.getByText(/order more olive oil/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('shows revenue metrics', async () => {
    renderWithStore(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/revenue/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('shows waste percentage metrics', async () => {
    renderWithStore(<Dashboard />);
    
    await waitFor(() => {
      // Look specifically for the "Waste Percentage" metric card title
      expect(screen.getByText('Waste Percentage')).toBeInTheDocument();
    }, { timeout: 2000 });
  });
})
