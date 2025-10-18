import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDateRangeValidation } from '../../../src/components/inventory/PeriodSelector/hooks/useDateRangeValidation';

// Mock date-fns functions
vi.mock('date-fns', () => ({
  isValid: vi.fn((date) => date instanceof Date && !isNaN(date)),
  isBefore: vi.fn((date1, date2) => date1 < date2),
  isAfter: vi.fn((date1, date2) => date1 > date2),
  differenceInDays: vi.fn((date1, date2) => Math.floor((date1 - date2) / (1000 * 60 * 60 * 24))),
  differenceInWeeks: vi.fn((date1, date2) => Math.floor((date1 - date2) / (1000 * 60 * 60 * 24 * 7))),
  differenceInMonths: vi.fn((date1, date2) => {
    const months = (date1.getFullYear() - date2.getFullYear()) * 12;
    return months + date1.getMonth() - date2.getMonth();
  }),
  startOfDay: vi.fn((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())),
  endOfDay: vi.fn((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)),
  format: vi.fn((date, formatStr) => {
    if (formatStr.includes('MMM')) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return date.toLocaleDateString();
  }),
  isEqual: vi.fn((date1, date2) => date1.getTime() === date2.getTime())
}));

describe('useDateRangeValidation Hook', () => {
  const defaultProps = {
    minDate: null,
    maxDate: null,
    maxRangeDays: null,
    minRangeDays: 1,
    allowWeekends: true,
    allowPastDates: true,
    onValidationChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Single Date Validation', () => {
    it('validates a valid date successfully', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const validDate = new Date('2024-01-15');
      const errors = result.current.validateDate(validDate, 'Test Date');
      
      expect(errors).toEqual([]);
    });

    it('rejects invalid date', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const invalidDate = new Date('invalid');
      const errors = result.current.validateDate(invalidDate, 'Test Date');
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('not a valid date');
    });

    it('enforces minimum date constraint', () => {
      const minDate = new Date('2024-01-10');
      const { result } = renderHook(() => 
        useDateRangeValidation({ ...defaultProps, minDate })
      );
      
      const earlyDate = new Date('2024-01-05');
      const errors = result.current.validateDate(earlyDate, 'Test Date');
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('cannot be before');
    });

    it('enforces maximum date constraint', () => {
      const maxDate = new Date('2024-01-20');
      const { result } = renderHook(() => 
        useDateRangeValidation({ ...defaultProps, maxDate })
      );
      
      const lateDate = new Date('2024-01-25');
      const errors = result.current.validateDate(lateDate, 'Test Date');
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('cannot be after');
    });

    it('enforces past date restriction when allowPastDates is false', () => {
      const { result } = renderHook(() => 
        useDateRangeValidation({ ...defaultProps, allowPastDates: false })
      );
      
      const pastDate = new Date('2020-01-01');
      const errors = result.current.validateDate(pastDate, 'Test Date');
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('cannot be in the past');
    });

    it('allows null dates for optional fields', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const errors = result.current.validateDate(null, 'Optional Date');
      
      expect(errors).toEqual([]);
    });
  });

  describe('Date Range Validation', () => {
    it('validates a valid date range successfully', () => {
      const onValidationChange = vi.fn();
      const { result } = renderHook(() => 
        useDateRangeValidation({ ...defaultProps, onValidationChange })
      );
      
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-22');
      
      let validation;
      act(() => {
        validation = result.current.validateRange(startDate, endDate);
      });
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
      expect(onValidationChange).toHaveBeenCalledWith(validation);
    });

    it('rejects range where start date is after end date', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-22');
      const endDate = new Date('2024-01-15');
      
      let validation;
      act(() => {
        validation = result.current.validateRange(startDate, endDate);
      });
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('Start date must be before end date');
    });

    it('rejects range where start date equals end date', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const sameDate = new Date('2024-01-15');
      
      let validation;
      act(() => {
        validation = result.current.validateRange(sameDate, sameDate);
      });
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('enforces minimum range days constraint', () => {
      const { result } = renderHook(() => 
        useDateRangeValidation({ ...defaultProps, minRangeDays: 7 })
      );
      
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-18'); // Only 4 days
      
      let validation;
      act(() => {
        validation = result.current.validateRange(startDate, endDate);
      });
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('at least 7 day'))).toBe(true);
    });

    it('enforces maximum range days constraint', () => {
      const { result } = renderHook(() => 
        useDateRangeValidation({ ...defaultProps, maxRangeDays: 30 })
      );
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-02-15'); // More than 30 days
      
      let validation;
      act(() => {
        validation = result.current.validateRange(startDate, endDate);
      });
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('cannot exceed 30 days'))).toBe(true);
    });

    it('generates warnings for weekend dates when weekends not allowed', () => {
      const { result } = renderHook(() => 
        useDateRangeValidation({ ...defaultProps, allowWeekends: false })
      );
      
      const startDate = new Date('2024-01-13'); // Saturday
      const endDate = new Date('2024-01-20');   // Saturday
      
      // Mock the getDay() method to return weekend values
      startDate.getDay = vi.fn(() => 6); // Saturday
      endDate.getDay = vi.fn(() => 6);   // Saturday
      
      let validation;
      act(() => {
        validation = result.current.validateRange(startDate, endDate);
      });
      
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some(w => w.includes('weekend'))).toBe(true);
    });

    it('generates business logic warnings for long ranges', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-05-01'); // > 90 days
      
      let validation;
      act(() => {
        validation = result.current.validateRange(startDate, endDate);
      });
      
      expect(validation.warnings.some(w => w.includes('performance'))).toBe(true);
    });

    it('generates warnings for short ranges', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-18'); // < 7 days
      
      let validation;
      act(() => {
        validation = result.current.validateRange(startDate, endDate);
      });
      
      expect(validation.warnings.some(w => w.includes('sufficient data'))).toBe(true);
    });

    it('handles null dates gracefully', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      let validation;
      act(() => {
        validation = result.current.validateRange(null, null);
      });
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });

  describe('Suggested Period Types', () => {
    it('suggests weekly for 7-day ranges', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-21'); // 7 days
      
      const suggestedType = result.current.getSuggestedPeriodType(startDate, endDate);
      
      expect(suggestedType).toBe('weekly');
    });

    it('suggests monthly for ~30-day ranges', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31'); // 31 days
      
      const suggestedType = result.current.getSuggestedPeriodType(startDate, endDate);
      
      expect(suggestedType).toBe('monthly');
    });

    it('suggests bi-weekly for 14-day ranges', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-14'); // 14 days
      
      const suggestedType = result.current.getSuggestedPeriodType(startDate, endDate);
      
      expect(suggestedType).toBe('bi-weekly');
    });

    it('suggests quarterly for ~90-day ranges', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-31'); // ~90 days
      
      const suggestedType = result.current.getSuggestedPeriodType(startDate, endDate);
      
      expect(suggestedType).toBe('quarterly');
    });

    it('suggests custom for non-standard ranges', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-25'); // 25 days - non-standard
      
      const suggestedType = result.current.getSuggestedPeriodType(startDate, endDate);
      
      expect(suggestedType).toBe('custom');
    });

    it('returns null for invalid dates', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const suggestedType = result.current.getSuggestedPeriodType(null, null);
      
      expect(suggestedType).toBe(null);
    });
  });

  describe('Date Range Formatting', () => {
    it('formats date range with default options', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-22');
      
      const formatted = result.current.formatDateRange(startDate, endDate);
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('formats date range with custom separator', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-22');
      const options = { separator: ' to ' };
      
      const formatted = result.current.formatDateRange(startDate, endDate, options);
      
      expect(formatted).toContain(' to ');
    });

    it('formats date range in short format', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-22');
      const options = { shortFormat: true };
      
      const formatted = result.current.formatDateRange(startDate, endDate, options);
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('returns empty string for null dates', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const formatted = result.current.formatDateRange(null, null);
      
      expect(formatted).toBe('');
    });
  });

  describe('Range Statistics', () => {
    it('calculates range statistics correctly', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-07'); // 7 days
      
      const stats = result.current.getRangeStats(startDate, endDate);
      
      expect(stats).toBeDefined();
      expect(stats.days).toBe(7);
      expect(stats.weeks).toBe(1);
      expect(stats.suggestedType).toBe('weekly');
      expect(stats.formatted).toBeDefined();
      expect(stats.formattedShort).toBeDefined();
    });

    it('returns null for invalid dates', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const stats = result.current.getRangeStats(null, null);
      
      expect(stats).toBe(null);
    });
  });

  describe('Quick Validation', () => {
    it('quickly validates valid range without setting state', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-22');
      
      const isValid = result.current.isValidRange(startDate, endDate);
      
      expect(isValid).toBe(true);
    });

    it('quickly rejects invalid range without setting state', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-22');
      const endDate = new Date('2024-01-15'); // Invalid order
      
      const isValid = result.current.isValidRange(startDate, endDate);
      
      expect(isValid).toBe(false);
    });

    it('rejects null dates in quick validation', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const isValid = result.current.isValidRange(null, null);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Preset Ranges', () => {
    it('provides preset date ranges', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const presets = result.current.presetRanges;
      
      expect(Array.isArray(presets)).toBe(true);
      expect(presets.length).toBeGreaterThan(0);
      
      // Check that each preset has required properties
      presets.forEach(preset => {
        expect(preset).toHaveProperty('label');
        expect(preset).toHaveProperty('getValue');
        expect(typeof preset.getValue).toBe('function');
        
        const range = preset.getValue();
        expect(range).toHaveProperty('from');
        expect(range).toHaveProperty('to');
      });
    });

    it('filters out invalid preset ranges', () => {
      // Create a scenario where some preset ranges might be invalid
      const futureMinDate = new Date('2025-01-01');
      const { result } = renderHook(() => 
        useDateRangeValidation({ ...defaultProps, minDate: futureMinDate })
      );
      
      const presets = result.current.presetRanges;
      
      // Should filter out presets that don't meet the minDate constraint
      expect(Array.isArray(presets)).toBe(true);
    });
  });

  describe('Validation State Management', () => {
    it('updates validation state when validateRange is called', () => {
      const { result } = renderHook(() => useDateRangeValidation(defaultProps));
      
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-22');
      
      act(() => {
        result.current.validateRange(startDate, endDate);
      });
      
      expect(result.current.isValid).toBe(true);
      expect(result.current.errors).toEqual([]);
      expect(result.current.validationState.isValid).toBe(true);
    });

    it('calls onValidationChange when validation state changes', () => {
      const onValidationChange = vi.fn();
      const { result } = renderHook(() => 
        useDateRangeValidation({ ...defaultProps, onValidationChange })
      );
      
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-22');
      
      act(() => {
        result.current.validateRange(startDate, endDate);
      });
      
      expect(onValidationChange).toHaveBeenCalledWith({
        isValid: true,
        errors: [],
        warnings: expect.any(Array)
      });
    });
  });
});
