/**
 * Unit Tests: POSDataTransformer - Sales Transformation
 * 
 * Tests the squareOrderToSalesTransactions() method including:
 * - Catalog ID to inventory item mapping
 * - Unmapped item handling (skip gracefully)
 * - Currency conversion (cents to dollars)
 * - JSONB escape hatch for provider-specific data
 * - Dry-run mode
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import POSDataTransformer from '../../../src/services/POSDataTransformer.js';

// Mock the models at module level to intercept dynamic require() calls
vi.mock('../../../src/models/InventoryItem.js', () => ({
  default: {
    findOne: vi.fn()
  }
}));
vi.mock('../../../src/models/SalesTransaction.js', () => ({
  default: {
    upsert: vi.fn()
  }
}));

import InventoryItem from '../../../src/models/InventoryItem.js';
import SalesTransaction from '../../../src/models/SalesTransaction.js';

describe('POSDataTransformer - squareOrderToSalesTransactions()', () => {
  let transformer;
  let mockOrder;
  let mockInventoryItems;

  beforeEach(() => {
    transformer = new POSDataTransformer();

    // Mock order with line items
    mockOrder = {
      id: 1,
      squareOrderId: 'ORDER123456',
      restaurantId: 1, // Direct property, not nested
      locationId: 'L72T9RBYVQG4J',
      state: 'COMPLETED',
      closedAt: new Date('2023-10-05T10:30:00Z'),
      totalMoneyAmount: 1580,
      totalTaxMoneyAmount: 130,
      totalDiscountMoneyAmount: 0,
      orderData: {},
      connectionId: 1,
      SquareOrderItems: [
        {
          id: 1,
          squareLineItemUid: 'LINE_ITEM_UID_1', // Changed from uid
          name: 'Coffee',
          quantity: '2',
          squareCatalogObjectId: 'COFFEE_VARIATION_ID',
          squareVariationId: 'COFFEE_VARIATION_ID', // Added
          variationName: 'Regular',
          basePriceMoneyAmount: 250,
          grossSalesMoneyAmount: 500,
          totalTaxMoneyAmount: 40,
          totalDiscountMoneyAmount: 0,
          totalMoneyAmount: 540
        },
        {
          id: 2,
          squareLineItemUid: 'LINE_ITEM_UID_2', // Changed from uid
          name: 'Burger',
          quantity: '1',
          squareCatalogObjectId: 'BURGER_VARIATION_ID',
          squareVariationId: 'BURGER_VARIATION_ID', // Added
          variationName: 'Regular',
          basePriceMoneyAmount: 995,
          grossSalesMoneyAmount: 995,
          totalTaxMoneyAmount: 85,
          totalDiscountMoneyAmount: 0,
          totalMoneyAmount: 1080
        },
        {
          id: 3,
          squareLineItemUid: 'LINE_ITEM_UID_3', // Changed from uid
          name: 'Extra Cheese',
          quantity: '1',
          squareCatalogObjectId: null, // Modifier without catalog ID
          squareVariationId: null, // Added
          variationName: null,
          basePriceMoneyAmount: 50,
          grossSalesMoneyAmount: 50,
          totalTaxMoneyAmount: 5,
          totalDiscountMoneyAmount: 0,
          totalMoneyAmount: 55
        }
      ]
    };

    // Mock inventory items (mapped catalog IDs)
    mockInventoryItems = {
      COFFEE_VARIATION_ID: {
        id: 101,
        name: 'Coffee - Regular',
        restaurantId: 1,
        sourcePosProvider: 'square',
        sourcePosItemId: 'COFFEE_VARIATION_ID'
      },
      BURGER_VARIATION_ID: {
        id: 102,
        name: 'Burger - Regular',
        restaurantId: 1,
        sourcePosProvider: 'square',
        sourcePosItemId: 'BURGER_VARIATION_ID'
      }
    };

    // Configure mock implementations
    InventoryItem.findOne.mockImplementation(async ({ where }) => {
      const catalogId = where.sourcePosItemId;
      return mockInventoryItems[catalogId] || null;
    });

    SalesTransaction.upsert.mockResolvedValue([{}, true]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Transformation', () => {
    it('should transform mapped line items to sales transactions', async () => {
      const result = await transformer.squareOrderToSalesTransactions(mockOrder);

      expect(result.created).toBe(2); // Coffee and Burger
      expect(result.skipped).toBe(1); // Extra Cheese (no catalog ID)
      expect(result.errors).toHaveLength(0);
      expect(SalesTransaction.upsert).toHaveBeenCalledTimes(2);
    });

    it('should convert cents to dollars for unit price', async () => {
      await transformer.squareOrderToSalesTransactions(mockOrder);

      const coffeeCall = SalesTransaction.upsert.mock.calls[0][0];
      expect(coffeeCall.unitPrice).toBe(2.50); // 250 cents → $2.50
      expect(coffeeCall.totalAmount).toBe(5.40); // 540 cents → $5.40

      const burgerCall = SalesTransaction.upsert.mock.calls[1][0];
      expect(burgerCall.unitPrice).toBe(9.95); // 995 cents → $9.95
      expect(burgerCall.totalAmount).toBe(10.80); // 1080 cents → $10.80
    });

    it('should use order closedAt as transaction date', async () => {
      await transformer.squareOrderToSalesTransactions(mockOrder);

      const firstCall = SalesTransaction.upsert.mock.calls[0][0];
      expect(firstCall.transactionDate).toEqual(mockOrder.closedAt);
    });

    it('should set correct restaurant ID from connection', async () => {
      await transformer.squareOrderToSalesTransactions(mockOrder);

      const firstCall = SalesTransaction.upsert.mock.calls[0][0];
      expect(firstCall.restaurantId).toBe(1);
    });

    it('should set correct inventory item IDs from mapping', async () => {
      await transformer.squareOrderToSalesTransactions(mockOrder);

      const coffeeCall = SalesTransaction.upsert.mock.calls[0][0];
      expect(coffeeCall.inventoryItemId).toBe(101);

      const burgerCall = SalesTransaction.upsert.mock.calls[1][0];
      expect(burgerCall.inventoryItemId).toBe(102);
    });

    it('should use string quantity from Square', async () => {
      await transformer.squareOrderToSalesTransactions(mockOrder);

      const coffeeCall = SalesTransaction.upsert.mock.calls[0][0];
      expect(coffeeCall.quantity).toBe('2');

      const burgerCall = SalesTransaction.upsert.mock.calls[1][0];
      expect(burgerCall.quantity).toBe('1');
    });

    it('should set sourcePosProvider to square', async () => {
      await transformer.squareOrderToSalesTransactions(mockOrder);

      const firstCall = SalesTransaction.upsert.mock.calls[0][0];
      expect(firstCall.sourcePosProvider).toBe('square');
    });

    it('should set sourcePosOrderId from order', async () => {
      await transformer.squareOrderToSalesTransactions(mockOrder);

      const firstCall = SalesTransaction.upsert.mock.calls[0][0];
      expect(firstCall.sourcePosOrderId).toBe('ORDER123456');
    });

    it('should generate sourcePosLineItemId with square- prefix', async () => {
      await transformer.squareOrderToSalesTransactions(mockOrder);

      const firstCall = SalesTransaction.upsert.mock.calls[0][0];
      expect(firstCall.sourcePosLineItemId).toBe('square-LINE_ITEM_UID_1');

      const secondCall = SalesTransaction.upsert.mock.calls[1][0];
      expect(secondCall.sourcePosLineItemId).toBe('square-LINE_ITEM_UID_2');
    });

    it('should store provider-specific data in sourcePosData JSONB', async () => {
      await transformer.squareOrderToSalesTransactions(mockOrder);

      const coffeeCall = SalesTransaction.upsert.mock.calls[0][0];
      expect(coffeeCall.sourcePosData).toEqual({
        variationId: 'COFFEE_VARIATION_ID',
        variationName: 'Regular',
        tax: 0.40,
        discount: 0.00,
        grossSales: 5.00
      });

      const burgerCall = SalesTransaction.upsert.mock.calls[1][0];
      expect(burgerCall.sourcePosData).toEqual({
        variationId: 'BURGER_VARIATION_ID',
        variationName: 'Regular',
        tax: 0.85,
        discount: 0.00,
        grossSales: 9.95
      });
    });
  });

  describe('Unmapped Item Handling', () => {
    it('should skip line items without catalog_object_id', async () => {
      const result = await transformer.squareOrderToSalesTransactions(mockOrder);

      expect(result.skipped).toBe(1);
      expect(SalesTransaction.upsert).toHaveBeenCalledTimes(2); // Only 2 out of 3
    });

    it('should skip line items not mapped to inventory items', async () => {
      // Return null for burger lookup (unmapped)
      InventoryItem.findOne.mockImplementation(async ({ where }) => {
        if (where.sourcePosItemId === 'COFFEE_VARIATION_ID') {
          return mockInventoryItems.COFFEE_VARIATION_ID;
        }
        return null;
      });

      const result = await transformer.squareOrderToSalesTransactions(mockOrder);

      expect(result.created).toBe(1); // Only coffee
      expect(result.skipped).toBe(2); // Burger + Extra Cheese
      expect(SalesTransaction.upsert).toHaveBeenCalledTimes(1);
    });

    it('should return skipped count when all items unmapped', async () => {
      InventoryItem.findOne.mockResolvedValue(null);

      const result = await transformer.squareOrderToSalesTransactions(mockOrder);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(3);
      expect(SalesTransaction.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle order without line items', async () => {
      mockOrder.SquareOrderItems = [];

      const result = await transformer.squareOrderToSalesTransactions(mockOrder);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle order with null SquareOrderItems', async () => {
      mockOrder.SquareOrderItems = null;

      const result = await transformer.squareOrderToSalesTransactions(mockOrder);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('should handle undefined SquareOrderItems', async () => {
      delete mockOrder.SquareOrderItems;

      const result = await transformer.squareOrderToSalesTransactions(mockOrder);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('should handle zero prices (free items)', async () => {
      mockOrder.SquareOrderItems = [
        {
          squareLineItemUid: 'FREE_ITEM',
          name: 'Free Sample',
          quantity: '1',
          squareCatalogObjectId: 'COFFEE_VARIATION_ID',
          basePriceMoneyAmount: 0,
          grossSalesMoneyAmount: 0,
          totalTaxMoneyAmount: 0,
          totalDiscountMoneyAmount: 0,
          totalMoneyAmount: 0
        }
      ];

      const result = await transformer.squareOrderToSalesTransactions(mockOrder);

      expect(result.created).toBe(1);
      const call = SalesTransaction.upsert.mock.calls[0][0];
      expect(call.unitPrice).toBe(0.00);
      expect(call.totalAmount).toBe(0.00);
    });

    it('should handle decimal quantities', async () => {
      mockOrder.SquareOrderItems[0].quantity = '2.5';

      await transformer.squareOrderToSalesTransactions(mockOrder);

      const call = SalesTransaction.upsert.mock.calls[0][0];
      expect(call.quantity).toBe('2.5');
    });

    it('should handle missing variation name', async () => {
      mockOrder.SquareOrderItems[0].variationName = null;

      await transformer.squareOrderToSalesTransactions(mockOrder);

      const call = SalesTransaction.upsert.mock.calls[0][0];
      expect(call.sourcePosData.variationName).toBeNull();
    });
  });

  describe('Dry Run Mode', () => {
    it('should not create transactions in dry-run mode', async () => {
      const result = await transformer.squareOrderToSalesTransactions(mockOrder, {
        dryRun: true
      });

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(1);
      expect(SalesTransaction.upsert).not.toHaveBeenCalled();
    });

    it('should still perform mapping lookups in dry-run', async () => {
      await transformer.squareOrderToSalesTransactions(mockOrder, { dryRun: true });

      expect(InventoryItem.findOne).toHaveBeenCalledTimes(2); // Coffee and Burger
    });

    it('should return same results in dry-run as real run', async () => {
      const dryResult = await transformer.squareOrderToSalesTransactions(mockOrder, {
        dryRun: true
      });
      const realResult = await transformer.squareOrderToSalesTransactions(mockOrder, {
        dryRun: false
      });

      expect(dryResult.created).toBe(realResult.created);
      expect(dryResult.skipped).toBe(realResult.skipped);
    });
  });

  describe('Error Handling', () => {
    it('should collect errors for failed upserts', async () => {
      SalesTransaction.upsert.mockRejectedValueOnce(
        new Error('Database constraint violation')
      );

      const result = await transformer.squareOrderToSalesTransactions(mockOrder);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].lineItemId).toBe('LINE_ITEM_UID_1');
      expect(result.errors[0].error).toContain('Database constraint violation');
    });

    it('should continue processing after single item error', async () => {
      SalesTransaction.upsert
        .mockRejectedValueOnce(new Error('First item failed'))
        .mockResolvedValueOnce([{}, true]);

      const result = await transformer.squareOrderToSalesTransactions(mockOrder);

      expect(result.created).toBe(1); // Second item succeeded
      expect(result.errors).toHaveLength(1);
      expect(SalesTransaction.upsert).toHaveBeenCalledTimes(2);
    });

    it('should handle inventory lookup errors gracefully', async () => {
      InventoryItem.findOne.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const result = await transformer.squareOrderToSalesTransactions(mockOrder);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Database connection failed');
    });
  });

  describe('Upsert Conflict Resolution', () => {
    it('should upsert with conflict on sourcePosProvider and sourcePosLineItemId', async () => {
      await transformer.squareOrderToSalesTransactions(mockOrder);

      const firstCall = SalesTransaction.upsert.mock.calls[0];
      expect(firstCall[1]).toEqual({
        conflictFields: ['sourcePosProvider', 'sourcePosLineItemId']
      });
    });

    it('should handle existing transaction updates', async () => {
      // Mock existing transaction (upsert returns [instance, false] for update)
      SalesTransaction.upsert.mockResolvedValue([{}, false]);

      const result = await transformer.squareOrderToSalesTransactions(mockOrder);

      expect(result.created).toBe(2); // Still counts as "created" in our logic
    });
  });

  describe('Currency Conversion', () => {
    it('should handle large amounts correctly', async () => {
      mockOrder.SquareOrderItems = [
        {
          squareLineItemUid: 'EXPENSIVE_ITEM',
          squareCatalogObjectId: 'COFFEE_VARIATION_ID',
          quantity: '1',
          basePriceMoneyAmount: 999999, // $9,999.99
          totalMoneyAmount: 999999
        }
      ];

      await transformer.squareOrderToSalesTransactions(mockOrder);

      const call = SalesTransaction.upsert.mock.calls[0][0];
      expect(call.unitPrice).toBe(9999.99);
    });

    it('should handle fractional cents correctly', async () => {
      mockOrder.SquareOrderItems = [
        {
          squareLineItemUid: 'ODD_PRICE',
          squareCatalogObjectId: 'COFFEE_VARIATION_ID',
          quantity: '1',
          basePriceMoneyAmount: 333, // $3.33
          totalMoneyAmount: 333
        }
      ];

      await transformer.squareOrderToSalesTransactions(mockOrder);

      const call = SalesTransaction.upsert.mock.calls[0][0];
      expect(call.unitPrice).toBe(3.33);
    });
  });
});
