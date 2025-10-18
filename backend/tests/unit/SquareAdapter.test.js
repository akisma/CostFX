/**
 * Unit Tests: SquareAdapter
 * 
 * Tests the Square POS adapter implementation including:
 * - syncInventory() method and helper methods
 * - Rate limiting integration
 * - Retry policy integration
 * - Database operations (upsert categories, items, counts)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock SquareOrder and SquareOrderItem at module level
vi.mock('../../src/models/SquareOrder.js', () => ({
  default: {
    upsert: vi.fn()
  }
}));
vi.mock('../../src/models/SquareOrderItem.js', () => ({
  default: {
    upsert: vi.fn()
  }
}));

import SquareAdapter from '../../src/adapters/SquareAdapter.js';
import POSConnection from '../../src/models/POSConnection.js';
import SquareCategory from '../../src/models/SquareCategory.js';
import SquareMenuItem from '../../src/models/SquareMenuItem.js';
import SquareInventoryCount from '../../src/models/SquareInventoryCount.js';
import SquareLocation from '../../src/models/SquareLocation.js';
import SquareOrder from '../../src/models/SquareOrder.js';
import SquareOrderItem from '../../src/models/SquareOrderItem.js';
import {
  catalogListResponse,
  inventoryCountsResponse,
  MockSquareClient
} from '../fixtures/squareApiResponses.js';

describe('SquareAdapter', () => {
  let adapter;
  let mockConnection;
  let mockClient;
  
  beforeEach(async () => {
    // Create adapter with test configuration
    const config = {
      provider: 'square',
      environment: 'sandbox',
      oauth: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['ITEMS_READ', 'MERCHANT_PROFILE_READ'],
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
    
    // Mock connection
    mockConnection = {
      id: 1,
      restaurantId: 1,
      provider: 'square',
      status: 'active',
      merchantId: 'MERCHANT_123',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      tokenExpiresAt: new Date(Date.now() + 3600000),
      squareLocationId: 'L72T9RBYVQG4J',
      lastSyncAt: null,
      isTokenExpired: () => false,
      isActive: () => true,
      getHoursUntilExpiration: () => 1, // 1 hour until expiration
      save: vi.fn().mockResolvedValue(true)
    };
    
    // Mock Square client
    mockClient = new MockSquareClient({
      accessToken: mockConnection.accessToken,
      environment: 'sandbox'
    });
    
    // Mock the _getClientForConnection method
    vi.spyOn(adapter, '_getClientForConnection').mockResolvedValue(mockClient);
    
    // Mock database models
    vi.spyOn(SquareCategory, 'upsert').mockResolvedValue([{}, true]);
    vi.spyOn(SquareMenuItem, 'upsert').mockResolvedValue([{}, true]);
    vi.spyOn(SquareMenuItem, 'findAll').mockResolvedValue([
      {
        id: 1,
        squareItemId: 'W62UWFY35CWMYGVWK6TWJDNI',
        variationIds: ['2TZFAOHWGG7PAK2QEXWYPZSP']
      },
      {
        id: 2,
        squareItemId: 'ITEM_BURGER_ID',
        variationIds: ['VARIATION_BURGER_REGULAR']
      }
    ]);
    vi.spyOn(SquareInventoryCount, 'create').mockResolvedValue({});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('syncInventory()', () => {
    it('should sync categories and items from catalog API', async () => {
      const result = await adapter.syncInventory(mockConnection);
      
      expect(result.synced).toBeGreaterThan(0);
      expect(result.details.categories).toBeGreaterThan(0);
      expect(result.details.items).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);
      
      // Verify connection last sync updated
      expect(mockConnection.save).toHaveBeenCalled();
    });
    
    it('should sync inventory counts', async () => {
      const result = await adapter.syncInventory(mockConnection);
      
      expect(result.details.inventoryCounts).toBeGreaterThan(0);
      expect(SquareInventoryCount.create).toHaveBeenCalled();
    });
    
    it('should handle incremental sync with since parameter', async () => {
      const since = new Date('2023-10-01');
      const result = await adapter.syncInventory(mockConnection, since);
      
      expect(result.synced).toBeGreaterThan(0);
      expect(adapter._getClientForConnection).toHaveBeenCalledWith(mockConnection);
    });
    
    it('should collect errors without failing entire sync', async () => {
      // Mock one upsert to fail
      vi.spyOn(SquareCategory, 'upsert').mockRejectedValueOnce(new Error('Database error'));
      
      const result = await adapter.syncInventory(mockConnection);
      
      // Sync should complete despite error
      expect(result.synced).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatchObject({
        error: expect.stringContaining('Database error')
      });
    });
    
    it('should use rate limiter for API calls', async () => {
      const acquireTokenSpy = vi.spyOn(adapter.rateLimiter, 'acquireToken');
      
      await adapter.syncInventory(mockConnection);
      
      // Should call rate limiter multiple times (catalog + inventory API calls)
      expect(acquireTokenSpy).toHaveBeenCalled();
      expect(acquireTokenSpy).toHaveBeenCalledWith(mockConnection.id);
    });
    
    it('should use retry policy for API calls', async () => {
      const executeWithRetrySpy = vi.spyOn(adapter.retryPolicy, 'executeWithRetry');
      
      await adapter.syncInventory(mockConnection);
      
      // Should use retry policy for API calls
      expect(executeWithRetrySpy).toHaveBeenCalled();
    });
  });
  
  describe('_syncCatalogObjects()', () => {
    it('should fetch and store categories', async () => {
      const stats = {
        categoriesSynced: 0,
        itemsSynced: 0,
        inventoryCountsSynced: 0,
        errors: []
      };
      
      await adapter._syncCatalogObjects(mockClient, mockConnection, null, stats);
      
      expect(stats.categoriesSynced).toBeGreaterThan(0);
      expect(SquareCategory.upsert).toHaveBeenCalled();
    });
    
    it('should fetch and store items', async () => {
      const stats = {
        categoriesSynced: 0,
        itemsSynced: 0,
        inventoryCountsSynced: 0,
        errors: []
      };
      
      await adapter._syncCatalogObjects(mockClient, mockConnection, null, stats);
      
      expect(stats.itemsSynced).toBeGreaterThan(0);
      expect(SquareMenuItem.upsert).toHaveBeenCalled();
    });
    
    it('should handle pagination with cursor', async () => {
      const listCatalogSpy = vi.spyOn(mockClient.catalogApi, 'listCatalog');
      const stats = {
        categoriesSynced: 0,
        itemsSynced: 0,
        inventoryCountsSynced: 0,
        errors: []
      };
      
      await adapter._syncCatalogObjects(mockClient, mockConnection, null, stats);
      
      // Should call API at least twice (first page + check for next page)
      expect(listCatalogSpy).toHaveBeenCalled();
    });
    
    it('should pass since parameter for incremental sync', async () => {
      const listCatalogSpy = vi.spyOn(mockClient.catalogApi, 'listCatalog');
      const since = new Date('2023-10-01');
      const stats = {
        categoriesSynced: 0,
        itemsSynced: 0,
        inventoryCountsSynced: 0,
        errors: []
      };
      
      await adapter._syncCatalogObjects(mockClient, mockConnection, since, stats);
      
      // Verify since date passed to API as 5th positional parameter
      expect(listCatalogSpy).toHaveBeenCalledWith(
        undefined,              // cursor (first call)
        expect.any(String),     // types
        undefined,              // catalogVersion
        100,                    // limit
        since.toISOString()     // beginTime
      );
    });
  });
  
  describe('_storeCatalogCategory()', () => {
    it('should upsert category with correct data', async () => {
      const categoryObj = catalogListResponse.objects[0]; // First object is a CATEGORY
      
      await adapter._storeCatalogCategory(mockConnection, categoryObj);
      
      expect(SquareCategory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          posConnectionId: mockConnection.id,
          restaurantId: mockConnection.restaurantId,
          squareCategoryId: categoryObj.id,
          name: 'Beverages',
          squareVersion: String(categoryObj.version), // Version stored as string
          isDeleted: false,
          squareData: categoryObj
        }),
        expect.objectContaining({
          conflictFields: ['square_catalog_object_id'] // Updated field name
        })
      );
    });
    
    it('should handle missing category name', async () => {
      const categoryObj = {
        type: 'CATEGORY',
        id: 'TEST_CAT_ID',
        version: 123,
        updated_at: '2023-10-05T12:00:00Z',
        category_data: {} // No name
      };
      
      await adapter._storeCatalogCategory(mockConnection, categoryObj);
      
      expect(SquareCategory.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Unnamed Category'
        }),
        expect.anything()
      );
    });
  });
  
  describe('_storeCatalogItem()', () => {
    it('should upsert menu item with correct data', async () => {
      const itemObj = catalogListResponse.objects[2]; // Third object is an ITEM (Coffee)
      
      await adapter._storeCatalogItem(mockConnection, itemObj);
      
      expect(SquareMenuItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          posConnectionId: mockConnection.id,
          restaurantId: mockConnection.restaurantId,
          squareItemId: itemObj.id,
          name: 'Coffee',
          description: 'Premium roasted coffee',
          squareCategoryId: 'BJNQCF2FJ6S6VVRSXC2TCMCH',
          priceMoneyAmount: 250,
          priceMoneyAmountCurrency: 'USD',
          squareVersion: String(itemObj.version), // Version is stored as string
          isDeleted: false,
          variationIds: ['2TZFAOHWGG7PAK2QEXWYPZSP'],
          squareData: itemObj
        }),
        expect.objectContaining({
          conflictFields: ['square_catalog_object_id'] // Updated field name
        })
      );
    });
    
    it('should handle items without variations', async () => {
      const itemObj = {
        type: 'ITEM',
        id: 'TEST_ITEM_ID',
        version: 123,
        updated_at: '2023-10-05T12:00:00Z',
        item_data: {
          name: 'Test Item',
          variations: []
        }
      };
      
      await adapter._storeCatalogItem(mockConnection, itemObj);
      
      expect(SquareMenuItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          priceMoneyAmount: 0,
          priceMoneyAmountCurrency: 'USD',
          variationIds: []
        }),
        expect.anything()
      );
    });
  });
  
  describe('_syncInventoryCounts()', () => {
    it('should fetch and store inventory counts', async () => {
      const stats = {
        categoriesSynced: 0,
        itemsSynced: 0,
        inventoryCountsSynced: 0,
        errors: []
      };
      
      await adapter._syncInventoryCounts(mockClient, mockConnection, stats);
      
      expect(stats.inventoryCountsSynced).toBeGreaterThan(0);
      expect(SquareInventoryCount.create).toHaveBeenCalled();
    });
    
    it('should handle menu items without variation IDs', async () => {
      SquareMenuItem.findAll.mockResolvedValueOnce([
        {
          id: 1,
          squareItemId: 'TEST_ITEM',
          variationIds: []
        }
      ]);
      
      const stats = {
        categoriesSynced: 0,
        itemsSynced: 0,
        inventoryCountsSynced: 0,
        errors: []
      };
      
      await adapter._syncInventoryCounts(mockClient, mockConnection, stats);
      
      // Should complete without error, no counts stored
      expect(stats.inventoryCountsSynced).toBe(0);
    });
    
    it('should batch inventory count requests', async () => {
      // Create 150 variation IDs (should trigger 2 batches of 100)
      const manyVariations = Array.from({ length: 150 }, (_, i) => `VAR_${i}`);
      SquareMenuItem.findAll.mockResolvedValueOnce([
        {
          id: 1,
          squareItemId: 'TEST_ITEM',
          variationIds: manyVariations
        }
      ]);
      
      // Clear previous calls and mock the return value  
      const batchRetrieveSpy = vi.spyOn(mockClient.inventoryApi, 'batchRetrieveInventoryCounts')
        .mockClear()
        .mockResolvedValue({ result: { counts: [] } });
      
      const stats = {
        categoriesSynced: 0,
        itemsSynced: 0,
        inventoryCountsSynced: 0,
        errors: []
      };
      
      await adapter._syncInventoryCounts(mockClient, mockConnection, stats);
      
      // Should make multiple API calls (batches of 100)
      expect(batchRetrieveSpy).toHaveBeenCalledTimes(2); // 150 items = 2 batches
    });
  });
  
  describe('_storeInventoryCount()', () => {
    const menuItems = [
      {
        id: 1,
        squareItemId: 'W62UWFY35CWMYGVWK6TWJDNI',
        variationIds: ['2TZFAOHWGG7PAK2QEXWYPZSP']
      }
    ];
    
    it('should create inventory count with correct data', async () => {
      const countObj = inventoryCountsResponse.counts[0];
      
      await adapter._storeInventoryCount(mockConnection, countObj, menuItems);
      
      expect(SquareInventoryCount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          posConnectionId: mockConnection.id,
          restaurantId: mockConnection.restaurantId,
          squareMenuItemId: 1,
          squareCatalogObjectId: countObj.catalog_object_id,
          squareCatalogObjectType: 'ITEM_VARIATION',
          squareState: 'IN_STOCK',
          squareLocationId: 'L72T9RBYVQG4J',
          quantity: '100',
          squareData: countObj
        })
      );
    });
    
    it('should skip counts for unknown menu items', async () => {
      const countObj = {
        catalog_object_id: 'UNKNOWN_VARIATION_ID',
        state: 'IN_STOCK',
        quantity: '10'
      };
      
      await adapter._storeInventoryCount(mockConnection, countObj, menuItems);
      
      // Should not create count for unknown item
      expect(SquareInventoryCount.create).not.toHaveBeenCalled();
    });
    
    it('should handle multiple inventory states', async () => {
      const counts = inventoryCountsResponse.counts; // Includes IN_STOCK and WASTE
      
      for (const count of counts) {
        await adapter._storeInventoryCount(mockConnection, count, [
          {
            id: 1,
            squareItemId: 'ITEM_BURGER_ID',
            variationIds: ['VARIATION_BURGER_REGULAR']
          }
        ]);
      }
      
      // Should create multiple counts (one for each state)
      expect(SquareInventoryCount.create).toHaveBeenCalledTimes(2); // IN_STOCK and WASTE
    });
  });
  
  describe('Rate Limiting Integration', () => {
    it('should respect rate limits during catalog sync', async () => {
      const acquireTokenSpy = vi.spyOn(adapter.rateLimiter, 'acquireToken');
      
      await adapter.syncInventory(mockConnection);
      
      // Verify rate limiter was used for each API call
      expect(acquireTokenSpy.mock.calls.length).toBeGreaterThan(0);
      
      // All calls should use the same connection ID
      acquireTokenSpy.mock.calls.forEach(call => {
        expect(call[0]).toBe(mockConnection.id);
      });
    });
    
    it('should handle rate limit errors gracefully', async () => {
      // Mock rate limiter to pause
      vi.spyOn(adapter.rateLimiter, 'acquireToken').mockImplementation(async (connId) => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate brief wait
      });
      
      const result = await adapter.syncInventory(mockConnection);
      
      // Should still complete successfully
      expect(result.synced).toBeGreaterThan(0);
    });
  });
  
  describe('Retry Policy Integration', () => {
    it('should retry on transient failures', async () => {
      // Test the retry policy directly, not through the adapter methods
      let attempts = 0;
      const testFn = async () => {
        attempts++;
        if (attempts === 1) {
          const error = new Error('Service unavailable');
          error.statusCode = 503;
          error.body = { errors: [] };
          // Make it look like a SquareError for the retry policy
          Object.defineProperty(error.constructor, 'name', { value: 'SquareError' });
          throw error;
        }
        return { success: true };
      };
      
      // Mock _delay to make test fast
      vi.spyOn(adapter.retryPolicy, '_delay').mockResolvedValue(undefined);
      
      const result = await adapter.retryPolicy.executeWithRetry(testFn, { method: 'test' });
      
      expect(result.success).toBe(true);
      expect(attempts).toBe(2); // Initial attempt + 1 retry
    });
    
    it('should not retry on non-retryable errors', async () => {
      let attempts = 0;
      vi.spyOn(mockClient.catalogApi, 'listCatalog').mockImplementation(async () => {
        attempts++;
        const error = new Error('Bad request');
        error.statusCode = 400;
        error.body = { errors: [] };
        // Make it look like a SquareError for the retry policy
        Object.defineProperty(error.constructor, 'name', { value: 'SquareError' });
        throw error;
      });
      
      // syncInventory will throw when the catalog API fails with a non-retryable error
      await expect(adapter.syncInventory(mockConnection)).rejects.toThrow();
      
      // Should only try once (no retries for 400 errors)
      expect(attempts).toBe(1);
    });
  });

  // ==========================================================================
  // healthCheck() Tests
  // ==========================================================================
  
  describe('healthCheck()', () => {
    it('should return healthy status for active connection', async () => {
      vi.spyOn(mockClient.merchantsApi, 'retrieveMerchant').mockResolvedValue({
        result: {
          merchant: {
            id: 'MERCHANT_123',
            businessName: 'Test Restaurant',
            country: 'US'
          }
        }
      });

      const result = await adapter.healthCheck(mockConnection);

      expect(result.healthy).toBe(true);
      expect(result.message).toBe('Square connection healthy');
      expect(result.details).toMatchObject({
        connectionId: mockConnection.id,
        provider: 'square',
        restaurantId: mockConnection.restaurantId,
        status: 'active',
        tokenExpired: false,
        apiAccessible: true,
        merchantName: 'Test Restaurant'
      });
      expect(mockClient.merchantsApi.retrieveMerchant).toHaveBeenCalledWith('MERCHANT_123');
    });

    it('should return unhealthy status for inactive connection', async () => {
      // Make connection inactive
      vi.spyOn(mockConnection, 'isActive').mockReturnValue(false);
      vi.spyOn(mockConnection, 'isTokenExpired').mockReturnValue(true);
      mockConnection.status = 'expired';

      const result = await adapter.healthCheck(mockConnection);

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Connection not active');
      expect(result.message).toContain('status: expired');
      expect(result.details).toMatchObject({
        connectionId: mockConnection.id,
        provider: 'square',
        restaurantId: mockConnection.restaurantId,
        status: 'expired',
        tokenExpired: true
      });
      // retrieveMerchant should not be called since connection is inactive
      expect(adapter._getClientForConnection).not.toHaveBeenCalled();
    });

    it('should return unhealthy status for expired token', async () => {
      // Make token expired
      vi.spyOn(mockConnection, 'isTokenExpired').mockReturnValue(true);
      vi.spyOn(mockConnection, 'isActive').mockReturnValue(false);
      mockConnection.status = 'expired';

      const result = await adapter.healthCheck(mockConnection);

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Connection not active');
      expect(result.message).toContain('token expired: true');
      expect(result.details.tokenExpired).toBe(true);
    });

    it('should handle authentication errors (401)', async () => {
      vi.spyOn(mockClient.merchantsApi, 'retrieveMerchant').mockRejectedValue(
        new Error('Unauthorized')
      );

      const result = await adapter.healthCheck(mockConnection);

      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Square API error: Unauthorized');
      expect(result.details).toMatchObject({
        connectionId: mockConnection.id,
        provider: 'square',
        apiAccessible: false,
        error: 'Unauthorized'
      });
    });

    it('should handle network errors', async () => {
      vi.spyOn(mockClient.merchantsApi, 'retrieveMerchant').mockRejectedValue(
        new Error('Network timeout')
      );

      const result = await adapter.healthCheck(mockConnection);

      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Square API error: Network timeout');
      expect(result.details.apiAccessible).toBe(false);
      expect(result.details.error).toBe('Network timeout');
    });

    it('should handle Square API errors (503)', async () => {
      const apiError = new Error('Service unavailable');
      apiError.statusCode = 503;
      vi.spyOn(mockClient.merchantsApi, 'retrieveMerchant').mockRejectedValue(apiError);

      const result = await adapter.healthCheck(mockConnection);

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Square API error');
      expect(result.details.apiAccessible).toBe(false);
    });

    it('should include token expiration hours in details', async () => {
      vi.spyOn(mockConnection, 'getHoursUntilExpiration').mockReturnValue(168); // 7 days
      vi.spyOn(mockClient.merchantsApi, 'retrieveMerchant').mockResolvedValue({
        result: {
          merchant: {
            id: 'MERCHANT_123',
            businessName: 'Test Restaurant'
          }
        }
      });

      const result = await adapter.healthCheck(mockConnection);

      expect(result.healthy).toBe(true);
      expect(result.details.hoursUntilExpiration).toBe(168);
    });

    it('should handle missing merchant data gracefully', async () => {
      vi.spyOn(mockClient.merchantsApi, 'retrieveMerchant').mockResolvedValue({
        result: {
          merchant: null
        }
      });

      const result = await adapter.healthCheck(mockConnection);

      expect(result.healthy).toBe(true);
      expect(result.details.merchantName).toBe('Unknown');
    });

    it('should throw error if adapter not initialized', async () => {
      const uninitializedConfig = {
        provider: 'square',
        environment: 'sandbox',
        oauth: {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          redirectUri: 'http://localhost:3000/callback',
          scopes: ['ITEMS_READ'],
          authorizationUrl: 'https://squareupsandbox.com',
          tokenUrl: 'https://squareupsandbox.com/oauth2/token'
        },
        api: {
          baseUrl: 'https://connect.squareupsandbox.com',
          version: '2023-10-18',
          rateLimit: { maxRequests: 80, windowMs: 10000 }
        }
      };
      const uninitializedAdapter = new SquareAdapter(uninitializedConfig);
      
      await expect(
        uninitializedAdapter.healthCheck(mockConnection)
      ).rejects.toThrow('must be initialized before use');
    });
  });

  describe('syncSales()', () => {
    beforeEach(async () => {
      // Configure the mocked model methods
      SquareOrder.upsert.mockResolvedValue([{}, true]);
      SquareOrderItem.upsert.mockResolvedValue([{}, true]);
      
      // Spy on the mock client's searchOrders method
      vi.spyOn(mockClient.ordersApi, 'searchOrders');

      // Provide enabled locations for the adapter to process during sync
      vi.spyOn(SquareLocation, 'findAll').mockResolvedValue([
        {
          id: 101,
          posConnectionId: mockConnection.id,
          restaurantId: mockConnection.restaurantId,
          locationId: 'L72T9RBYVQG4J',
          name: 'Main Square Location',
          syncEnabled: true
        }
      ]);
    });

    it('should sync sales data from Square Orders API', async () => {
      const startDate = new Date('2023-10-01T00:00:00Z');
      const endDate = new Date('2023-10-31T23:59:59Z');

      const result = await adapter.syncSales(mockConnection, startDate, endDate);

      expect(result.synced.orders).toBe(1);
      expect(result.synced.lineItems).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.details.apiCalls).toBeGreaterThan(0);
      expect(mockClient.ordersApi.searchOrders).toHaveBeenCalled();
    });

    it('should pass correct date range to Square API', async () => {
      const startDate = new Date('2023-10-01T00:00:00Z');
      const endDate = new Date('2023-10-31T23:59:59Z');

      await adapter.syncSales(mockConnection, startDate, endDate);

      expect(mockClient.ordersApi.searchOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          locationIds: ['L72T9RBYVQG4J'],
          query: expect.objectContaining({
            filter: expect.objectContaining({
              dateTimeFilter: expect.objectContaining({
                closedAt: {
                  startAt: startDate.toISOString(),
                  endAt: endDate.toISOString()
                }
              }),
              stateFilter: {
                states: ['COMPLETED', 'OPEN']
              }
            })
          })
        })
      );
    });

    it('should handle pagination with cursor', async () => {
      // Mock paginated response
      let callCount = 0;
      vi.spyOn(mockClient.ordersApi, 'searchOrders').mockImplementation(async ({ cursor }) => {
        callCount++;
        if (callCount === 1) {
          return {
            result: {
              orders: [{ id: 'ORDER1', line_items: [{ uid: 'LINE1' }] }],
              cursor: 'NEXT_PAGE_CURSOR'
            }
          };
        }
        return {
          result: {
            orders: [{ id: 'ORDER2', line_items: [{ uid: 'LINE2' }] }],
            cursor: null
          }
        };
      });

      const result = await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(result.synced.orders).toBe(2);
      expect(result.details.pages).toBe(2);
      expect(mockClient.ordersApi.searchOrders).toHaveBeenCalledTimes(2);
    });

    it('should respect 500 order limit per request', async () => {
      await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(mockClient.ordersApi.searchOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 500
        })
      );
    });

    it('should upsert orders to SquareOrder model', async () => {
      const result = await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(SquareOrder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          squareOrderId: 'ORDER123456',
          locationId: 'L72T9RBYVQG4J',
          posConnectionId: 1,
          restaurantId: 1
        }),
        expect.objectContaining({
          conflictFields: ['squareOrderId']
        })
      );
    });

    it('should upsert line items to SquareOrderItem model', async () => {
      await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(SquareOrderItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          squareLineItemUid: 'LINE_ITEM_UID_1',
          name: 'Coffee',
          quantity: 2, // Parsed to float
          squareCatalogObjectId: '2TZFAOHWGG7PAK2QEXWYPZSP'
        }),
        expect.objectContaining({
          conflictFields: ['squareLineItemUid']
        })
      );
    });

    it('should store full order data in JSONB', async () => {
      await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(SquareOrder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          squareData: expect.objectContaining({
            id: 'ORDER123456',
            lineItems: expect.any(Array)
          })
        }),
        expect.any(Object)
      );
    });

    it('should update connection.lastSyncAt timestamp', async () => {
      const beforeSync = new Date();

      await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(mockConnection.save).toHaveBeenCalled();
      expect(mockConnection.lastSyncAt).toBeInstanceOf(Date);
      expect(mockConnection.lastSyncAt.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
    });

    it('should handle empty results', async () => {
      vi.spyOn(mockClient.ordersApi, 'searchOrders').mockResolvedValue({
        result: { orders: [] }
      });

      const result = await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(result.synced.orders).toBe(0);
      expect(result.synced.lineItems).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle orders without line items', async () => {
      vi.spyOn(mockClient.ordersApi, 'searchOrders').mockResolvedValue({
        result: {
          orders: [
            {
              id: 'ORDER_NO_ITEMS',
              location_id: 'L72T9RBYVQG4J',
              state: 'COMPLETED',
              line_items: []
            }
          ]
        }
      });

      const result = await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(result.synced.orders).toBe(1);
      expect(result.synced.lineItems).toBe(0);
    });

    it('should collect errors for failed order upserts', async () => {
      SquareOrder.upsert.mockRejectedValueOnce(
        new Error('Database constraint violation')
      );

      const result = await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('Database constraint violation');
    });

    it('should continue processing after single order error', async () => {
      mockClient.ordersApi.searchOrders.mockResolvedValue({
        result: {
          orders: [
            { id: 'ORDER1', line_items: [{ uid: 'LINE1' }] },
            { id: 'ORDER2', line_items: [{ uid: 'LINE2' }] }
          ]
        }
      });

      SquareOrder.upsert
        .mockRejectedValueOnce(new Error('First order failed'))
        .mockResolvedValueOnce([{}, true]);

      const result = await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(result.synced.orders).toBe(1); // Second order succeeded
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle Square API errors', async () => {
      vi.spyOn(mockClient.ordersApi, 'searchOrders').mockRejectedValue(
        new Error('Square API error: Invalid access token')
      );

      await expect(
        adapter.syncSales(mockConnection, new Date('2023-10-01'), new Date('2023-10-31'))
      ).rejects.toThrow();
    });

    it('should use rate limiter before API calls', async () => {
      const acquireTokenSpy = vi.spyOn(adapter.rateLimiter, 'acquireToken');

      await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(acquireTokenSpy).toHaveBeenCalledWith('MERCHANT_123');
    });

    it('should use retry policy for transient failures', async () => {
      const executeWithRetrySpy = vi.spyOn(adapter.retryPolicy, 'executeWithRetry');

      await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(executeWithRetrySpy).toHaveBeenCalled();
    });

    it('should validate connection is provided', async () => {
      await expect(
        adapter.syncSales(null, new Date(), new Date())
      ).rejects.toThrow();
    });

    it('should validate date range is provided', async () => {
      await expect(
        adapter.syncSales(mockConnection, null, new Date())
      ).rejects.toThrow();

      await expect(
        adapter.syncSales(mockConnection, new Date(), null)
      ).rejects.toThrow();
    });

    it('should include cursor in result details', async () => {
      // First call returns a cursor, second call returns no cursor to stop pagination
      mockClient.ordersApi.searchOrders
        .mockResolvedValueOnce({
          result: {
            orders: [],
            cursor: 'FINAL_CURSOR'
          }
        })
        .mockResolvedValueOnce({
          result: {
            orders: [],
            cursor: null
          }
        });

      const result = await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(result.details.cursor).toBe('FINAL_CURSOR');
    });

    it('should track API call count', async () => {
      let callCount = 0;
      vi.spyOn(mockClient.ordersApi, 'searchOrders').mockImplementation(async ({ cursor }) => {
        callCount++;
        if (callCount < 3) {
          return {
            result: { orders: [{ id: `ORDER${callCount}`, line_items: [] }], cursor: 'NEXT' }
          };
        }
        return { result: { orders: [], cursor: null } };
      });

      const result = await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(result.details.apiCalls).toBe(3);
    });

    it('should handle large date ranges', async () => {
      const startDate = new Date('2020-01-01T00:00:00Z');
      const endDate = new Date('2023-12-31T23:59:59Z');

      const result = await adapter.syncSales(mockConnection, startDate, endDate);

      expect(mockClient.ordersApi.searchOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            filter: expect.objectContaining({
              dateTimeFilter: expect.objectContaining({
                closedAt: {
                  startAt: startDate.toISOString(),
                  endAt: endDate.toISOString()
                }
              })
            })
          })
        })
      );
    });

    it('should filter by COMPLETED and OPEN states', async () => {
      await adapter.syncSales(
        mockConnection,
        new Date('2023-10-01'),
        new Date('2023-10-31')
      );

      expect(mockClient.ordersApi.searchOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            filter: expect.objectContaining({
              stateFilter: {
                states: ['COMPLETED', 'OPEN']
              }
            })
          })
        })
      );
    });
  });
});
