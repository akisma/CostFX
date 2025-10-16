import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as posSyncService from '../../src/services/posSyncService'

// Mock the api module
vi.mock('../../src/services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn()
  }
}))

import api from '../../src/services/api'

describe('posSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================
  // EXISTING INVENTORY SYNC TESTS
  // ============================================

  describe('syncInventory', () => {
    it('should call the correct endpoint with default parameters', async () => {
      const mockResponse = {
        data: {
          syncId: 'sync_123',
          status: 'completed',
          sync: { synced: 10, errors: [] },
          duration: 1000
        }
      }
      
      api.post.mockResolvedValue(mockResponse)

      const result = await posSyncService.syncInventory(1)

      expect(api.post).toHaveBeenCalledWith('/pos/square/inventory/sync/1', {}, {
        params: { incremental: true, dryRun: false, clearBeforeSync: false }
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('should pass custom options to the API', async () => {
      const mockResponse = { data: {} }
      api.post.mockResolvedValue(mockResponse)

      await posSyncService.syncInventory(1, {
        incremental: false,
        dryRun: true,
        clearBeforeSync: true
      })

      expect(api.post).toHaveBeenCalledWith('/pos/square/inventory/sync/1', {}, {
        params: { incremental: false, dryRun: true, clearBeforeSync: true }
      })
    })
  })

  describe('transformInventory', () => {
    it('should call the correct endpoint with default parameters', async () => {
      const mockResponse = {
        data: {
          syncId: 'transform_123',
          status: 'completed',
          transform: { successCount: 8, errorCount: 2 }
        }
      }
      
      api.post.mockResolvedValue(mockResponse)

      const result = await posSyncService.transformInventory(1)

      expect(api.post).toHaveBeenCalledWith('/pos/square/inventory/transform/1', {}, {
        params: { dryRun: false }
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('should pass dryRun option to the API', async () => {
      const mockResponse = { data: {} }
      api.post.mockResolvedValue(mockResponse)

      await posSyncService.transformInventory(1, { dryRun: true })

      expect(api.post).toHaveBeenCalledWith('/pos/square/inventory/transform/1', {}, {
        params: { dryRun: true }
      })
    })
  })

  describe('getSyncStatus', () => {
    it('should call the correct endpoint', async () => {
      const mockResponse = {
        data: {
          connectionId: 1,
          tier1Count: 10,
          tier2Count: 8
        }
      }
      
      api.get.mockResolvedValue(mockResponse)

      const result = await posSyncService.getSyncStatus(1)

      expect(api.get).toHaveBeenCalledWith('/pos/square/inventory/status/1')
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('clearPOSData', () => {
    it('should call the correct endpoint', async () => {
      const mockResponse = {
        data: {
          deleted: { categories: 5, items: 10 }
        }
      }
      
      api.delete.mockResolvedValue(mockResponse)

      const result = await posSyncService.clearPOSData(1)

      expect(api.delete).toHaveBeenCalledWith('/pos/square/inventory/1')
      expect(result).toEqual(mockResponse.data)
    })
  })

  // ============================================
  // NEW SALES SYNC TESTS (TDD - tests first!)
  // ============================================

  describe('syncSales', () => {
    it('should call the correct endpoint with required date parameters', async () => {
      const mockResponse = {
        data: {
          syncId: 'sales_sync_123',
          status: 'completed',
          sync: {
            synced: { orders: 50, lineItems: 200 },
            errors: []
          },
          transform: {
            created: 180,
            skipped: 20,
            errors: []
          },
          duration: 2500
        }
      }
      
      api.post.mockResolvedValue(mockResponse)

      const result = await posSyncService.syncSales(1, {
        startDate: '2025-10-01',
        endDate: '2025-10-07'
      })

      expect(api.post).toHaveBeenCalledWith('/pos/square/sales/sync/1', {
        startDate: '2025-10-01',
        endDate: '2025-10-07',
        dryRun: false
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('should pass custom options to the API', async () => {
      const mockResponse = { data: {} }
      api.post.mockResolvedValue(mockResponse)

      await posSyncService.syncSales(1, {
        startDate: '2025-10-01',
        endDate: '2025-10-07',
        transform: false,
        dryRun: true
      })

      expect(api.post).toHaveBeenCalledWith('/pos/square/sales/sync/1', {
        startDate: '2025-10-01',
        endDate: '2025-10-07',
        dryRun: true
      })
    })

    it('should handle API response with correct data structure', async () => {
      const mockApiResponse = {
        data: {
          syncId: 'sales_sync_456',
          connectionId: 1,
          restaurantId: 1,
          phase: 'complete',
          status: 'completed',
          startedAt: '2025-10-13T10:00:00.000Z',
          completedAt: '2025-10-13T10:00:02.500Z',
          duration: 2500,
          sync: {
            synced: {
              orders: 50,
              lineItems: 200
            },
            errors: [],
            details: {
              dateRange: {
                start: '2025-10-01',
                end: '2025-10-07'
              }
            }
          },
          transform: {
            processed: 200,
            created: 180,
            skipped: 20,
            errors: []
          },
          errors: []
        }
      }

      api.post.mockResolvedValue(mockApiResponse)

      const result = await posSyncService.syncSales(1, {
        startDate: '2025-10-01',
        endDate: '2025-10-07'
      })

      // Verify the exact data structure we expect in components
      expect(result.syncId).toBe('sales_sync_456')
      expect(result.status).toBe('completed')
      expect(result.sync.synced.orders).toBe(50)
      expect(result.sync.synced.lineItems).toBe(200)
      expect(result.transform.created).toBe(180)
      expect(result.transform.skipped).toBe(20)
      expect(result.duration).toBe(2500)
    })

    it('should throw error if startDate is missing', async () => {
      await expect(
        posSyncService.syncSales(1, { endDate: '2025-10-07' })
      ).rejects.toThrow('startDate is required for sales sync')
    })

    it('should throw error if endDate is missing', async () => {
      await expect(
        posSyncService.syncSales(1, { startDate: '2025-10-01' })
      ).rejects.toThrow('endDate is required for sales sync')
    })

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('Connection failed')
      mockError.response = {
        status: 500,
        data: { error: 'Internal server error' }
      }
      
      api.post.mockRejectedValue(mockError)

      await expect(
        posSyncService.syncSales(1, {
          startDate: '2025-10-01',
          endDate: '2025-10-07'
        })
      ).rejects.toThrow('Connection failed')
    })
  })

  describe('getSalesStatus', () => {
    it('should call the correct endpoint', async () => {
      const mockResponse = {
        data: {
          connectionId: 1,
          restaurantId: 1,
          provider: 'square',
          tier1: {
            orders: 50,
            orderItems: 200
          },
          tier2: {
            transactions: 180
          },
          lastSyncAt: '2025-10-13T10:00:00.000Z',
          status: 'synced'
        }
      }
      
      api.get.mockResolvedValue(mockResponse)

      const result = await posSyncService.getSalesStatus(1)

      expect(api.get).toHaveBeenCalledWith('/pos/square/sales/status/1')
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle missing sales data gracefully', async () => {
      const mockResponse = {
        data: {
          connectionId: 1,
          tier1: { orders: 0, orderItems: 0 },
          tier2: { transactions: 0 },
          status: 'not_synced'
        }
      }
      
      api.get.mockResolvedValue(mockResponse)

      const result = await posSyncService.getSalesStatus(1)

      expect(result.tier1.orders).toBe(0)
      expect(result.status).toBe('not_synced')
    })
  })

  describe('clearSalesData', () => {
    it('should call the correct endpoint', async () => {
      const mockResponse = {
        data: {
          deleted: {
            orders: 50,
            orderItems: 200,
            transactions: 180
          },
          message: 'Sales data cleared successfully'
        }
      }
      
      api.delete.mockResolvedValue(mockResponse)

      const result = await posSyncService.clearSalesData(1)

      expect(api.delete).toHaveBeenCalledWith('/pos/square/sales/1')
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle errors during deletion', async () => {
      const mockError = new Error('Delete failed')
      mockError.response = {
        status: 500,
        data: { error: 'Database error' }
      }
      
      api.delete.mockRejectedValue(mockError)

      await expect(
        posSyncService.clearSalesData(1)
      ).rejects.toThrow('Delete failed')
    })
  })
})
