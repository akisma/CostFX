import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { SnackbarProvider } from 'notistack'

// Mock API before imports
vi.mock('../../../../src/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

import ConnectionStatus from '../../../../src/components/pos/square/ConnectionStatus'
import squareConnectionReducer from '../../../../src/store/slices/squareConnectionSlice'
import api from '../../../../src/services/api'

/**
 * ConnectionStatus Component Tests
 * 
 * Purpose: Verify disconnect functionality and state management
 * Issue: #30 - Square OAuth Connection UI - Bug Fix
 * 
 * These tests specifically validate:
 * 1. Disconnect button renders and functions correctly
 * 2. Loading states are managed via Redux (not local useState)
 * 3. The bug fix: removed broken setIsDisconnecting(true) call
 * 
 * NOTE: These tests focus on the critical bug that was fixed:
 * - Component was calling setIsDisconnecting(true) without useState declaration
 * - Now properly uses loading.disconnect from Redux store
 */

describe('ConnectionStatus Component - Disconnect Functionality', () => {
  let store
  let user

  beforeEach(() => {
    vi.clearAllMocks()
    user = userEvent.setup()
    
    // Mock window.confirm to always return true
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const renderConnectedStatus = (onDisconnect = null) => {
    // Create store with connected state
    store = configureStore({
      reducer: {
        squareConnection: squareConnectionReducer
      },
      preloadedState: {
        squareConnection: {
          isConnected: true,
          connectionStatus: 'active',
          connection: { id: 1, provider: 'square', status: 'active' },
          availableLocations: [],
          selectedLocations: [{ id: 'L1', name: 'Test Location' }],
          oauthState: null,
          authorizationUrl: null,
          health: null,
          lastHealthCheck: null,
          loading: {
            connect: false,
            callback: false,
            status: false,
            locations: false,
            select: false,
            disconnect: false,
            health: false
          },
          error: null,
          lastError: null,
          showLocationSelector: false,
          callbackProcessed: false
        }
      }
    })

    // Mock the auto-fetch that happens on mount
    api.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          connected: true,
          connection: { id: 1, provider: 'square', status: 'active' },
          locations: [{ id: 'L1', name: 'Test Location' }]
        }
      }
    })

    return render(
      <Provider store={store}>
        <SnackbarProvider>
          <ConnectionStatus 
            showDisconnectButton={true}
            refreshInterval={999999} // Set very high to prevent interval firing during test
            onDisconnect={onDisconnect}
          />
        </SnackbarProvider>
      </Provider>
    )
  }

  // =========================================================================
  // Critical Bug Fix Test - This is the main test for Issue #30 bug
  // =========================================================================

  describe('Bug Fix: Disconnect uses Redux state (not broken useState)', () => {
    it('should successfully dispatch disconnect without calling undefined setIsDisconnecting', async () => {
      // This test verifies the bug fix:
      // Before: Component called setIsDisconnecting(true) which didn't exist → ReferenceError
      // After: Component uses Redux loading.disconnect state → works correctly

      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Square integration disconnected successfully',
          data: null
        }
      })

      renderConnectedStatus()

      // Wait for initial render to complete
      await waitFor(() => {
        expect(screen.queryByText('Connected')).toBeInTheDocument()
      })

      // Find and click disconnect button
      const disconnectButton = screen.getByRole('button', { name: /disconnect/i })
      expect(disconnectButton).toBeInTheDocument()
      
      // Click disconnect - this would have thrown ReferenceError before fix
      await user.click(disconnectButton)

      // Verify API was called (proves the function executed successfully)
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/pos/square/disconnect')
      })

      // Verify Redux state was updated correctly
      await waitFor(() => {
        const state = store.getState().squareConnection
        expect(state.isConnected).toBe(false)
        expect(state.connectionStatus).toBe('disconnected')
      })
    })

    it('should use Redux loading.disconnect state for UI loading indicator', async () => {
      // Mock slow API response to catch loading state
      let resolveDisconnect
      const disconnectPromise = new Promise(resolve => {
        resolveDisconnect = resolve
      })
      
      api.post.mockReturnValueOnce(disconnectPromise)

      renderConnectedStatus()

      await waitFor(() => {
        expect(screen.queryByText('Connected')).toBeInTheDocument()
      })

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i })
      await user.click(disconnectButton)

      // During disconnect, button should show "Disconnecting..." from Redux state
      await waitFor(() => {
        const state = store.getState().squareConnection
        expect(state.loading.disconnect).toBe(true)
      })

      // Complete the disconnect
      resolveDisconnect({
        data: {
          success: true,
          message: 'Disconnected',
          data: null
        }
      })

      // After disconnect, loading should be false
      await waitFor(() => {
        const state = store.getState().squareConnection
        expect(state.loading.disconnect).toBe(false)
      })
    })
  })

  // =========================================================================
  // Disconnect Error Handling
  // =========================================================================

  describe('Disconnect Error Handling', () => {
    it('should handle disconnect errors gracefully', async () => {
      const errorMessage = 'Failed to revoke tokens'
      api.post.mockRejectedValueOnce({
        response: {
          data: {
            error: errorMessage
          }
        }
      })

      renderConnectedStatus()

      await waitFor(() => {
        expect(screen.queryByText('Connected')).toBeInTheDocument()
      })

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i })
      await user.click(disconnectButton)

      // Verify error is stored in Redux
      await waitFor(() => {
        const state = store.getState().squareConnection
        expect(state.error).toBe(errorMessage)
        expect(state.loading.disconnect).toBe(false)
      })
    })
  })

  // =========================================================================
  // Disconnect Callback
  // =========================================================================

  describe('Disconnect Callback', () => {
    it('should call onDisconnect callback after successful disconnect', async () => {
      const onDisconnectMock = vi.fn()
      
      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Square integration disconnected successfully',
          data: null
        }
      })

      renderConnectedStatus(onDisconnectMock)

      await waitFor(() => {
        expect(screen.queryByText('Connected')).toBeInTheDocument()
      })

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i })
      await user.click(disconnectButton)

      await waitFor(() => {
        expect(onDisconnectMock).toHaveBeenCalledTimes(1)
      })
    })
  })

  // =========================================================================
  // Confirmation Dialog
  // =========================================================================

  describe('Confirmation Dialog', () => {
    it('should show confirmation dialog and cancel if user declines', async () => {
      window.confirm.mockReturnValue(false) // User cancels

      renderConnectedStatus()

      await waitFor(() => {
        expect(screen.queryByText('Connected')).toBeInTheDocument()
      })

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i })
      await user.click(disconnectButton)

      // Verify confirmation was shown
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to disconnect Square? This will stop syncing data.'
      )

      // Verify API was NOT called (user cancelled)
      expect(api.post).not.toHaveBeenCalled()

      // State should remain connected
      const state = store.getState().squareConnection
      expect(state.isConnected).toBe(true)
    })
  })
})

