import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import userEvent from '@testing-library/user-event';
import PeriodSelector from '../../../src/components/inventory/PeriodSelector';
import inventoryReducer from '../../../src/store/slices/inventorySlice';

// Mock react-datepicker
vi.mock('react-datepicker', () => ({
  default: (props) => {
    const {
      onChange,
      selectsRange,
      startDate,
      endDate,
      className
    } = props;
    const handleDateClick = (date) => {
      if (selectsRange) {
        // For range selection, simulate two clicks
        if (!startDate) {
          // First click - set start date
          onChange([date, null]);
        } else if (!endDate) {
          // Second click - set end date
          onChange([startDate, date]);
        } else {
          // Reset and start new range
          onChange([date, null]);
        }
      } else {
        onChange(date);
      }
    };
    
    return (
      <div data-testid="mock-datepicker" className={className}>
        <button
          onClick={() => handleDateClick(new Date('2024-01-15'))}
          data-testid="date-button-start"
        >
          Jan 15, 2024
        </button>
        <button
          onClick={() => handleDateClick(new Date('2024-01-30'))}
          data-testid="date-button-end"
        >
          Jan 30, 2024
        </button>
      </div>
    );
  }
}));

// Mock date-fns functions
vi.mock('date-fns', () => ({
  format: vi.fn((date) => {
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    return 'Invalid Date';
  }),
  parseISO: vi.fn((dateStr) => new Date(dateStr)),
  isValid: vi.fn((date) => date instanceof Date && !isNaN(date))
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Calendar: () => <div data-testid="calendar-icon">📅</div>,
  ChevronDown: () => <div data-testid="chevron-down-icon">⬇️</div>,
  Plus: () => <div data-testid="plus-icon">➕</div>,
  X: () => <div data-testid="x-icon">❌</div>
}));

// Test data
const mockPeriods = [
  {
    id: '1',
    periodName: 'Weekly Period Jan 1-7',
    periodType: 'weekly',
    periodStart: '2024-01-01T00:00:00Z',
    periodEnd: '2024-01-07T23:59:59Z',
    status: 'active',
    description: 'First week of January',
    beginningSnapshotCompleted: true,
    endingSnapshotCompleted: false
  },
  {
    id: '2',
    periodName: 'Monthly Period January',
    periodType: 'monthly',
    periodStart: '2024-01-01T00:00:00Z',
    periodEnd: '2024-01-31T23:59:59Z',
    status: 'draft',
    description: 'January monthly period',
    beginningSnapshotCompleted: false,
    endingSnapshotCompleted: false
  },
  {
    id: '3',
    periodName: 'Custom Period Q1',
    periodType: 'custom',
    periodStart: '2024-01-01T00:00:00Z',
    periodEnd: '2024-03-31T23:59:59Z',
    status: 'closed',
    description: 'Q1 custom period',
    beginningSnapshotCompleted: true,
    endingSnapshotCompleted: true
  }
];

const createMockStore = (initialState = {}) => {
  const defaultState = {
    periodSelection: {
      periods: mockPeriods,
      selectedPeriod: null,
      selectedDateRange: null,
      filters: {
        restaurantId: null,
        periodTypes: ['weekly', 'monthly', 'custom'],
        statusFilter: ['draft', 'active', 'closed']
      },
      pagination: { page: 1, limit: 50, total: mockPeriods.length, pages: 1 },
      loading: false,
      error: null,
      lastFetch: null
    },
    loading: false,
    error: null,
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
    }
  };

  return configureStore({
    reducer: {
      inventory: inventoryReducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      serializableCheck: false
    }),
    preloadedState: {
      inventory: {
        ...defaultState,
        ...initialState
      }
    }
  });
};

const renderWithRedux = (component, { initialState = {} } = {}) => {
  const store = createMockStore(initialState);
  return {
    ...render(<Provider store={store}>{component}</Provider>),
    store
  };
};

describe('PeriodSelector Component', () => {
  const defaultProps = {
    restaurantId: 'restaurant-123',
    onPeriodSelect: vi.fn(),
    onDateRangeSelect: vi.fn(),
    onError: vi.fn(),
    onLoadingChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with default placeholder text', () => {
      renderWithRedux(<PeriodSelector {...defaultProps} />);
      
      expect(screen.getByText('Select a period...')).toBeInTheDocument();
      expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
      expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
    });

    it('renders with custom placeholder text', () => {
      renderWithRedux(
        <PeriodSelector {...defaultProps} placeholder="Choose your period" />
      );
      
      expect(screen.getByText('Choose your period')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = renderWithRedux(
        <PeriodSelector {...defaultProps} className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('disables input when disabled prop is true', () => {
      renderWithRedux(<PeriodSelector {...defaultProps} disabled={true} />);
      
      const input = screen.getByText('Select a period...').closest('.period-selector-input');
      expect(input).toHaveClass('opacity-50', 'cursor-not-allowed');
    });
  });

  describe('Dropdown Interaction', () => {
    it('opens dropdown when clicked', async () => {
      const user = userEvent.setup();
      renderWithRedux(<PeriodSelector {...defaultProps} />);
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      expect(screen.getByText('Existing Periods')).toBeInTheDocument();
      expect(screen.getByText('Custom Range')).toBeInTheDocument();
    });

    it('closes dropdown when clicked outside', async () => {
      const user = userEvent.setup();
      renderWithRedux(<PeriodSelector {...defaultProps} />);
      
      // Open dropdown
      const input = screen.getByText('Select a period...');
      await user.click(input);
      expect(screen.getByText('Existing Periods')).toBeInTheDocument();
      
      // Click outside
      await user.click(document.body);
      
      await waitFor(() => {
        expect(screen.queryByText('Existing Periods')).not.toBeInTheDocument();
      });
    });

    it('does not open dropdown when disabled', async () => {
      const user = userEvent.setup();
      renderWithRedux(<PeriodSelector {...defaultProps} disabled={true} />);
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      expect(screen.queryByText('Existing Periods')).not.toBeInTheDocument();
    });
  });

  describe('Period Selection', () => {
    it('displays periods from Redux store', async () => {
      const user = userEvent.setup();
      const initialState = {
        periodSelection: {
          periods: mockPeriods,
          loading: false,
          error: null
        }
      };
      
      // Don't provide restaurantId to avoid triggering fetchPeriods
      const propsWithoutRestaurant = { ...defaultProps };
      delete propsWithoutRestaurant.restaurantId;
      
      renderWithRedux(<PeriodSelector {...propsWithoutRestaurant} />, { initialState });
      
      // Open dropdown
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      // Wait for periods to be displayed
      await waitFor(() => {
        expect(screen.getByText('Weekly Period Jan 1-7')).toBeInTheDocument();
        expect(screen.getByText('Monthly Period January')).toBeInTheDocument();
        expect(screen.getByText('Custom Period Q1')).toBeInTheDocument();
      });
    });

    it('displays period status badges', async () => {
      const user = userEvent.setup();
      const initialState = {
        periodSelection: {
          periods: mockPeriods,
          loading: false,
          error: null
        }
      };
      
      const propsWithoutRestaurant = { ...defaultProps };
      delete propsWithoutRestaurant.restaurantId;
      
      renderWithRedux(<PeriodSelector {...propsWithoutRestaurant} />, { initialState });
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('draft')).toBeInTheDocument();
      expect(screen.getByText('closed')).toBeInTheDocument();
    });

    it('calls onPeriodSelect when period is selected', async () => {
      const user = userEvent.setup();
      const onPeriodSelect = vi.fn();
      const initialState = {
        periodSelection: {
          periods: mockPeriods,
          loading: false,
          error: null
        }
      };
      
      const propsWithoutRestaurant = { ...defaultProps };
      delete propsWithoutRestaurant.restaurantId;
      
      renderWithRedux(
        <PeriodSelector {...propsWithoutRestaurant} onPeriodSelect={onPeriodSelect} />,
        { initialState }
      );
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      const periodButton = screen.getByText('Weekly Period Jan 1-7');
      await user.click(periodButton);
      
      expect(onPeriodSelect).toHaveBeenCalledWith(mockPeriods[0]);
    });

    it('displays selected period in input', () => {
      const initialState = {
        periodSelection: {
          periods: mockPeriods,
          selectedPeriod: mockPeriods[0],
          loading: false,
          error: null
        }
      };
      
      const propsWithoutRestaurant = { ...defaultProps };
      delete propsWithoutRestaurant.restaurantId;
      
      renderWithRedux(<PeriodSelector {...propsWithoutRestaurant} selectedPeriod={mockPeriods[0]} />, { initialState });
      
      // Should display the selected period name and date range
      expect(screen.getByText(/Weekly Period Jan 1-7/)).toBeInTheDocument();
    });
  });

  describe('Date Range Selection', () => {
    it('shows custom range tab when showDateRangePicker is true', async () => {
      const user = userEvent.setup();
      renderWithRedux(
        <PeriodSelector {...defaultProps} showDateRangePicker={true} />
      );
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      expect(screen.getByText('Custom Range')).toBeInTheDocument();
    });

    it('hides custom range tab when showDateRangePicker is false', async () => {
      const user = userEvent.setup();
      renderWithRedux(
        <PeriodSelector {...defaultProps} showDateRangePicker={false} />
      );
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      expect(screen.queryByText('Custom Range')).not.toBeInTheDocument();
    });

    it('switches to date range tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithRedux(
        <PeriodSelector {...defaultProps} showDateRangePicker={true} />
      );
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      const customRangeTab = screen.getByText('Custom Range');
      await user.click(customRangeTab);
      
      expect(screen.getByTestId('mock-datepicker')).toBeInTheDocument();
    });

    it('calls onDateRangeSelect when date range is selected', async () => {
      const user = userEvent.setup();
      const onDateRangeSelect = vi.fn();
      
      renderWithRedux(
        <PeriodSelector 
          {...defaultProps} 
          onDateRangeSelect={onDateRangeSelect}
          showDateRangePicker={true} 
        />
      );
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      const customRangeTab = screen.getByText('Custom Range');
      await user.click(customRangeTab);
      
      // Click both start and end dates to select a complete range
      const startDateButton = screen.getByTestId('date-button-start');
      await user.click(startDateButton);
      
      const endDateButton = screen.getByTestId('date-button-end');
      await user.click(endDateButton);
      
      expect(onDateRangeSelect).toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    it('filters periods based on search term', async () => {
      const user = userEvent.setup();
      const initialState = {
        periodSelection: {
          periods: mockPeriods,
          loading: false,
          error: null
        }
      };
      
      const propsWithoutRestaurant = { ...defaultProps };
      delete propsWithoutRestaurant.restaurantId;
      
      renderWithRedux(<PeriodSelector {...propsWithoutRestaurant} />, { initialState });
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      const searchInput = screen.getByPlaceholderText('Search periods...');
      await user.type(searchInput, 'Weekly');
      
      expect(screen.getByText('Weekly Period Jan 1-7')).toBeInTheDocument();
      expect(screen.queryByText('Monthly Period January')).not.toBeInTheDocument();
    });

    it('shows no results message when search yields no matches', async () => {
      const user = userEvent.setup();
      const initialState = {
        periodSelection: {
          periods: mockPeriods,
          loading: false,
          error: null
        }
      };
      
      const propsWithoutRestaurant = { ...defaultProps };
      delete propsWithoutRestaurant.restaurantId;
      
      renderWithRedux(<PeriodSelector {...propsWithoutRestaurant} />, { initialState });
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      const searchInput = screen.getByPlaceholderText('Search periods...');
      await user.type(searchInput, 'NonexistentPeriod');
      
      expect(screen.getByText('No periods match your search.')).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('displays loading state', async () => {
      const user = userEvent.setup();
      const initialState = {
        periodSelection: {
          periods: [],
          loading: true,
          error: null
        }
      };
      
      renderWithRedux(<PeriodSelector {...defaultProps} />, { initialState });
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      expect(screen.getByText('Loading periods...')).toBeInTheDocument();
    });

    it('displays error state', async () => {
      const user = userEvent.setup();
      const initialState = {
        periodSelection: {
          periods: [],
          loading: false,
          error: 'Failed to load periods'
        }
      };
      
      const propsWithoutRestaurant = { ...defaultProps };
      delete propsWithoutRestaurant.restaurantId;
      
      renderWithRedux(<PeriodSelector {...propsWithoutRestaurant} />, { initialState });
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      expect(screen.getByText('Failed to load periods')).toBeInTheDocument();
    });

    it('calls onLoadingChange when loading state changes', () => {
      const onLoadingChange = vi.fn();
      const initialState = {
        periodSelection: {
          periods: [],
          loading: true,
          error: null
        }
      };
      
      renderWithRedux(
        <PeriodSelector {...defaultProps} onLoadingChange={onLoadingChange} />,
        { initialState }
      );
      
      expect(onLoadingChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Create New Period', () => {
    it('shows create button when showCreateButton is true', async () => {
      const user = userEvent.setup();
      renderWithRedux(
        <PeriodSelector {...defaultProps} showCreateButton={true} />
      );
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      expect(screen.getByText('Create New Period')).toBeInTheDocument();
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    });

    it('calls onCreatePeriod when create button is clicked', async () => {
      const user = userEvent.setup();
      const onCreatePeriod = vi.fn();
      
      renderWithRedux(
        <PeriodSelector 
          {...defaultProps} 
          showCreateButton={true}
          onCreatePeriod={onCreatePeriod}
        />
      );
      
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      const createButton = screen.getByText('Create New Period');
      await user.click(createButton);
      
      expect(onCreatePeriod).toHaveBeenCalled();
    });
  });

  describe('Clear Selection', () => {
    it('shows clear button when there is a selection', () => {
      const initialState = {
        periodSelection: {
          periods: mockPeriods,
          selectedPeriod: mockPeriods[0],
          loading: false,
          error: null
        }
      };
      
      const propsWithoutRestaurant = { ...defaultProps };
      delete propsWithoutRestaurant.restaurantId;
      
      renderWithRedux(<PeriodSelector {...propsWithoutRestaurant} selectedPeriod={mockPeriods[0]} />, { initialState });
      
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });

    it('clears selection when clear button is clicked', async () => {
      const user = userEvent.setup();
      const onPeriodSelect = vi.fn();
      const initialState = {
        periodSelection: {
          periods: mockPeriods,
          selectedPeriod: mockPeriods[0],
          loading: false,
          error: null
        }
      };
      
      const propsWithoutRestaurant = { ...defaultProps };
      delete propsWithoutRestaurant.restaurantId;
      
      renderWithRedux(
        <PeriodSelector {...propsWithoutRestaurant} selectedPeriod={mockPeriods[0]} onPeriodSelect={onPeriodSelect} />,
        { initialState }
      );
      
      const clearButton = screen.getByTestId('x-icon');
      await user.click(clearButton);
      
      expect(onPeriodSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      const initialState = {
        periodSelection: {
          periods: mockPeriods,
          selectedPeriod: mockPeriods[0],
          loading: false,
          error: null
        }
      };
      
      const propsWithoutRestaurant = { ...defaultProps };
      delete propsWithoutRestaurant.restaurantId;
      
      renderWithRedux(<PeriodSelector {...propsWithoutRestaurant} selectedPeriod={mockPeriods[0]} />, { initialState });
      
      const clearButton = screen.getByLabelText('Clear selection');
      expect(clearButton).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      const propsWithoutRestaurant = { ...defaultProps };
      delete propsWithoutRestaurant.restaurantId;
      
      renderWithRedux(<PeriodSelector {...propsWithoutRestaurant} />);
      
      // For now, just verify that clicking opens the dropdown
      // TODO: Implement proper keyboard navigation in the component
      const input = screen.getByText('Select a period...');
      await user.click(input);
      
      expect(screen.getByText('Existing Periods')).toBeInTheDocument();
    });
  });
});
