import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SnackbarProvider } from 'notistack'

// Mock API services before imports
vi.mock('../../../../src/services/posSyncService', () => ({
  syncSales: vi.fn(),
  transformSales: vi.fn(),
  clearSalesData: vi.fn()
}))

import SalesDataImportPanel from '../../../../src/components/pos/square/SalesDataImportPanel'
import { syncSales, transformSales, clearSalesData } from '../../../../src/services/posSyncService'

/**
 * SalesDataImportPanel Component Tests (TDD)
 * 
 * Purpose: Verify sales data import functionality with date range selection
 * Issue: #46 - UI for Square Sales Import & Transformation
 * 
 * Test Coverage:
 * 1. Date range picker (startDate, endDate inputs)
 * 2. Import button triggers syncSales with date parameters
 * 3. Transform functionality (same as inventory import)
 * 4. Clear sales data button
 * 5. Loading states and error handling
 * 6. Stats display (orders, line items, transactions)
 * 
 * Created: 2025-10-13 (TDD - tests written first)
 */

describe('SalesDataImportPanel Component', () => {
  let user

  beforeEach(() => {
    vi.clearAllMocks()
    user = userEvent.setup()
    
    // Mock window.confirm for clear data
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const renderComponent = (props = {}) => {
    const defaultProps = {
      connectionId: 1,
      restaurantId: 1,
      onSyncComplete: vi.fn()
    }

    return render(
      <SnackbarProvider>
        <SalesDataImportPanel {...defaultProps} {...props} />
      </SnackbarProvider>
    )
  }

  describe('Initial Render', () => {
    it('should render date range inputs', () => {
      renderComponent()
      
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
    })

    it('should render Import, Transform, and Clear buttons', () => {
      renderComponent()
      
      expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /transform/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    })

    it('should disable Import button when dates are not selected', () => {
      renderComponent()
      
      const importButton = screen.getByRole('button', { name: /import/i })
      expect(importButton).toBeDisabled()
    })

    it('should show empty state message', () => {
      renderComponent()
      
      expect(screen.getByText(/select dates and click "import"/i)).toBeInTheDocument()
    })
  })

  describe('Date Range Selection', () => {
    it('should enable Import button when both dates are selected', async () => {
      renderComponent()
      
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      
      await user.type(startDateInput, '2025-10-01')
      await user.type(endDateInput, '2025-10-07')
      
      const importButton = screen.getByRole('button', { name: /import/i })
      expect(importButton).toBeEnabled()
    })

    it('should validate that end date is after start date', async () => {
      renderComponent()
      
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      
      await user.type(startDateInput, '2025-10-07')
      await user.type(endDateInput, '2025-10-01')
      
      // Trigger blur to validate inside act to flush state updates
      act(() => {
        endDateInput.blur()
      })
      
      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/end date must be after start date/i)).toBeInTheDocument()
      })
    })

    it('should set default date range to last 7 days when "Last 7 Days" preset is clicked', async () => {
      renderComponent()
      
      const preset7Days = screen.getByRole('button', { name: /last 7 days/i })
      await user.click(preset7Days)
      
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      
      expect(startDateInput.value).toBeTruthy()
      expect(endDateInput.value).toBeTruthy()
    })
  })

  describe('Import Functionality', () => {
    it('should call syncSales with correct date parameters when Import is clicked', async () => {
      const mockResult = {
        syncId: 'sales_sync_123',
        status: 'completed',
        sync: {
          synced: { orders: 50, lineItems: 200 },
          errors: []
        },
        transform: null, // No transform on import
        duration: 2500
      }
      
      syncSales.mockResolvedValue(mockResult)
      
      renderComponent()
      
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      const importButton = screen.getByRole('button', { name: /import/i })
      
      await user.type(startDateInput, '2025-10-01')
      await user.type(endDateInput, '2025-10-07')
      await user.click(importButton)
      
      await waitFor(() => {
        expect(syncSales).toHaveBeenCalledWith(1, {
          startDate: '2025-10-01',
          endDate: '2025-10-07',
          dryRun: false
        })
      })
    })

    it('should show loading state during import', async () => {
      syncSales.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      renderComponent()
      
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      const importButton = screen.getByRole('button', { name: /import/i })
      
      await user.type(startDateInput, '2025-10-01')
      await user.type(endDateInput, '2025-10-07')
      await user.click(importButton)
      
      expect(screen.getByText(/importing/i)).toBeInTheDocument()
      expect(importButton).toBeDisabled()
    })

    it('should display sync stats after successful import', async () => {
      const mockResult = {
        syncId: 'sales_sync_123',
        status: 'completed',
        sync: {
          synced: { orders: 50, lineItems: 200 },
          errors: []
        },
        transform: null, // No transform on import
        duration: 2500
      }
      
      syncSales.mockResolvedValue(mockResult)
      
      renderComponent()
      
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      const importButton = screen.getByRole('button', { name: /import/i })
      
      await user.type(startDateInput, '2025-10-01')
      await user.type(endDateInput, '2025-10-07')
      await user.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Orders Synced/i)).toBeInTheDocument()
        expect(screen.getByText(/Line Items/i)).toBeInTheDocument()
        expect(screen.getAllByText(/50/).length).toBeGreaterThan(0) // orders count (may appear multiple times)
        expect(screen.getAllByText(/200/).length).toBeGreaterThan(0) // line items count (may appear multiple times)
      })
    })

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('Connection failed')
      mockError.response = { data: { message: 'POS connection not active' } }
      
      syncSales.mockRejectedValue(mockError)
      
      renderComponent()
      
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      const importButton = screen.getByRole('button', { name: /import/i })
      
      await user.type(startDateInput, '2025-10-01')
      await user.type(endDateInput, '2025-10-07')
      await user.click(importButton)
      
      await waitFor(() => {
        // Error appears in the error display section
        expect(screen.getAllByText(/POS connection not active/i).length).toBeGreaterThan(0)
      })
    })

    it('should call onSyncComplete callback after successful import', async () => {
      const mockResult = {
        syncId: 'sales_sync_123',
        status: 'completed',
        sync: { synced: { orders: 50, lineItems: 200 }, errors: [] },
        transform: { created: 180, skipped: 20, errors: [] }
      }
      
      syncSales.mockResolvedValue(mockResult)
      const onSyncComplete = vi.fn()
      
      renderComponent({ onSyncComplete })
      
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      const importButton = screen.getByRole('button', { name: /import/i })
      
      await user.type(startDateInput, '2025-10-01')
      await user.type(endDateInput, '2025-10-07')
      await user.click(importButton)
      
      await waitFor(() => {
        expect(onSyncComplete).toHaveBeenCalledWith(mockResult)
      })
    })
  })

  describe('Transform Functionality', () => {
    it('should call transformSales with correct date parameters when Transform is clicked', async () => {
      // First, mock a successful import to enable Transform button
      const mockImportResult = {
        syncId: 'sales_sync_123',
        status: 'completed',
        sync: {
          synced: { orders: 50, lineItems: 200 },
          errors: []
        },
        transform: null,
        duration: 2500
      }
      
      const mockTransformResult = {
        syncId: 'sales_transform_456',
        status: 'completed',
        sync: null, // No sync on transform
        transform: {
          created: 180,
          skipped: 20,
          errors: []
        },
        duration: 1500
      }
      
      syncSales.mockResolvedValue(mockImportResult)
      transformSales.mockResolvedValue(mockTransformResult)
      
      renderComponent()
      
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      
      await user.type(startDateInput, '2025-10-01')
      await user.type(endDateInput, '2025-10-07')
      
      // First import to enable transform
      const importButton = screen.getByRole('button', { name: /import/i })
      await user.click(importButton)
      
      await waitFor(() => {
        expect(syncSales).toHaveBeenCalled()
      })
      
      // Now click Transform
      const transformButton = screen.getByRole('button', { name: /^transform$/i })
      await user.click(transformButton)
      
      await waitFor(() => {
        expect(transformSales).toHaveBeenCalledWith(1, {
          startDate: '2025-10-01',
          endDate: '2025-10-07',
          dryRun: false
        })
      })
    })

    it('should show loading state during transformation', async () => {
      // First, mock a successful import to enable Transform button
      const mockImportResult = {
        syncId: 'sales_sync_123',
        status: 'completed',
        sync: {
          synced: { orders: 50, lineItems: 200 },
          errors: []
        },
        transform: null,
        duration: 2500
      }
      
      syncSales.mockResolvedValue(mockImportResult)
      transformSales.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      renderComponent()
      
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      
      await user.type(startDateInput, '2025-10-01')
      await user.type(endDateInput, '2025-10-07')
      
      // First import to enable transform
      const importButton = screen.getByRole('button', { name: /import/i })
      await user.click(importButton)
      
      await waitFor(() => {
        expect(syncSales).toHaveBeenCalled()
      })
      
      const transformButton = screen.getByRole('button', { name: /^transform$/i })
      await user.click(transformButton)
      
      expect(screen.getByText(/transforming\.\.\./i)).toBeInTheDocument()
      const transformingButton = screen.getByRole('button', { name: /transforming\.\.\./i })
      expect(transformingButton).toBeDisabled()
    })

    it('should display transformation stats after successful transform', async () => {
      // First, mock a successful import to enable Transform button
      const mockImportResult = {
        syncId: 'sales_sync_123',
        status: 'completed',
        sync: {
          synced: { orders: 50, lineItems: 200 },
          errors: []
        },
        transform: null,
        duration: 2500
      }
      
      const mockTransformResult = {
        syncId: 'sales_transform_456',
        status: 'completed',
        sync: null,
        transform: {
          created: 180,
          skipped: 20,
          errors: []
        },
        duration: 1500
      }
      
      syncSales.mockResolvedValue(mockImportResult)
      transformSales.mockResolvedValue(mockTransformResult)
      
      renderComponent()
      
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      
      await user.type(startDateInput, '2025-10-01')
      await user.type(endDateInput, '2025-10-07')
      
      // First import to enable transform
      const importButton = screen.getByRole('button', { name: /import/i })
      await user.click(importButton)
      
      await waitFor(() => {
        expect(syncSales).toHaveBeenCalled()
      })
      
      const transformButton = screen.getByRole('button', { name: /^transform$/i })
      await user.click(transformButton)
      
      await waitFor(() => {
        // Look for the "Created" label and the value "180"
        expect(screen.getByText('Created')).toBeInTheDocument()
        expect(screen.getByText('180')).toBeInTheDocument()
      })
    })

    it('should handle transformation errors gracefully', async () => {
      // First, mock a successful import to enable Transform button
      const mockImportResult = {
        syncId: 'sales_sync_123',
        status: 'completed',
        sync: {
          synced: { orders: 50, lineItems: 200 },
          errors: []
        },
        transform: null,
        duration: 2500
      }
      
      syncSales.mockResolvedValue(mockImportResult)
      
      const mockError = new Error('Transform failed')
      mockError.response = { data: { message: 'No raw data found' } }
      
      transformSales.mockRejectedValue(mockError)
      
      renderComponent()
      
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      
      await user.type(startDateInput, '2025-10-01')
      await user.type(endDateInput, '2025-10-07')
      
      // First import to enable transform
      const importButton = screen.getByRole('button', { name: /import/i })
      await user.click(importButton)
      
      await waitFor(() => {
        expect(syncSales).toHaveBeenCalled()
      })
      
      const transformButton = screen.getByRole('button', { name: /^transform$/i })
      await user.click(transformButton)
      
      await waitFor(() => {
        // Error should be displayed in the error section
        expect(screen.getByText(/import error/i)).toBeInTheDocument()
        expect(screen.getByText(/no raw data found/i)).toBeInTheDocument()
      })
    })
  })

  describe('Clear Sales Data Functionality', () => {
    it('should call clearSalesData when Clear button is clicked', async () => {
      const mockResult = {
        restaurantId: 1,
        deleted: {
          squareOrders: 50,
          squareOrderItems: 200,
          salesTransactions: 180
        }
      }
      
      clearSalesData.mockResolvedValue(mockResult)
      
      renderComponent()
      
      const clearButton = screen.getByRole('button', { name: /clear/i })
      await user.click(clearButton)
      
      await waitFor(() => {
        expect(clearSalesData).toHaveBeenCalledWith(1)
      })
    })

    it('should show confirmation dialog before clearing data', async () => {
      renderComponent()
      
      const clearButton = screen.getByRole('button', { name: /clear/i })
      await user.click(clearButton)
      
      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('delete all sales data')
      )
    })

    it('should not clear data if user cancels confirmation', async () => {
      window.confirm.mockReturnValue(false)
      
      renderComponent()
      
      const clearButton = screen.getByRole('button', { name: /clear/i })
      await user.click(clearButton)
      
      expect(clearSalesData).not.toHaveBeenCalled()
    })
  })

  describe('Disabled States', () => {
    it('should disable Transform button when no sync has been performed', () => {
      renderComponent()
      
      const transformButton = screen.getByRole('button', { name: /transform/i })
      expect(transformButton).toBeDisabled()
    })

    it('should disable all buttons during import', async () => {
      syncSales.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      renderComponent()
      
      const startDateInput = screen.getByLabelText(/start date/i)
      const endDateInput = screen.getByLabelText(/end date/i)
      const importButton = screen.getByRole('button', { name: /import/i })
      
      await user.type(startDateInput, '2025-10-01')
      await user.type(endDateInput, '2025-10-07')
      await user.click(importButton)
      
      expect(screen.getByRole('button', { name: /importing/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /transform/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled()
    })
  })
})
