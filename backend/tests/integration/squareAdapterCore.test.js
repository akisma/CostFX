/**
 * Square Adapter Core Integration Tests
 * 
 * Purpose: Focused integration tests for core Square POS adapter flows
 * Tests: Connection health, basic sync, rate limiting, retry policy
 * 
 * Progress Note: Issue #19 - Square POS Adapter Implementation
 * Phase 5: Integration Testing (Simplified Core Tests)
 */

import { vi, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import SquareAdapter from '../../src/adapters/SquareAdapter.js';
import POSConnection from '../../src/models/POSConnection.js';
import SquareCategory from '../../src/models/SquareCategory.js';
import SquareMenuItem from '../../src/models/SquareMenuItem.js';
import SquareInventoryCount from '../../src/models/SquareInventoryCount.js';
import { MockSquareClient } from '../fixtures/squareApiResponses.js';

describe('Square Adapter Core Integration', () => {
  let adapter;
  let mockConnection;
  let mockClient;

  beforeAll(async () => {
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

    mockConnection = {
      id: 1,
      restaurantId: 1,
      provider: 'square',
      status: 'active',
      merchantId: 'MERCHANT_123',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 3600000),
      squareLocationId: 'LOCATION_1',
      lastSyncAt: null,
      isTokenExpired: vi.fn().mockReturnValue(false),
      isActive: vi.fn().mockReturnValue(true),
      getHoursUntilExpiration: vi.fn().mockReturnValue(168),
      save: vi.fn().mockResolvedValue(true),
      update: vi.fn().mockResolvedValue(true)
    };

    mockClient = new MockSquareClient({
      accessToken: mockConnection.accessToken,
      environment: 'sandbox'
    });

    vi.spyOn(adapter, '_getClientForConnection').mockResolvedValue(mockClient);
    vi.spyOn(SquareCategory, 'upsert').mockResolvedValue([{}, true]);
    vi.spyOn(SquareMenuItem, 'upsert').mockResolvedValue([{}, true]);
    vi.spyOn(SquareMenuItem, 'findOne').mockResolvedValue({ id: 1, catalogObjectId: '2TZFAOHWGG7PAK2QEXWYPZSP' });
    vi.spyOn(SquareMenuItem, 'findAll').mockResolvedValue([{ id: 1, catalogObjectId: '2TZFAOHWGG7PAK2QEXWYPZSP', variationId: '2TZFAOHWGG7PAK2QEXWYPZSP' }]);
    vi.spyOn(SquareInventoryCount, 'create').mockResolvedValue({});
    vi.spyOn(POSConnection, 'findOne').mockResolvedValue(mockConnection);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Core Sync Functionality', () => {
    test('should complete basic sync successfully', async () => {
      const result = await adapter.syncInventory(mockConnection);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('details');
      expect(result.details.categories).toBeGreaterThan(0);
      expect(result.details.items).toBeGreaterThan(0);
    });

    test('should call Square Catalog API during sync', async () => {
      const catalogSpy = vi.spyOn(mockClient.catalogApi, 'listCatalog');

      await adapter.syncInventory(mockConnection);

      expect(catalogSpy).toHaveBeenCalled();
    });

    test('should upsert data to database', async () => {
      await adapter.syncInventory(mockConnection);

      expect(SquareCategory.upsert).toHaveBeenCalled();
      expect(SquareMenuItem.upsert).toHaveBeenCalled();
    });

    test('should handle incremental sync with timestamp', async () => {
      const since = new Date(Date.now() - 24 * 3600000);
      const catalogSpy = vi.spyOn(mockClient.catalogApi, 'listCatalog');

      await adapter.syncInventory(mockConnection, since);

      expect(catalogSpy).toHaveBeenCalledWith(
        undefined,              // cursor (first call)
        expect.any(String),     // types
        undefined,              // catalogVersion
        100,                    // limit
        since.toISOString()     // beginTime
      );
    });

    test('should update lastSyncAt after sync', async () => {
      await adapter.syncInventory(mockConnection);

      expect(mockConnection.save).toHaveBeenCalled();
      expect(mockConnection.lastSyncAt).toBeInstanceOf(Date);
    });
  });

  describe('Rate Limiting', () => {
    test('should use rate limiter during sync', async () => {
      const acquireSpy = vi.spyOn(adapter.rateLimiter, 'acquireToken');

      await adapter.syncInventory(mockConnection);

      expect(acquireSpy).toHaveBeenCalled();
    });

    test('should track rate limiter statistics', async () => {
      await adapter.syncInventory(mockConnection);

      const stats = adapter.rateLimiter.getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);
    });
  });

  describe('Retry Policy', () => {
    test('should retry on transient failures', async () => {
      let attempts = 0;
      vi.spyOn(mockClient.catalogApi, 'listCatalog').mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Service unavailable');
          error.statusCode = 503;
          error.body = { errors: [] };
          Object.defineProperty(error.constructor, 'name', { value: 'SquareError' });
          throw error;
        }
        return { result: { objects: [] } };
      });

      await adapter.syncInventory(mockConnection);

      expect(attempts).toBe(2);
    });

    test('should not retry non-retryable errors', async () => {
      let attempts = 0;
      vi.spyOn(mockClient.catalogApi, 'listCatalog').mockImplementation(async () => {
        attempts++;
        const error = new Error('Bad request');
        error.statusCode = 400;
        error.body = { errors: [] };
        Object.defineProperty(error.constructor, 'name', { value: 'SquareError' });
        throw error;
      });

      await expect(adapter.syncInventory(mockConnection)).rejects.toThrow();
      expect(attempts).toBe(1);
    });
  });

  describe('Health Check', () => {
    test('should verify healthy connection', async () => {
      const result = await adapter.healthCheck(mockConnection);

      expect(result.healthy).toBe(true);
      expect(result.message).toBe('Square connection healthy');
      expect(result.details).toMatchObject({
        connectionId: 1,
        provider: 'square',
        apiAccessible: true
      });
    });

    test('should detect inactive connection', async () => {
      mockConnection.isActive.mockReturnValue(false);

      const result = await adapter.healthCheck(mockConnection);

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Connection not active');
    });

    test('should call merchant API', async () => {
      const merchantSpy = vi.spyOn(mockClient.merchantsApi, 'retrieveMerchant');

      await adapter.healthCheck(mockConnection);

      expect(merchantSpy).toHaveBeenCalledWith('MERCHANT_123');
    });
  });

  describe('Error Handling', () => {
    test('should collect errors without failing', async () => {
      vi.spyOn(SquareCategory, 'upsert').mockRejectedValueOnce(new Error('DB error'));

      const result = await adapter.syncInventory(mockConnection);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.details.items).toBeGreaterThan(0);
    });

    test('should handle API errors gracefully', async () => {
      vi.spyOn(mockClient.merchantsApi, 'retrieveMerchant').mockRejectedValue(
        new Error('API error')
      );

      const result = await adapter.healthCheck(mockConnection);

      expect(result.healthy).toBe(false);
      expect(result.details.apiAccessible).toBe(false);
    });
  });
});
