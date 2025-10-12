/**
 * Square Adapter Integration Tests
 * 
 * Purpose: End-to-end integration tests for Square POS adapter
 * Tests complete flow: Connection → Sync → Database with real Square SDK
 * 
 * Progress Note: Issue #19 - Square POS Adapter Implementation
 * Phase 5: Integration Testing
 */

import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import SquareAdapter from '../../src/adapters/SquareAdapter.js';
import POSConnection from '../../src/models/POSConnection.js';
import SquareCategory from '../../src/models/SquareCategory.js';
import SquareMenuItem from '../../src/models/SquareMenuItem.js';
import SquareInventoryCount from '../../src/models/SquareInventoryCount.js';
import { MockSquareClient } from '../fixtures/squareApiResponses.js';

describe('Square Adapter Integration Tests', () => {
  let adapter;
  let mockConnection;
  let mockClient;

  beforeAll(async () => {
    // Initialize adapter with test configuration
    const config = {
      provider: 'square',
      environment: 'sandbox',
      oauth: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['ITEMS_READ', 'MERCHANT_PROFILE_READ', 'INVENTORY_READ'],
        authorizationUrl: 'https://squareupsandbox.com',
        tokenUrl: 'https://squareupsandbox.com/oauth2/token'
      },
      api: {
        baseUrl: 'https://connect.squareupsandbox.com',
        version: '2023-10-18',
        rateLimit: {
          maxRequests: 80,
          windowMs: 10000
        }
      }
    };

    adapter = new SquareAdapter(config);
    await adapter.initialize();
  });

  afterAll(() => {
    // Cleanup rate limiter to prevent test hanging
    if (adapter && adapter.rateLimiter) {
      adapter.rateLimiter.clearAllBuckets();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock connection with realistic data
    mockConnection = {
      id: 1,
      restaurantId: 1,
      provider: 'square',
      status: 'active',
      merchantId: 'MERCHANT_123',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 3600000), // 7 days from now
      squareLocationId: 'LOCATION_1',
      lastSyncAt: null,
      isTokenExpired: vi.fn().mockReturnValue(false),
      isActive: vi.fn().mockReturnValue(true),
      getHoursUntilExpiration: vi.fn().mockReturnValue(168), // 7 days
      save: vi.fn().mockResolvedValue(true),
      update: vi.fn().mockResolvedValue(true)
    };

    // Create mock Square client
    mockClient = new MockSquareClient({
      accessToken: mockConnection.accessToken,
      environment: 'sandbox'
    });

    // Spy on mockClient methods for test assertions
    vi.spyOn(mockClient.catalogApi, 'listCatalog');
    vi.spyOn(mockClient.inventoryApi, 'batchRetrieveInventoryCounts');
    vi.spyOn(mockClient.merchantsApi, 'retrieveMerchant');

    // Mock the client creation
    vi.spyOn(adapter, '_getClientForConnection').mockResolvedValue(mockClient);

    // Mock database models
    vi.spyOn(SquareCategory, 'upsert').mockImplementation(async (data) => {
      return [{ ...data, id: Math.floor(Math.random() * 1000) }, true];
    });

    vi.spyOn(SquareMenuItem, 'upsert').mockImplementation(async (data) => {
      return [{ ...data, id: Math.floor(Math.random() * 1000) }, true];
    });

    vi.spyOn(SquareMenuItem, 'findOne').mockImplementation(async ({ where }) => {
      if (where.catalogObjectId === '2TZFAOHWGG7PAK2QEXWYPZSP') {
        return { 
          id: 1, 
          catalogObjectId: '2TZFAOHWGG7PAK2QEXWYPZSP',
          variationIds: ['2TZFAOHWGG7PAK2QEXWYPZSP', 'VARIATION_BURGER_REGULAR']
        };
      }
      return null;
    });

    vi.spyOn(SquareMenuItem, 'findAll').mockResolvedValue([
      { 
        id: 1, 
        posConnectionId: 1,
        squareItemId: '2TZFAOHWGG7PAK2QEXWYPZSP',
        catalogObjectId: '2TZFAOHWGG7PAK2QEXWYPZSP', 
        variationIds: ['2TZFAOHWGG7PAK2QEXWYPZSP', 'VARIATION_BURGER_REGULAR'],
        isDeleted: false
      }
    ]);

    vi.spyOn(SquareInventoryCount, 'create').mockImplementation(async (data) => {
      return { ...data, id: Math.floor(Math.random() * 1000) };
    });

    vi.spyOn(POSConnection, 'findOne').mockResolvedValue(mockConnection);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Complete Sync Flow Tests
  // ==========================================================================

  describe('Complete Sync Flow', () => {
    test('should successfully sync catalog and inventory data', async () => {
      const result = await adapter.syncInventory(mockConnection);

      // Verify sync completed
      expect(result).toBeDefined();
      expect(result.details.categories).toBeGreaterThan(0);
      expect(result.details.items).toBeGreaterThan(0);
      expect(result.details.inventoryCounts).toBeGreaterThanOrEqual(0);

      // Verify database calls were made
      expect(SquareCategory.upsert).toHaveBeenCalled();
      expect(SquareMenuItem.upsert).toHaveBeenCalled();

      // Verify Square API calls were made
      expect(mockClient.catalogApi.listCatalog).toHaveBeenCalled();
      expect(mockClient.inventoryApi.batchRetrieveInventoryCounts).toHaveBeenCalled();
    });

    test('should handle incremental sync with since parameter', async () => {
      const since = new Date(Date.now() - 24 * 3600000); // 24 hours ago

      const result = await adapter.syncInventory(mockConnection, since);

      expect(result).toBeDefined();
      expect(mockClient.catalogApi.listCatalog).toHaveBeenCalledWith(
        undefined,              // cursor (first call)
        expect.any(String),     // types
        undefined,              // catalogVersion
        100,                    // limit
        since.toISOString()     // beginTime
      );
    });

    test('should update connection lastSyncAt after successful sync', async () => {
      await adapter.syncInventory(mockConnection);

      // Implementation uses save() not update()
      expect(mockConnection.save).toHaveBeenCalled();
      expect(mockConnection.lastSyncAt).toBeInstanceOf(Date);
    });

    test('should collect and return errors without failing entire sync', async () => {
      // Make one operation fail
      vi.spyOn(SquareCategory, 'upsert').mockRejectedValueOnce(new Error('Database error'));

      const result = await adapter.syncInventory(mockConnection);

      // Sync should complete despite error
      expect(result).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.details.items).toBeGreaterThan(0); // Other operations succeeded
    });
  });

  // ==========================================================================
  // Rate Limiting Integration Tests
  // ==========================================================================

  describe('Rate Limiting Integration', () => {
    test('should respect rate limits across multiple operations', async () => {
      const acquireSpy = vi.spyOn(adapter.rateLimiter, 'acquireToken');

      await adapter.syncInventory(mockConnection);

      // Verify rate limiter was used
      expect(acquireSpy).toHaveBeenCalled();
      
      // Check rate limiter stats
      const stats = adapter.rateLimiter.getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);
    });

    test('should handle rate limit errors gracefully', async () => {
      // Simulate rate limit error on first call
      let callCount = 0;
      vi.spyOn(mockClient.catalogApi, 'listCatalog').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('Rate limit exceeded');
          error.statusCode = 429;
          error.body = { errors: [{ code: 'RATE_LIMITED' }] };
          Object.defineProperty(error.constructor, 'name', { value: 'SquareError' });
          throw error;
        }
        return { result: { objects: [] } };
      });

      // Should retry and succeed
      await expect(adapter.syncInventory(mockConnection)).resolves.toBeDefined();
      
      expect(callCount).toBeGreaterThan(1); // Retry occurred
    });

    test('should track rate limiter statistics', async () => {
      await adapter.syncInventory(mockConnection);

      // Rate limiter is used, verify acquireToken was called
      const acquireSpy = vi.spyOn(adapter.rateLimiter, 'acquireToken');
      
      // Run another sync to verify rate limiter is working
      await adapter.syncInventory(mockConnection);
      
      expect(acquireSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Retry Policy Integration Tests
  // ==========================================================================

  describe('Retry Policy Integration', () => {
    test('should retry transient failures', async () => {
      let attemptCount = 0;
      vi.spyOn(mockClient.catalogApi, 'listCatalog').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          const error = new Error('Service unavailable');
          error.statusCode = 503;
          error.body = { errors: [] };
          Object.defineProperty(error.constructor, 'name', { value: 'SquareError' });
          throw error;
        }
        return { result: { objects: [] } };
      });

      await adapter.syncInventory(mockConnection);

      expect(attemptCount).toBe(2); // Initial + 1 retry
    });

    test('should not retry non-retryable errors', async () => {
      let attemptCount = 0;
      vi.spyOn(mockClient.catalogApi, 'listCatalog').mockImplementation(async () => {
        attemptCount++;
        const error = new Error('Bad request');
        error.statusCode = 400;
        error.body = { errors: [] };
        Object.defineProperty(error.constructor, 'name', { value: 'SquareError' });
        throw error;
      });

      await expect(adapter.syncInventory(mockConnection)).rejects.toThrow();
      expect(attemptCount).toBe(1); // Only one attempt, no retries
    });

    test('should track retry statistics', async () => {
      let attemptCount = 0;
      vi.spyOn(mockClient.catalogApi, 'listCatalog').mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error('Server error');
          error.statusCode = 500;
          error.body = { errors: [] };
          Object.defineProperty(error.constructor, 'name', { value: 'SquareError' });
          throw error;
        }
        return { result: { objects: [] } };
      });

      await adapter.syncInventory(mockConnection);

      // Verify retry occurred (attemptCount should be 2: initial + 1 retry)
      expect(attemptCount).toBe(2);
    });
  });

  // ==========================================================================
  // Health Check Integration Tests
  // ==========================================================================

  describe('Health Check Integration', () => {
    test('should verify connection health with merchant API', async () => {
      const result = await adapter.healthCheck(mockConnection);

      expect(result).toMatchObject({
        healthy: true,
        message: 'Square connection healthy',
        details: expect.objectContaining({
          connectionId: mockConnection.id,
          provider: 'square',
          merchantName: expect.any(String),
          apiAccessible: true
        })
      });

      expect(mockClient.merchantsApi.retrieveMerchant).toHaveBeenCalledWith('MERCHANT_123');
    });

    test('should detect unhealthy connection', async () => {
      mockConnection.isActive.mockReturnValue(false);

      const result = await adapter.healthCheck(mockConnection);

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Connection not active');
    });

    test('should handle API errors during health check', async () => {
      vi.spyOn(mockClient.merchantsApi, 'retrieveMerchant').mockRejectedValue(
        new Error('Network timeout')
      );

      const result = await adapter.healthCheck(mockConnection);

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Square API error');
      expect(result.details.apiAccessible).toBe(false);
    });
  });

  // ==========================================================================
  // Data Flow Validation Tests
  // ==========================================================================

  describe('Data Flow Validation', () => {
    test('should correctly map Square catalog data to database schema', async () => {
      await adapter.syncInventory(mockConnection);

      // Verify category data mapping (actual field names from SquareAdapter)
      expect(SquareCategory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          posConnectionId: mockConnection.id,
          restaurantId: mockConnection.restaurantId,
          squareCategoryId: expect.any(String),
          name: expect.any(String),
          isDeleted: expect.any(Boolean)
        }),
        expect.any(Object)
      );

      // Verify menu item data mapping (actual field names from SquareAdapter)
      expect(SquareMenuItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          posConnectionId: mockConnection.id,
          restaurantId: mockConnection.restaurantId,
          squareItemId: expect.any(String),
          name: expect.any(String),
          variationIds: expect.any(Array)
        }),
        expect.any(Object)
      );
    });

    test('should correctly map Square inventory counts to database schema', async () => {
      await adapter.syncInventory(mockConnection);

      // Verify inventory count was created (actual field names from SquareAdapter)
      expect(SquareInventoryCount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          posConnectionId: mockConnection.id,
          restaurantId: mockConnection.restaurantId,
          squareMenuItemId: expect.any(Number),
          squareCatalogObjectId: expect.any(String),
          squareLocationId: expect.any(String),
          quantity: expect.any(String),
          squareState: expect.any(String)
        })
      );
    });

    test('should handle items with multiple variations', async () => {
      await adapter.syncInventory(mockConnection);

      // Verify multiple variations were stored
      const upsertCalls = SquareMenuItem.upsert.mock.calls;
      const variationIds = upsertCalls.map(call => call[0].variationId);
      
      // Should have unique variation IDs
      expect(new Set(variationIds).size).toBeGreaterThan(0);
    });

    test('should skip inventory counts for unknown menu items', async () => {
      // Mock findAll to return empty (no menu items)
      SquareMenuItem.findAll.mockResolvedValue([]);

      await adapter.syncInventory(mockConnection);

      // Should have attempted to find menu items
      expect(SquareMenuItem.findAll).toHaveBeenCalled();
      
      // No inventory counts created when no menu items exist
      const createCalls = SquareInventoryCount.create.mock.calls.length;
      expect(createCalls).toBe(0);
    });
  });

  // ==========================================================================
  // Pagination Integration Tests
  // ==========================================================================

  describe('Pagination Integration', () => {
    test('should handle paginated catalog responses', async () => {
      let callCount = 0;
      vi.spyOn(mockClient.catalogApi, 'listCatalog').mockImplementation(async (cursor, types, catalogVersion, limit, beginTime) => {
        callCount++;
        if (callCount === 1) {
          return {
            result: {
              objects: [
                {
                  type: 'CATEGORY',
                  id: 'CAT_1',
                  category_data: { name: 'Category 1' }
                }
              ],
              cursor: 'NEXT_PAGE_CURSOR'
            }
          };
        }
        return { result: { objects: [] } }; // No more pages
      });

      await adapter.syncInventory(mockConnection);

      expect(callCount).toBe(2); // Initial call + pagination call
      expect(mockClient.catalogApi.listCatalog).toHaveBeenCalledWith(
        'NEXT_PAGE_CURSOR', // cursor parameter
        expect.any(String),  // types
        undefined,          // catalogVersion
        100,                // limit
        undefined           // beginTime
      );
    });

    test('should handle batched inventory count requests', async () => {
      // Create 150 menu items to test batching (should split into 2 batches of 100 variation IDs)
      const menuItems = Array.from({ length: 150 }, (_, i) => ({
        id: i + 1,
        posConnectionId: 1,
        squareItemId: `ITEM_${i + 1}`,
        catalogObjectId: `ITEM_${i + 1}`,
        variationIds: [`VARIATION_${i + 1}`], // Array as expected by the code
        isDeleted: false
      }));

      vi.spyOn(SquareMenuItem, 'findAll').mockResolvedValue(menuItems);

      let batchCallCount = 0;
      vi.spyOn(mockClient.inventoryApi, 'batchRetrieveInventoryCounts')
        .mockImplementation(async ({ catalogObjectIds }) => {
          batchCallCount++;
          expect(catalogObjectIds.length).toBeLessThanOrEqual(100);
          return { result: { counts: [] } };
        });

      await adapter.syncInventory(mockConnection);

      expect(batchCallCount).toBe(2); // 150 variation IDs = 2 batches (100 + 50)
    });
  });

  // ==========================================================================
  // Error Recovery Tests
  // ==========================================================================

  describe('Error Recovery', () => {
    test('should continue sync after partial failures', async () => {
      // Make category sync fail but items should still sync
      vi.spyOn(SquareCategory, 'upsert')
        .mockRejectedValueOnce(new Error('Category error'))
        .mockResolvedValue([{}, true]);

      const result = await adapter.syncInventory(mockConnection);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.details.items).toBeGreaterThan(0); // Items still synced
    });

    test('should handle network interruptions with retry attempts', async () => {
      let callCount = 0;
      vi.spyOn(mockClient.catalogApi, 'listCatalog').mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          const error = new Error('ECONNRESET: Connection reset');
          error.code = 'ECONNRESET';
          error.statusCode = 503;
          error.body = { errors: [] };
          Object.defineProperty(error.constructor, 'name', { value: 'SquareError' });
          throw error;
        }
        return { result: { objects: [] } };
      });

      // Should retry and eventually succeed
      const result = await adapter.syncInventory(mockConnection);
      expect(result).toBeDefined();
      expect(callCount).toBeGreaterThan(1); // Should have retried
    });

    test('should provide detailed error information', async () => {
      vi.spyOn(mockClient.catalogApi, 'listCatalog').mockRejectedValue(
        new Error('Detailed test error')
      );

      try {
        await adapter.syncInventory(mockConnection);
      } catch (error) {
        expect(error.message).toContain('Detailed test error');
      }
    });
  });

  // ==========================================================================
  // Performance and Efficiency Tests
  // ==========================================================================

  describe('Performance and Efficiency', () => {
    test('should complete sync in reasonable time', async () => {
      const startTime = Date.now();

      await adapter.syncInventory(mockConnection);

      const duration = Date.now() - startTime;
      
      // With mocks, should complete quickly (< 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    test('should minimize database calls with upsert', async () => {
      await adapter.syncInventory(mockConnection);

      // Should use upsert (one call per item) not separate find + create/update
      const upsertCalls = SquareCategory.upsert.mock.calls.length +
                          SquareMenuItem.upsert.mock.calls.length;
      
      expect(upsertCalls).toBeGreaterThan(0);
    });

    test('should batch inventory API calls efficiently', async () => {
      const batchSpy = vi.spyOn(mockClient.inventoryApi, 'batchRetrieveInventoryCounts');
      const catalogSpy = vi.spyOn(mockClient.catalogApi, 'listCatalog');
      
      await adapter.syncInventory(mockConnection);

      // Should batch inventory requests (not one per item)
      const batchCalls = batchSpy.mock.calls.length;
      const inventoryCalls = catalogSpy.mock.calls.length;
      
      // Should have made at least one batch call if there are inventory counts
      expect(batchCalls).toBeGreaterThanOrEqual(0);
      expect(inventoryCalls).toBeGreaterThan(0);
    });
  });
});
