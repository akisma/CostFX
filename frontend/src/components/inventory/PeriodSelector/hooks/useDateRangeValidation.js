import { useState, useCallback, useMemo } from 'react';
import { 
  isValid, 
  isBefore, 
  isAfter, 
  isEqual,
  differenceInDays, 
  differenceInWeeks,
  differenceInMonths,
  startOfDay,
  endOfDay,
  format
} from 'date-fns';

/**
 * Custom hook for date range validation and utilities
 * Provides comprehensive date range validation, formatting, and business logic
 */
export const useDateRangeValidation = ({
  minDate = null,
  maxDate = null,
  maxRangeDays = null,
  minRangeDays = 1,
  allowWeekends = true,
  allowPastDates = true,
  onValidationChange = () => {}
}) => {
  const [validationState, setValidationState] = useState({
    isValid: true,
    errors: [],
    warnings: []
  });
  
  /**
   * Validate a single date
   */
  const validateDate = useCallback((date, fieldName = 'Date') => {
    const errors = [];
    
    if (!date) {
      return errors; // Allow null dates for optional fields
    }
    
    if (!isValid(date)) {
      errors.push(`${fieldName} is not a valid date`);
      return errors;
    }
    
    // Check min date
    if (minDate && isBefore(date, startOfDay(minDate))) {
      errors.push(`${fieldName} cannot be before ${format(minDate, 'MMM d, yyyy')}`);
    }
    
    // Check max date
    if (maxDate && isAfter(date, endOfDay(maxDate))) {
      errors.push(`${fieldName} cannot be after ${format(maxDate, 'MMM d, yyyy')}`);
    }
    
    // Check past dates
    if (!allowPastDates && isBefore(date, startOfDay(new Date()))) {
      errors.push(`${fieldName} cannot be in the past`);
    }
    
    return errors;
  }, [minDate, maxDate, allowPastDates]);
  
  /**
   * Validate a date range
   */
  const validateRange = useCallback((startDate, endDate) => {
    const errors = [];
    const warnings = [];
    
    // Validate individual dates
    errors.push(...validateDate(startDate, 'Start date'));
    errors.push(...validateDate(endDate, 'End date'));
    
    // If individual dates are invalid, don't continue with range validation
    if (errors.length > 0) {
      const newState = { isValid: false, errors, warnings };
      setValidationState(newState);
      onValidationChange(newState);
      return newState;
    }
    
    // Both dates must be present for range validation
    if (!startDate || !endDate) {
      const newState = { isValid: true, errors: [], warnings: [] };
      setValidationState(newState);
      onValidationChange(newState);
      return newState;
    }
    
    // Start date must be before end date
    if (isAfter(startDate, endDate) || isEqual(startDate, endDate)) {
      errors.push('Start date must be before end date');
    }
    
    // Calculate range duration
    const rangeDays = differenceInDays(endDate, startDate) + 1; // Include both start and end days
    
    // Check minimum range
    if (minRangeDays && rangeDays < minRangeDays) {
      errors.push(`Date range must be at least ${minRangeDays} day${minRangeDays > 1 ? 's' : ''}`);
    }
    
    // Check maximum range
    if (maxRangeDays && rangeDays > maxRangeDays) {
      errors.push(`Date range cannot exceed ${maxRangeDays} days`);
    }
    
    // Weekend warnings (if weekends are not allowed)
    if (!allowWeekends) {
      const startDay = startDate.getDay();
      const endDay = endDate.getDay();
      
      if (startDay === 0 || startDay === 6) {
        warnings.push('Start date falls on a weekend');
      }
      
      if (endDay === 0 || endDay === 6) {
        warnings.push('End date falls on a weekend');
      }
    }
    
    // Business logic warnings
    if (rangeDays > 90) {
      warnings.push('Long date ranges may affect performance');
    }
    
    if (rangeDays < 7) {
      warnings.push('Short periods may not provide sufficient data for analysis');
    }
    
    const newState = {
      isValid: errors.length === 0,
      errors,
      warnings
    };
    
    setValidationState(newState);
    onValidationChange(newState);
    return newState;
  }, [validateDate, minRangeDays, maxRangeDays, allowWeekends, onValidationChange]);
  
  /**
   * Get suggested period types based on date range
   */
  const getSuggestedPeriodType = useCallback((startDate, endDate) => {
    if (!startDate || !endDate || !isValid(startDate) || !isValid(endDate)) {
      return null;
    }
    
    const days = differenceInDays(endDate, startDate) + 1;
    const weeks = differenceInWeeks(endDate, startDate);
    const months = differenceInMonths(endDate, startDate);
    
    if (days === 7 || (days >= 6 && days <= 8)) {
      return 'weekly';
    }
    
    if (days === 14 || weeks === 2) {
      return 'bi-weekly';
    }
    
    if (months === 1 && (days >= 28 && days <= 32)) {
      return 'monthly';
    }
    
    if (months === 3 || (days >= 89 && days <= 93)) {
      return 'quarterly';
    }
    
    return 'custom';
  }, []);
  
  /**
   * Format date range for display
   */
  const formatDateRange = useCallback((startDate, endDate, options = {}) => {
    const {
      includeYear = true,
      separator = ' - ',
      shortFormat = false
    } = options;
    
    if (!startDate || !endDate) {
      return '';
    }
    
    const formatString = shortFormat 
      ? (includeYear ? 'MMM d, yyyy' : 'MMM d')
      : (includeYear ? 'MMMM d, yyyy' : 'MMMM d');
    
    const startFormatted = format(startDate, formatString);
    const endFormatted = format(endDate, formatString);
    
    // Same year optimization
    if (!shortFormat && includeYear && startDate.getFullYear() === endDate.getFullYear()) {
      const startMonth = format(startDate, 'MMMM d');
      return `${startMonth}${separator}${endFormatted}`;
    }
    
    return `${startFormatted}${separator}${endFormatted}`;
  }, []);
  
  /**
   * Get date range statistics
   */
  const getRangeStats = useCallback((startDate, endDate) => {
    if (!startDate || !endDate || !isValid(startDate) || !isValid(endDate)) {
      return null;
    }
    
    const days = differenceInDays(endDate, startDate) + 1;
    const weeks = Math.ceil(days / 7);
    const months = differenceInMonths(endDate, startDate);
    
    return {
      days,
      weeks,
      months,
      suggestedType: getSuggestedPeriodType(startDate, endDate),
      formatted: formatDateRange(startDate, endDate),
      formattedShort: formatDateRange(startDate, endDate, { shortFormat: true })
    };
  }, [getSuggestedPeriodType, formatDateRange]);
  
  /**
   * Quick validation check (without setting state)
   */
  const isValidRange = useCallback((startDate, endDate) => {
    if (!startDate || !endDate) return false;
    if (!isValid(startDate) || !isValid(endDate)) return false;
    if (isAfter(startDate, endDate) || isEqual(startDate, endDate)) return false;
    
    const errors = [];
    errors.push(...validateDate(startDate, 'Start date'));
    errors.push(...validateDate(endDate, 'End date'));
    
    const rangeDays = differenceInDays(endDate, startDate) + 1;
    
    if (minRangeDays && rangeDays < minRangeDays) return false;
    if (maxRangeDays && rangeDays > maxRangeDays) return false;
    
    return errors.length === 0;
  }, [validateDate, minRangeDays, maxRangeDays]);
  
  /**
   * Preset date ranges
   */
  const presetRanges = useMemo(() => {
    const today = new Date();
    const presets = [
      {
        label: 'Last 7 days',
        getValue: () => ({
          from: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
          to: today
        })
      },
      {
        label: 'Last 30 days',
        getValue: () => ({
          from: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000),
          to: today
        })
      },
      {
        label: 'Last 3 months',
        getValue: () => ({
          from: new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()),
          to: today
        })
      },
      {
        label: 'This month',
        getValue: () => ({
          from: new Date(today.getFullYear(), today.getMonth(), 1),
          to: new Date(today.getFullYear(), today.getMonth() + 1, 0)
        })
      },
      {
        label: 'Last month',
        getValue: () => ({
          from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
          to: new Date(today.getFullYear(), today.getMonth(), 0)
        })
      }
    ];
    
    return presets.filter(preset => {
      const range = preset.getValue();
      return isValidRange(range.from, range.to);
    });
  }, [isValidRange]);
  
  return {
    // Validation state
    validationState,
    isValid: validationState.isValid,
    errors: validationState.errors,
    warnings: validationState.warnings,
    
    // Validation methods
    validateDate,
    validateRange,
    isValidRange,
    
    // Utility methods
    getSuggestedPeriodType,
    formatDateRange,
    getRangeStats,
    
    // Presets
    presetRanges
  };
};
