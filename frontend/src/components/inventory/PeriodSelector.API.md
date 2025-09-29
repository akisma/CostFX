# PeriodSelector Component API Design

## Overview
A React component for selecting inventory periods with date range picker integration, following CostFX architecture patterns.

## Component Props Interface

```typescript
interface PeriodSelectorProps {
  // Selection Configuration
  mode?: 'single' | 'range' | 'preset'           // Selection mode
  selectedPeriod?: InventoryPeriod | null         // Currently selected period
  selectedDateRange?: DateRange | null            // Custom date range selection
  onPeriodSelect?: (period: InventoryPeriod) => void      // Period selection callback
  onDateRangeSelect?: (range: DateRange) => void          // Date range selection callback
  
  // Data & Filtering
  restaurantId: string                            // Required: Restaurant context
  periodTypes?: PeriodType[]                      // Filter by period types ['weekly', 'monthly', 'custom']
  statusFilter?: PeriodStatus[]                   // Filter by status ['draft', 'active', 'closed', 'locked']
  maxPeriods?: number                             // Limit number of periods loaded
  
  // UI Configuration
  placeholder?: string                            // Input placeholder text
  className?: string                              // Additional CSS classes
  disabled?: boolean                              // Disable component
  showCreateButton?: boolean                      // Show "Create New Period" button
  showDateRangePicker?: boolean                   // Show custom date range picker
  
  // Validation
  validateOverlap?: boolean                       // Check for period overlaps
  minDate?: Date                                  // Minimum selectable date
  maxDate?: Date                                  // Maximum selectable date
  
  // Events
  onCreatePeriod?: () => void                     // Create new period callback
  onError?: (error: string) => void               // Error handling callback
  onLoadingChange?: (loading: boolean) => void    // Loading state callback
}

interface DateRange {
  from: Date | null
  to: Date | null
}

interface InventoryPeriod {
  id: string
  restaurantId: string
  periodName: string
  periodType: 'weekly' | 'monthly' | 'custom'
  periodStart: string     // ISO date string
  periodEnd: string       // ISO date string
  status: 'draft' | 'active' | 'closed' | 'locked'
  description?: string
  beginningSnapshotCompleted: boolean
  endingSnapshotCompleted: boolean
  createdAt: string
  updatedAt: string
}
```

## Redux Integration Pattern

```typescript
// Actions to be added to inventorySlice.js
export const fetchPeriods = createAsyncThunk(
  'inventory/fetchPeriods',
  async ({ restaurantId, filters }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams({
        restaurantId,
        ...filters
      });
      const response = await api.get(`/periods?${queryParams}`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch periods');
    }
  }
);

export const selectPeriod = createAsyncThunk(
  'inventory/selectPeriod',
  async ({ periodId }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/periods/${periodId}`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Failed to select period');
    }
  }
);

// State structure to be added to inventorySlice
periodSelection: {
  periods: [],
  selectedPeriod: null,
  selectedDateRange: null,
  loading: false,
  error: null,
  lastFetch: null
}
```

## Component Usage Examples

### Basic Period Selection
```jsx
<PeriodSelector
  restaurantId="restaurant-123"
  selectedPeriod={selectedPeriod}
  onPeriodSelect={handlePeriodSelect}
  placeholder="Select an inventory period..."
/>
```

### Date Range Mode
```jsx
<PeriodSelector
  mode="range"
  restaurantId="restaurant-123"
  selectedDateRange={dateRange}
  onDateRangeSelect={handleDateRangeChange}
  showDateRangePicker={true}
  minDate={new Date('2024-01-01')}
  maxDate={new Date()}
/>
```

### Filtered Selection
```jsx
<PeriodSelector
  restaurantId="restaurant-123"
  periodTypes={['weekly', 'monthly']}
  statusFilter={['active', 'closed']}
  maxPeriods={50}
  validateOverlap={true}
  showCreateButton={true}
  onCreatePeriod={handleCreatePeriod}
/>
```

## Styling Classes (Tailwind CSS)

```css
/* Base component container */
.period-selector-container {
  @apply relative w-full;
}

/* Period dropdown */
.period-selector-dropdown {
  @apply w-full px-3 py-2 border border-gray-300 rounded-md bg-white;
  @apply focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
  @apply disabled:bg-gray-100 disabled:cursor-not-allowed;
}

/* Date picker integration */
.period-selector-datepicker {
  @apply border border-gray-300 rounded-md p-2;
}

/* Period item in dropdown */
.period-selector-item {
  @apply px-3 py-2 hover:bg-blue-50 cursor-pointer;
  @apply flex justify-between items-center;
}

/* Status indicators */
.period-status-draft { @apply text-gray-500; }
.period-status-active { @apply text-green-600; }
.period-status-closed { @apply text-blue-600; }
.period-status-locked { @apply text-red-600; }
```

## Component Architecture

```
PeriodSelector/
├── index.jsx                 // Main component
├── PeriodDropdown.jsx        // Period selection dropdown
├── DateRangePicker.jsx       // Custom date range picker
├── PeriodItem.jsx           // Individual period display
├── CreatePeriodButton.jsx   // New period creation
└── hooks/
    ├── usePeriodSelection.js // Period selection logic
    └── useDateRangeValidation.js // Date validation
```

## Testing Strategy

```javascript
// Test scenarios to implement
describe('PeriodSelector', () => {
  it('fetches and displays periods on mount')
  it('handles period selection correctly')  
  it('validates date range overlaps')
  it('filters periods by type and status')
  it('integrates with Redux store')
  it('handles loading and error states')
  it('supports keyboard navigation')
  it('is accessible (ARIA compliance)')
})
```

## Integration Points

1. **Redux Store**: Connects to `inventorySlice.periodSelection`
2. **API Service**: Uses `/api/v1/periods` endpoints
3. **Parent Components**: Dashboard, Reports, Period Management
4. **Date Library**: react-datepicker for date selection
5. **Styling**: Tailwind CSS classes with design system tokens

This API design follows the established CostFX patterns while providing flexibility for various use cases.
