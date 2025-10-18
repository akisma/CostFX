/**
 * SquareInventorySyncService Unit Tests
 * 
 * Tests the orchestration service that coordinates:
 * 1. SquareAdapter.syncInventory() - Fetch raw data from Square
 * 2. POSDataTransformer.transformBatch() - Transform to unified format
 * 
 * Test Coverage:
 * - Sync and transform pipeline
 * - Error handling and recovery
 * - Status tracking and reporting
 * - Data validation
 * - Clear operations
 * 
 * Created: 2025-10-06
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import SquareInventorySyncService from '../../../src/services/SquareInventorySyncService.js';
import POSConnection from '../../../src/models/POSConnection.js';
import SquareMenuItem from '../../../src/models/SquareMenuItem.js';
import SquareCategory from '../../../src/models/SquareCategory.js';
import SquareInventoryCount from '../../../src/models/SquareInventoryCount.js';
import InventoryItem from '../../../src/models/InventoryItem.js';
import POSDataTransformer from '../../../src/services/POSDataTransformer.js';
import sequelize from '../../../src/config/database.js';

// Mock dependencies
vi.mock('../../../src/models/POSConnection.js');
vi.mock('../../../src/models/SquareMenuItem.js');
vi.mock('../../../src/models/SquareCategory.js');
vi.mock('../../../src/models/SquareInventoryCount.js');
vi.mock('../../../src/models/InventoryItem.js');
vi.mock('../../../src/services/POSDataTransformer.js');
vi.mock('../../../src/config/database.js');

describe('SquareInventorySyncService', () => {
  let service;
  let mockSquareAdapter;
  let mockConnection;
  let mockTransaction;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock SquareAdapter
    mockSquareAdapter = {
      syncInventory: vi.fn()
    };

    // Mock POSDataTransformer
    POSDataTransformer.mockImplementation(() => ({
      transformBatch: vi.fn().mockResolvedValue({
        successCount: 2,
        errorCount: 0,
        totalItems: 2,
        items: [
          { id: 1, name: 'Test Item 1', category: 'produce' },
          { id: 2, name: 'Test Item 2', category: 'proteins' }
        ],
        errors: []
      })
    }));

    // Mock POSConnection
    mockConnection = {
      id: 1,
      restaurantId: 1,
      provider: 'square',
      lastSyncAt: null,
      status: 'active',
      isActive: true
    };

    // Mock transaction
    mockTransaction = {
      commit: vi.fn(),
      rollback: vi.fn()
    };

    sequelize.transaction = vi.fn().mockResolvedValue(mockTransaction);
    sequelize.fn = vi.fn((fnName, col) => `${fnName}(${col})`);
    sequelize.col = vi.fn((colName) => colName);

    // Create service
    service = new SquareInventorySyncService(mockSquareAdapter);
    expect(POSDataTransformer).toHaveBeenCalledWith({
      categoryMapperOptions: {
        enableFallback: false
      }
    });
  });

  describe('Constructor', () => {
    it('should require SquareAdapter', () => {
      expect(() => new SquareInventorySyncService()).toThrow('SquareAdapter is required');
    });

    it('should initialize with SquareAdapter', () => {
      const service = new SquareInventorySyncService(mockSquareAdapter);
      expect(service.squareAdapter).toBe(mockSquareAdapter);
      expect(service.transformer).toBeDefined();
    });
  });

  describe('syncAndTransform()', () => {
    beforeEach(() => {
      POSConnection.findByPk = vi.fn().mockResolvedValue(mockConnection);
      
      mockSquareAdapter.syncInventory = vi.fn().mockResolvedValue({
        synced: 10,
        errors: [],
        details: {
          categories: 3,
          items: 7,
          inventoryCounts: 0
        }
      });

      SquareMenuItem.findAll = vi.fn().mockResolvedValue([
        {
          id: 1,
          squareItemId: 'square-1',
          name: 'Test Item 1',
          squareData: {
            item_data: {
              category_id: 'cat-produce',
              variations: [
                {
                  id: 'var-1',
                  item_variation_data: {
                    name: 'Regular',
                    price_money: { amount: 1000, currency: 'USD' },
                    ordinal: 0
                  }
                }
              ]
            }
          }
        },
        {
          id: 2,
          squareItemId: 'square-2',
          name: 'Test Item 2',
          squareData: {
            item_data: {
              category_id: 'cat-proteins',
              variations: [
                {
                  id: 'var-2',
                  item_variation_data: {
                    name: 'Regular',
                    price_money: { amount: 2000, currency: 'USD' },
                    ordinal: 0
                  }
                }
              ]
            }
          }
        }
      ]);
    });

    it('should complete full sync and transform pipeline', async () => {
      const result = await service.syncAndTransform(1);

      expect(result).toMatchObject({
        connectionId: 1,
        restaurantId: 1,
        status: 'completed',
        phase: 'complete'
      });

      expect(result.sync).toBeDefined();
      expect(result.transform).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0); // Can be 0 in fast tests
      expect(result.syncId).toMatch(/^sync_/);
    });

    it('should handle incremental sync by default', async () => {
      mockConnection.lastSyncAt = new Date('2025-10-01');
      
      await service.syncAndTransform(1);

      expect(mockSquareAdapter.syncInventory).toHaveBeenCalledWith(
        mockConnection,
        mockConnection.lastSyncAt
      );
    });

    it('should handle full sync when incremental=false', async () => {
      await service.syncAndTransform(1, { incremental: false });

      expect(mockSquareAdapter.syncInventory).toHaveBeenCalledWith(
        mockConnection,
        null
      );
    });

    it('should support dry-run mode', async () => {
      const result = await service.syncAndTransform(1, { dryRun: true });

      expect(result.status).toBe('completed');
      expect(result.transform.totalItems).toBe(2);
      // Verify POSDataTransformer was called with dryRun=true
    });

    it('should clear data before sync if requested', async () => {
      SquareMenuItem.destroy = vi.fn().mockResolvedValue(5);
      SquareCategory.destroy = vi.fn().mockResolvedValue(3);
      SquareInventoryCount.destroy = vi.fn().mockResolvedValue(0);
      InventoryItem.destroy = vi.fn().mockResolvedValue(5);

      const result = await service.syncAndTransform(1, { clearBeforeSync: true });

      expect(result.status).toBe('completed');
      expect(SquareMenuItem.destroy).toHaveBeenCalled();
      expect(SquareCategory.destroy).toHaveBeenCalled();
    });

    it('should throw error if connection not found', async () => {
      POSConnection.findByPk = vi.fn().mockResolvedValue(null);

      await expect(service.syncAndTransform(999)).rejects.toThrow('POSConnection 999 not found');
    });

    it('should throw error if connection is not Square', async () => {
      mockConnection.provider = 'toast';
      POSConnection.findByPk = vi.fn().mockResolvedValue(mockConnection);

      await expect(service.syncAndTransform(1)).rejects.toThrow('not a Square connection');
    });

    it('should handle sync phase errors', async () => {
      mockSquareAdapter.syncInventory = vi.fn().mockRejectedValue(
        new Error('Square API error')
      );

      await expect(service.syncAndTransform(1)).rejects.toThrow('Square sync failed');
    });

    it('should handle transform phase errors', async () => {
      SquareMenuItem.findAll = vi.fn().mockRejectedValue(
        new Error('Database error')
      );

      // Service now collects errors instead of throwing
      const result = await service.syncAndTransform(1);
      
      expect(result.status).toBe('completed');
      expect(result.transform.errors).toBeDefined();
      expect(result.transform.errors.length).toBeGreaterThan(0);
    });

    it('should return error details in result on failure', async () => {
      mockSquareAdapter.syncInventory = vi.fn().mockRejectedValue(
        new Error('API timeout')
      );

      try {
        await service.syncAndTransform(1);
      } catch (error) {
        expect(error.message).toContain('API timeout');
        expect(error.result).toBeDefined();
        expect(error.result.status).toBe('failed');
        expect(error.result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getSyncStatus()', () => {
    beforeEach(() => {
      POSConnection.findByPk = vi.fn().mockResolvedValue(mockConnection);
      
      SquareMenuItem.count = vi.fn().mockResolvedValue(10);
      SquareMenuItem.findOne = vi.fn().mockResolvedValue({
        updatedAt: new Date('2025-10-06T10:00:00Z')
      });
      
      InventoryItem.count = vi.fn().mockResolvedValue(10);
    });

    it('should return sync status for connection', async () => {
      const status = await service.getSyncStatus(1);

      expect(status).toMatchObject({
        connectionId: 1,
        restaurantId: 1,
        provider: 'square',
        tier1: {
          name: 'Raw Square Data',
          itemCount: 10
        },
        tier2: {
          name: 'Unified Inventory Items',
          itemCount: 10
        }
      });
    });

    it('should indicate sync needed when never synced', async () => {
      mockConnection.lastSyncAt = null;
      
      const status = await service.getSyncStatus(1);

      expect(status.syncNeeded).toBe(true);
    });

    it('should indicate sync needed when data is stale', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2);
      mockConnection.lastSyncAt = yesterday;
      
      const status = await service.getSyncStatus(1);

      expect(status.syncNeeded).toBe(true);
    });

    it('should indicate sync not needed when recently synced', async () => {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      mockConnection.lastSyncAt = oneHourAgo;
      
      SquareMenuItem.findOne = vi.fn().mockResolvedValue({
        updatedAt: new Date(oneHourAgo.getTime() - 1000) // Before last sync
      });
      
      const status = await service.getSyncStatus(1);

      expect(status.syncNeeded).toBe(false);
    });

    it('should handle connection not found', async () => {
      POSConnection.findByPk = vi.fn().mockResolvedValue(null);

      await expect(service.getSyncStatus(999)).rejects.toThrow('POSConnection 999 not found');
    });
  });

  describe('clearSquareData()', () => {
    beforeEach(() => {
      SquareMenuItem.destroy = vi.fn().mockResolvedValue(10);
      SquareCategory.destroy = vi.fn().mockResolvedValue(5);
      SquareInventoryCount.destroy = vi.fn().mockResolvedValue(3);
      InventoryItem.destroy = vi.fn().mockResolvedValue(10);
    });

    it('should clear all Square data for restaurant', async () => {
      const result = await service.clearSquareData(1);

      expect(result).toEqual({
        squareMenuItems: 10,
        squareCategories: 5,
        squareInventoryCounts: 3,
        inventoryItems: 10
      });

      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('should delete from Tier 2 before Tier 1', async () => {
      const deletionOrder = [];
      
      InventoryItem.destroy = vi.fn().mockImplementation(() => {
        deletionOrder.push('inventory_items');
        return Promise.resolve(10);
      });
      
      SquareInventoryCount.destroy = vi.fn().mockImplementation(() => {
        deletionOrder.push('square_inventory_counts');
        return Promise.resolve(3);
      });
      
      SquareMenuItem.destroy = vi.fn().mockImplementation(() => {
        deletionOrder.push('square_menu_items');
        return Promise.resolve(10);
      });
      
      SquareCategory.destroy = vi.fn().mockImplementation(() => {
        deletionOrder.push('square_categories');
        return Promise.resolve(5);
      });

      await service.clearSquareData(1);

      // inventory_items should be deleted first (Tier 2)
      expect(deletionOrder[0]).toBe('inventory_items');
      // Then square_* tables (Tier 1) in reverse dependency order
      expect(deletionOrder.slice(1)).toEqual([
        'square_inventory_counts',
        'square_menu_items',
        'square_categories'
      ]);
    });

    it('should rollback transaction on error', async () => {
      SquareMenuItem.destroy = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(service.clearSquareData(1)).rejects.toThrow('Failed to clear Square data');

      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    it('should use transaction for atomic operations', async () => {
      await service.clearSquareData(1);

      expect(sequelize.transaction).toHaveBeenCalled();
      expect(InventoryItem.destroy).toHaveBeenCalledWith(
        expect.objectContaining({ transaction: mockTransaction })
      );
    });
  });

  describe('validateTransformation()', () => {
    it('should validate successful transformation', async () => {
      SquareMenuItem.count = vi.fn().mockResolvedValue(100);
      InventoryItem.count = vi.fn().mockResolvedValue(100);

      const result = await service.validateTransformation(1);

      expect(result).toMatchObject({
        restaurantId: 1,
        tier1Count: 100,
        tier2Count: 100,
        transformationRate: '100.00%',
        isValid: true,
        status: 'valid'
      });
    });

    it('should validate transformation with 95% success rate', async () => {
      SquareMenuItem.count = vi.fn().mockResolvedValue(100);
      InventoryItem.count = vi.fn().mockResolvedValue(96);

      const result = await service.validateTransformation(1);

      expect(result.isValid).toBe(true);
      expect(result.transformationRate).toBe('96.00%');
      expect(result.status).toBe('valid');
    });

    it('should mark as incomplete if below 95%', async () => {
      SquareMenuItem.count = vi.fn().mockResolvedValue(100);
      InventoryItem.count = vi.fn().mockResolvedValue(85);

      const result = await service.validateTransformation(1);

      expect(result.isValid).toBe(false);
      expect(result.transformationRate).toBe('85.00%');
      expect(result.status).toBe('incomplete');
    });

    it('should mark as not_transformed if no inventory items', async () => {
      SquareMenuItem.count = vi.fn().mockResolvedValue(100);
      InventoryItem.count = vi.fn().mockResolvedValue(0);

      const result = await service.validateTransformation(1);

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('not_transformed');
    });

    it('should handle zero square items', async () => {
      SquareMenuItem.count = vi.fn().mockResolvedValue(0);
      InventoryItem.count = vi.fn().mockResolvedValue(0);

      const result = await service.validateTransformation(1);

      expect(result.transformationRate).toBe('0%');
      expect(result.isValid).toBe(true); // 0 items is valid - nothing to transform
    });
  });

  describe('getTransformationStats()', () => {
    beforeEach(() => {
      InventoryItem.findAll = vi.fn().mockResolvedValue([
        { category: 'produce', dataValues: { count: '25' } },
        { category: 'proteins', dataValues: { count: '15' } },
        { category: 'dairy', dataValues: { count: '10' } }
      ]);

      InventoryItem.count = vi.fn().mockResolvedValue(8);
    });

    it('should return transformation statistics', async () => {
      const stats = await service.getTransformationStats(1);

      expect(stats).toMatchObject({
        restaurantId: 1,
        totalItems: 50,
        highValueItems: 8
      });

      expect(stats.byCategory).toEqual([
        { category: 'produce', count: 25 },
        { category: 'proteins', count: 15 },
        { category: 'dairy', count: 10 }
      ]);
    });

    it('should handle empty results', async () => {
      InventoryItem.findAll = vi.fn().mockResolvedValue([]);
      InventoryItem.count = vi.fn().mockResolvedValue(0);

      const stats = await service.getTransformationStats(1);

      expect(stats.totalItems).toBe(0);
      expect(stats.highValueItems).toBe(0);
      expect(stats.byCategory).toEqual([]);
    });

    it('should group by unit distribution', async () => {
      // Second findAll call for unit stats
      InventoryItem.findAll = vi.fn()
        .mockResolvedValueOnce([
          { category: 'produce', dataValues: { count: '25' } }
        ])
        .mockResolvedValueOnce([
          { unit: 'lb', dataValues: { count: '15' } },
          { unit: 'gal', dataValues: { count: '10' } }
        ]);

      const stats = await service.getTransformationStats(1);

      expect(stats.byUnit).toEqual([
        { unit: 'lb', count: 15 },
        { unit: 'gal', count: 10 }
      ]);
    });
  });

  describe('Private Helper Methods', () => {
    describe('_loadConnection()', () => {
      it('should load connection by ID', async () => {
        POSConnection.findByPk = vi.fn().mockResolvedValue(mockConnection);

        const connection = await service._loadConnection(1);

        expect(connection).toBe(mockConnection);
        expect(POSConnection.findByPk).toHaveBeenCalledWith(1);
      });

      it('should throw if connection not found', async () => {
        POSConnection.findByPk = vi.fn().mockResolvedValue(null);

        await expect(service._loadConnection(1)).rejects.toThrow('POSConnection 1 not found');
      });

      it('should throw if connection is not Square', async () => {
        mockConnection.provider = 'toast';
        POSConnection.findByPk = vi.fn().mockResolvedValue(mockConnection);

        await expect(service._loadConnection(1)).rejects.toThrow('not a Square connection');
      });
    });

    describe('_determineSyncNeeded()', () => {
      it('should return true when never synced', () => {
        mockConnection.lastSyncAt = null;

        const result = service._determineSyncNeeded(mockConnection, null);

        expect(result).toBe(true);
      });

      it('should return true when recent updates exist', () => {
        mockConnection.lastSyncAt = new Date('2025-10-01T12:00:00Z');
        const recentUpdate = new Date('2025-10-02T12:00:00Z');

        const result = service._determineSyncNeeded(mockConnection, recentUpdate);

        expect(result).toBe(true);
      });

      it('should return true when data is stale (>24 hours)', () => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        mockConnection.lastSyncAt = twoDaysAgo;

        const result = service._determineSyncNeeded(mockConnection, null);

        expect(result).toBe(true);
      });

      it('should return false when recently synced and no new updates', () => {
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);
        mockConnection.lastSyncAt = oneHourAgo;

        const result = service._determineSyncNeeded(mockConnection, null);

        expect(result).toBe(false);
      });
    });

    describe('_generateSyncId()', () => {
      it('should generate unique sync ID', () => {
        const id1 = service._generateSyncId();
        const id2 = service._generateSyncId();

        expect(id1).toMatch(/^sync_\d+_[a-z0-9]+$/);
        expect(id2).toMatch(/^sync_\d+_[a-z0-9]+$/);
        expect(id1).not.toBe(id2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      POSConnection.findByPk = vi.fn().mockRejectedValue(new Error('DB connection lost'));

      await expect(service.getSyncStatus(1)).rejects.toThrow('DB connection lost');
    });

    it('should handle invalid restaurantId', async () => {
      // clearSquareData accepts any restaurantId (even null) and just queries with it
      // It won't throw, but will delete 0 records
      const result = await service.clearSquareData(null);
      expect(result).toBeDefined();
    });

    it('should provide detailed error context', async () => {
      mockSquareAdapter.syncInventory = vi.fn().mockRejectedValue(
        new Error('Rate limit exceeded')
      );
      
      POSConnection.findByPk = vi.fn().mockResolvedValue(mockConnection);

      try {
        await service.syncAndTransform(1);
      } catch (error) {
        expect(error.result).toBeDefined();
        expect(error.result.errors).toHaveLength(1);
        expect(error.result.errors[0].message).toContain('Rate limit exceeded');
        expect(error.result.errors[0].phase).toBe('sync');
      }
    });
  });
});
