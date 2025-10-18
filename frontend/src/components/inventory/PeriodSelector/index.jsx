import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import DatePicker from 'react-datepicker';
import { Calendar, ChevronDown, Plus, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { 
  fetchPeriods, 
  setSelectedPeriod, 
  setSelectedDateRange 
} from '../../../store/slices/inventorySlice';
import '../../../styles/datepicker.css';

/**
 * PeriodSelector Component
 * 
 * A comprehensive period selection component supporting:
 * - Preset period selection from database
 * - Custom date range selection
 * - Period validation and overlap checking
 * - Redux integration for state management
 */
const PeriodSelector = ({
  // Selection Configuration
  mode = 'single',
  selectedPeriod = null,
  selectedDateRange = null,
  onPeriodSelect = () => {},
  onDateRangeSelect = () => {},
  
  // Data & Filtering
  restaurantId,
  periodTypes = ['weekly', 'monthly', 'custom'],
  statusFilter = ['draft', 'active', 'closed'],
  maxPeriods = 50,
  
  // UI Configuration
  placeholder = 'Select a period...',
  className = '',
  disabled = false,
  showCreateButton = false,
  showDateRangePicker = true,
  
  // Validation
  minDate = null,
  maxDate = null,
  
  // Events
  onCreatePeriod = () => {},
  onError = () => {},
  onLoadingChange = () => {}
}) => {
  // Local state
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('periods'); // 'periods' or 'daterange'
  const [customRange, setCustomRange] = useState({ from: null, to: null });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Refs
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  
  // Redux state
  const dispatch = useDispatch();
  const {
    periods = [],
    loading = false,
    error = null
  } = useSelector(state => state.inventory.periodSelection || {});
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Load periods on mount or when filters change
  useEffect(() => {
    if (restaurantId && isOpen) {
      dispatch(fetchPeriods({
        restaurantId,
        filters: {
          periodTypes,
          statusFilter,
          limit: maxPeriods
        }
      }));
    }
  }, [restaurantId, periodTypes, statusFilter, maxPeriods, isOpen, dispatch]);
  
  // Notify parent of loading state changes
  useEffect(() => {
    onLoadingChange(loading);
  }, [loading, onLoadingChange]);
  
  // Notify parent of errors
  useEffect(() => {
    if (error) {
      onError(error);
    }
  }, [error, onError]);
  
  // Filter periods based on search term
  const filteredPeriods = periods.filter(period => 
    period.periodName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    period.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Handle period selection
  const handlePeriodSelect = (period) => {
    dispatch(setSelectedPeriod(period));
    onPeriodSelect(period);
    setIsOpen(false);
    setSearchTerm('');
  };
  
  // Handle custom date range change
  const handleDateRangeChange = (dates) => {
    const [start, end] = dates;
    const newRange = { from: start, to: end };
    setCustomRange(newRange);
    
    if (start && end) {
      dispatch(setSelectedDateRange(newRange));
      onDateRangeSelect(newRange);
      if (mode === 'range') {
        setIsOpen(false);
      }
    }
  };
  
  // Format display text for selected item
  const getDisplayText = () => {
    if (selectedPeriod) {
      return `${selectedPeriod.periodName} (${format(parseISO(selectedPeriod.periodStart), 'MMM d')} - ${format(parseISO(selectedPeriod.periodEnd), 'MMM d, yyyy')})`;
    }
    
    if (selectedDateRange?.from && selectedDateRange?.to) {
      return `${format(selectedDateRange.from, 'MMM d, yyyy')} - ${format(selectedDateRange.to, 'MMM d, yyyy')}`;
    }
    
    if (selectedDateRange?.from) {
      return `From ${format(selectedDateRange.from, 'MMM d, yyyy')}`;
    }
    
    return placeholder;
  };
  
  // Get status color classes
  const getStatusColor = (status) => {
    const colors = {
      draft: 'text-gray-500 bg-gray-100',
      active: 'text-green-700 bg-green-100',
      closed: 'text-blue-700 bg-blue-100',
      locked: 'text-red-700 bg-red-100'
    };
    return colors[status] || 'text-gray-500 bg-gray-100';
  };
  
  // Clear selection
  const handleClear = (e) => {
    e.stopPropagation();
    dispatch(setSelectedPeriod(null));
    dispatch(setSelectedDateRange(null));
    onPeriodSelect(null);
    onDateRangeSelect(null);
    setCustomRange({ from: null, to: null });
  };
  
  const hasSelection = selectedPeriod || (selectedDateRange?.from && selectedDateRange?.to);
  
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input field */}
      <div
        ref={inputRef}
        className={`
          period-selector-input cursor-pointer flex items-center justify-between
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${isOpen ? 'ring-2 ring-primary-500 border-primary-500' : ''}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center flex-1 min-w-0">
          <Calendar className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <span className={`truncate ${hasSelection ? 'text-gray-900' : 'text-gray-500'}`}>
            {getDisplayText()}
          </span>
        </div>
        
        <div className="flex items-center ml-2">
          {hasSelection && !disabled && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
              aria-label="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown 
            className={`w-4 h-4 text-gray-400 ml-1 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`} 
          />
        </div>
      </div>
      
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                selectedTab === 'periods' 
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setSelectedTab('periods')}
            >
              Existing Periods
            </button>
            {showDateRangePicker && (
              <button
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  selectedTab === 'daterange' 
                    ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setSelectedTab('daterange')}
              >
                Custom Range
              </button>
            )}
          </div>
          
          {/* Periods Tab */}
          {selectedTab === 'periods' && (
            <div className="max-h-80 overflow-y-auto">
              {/* Search */}
              <div className="p-3 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="Search periods..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              {/* Create new period button */}
              {showCreateButton && (
                <button
                  onClick={() => {
                    onCreatePeriod();
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 flex items-center text-primary-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Period
                </button>
              )}
              
              {/* Loading state */}
              {loading && (
                <div className="p-4 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto mb-2"></div>
                  Loading periods...
                </div>
              )}
              
              {/* Error state */}
              {error && (
                <div className="p-4 text-center text-red-600 bg-red-50">
                  <p>{error}</p>
                </div>
              )}
              
              {/* Periods list */}
              {!loading && !error && filteredPeriods.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  {searchTerm ? 'No periods match your search.' : 'No periods available.'}
                </div>
              )}
              
              {!loading && !error && filteredPeriods.map((period) => (
                <button
                  key={period.id}
                  onClick={() => handlePeriodSelect(period)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900 truncate">
                          {period.periodName}
                        </span>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getStatusColor(period.status)}`}>
                          {period.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 truncate mt-1">
                        {format(parseISO(period.periodStart), 'MMM d')} - {format(parseISO(period.periodEnd), 'MMM d, yyyy')}
                      </div>
                      {period.description && (
                        <div className="text-xs text-gray-400 truncate mt-1">
                          {period.description}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* Date Range Tab */}
          {selectedTab === 'daterange' && showDateRangePicker && (
            <div className="p-4">
              <DatePicker
                selected={customRange.from}
                onChange={handleDateRangeChange}
                startDate={customRange.from}
                endDate={customRange.to}
                selectsRange
                inline
                minDate={minDate}
                maxDate={maxDate}
                className="w-full"
              />
              
              {customRange.from && customRange.to && (
                <div className="mt-3 p-3 bg-primary-50 rounded-md">
                  <p className="text-sm text-primary-700">
                    Selected: {format(customRange.from, 'MMM d, yyyy')} - {format(customRange.to, 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-primary-600 mt-1">
                    Duration: {Math.ceil((customRange.to - customRange.from) / (1000 * 60 * 60 * 24))} days
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

PeriodSelector.propTypes = {
  mode: PropTypes.oneOf(['single', 'range']),
  selectedPeriod: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    periodName: PropTypes.string,
    periodStart: PropTypes.string,
    periodEnd: PropTypes.string,
    status: PropTypes.string,
    description: PropTypes.string
  }),
  selectedDateRange: PropTypes.shape({
    from: PropTypes.instanceOf(Date),
    to: PropTypes.instanceOf(Date)
  }),
  onPeriodSelect: PropTypes.func,
  onDateRangeSelect: PropTypes.func,
  restaurantId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  periodTypes: PropTypes.arrayOf(PropTypes.string),
  statusFilter: PropTypes.arrayOf(PropTypes.string),
  maxPeriods: PropTypes.number,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  showCreateButton: PropTypes.bool,
  showDateRangePicker: PropTypes.bool,
  minDate: PropTypes.instanceOf(Date),
  maxDate: PropTypes.instanceOf(Date),
  onCreatePeriod: PropTypes.func,
  onError: PropTypes.func,
  onLoadingChange: PropTypes.func
};

export default PeriodSelector;
