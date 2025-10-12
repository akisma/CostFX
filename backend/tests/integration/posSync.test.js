/**
 * POS Sync Controller Integration Tests
 * 
 * Tests the complete POS sync API endpoints:
 * - POST /api/v1/pos/sync/:connectionId
 * - GET  /api/v1/pos/status/:connectionId
 * - GET  /api/v1/pos/stats/:restaurantId
 * - POST /api/v1/pos/clear/:restaurantId
 * - GET  /api/v1/pos/validate/:restaurantId
 * 
 * Test Coverage:
 * - API routing and request handling
 * - Response formatting
 * - Error handling (404, 400, 503)
 * - Query parameter parsing
 * 
 * Created: 2025-10-06
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import POSConnection from '../../src/models/POSConnection.js';
import SquareInventorySyncService from '../../src/services/SquareInventorySyncService.js';

// Mock dependencies
vi.mock('../../src/models/POSConnection.js');
vi.mock('../../src/services/SquareInventorySyncService.js');
vi.mock('../../src/adapters/SquareAdapter.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    syncInventory: vi.fn()
  }))
}));

describe('POS Sync Controller Integration Tests', () => {
  let mockConnection;
  let mockSyncResult;
  let mockStatusResult;
  let mockStatsResult;
  let mockValidationResult;

  beforeEach(() => {
    // Don't use vi.clearAllMocks() - it clears implementations
    // Instead, reset individual mocks as needed in tests

    // Mock connection data
    mockConnection = {
      id: 1,
      restaurantId: 1,
      provider: 'square',
      accessToken: 'test_token',
      status: 'active',
      isActive: true,
      lastSyncAt: null
    };

    // Mock sync result
    mockSyncResult = {
      syncId: 'sync_test123',
      connectionId: 1,
      restaurantId: 1,
      status: 'completed',
      phase: 'complete',
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 1234,
      sync: {
        synced: 10,
        errors: []
      },
      transform: {
        successCount: 9,
        errorCount: 1,
        totalItems: 10
      },
      errors: []
    };

    // Mock status result
    mockStatusResult = {
      connectionId: 1,
      restaurantId: 1,
      provider: 'square',
      tier1Count: 10,
      tier2Count: 9,
      lastSyncAt: null,
      mostRecentUpdate: null,
      syncNeeded: true,
      reason: 'Connection never synced'
    };

    // Mock stats result
    mockStatsResult = {
      restaurantId: 1,
      categoryDistribution: [
        { category: 'produce', count: 5 },
        { category: 'proteins', count: 4 }
      ],
      unitDistribution: [
        { unit: 'lb', count: 6 },
        { unit: 'each', count: 3 }
      ],
      highValueItemCount: 2
    };

    // Mock validation result
    mockValidationResult = {
      restaurantId: 1,
      tier1Count: 10,
      tier2Count: 9,
      transformationRate: '90.00%',
      isValid: false,
      status: 'incomplete'
    };

    // Setup POSConnection mock
    POSConnection.findByPk = vi.fn().mockResolvedValue(mockConnection);
    POSConnection.findOne = vi.fn().mockResolvedValue(mockConnection);

    // Setup SquareInventorySyncService mock
    SquareInventorySyncService.mockImplementation(() => ({
      syncAndTransform: vi.fn().mockResolvedValue(mockSyncResult),
      getSyncStatus: vi.fn().mockResolvedValue(mockStatusResult),
      getTransformationStats: vi.fn().mockResolvedValue(mockStatsResult),
      clearSquareData: vi.fn().mockResolvedValue({
        inventoryItems: 9,
        squareMenuItems: 10,
        squareCategories: 5,
        squareInventoryCounts: 3
      }),
      validateTransformation: vi.fn().mockResolvedValue(mockValidationResult)
    }));
  });

  describe('POST /api/v1/pos/sync/:connectionId', () => {
    it('should sync and transform inventory successfully', async () => {
      const response = await request(app)
        .post('/api/v1/pos/sync/1')
        .expect(200);

      expect(response.body).toMatchObject({
        connectionId: 1,
        restaurantId: 1,
        status: 'completed',
        phase: 'complete'
      });

      expect(response.body.syncId).toMatch(/^sync_/);
      expect(response.body.sync).toBeDefined();
      expect(response.body.transform).toBeDefined();
      expect(response.body.duration).toBeGreaterThanOrEqual(0);
    });

    it('should support incremental sync', async () => {
      const response = await request(app)
        .post('/api/v1/pos/sync/1?incremental=true')
        .expect(200);

      expect(response.body.status).toBe('completed');
    });

    it('should support full sync when incremental=false', async () => {
      const response = await request(app)
        .post('/api/v1/pos/sync/1?incremental=false')
        .expect(200);

      expect(response.body.status).toBe('completed');
    });

    it('should support dry-run mode', async () => {
      const response = await request(app)
        .post('/api/v1/pos/sync/1?dryRun=true')
        .expect(200);

      expect(response.body.status).toBe('completed');
    });

    it('should support clearBeforeSync option', async () => {
      const response = await request(app)
        .post('/api/v1/pos/sync/1?clearBeforeSync=true')
        .expect(200);

      expect(response.body.status).toBe('completed');
    });

    it('should return 404 for non-existent connection', async () => {
      POSConnection.findByPk = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/pos/sync/99999')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for inactive connection', async () => {
      POSConnection.findByPk = vi.fn().mockResolvedValue({
        ...mockConnection,
        isActive: false
      });

      const response = await request(app)
        .post('/api/v1/pos/sync/1')
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.message).toContain('not active');
    });
  });

  describe('GET /api/v1/pos/status/:connectionId', () => {
    it('should return sync status', async () => {
      const response = await request(app)
        .get('/api/v1/pos/status/1')
        .expect(200);

      expect(response.body).toMatchObject({
        connectionId: 1,
        restaurantId: 1,
        provider: 'square'
      });

      expect(response.body.tier1Count).toBeDefined();
      expect(response.body.tier2Count).toBeDefined();
      expect(response.body.syncNeeded).toBe(true);
    });

    it('should return 404 for non-existent connection', async () => {
      POSConnection.findByPk = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/pos/status/99999')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('GET /api/v1/pos/stats/:restaurantId', () => {
    it('should return transformation statistics', async () => {
      const response = await request(app)
        .get('/api/v1/pos/stats/1')
        .expect(200);

      expect(response.body.restaurantId).toBe(1);
      expect(response.body.categoryDistribution).toBeDefined();
      expect(response.body.unitDistribution).toBeDefined();
      expect(response.body.highValueItemCount).toBeDefined();
    });

    it('should return 404 for restaurant without POS connection', async () => {
      POSConnection.findOne = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/pos/stats/99999')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('POST /api/v1/pos/clear/:restaurantId', () => {
    it('should clear all POS data', async () => {
      const response = await request(app)
        .post('/api/v1/pos/clear/1')
        .expect(200);

      expect(response.body.restaurantId).toBe(1);
      expect(response.body.deleted).toBeDefined();
      expect(response.body.deleted.inventoryItems).toBeDefined();
      expect(response.body.deleted.squareMenuItems).toBeDefined();
    });

    it('should return 404 for restaurant without POS connection', async () => {
      POSConnection.findOne = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/pos/clear/99999')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('GET /api/v1/pos/validate/:restaurantId', () => {
    it('should validate transformation accuracy', async () => {
      const response = await request(app)
        .get('/api/v1/pos/validate/1')
        .expect(200);

      expect(response.body.restaurantId).toBe(1);
      expect(response.body.tier1Count).toBeDefined();
      expect(response.body.tier2Count).toBeDefined();
      expect(response.body.transformationRate).toBeDefined();
      expect(response.body.isValid).toBeDefined();
      expect(response.body.status).toBeDefined();
    });

    it('should return 404 for restaurant without POS connection', async () => {
      POSConnection.findOne = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/pos/validate/99999')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid connection ID format', async () => {
      POSConnection.findByPk = vi.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/pos/sync/invalid')
        .expect(404);

      expect(response.body.error).toBeDefined();
    });
  });
});
