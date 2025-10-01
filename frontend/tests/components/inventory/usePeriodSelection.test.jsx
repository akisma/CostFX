import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { usePeriodSelection } from '../../../src/components/inventory/PeriodSelector/hooks/usePeriodSelection';
import inventoryReducer from '../../../src/store/slices/inventorySlice';

// Mock data
const mockPeriods = [
  {
    id: '1',
    periodName: 'Weekly Period Jan 1-7',
    periodType: 'weekly',
    periodStart: '2024-01-01T00:00:00Z',
    periodEnd: '2024-01-07T23:59:59Z',
    status: 'active',
    description: 'First week of January'
  },
  {
    id: '2',
    periodName: 'Monthly Period January',
    periodType: 'monthly',
    periodStart: '2024-01-01T00:00:00Z',
    periodEnd: '2024-01-31T23:59:59Z',
    status: 'draft',
    description: 'January monthly period'
  },
  {
    id: '3',
    periodName: 'Overlapping Period',
    periodType: 'weekly',
    periodStart: '2024-01-05T00:00:00Z',
    periodEnd: '2024-01-12T23:59:59Z',
    status: 'closed',
    description: 'Period that overlaps with others'
  }
];

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      inventory: inventoryReducer
    },
    preloadedState: {
      inventory: {
        periodSelection: {
          periods: [],
          selectedPeriod: null,
          loading: false,
          error: null,
          ...initialState
        }
      }
    }
  });
};

const wrapper = ({ children, initialState = {} }) => {
  const store = createMockStore(initialState);
  return <Provider store={store}>{children}</Provider>;
};

describe('usePeriodSelection Hook', () => {
  const defaultProps = {
    restaurantId: 'restaurant-123',
    validateOverlap: true,
    onError: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Period Validation', () => {
    it('validates period dates correctly', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      // Create a period that doesn't overlap with existing periods
      const validPeriod = {
        id: 'test-valid',
        periodStart: '2024-02-01T00:00:00Z',
        periodEnd: '2024-02-07T23:59:59Z',
        status: 'active'
      };
      const errors = result.current.validatePeriod(validPeriod);
      
      expect(errors).toEqual([]);
    });

    it('detects period overlaps', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      // Test overlap with existing period
      const overlappingPeriod = {
        id: 'new',
        periodStart: '2024-01-03T00:00:00Z',
        periodEnd: '2024-01-10T23:59:59Z',
        status: 'active'
      };
      
      const errors = result.current.validatePeriod(overlappingPeriod);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('overlaps');
    });

    it('allows overlap with draft periods', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      // Create period that only overlaps with draft period
      const periodOverlappingDraft = {
        id: 'new',
        periodStart: '2024-01-15T00:00:00Z',
        periodEnd: '2024-01-25T23:59:59Z',
        status: 'active'
      };
      
      const errors = result.current.validatePeriod(periodOverlappingDraft);
      
      // Should have no overlap errors since it only overlaps with draft
      const overlapErrors = errors.filter(e => e.includes('overlap'));
      expect(overlapErrors).toHaveLength(0);
    });

    it('validates date range correctly', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper }
      );

      const startDate = new Date('2024-02-01');
      const endDate = new Date('2024-02-07');
      
      const errors = result.current.validateDateRange(startDate, endDate);
      
      expect(errors).toEqual([]);
    });

    it('detects invalid date ranges', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper }
      );

      const startDate = new Date('2024-02-07');
      const endDate = new Date('2024-02-01'); // End before start
      
      const errors = result.current.validateDateRange(startDate, endDate);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Start date must be before end date');
    });
  });

  describe('Period Filtering', () => {
    it('filters periods by type', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      const filters = { periodTypes: ['weekly'] };
      const filtered = result.current.getFilteredPeriods(filters);
      
      expect(filtered).toHaveLength(2); // Two weekly periods
      expect(filtered.every(p => p.periodType === 'weekly')).toBe(true);
    });

    it('filters periods by status', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      const filters = { statusFilter: ['active'] };
      const filtered = result.current.getFilteredPeriods(filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].status).toBe('active');
    });

    it('filters periods by search term', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      const filters = { searchTerm: 'Weekly' };
      const filtered = result.current.getFilteredPeriods(filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered.every(p => p.periodName.includes('Weekly'))).toBe(true);
    });

    it('limits results correctly', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      const filters = { maxPeriods: 2 };
      const filtered = result.current.getFilteredPeriods(filters);
      
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Period Selection', () => {
    it('selects valid period successfully', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      // Create a period that doesn't overlap with existing periods
      const validPeriod = {
        id: 'test-select',
        periodStart: '2024-03-01T00:00:00Z',
        periodEnd: '2024-03-07T23:59:59Z',
        status: 'active'
      };
      const response = result.current.selectPeriod(validPeriod);
      
      expect(response.success).toBe(true);
      expect(response.period).toEqual(validPeriod);
    });

    it('rejects invalid period selection', () => {
      const onError = vi.fn();
      const { result } = renderHook(
        () => usePeriodSelection({ ...defaultProps, onError }),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      // Create invalid period (overlapping)
      const invalidPeriod = {
        id: 'invalid',
        periodStart: '2024-01-03T00:00:00Z',
        periodEnd: '2024-01-10T23:59:59Z',
        status: 'active'
      };
      
      const response = result.current.selectPeriod(invalidPeriod);
      
      expect(response.success).toBe(false);
      expect(response.errors.length).toBeGreaterThan(0);
      expect(onError).toHaveBeenCalled();
    });

    it('handles null period selection', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper }
      );

      const response = result.current.selectPeriod(null);
      
      expect(response.success).toBe(true);
      expect(response.period).toBe(null);
    });
  });

  describe('Custom Range Validation', () => {
    it('validates custom range successfully', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper }
      );

      const startDate = new Date('2024-03-01');
      const endDate = new Date('2024-03-07');
      
      const response = result.current.validateCustomRange(startDate, endDate);
      
      expect(response.success).toBe(true);
      expect(response.range).toEqual({ from: startDate, to: endDate });
    });

    it('rejects invalid custom range', () => {
      const onError = vi.fn();
      const { result } = renderHook(
        () => usePeriodSelection({ ...defaultProps, onError }),
        { wrapper }
      );

      const startDate = new Date('2024-03-07');
      const endDate = new Date('2024-03-01'); // Invalid: end before start
      
      const response = result.current.validateCustomRange(startDate, endDate);
      
      expect(response.success).toBe(false);
      expect(response.errors.length).toBeGreaterThan(0);
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Period Statistics', () => {
    it('calculates period statistics correctly', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      const stats = result.current.periodStats;
      
      expect(stats.total).toBe(3);
      expect(stats.byStatus.active).toBe(1);
      expect(stats.byStatus.draft).toBe(1);
      expect(stats.byStatus.closed).toBe(1);
      expect(stats.byType.weekly).toBe(2);
      expect(stats.byType.monthly).toBe(1);
    });
  });

  describe('Validation Status', () => {
    it('returns correct validation status for valid period', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      const validPeriod = {
        id: 'valid',
        periodStart: '2024-03-01T00:00:00Z',
        periodEnd: '2024-03-07T23:59:59Z',
        status: 'active'
      };
      
      const status = result.current.getValidationStatus(validPeriod);
      
      expect(status.isValid).toBe(true);
      expect(status.errors).toHaveLength(0);
      expect(status.status).toBe('valid');
    });

    it('returns correct validation status for overlapping period', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      const overlappingPeriod = {
        id: 'overlap',
        periodStart: '2024-01-03T00:00:00Z',
        periodEnd: '2024-01-10T23:59:59Z',
        status: 'active'
      };
      
      const status = result.current.getValidationStatus(overlappingPeriod);
      
      expect(status.isValid).toBe(false);
      expect(status.errors.length).toBeGreaterThan(0);
      expect(status.status).toBe('overlap');
    });
  });

  describe('Period Can Select', () => {
    it('allows selection of valid period', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      const validPeriod = {
        id: 'valid',
        periodStart: '2024-03-01T00:00:00Z',
        periodEnd: '2024-03-07T23:59:59Z',
        status: 'active'
      };
      
      const canSelect = result.current.canSelectPeriod(validPeriod);
      
      expect(canSelect).toBe(true);
    });

    it('prevents selection of overlapping period', () => {
      const { result } = renderHook(
        () => usePeriodSelection(defaultProps),
        { wrapper: ({ children }) => wrapper({ children, initialState: { periods: mockPeriods } }) }
      );

      const overlappingPeriod = {
        id: 'overlap',
        periodStart: '2024-01-03T00:00:00Z',
        periodEnd: '2024-01-10T23:59:59Z',
        status: 'active'
      };
      
      const canSelect = result.current.canSelectPeriod(overlappingPeriod);
      
      expect(canSelect).toBe(false);
    });
  });
});
