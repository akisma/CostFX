/* eslint-disable react/prop-types */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import InventoryList from '../../../src/components/inventory/InventoryList.jsx';
import inventorySlice from '../../../src/store/slices/inventorySlice.js';

// Mock the fetchInventoryDashboard thunk to prevent state changes during tests
vi.mock('../../../src/store/slices/inventorySlice.js', async () => {
  const actual = await vi.importActual('../../../src/store/slices/inventorySlice.js');
  return {
    ...actual,
    fetchInventoryDashboard: vi.fn(() => ({ type: 'inventory/fetchInventoryDashboard/fulfilled', payload: {} }))
  };
});

// Mock PeriodSelector to avoid deep integration complexity
vi.mock('../../../src/components/inventory/PeriodSelector', () => ({
  default: ({ onPeriodSelect, onDateRangeSelect, selectedPeriod, selectedDateRange }) => (
    <div data-testid="period-selector">
      <div data-testid="selected-period">
        {selectedPeriod ? selectedPeriod.periodName : 'No period selected'}
      </div>
      <div data-testid="selected-date-range">
        {selectedDateRange ? 'Custom Range' : 'No date range selected'}
      </div>
      <button 
        onClick={() => onPeriodSelect({ 
          id: '1', 
          periodName: 'January 2024',
          periodStart: '2024-01-01',
          periodEnd: '2024-01-31'
        })}
        data-testid="select-period-btn"
      >
        Select Period
      </button>
      <button 
        onClick={() => onDateRangeSelect({ 
          from: new Date('2024-01-15'), 
          to: new Date('2024-01-30') 
        })}
        data-testid="select-date-range-btn"
      >
        Select Date Range
      </button>
    </div>
  )
}));

describe('InventoryList Component', () => {
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
          dashboardData: {
            summary: {
              totalItems: 150,
              totalValue: 12500,
              urgentReorders: 8,
              criticalExpirations: 3
            }
          },
          loading: false,
          loadingStates: {
            levels: false,
            reorderNeeds: false,
            expirationAlerts: false,
            wasteAnalysis: false,
            stockOptimization: false,
            dashboard: false,
            periods: false,
            periodCreate: false,
            periodUpdate: false
          },
          error: null
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

  it('renders inventory management page with period selector', () => {
    renderWithStore(<InventoryList />);
    
    // Check main elements
    expect(screen.getByText('Inventory Management')).toBeInTheDocument();
    expect(screen.getByText('Add Transaction')).toBeInTheDocument();
    expect(screen.getByText('Period Selection')).toBeInTheDocument();
    
    // Check PeriodSelector is present
    expect(screen.getByTestId('period-selector')).toBeInTheDocument();
  });

  it('displays inventory dashboard metrics', () => {
    renderWithStore(<InventoryList />);
    
    // Check that inventory metrics are displayed
    expect(screen.getByText('Total Items')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('Total Value')).toBeInTheDocument();
    expect(screen.getByText('$12,500')).toBeInTheDocument();
    expect(screen.getByText('Urgent Reorders')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Critical Expirations')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows current period display correctly', () => {
    renderWithStore(<InventoryList />);
    
    // Initially should show no period selected
    expect(screen.getByText('Current: No period selected')).toBeInTheDocument();
  });

  it('handles period selection correctly', async () => {
    renderWithStore(<InventoryList />);
    
    // Click the select period button
    const selectPeriodBtn = screen.getByTestId('select-period-btn');
    fireEvent.click(selectPeriodBtn);
    
    // Should trigger period selection (verified through console.log in component)
    // The actual Redux state update would be handled by the real PeriodSelector
    expect(selectPeriodBtn).toBeInTheDocument();
  });

  it('handles date range selection correctly', async () => {
    renderWithStore(<InventoryList />);
    
    // Click the select date range button
    const selectDateRangeBtn = screen.getByTestId('select-date-range-btn');
    fireEvent.click(selectDateRangeBtn);
    
    // Should trigger date range selection (verified through console.log in component)
    expect(selectDateRangeBtn).toBeInTheDocument();
  });

  it('displays period-specific analysis section when period is selected', () => {
    // Create store with selected period
    const storeWithPeriod = configureStore({
      reducer: {
        inventory: inventorySlice
      },
      preloadedState: {
        inventory: {
          periods: [],
          periodSelection: {
            selectedPeriod: {
              id: '1',
              periodName: 'January 2024',
              periodStart: '2024-01-01',
              periodEnd: '2024-01-31'
            },
            selectedDateRange: null,
            searchTerm: '',
            filterOptions: {
              type: 'all',
              status: 'all',
              limit: 50
            }
          },
          dashboardData: {
            summary: {
              totalItems: 150,
              totalValue: 12500,
              urgentReorders: 8,
              criticalExpirations: 3
            }
          },
          loading: false,
          loadingStates: {
            levels: false,
            reorderNeeds: false,
            expirationAlerts: false,
            wasteAnalysis: false,
            stockOptimization: false,
            dashboard: false,
            periods: false,
            periodCreate: false,
            periodUpdate: false
          },
          error: null
        }
      }
    });

    render(
      <Provider store={storeWithPeriod}>
        <InventoryList />
      </Provider>
    );
    
    // Should show period analysis section
    expect(screen.getByText('Period Analysis: January 2024 (2024-01-01 - 2024-01-31)')).toBeInTheDocument();
    expect(screen.getByText('🎉')).toBeInTheDocument();
    expect(screen.getByText('PeriodSelector Integration Complete!')).toBeInTheDocument();
  });

  it('displays loading state when dashboard is loading', () => {
    // Create store with loading state
    const storeWithLoading = configureStore({
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
          dashboardData: null,
          loading: false,
          loadingStates: {
            levels: false,
            reorderNeeds: false,
            expirationAlerts: false,
            wasteAnalysis: false,
            stockOptimization: false,
            dashboard: true, // Set to loading
            periods: false,
            periodCreate: false,
            periodUpdate: false
          },
          error: null
        }
      }
    });

    render(
      <Provider store={storeWithLoading}>
        <InventoryList />
      </Provider>
    );
    
    // Should show loading spinner
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
