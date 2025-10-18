import { useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { isValid, parseISO, isBefore, isAfter } from 'date-fns';

/**
 * Custom hook for period selection logic
 * Manages period validation, overlap checking, and state management
 */
export const usePeriodSelection = ({
  validateOverlap = true,
  onError = () => {}
}) => {
  const [validationErrors, setValidationErrors] = useState([]);
  
  // Redux state
  const {
    periods = [],
    selectedPeriod = null,
    loading = false,
    error = null
  } = useSelector(state => state.inventory.periodSelection || {});
  
  /**
   * Validate a date range for overlaps with existing periods
   */
  const validateDateRange = useCallback((startDate, endDate, excludePeriodId = null) => {
    const errors = [];
    
    if (!startDate || !endDate) {
      errors.push('Both start and end dates are required');
      return errors;
    }
    
    if (!isValid(startDate) || !isValid(endDate)) {
      errors.push('Invalid date format');
      return errors;
    }
    
    if (isAfter(startDate, endDate)) {
      errors.push('Start date must be before end date');
      return errors;
    }
    
    if (validateOverlap) {
      const overlappingPeriods = periods.filter(period => {
        // Skip self when editing
        if (excludePeriodId && period.id === excludePeriodId) {
          return false;
        }
        
        // Skip draft periods as they can be modified
        if (period.status === 'draft') {
          return false;
        }
        
        const periodStart = parseISO(period.periodStart);
        const periodEnd = parseISO(period.periodEnd);
        
        // Check for overlap: start1 < end2 AND start2 < end1
        return isBefore(startDate, periodEnd) && isBefore(periodStart, endDate);
      });
      
      if (overlappingPeriods.length > 0) {
        errors.push(`Date range overlaps with ${overlappingPeriods.length} existing period(s)`);
      }
    }
    
    return errors;
  }, [periods, validateOverlap]);
  
  /**
   * Validate a selected period
   */
  const validatePeriod = useCallback((period) => {
    if (!period) return [];
    
    const startDate = parseISO(period.periodStart);
    const endDate = parseISO(period.periodEnd);
    
    return validateDateRange(startDate, endDate, period.id);
  }, [validateDateRange]);
  
  /**
   * Check if a period can be selected based on its status and validation rules
   */
  const canSelectPeriod = useCallback((period) => {
    const errors = validatePeriod(period);
    return errors.length === 0;
  }, [validatePeriod]);
  
  /**
   * Get validation status for display
   */
  const getValidationStatus = useCallback((period) => {
    const errors = validatePeriod(period);
    
    if (errors.length === 0) {
      return { isValid: true, errors: [], status: 'valid' };
    }
    
    return {
      isValid: false,
      errors,
      status: errors.some(e => e.includes('overlap')) ? 'overlap' : 'invalid'
    };
  }, [validatePeriod]);
  
  /**
   * Get filtered and sorted periods
   */
  const getFilteredPeriods = useCallback((filters = {}) => {
    let filtered = [...periods];
    
    // Filter by period types
    if (filters.periodTypes && filters.periodTypes.length > 0) {
      filtered = filtered.filter(p => filters.periodTypes.includes(p.periodType));
    }
    
    // Filter by status
    if (filters.statusFilter && filters.statusFilter.length > 0) {
      filtered = filtered.filter(p => filters.statusFilter.includes(p.status));
    }
    
    // Search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.periodName.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term))
      );
    }
    
    // Sort by start date (newest first)
    filtered.sort((a, b) => {
      const dateA = parseISO(a.periodStart);
      const dateB = parseISO(b.periodStart);
      return isAfter(dateA, dateB) ? -1 : 1;
    });
    
    // Limit results
    if (filters.maxPeriods) {
      filtered = filtered.slice(0, filters.maxPeriods);
    }
    
    return filtered;
  }, [periods]);
  
  /**
   * Get period statistics
   */
  const periodStats = useMemo(() => {
    const stats = {
      total: periods.length,
      byStatus: {
        draft: 0,
        active: 0,
        closed: 0,
        locked: 0
      },
      byType: {
        weekly: 0,
        monthly: 0,
        custom: 0
      }
    };
    
    periods.forEach(period => {
      stats.byStatus[period.status] = (stats.byStatus[period.status] || 0) + 1;
      stats.byType[period.periodType] = (stats.byType[period.periodType] || 0) + 1;
    });
    
    return stats;
  }, [periods]);
  
  /**
   * Select a period with validation
   */
  const selectPeriod = useCallback((period) => {
    if (!period) {
      setValidationErrors([]);
      return { success: true, period: null };
    }
    
    const errors = validatePeriod(period);
    setValidationErrors(errors);
    
    if (errors.length > 0) {
      onError(`Cannot select period: ${errors.join(', ')}`);
      return { success: false, errors };
    }
    
    return { success: true, period };
  }, [validatePeriod, onError]);
  
  /**
   * Create date range validation result
   */
  const validateCustomRange = useCallback((startDate, endDate) => {
    const errors = validateDateRange(startDate, endDate);
    setValidationErrors(errors);
    
    if (errors.length > 0) {
      onError(`Invalid date range: ${errors.join(', ')}`);
      return { success: false, errors };
    }
    
    return { success: true, range: { from: startDate, to: endDate } };
  }, [validateDateRange, onError]);
  
  return {
    // State
    periods,
    selectedPeriod,
    loading,
    error,
    validationErrors,
    periodStats,
    
    // Methods
    validatePeriod,
    validateDateRange,
    validateCustomRange,
    canSelectPeriod,
    getValidationStatus,
    getFilteredPeriods,
    selectPeriod,
    
    // Computed
    hasValidSelection: selectedPeriod && canSelectPeriod(selectedPeriod)
  };
};
