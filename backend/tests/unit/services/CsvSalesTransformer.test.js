import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CsvSalesTransformer from '../../../src/services/csv/CsvSalesTransformer.js';

const InventoryItem = (await import('../../../src/models/InventoryItem.js')).default;
const SalesTransaction = (await import('../../../src/models/SalesTransaction.js')).default;

describe('CsvSalesTransformer', () => {
  const upload = {
    id: 77,
    restaurantId: 5,
    status: 'validated'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates sales transactions and matches inventory items', async () => {
    const transformer = new CsvSalesTransformer();

    const batches = [
      {
        rows: [
          {
            row: 1,
            data: {
              transaction_date: '2025-10-15T12:00:00Z',
              item_name: 'Margherita Pizza',
              quantity: 3,
              unit_price: 18.5,
              total_amount: 55.5,
              order_id: 'ORD-1',
              line_item_id: 'ITEM-1'
            }
          }
        ]
      }
    ];

    vi.spyOn(InventoryItem, 'findOne').mockResolvedValueOnce({ id: 200 });

    vi.spyOn(SalesTransaction, 'findOne').mockResolvedValue(null);
    vi.spyOn(SalesTransaction, 'upsert').mockResolvedValue([{ id: 999 }, true]);

    const result = await transformer.transform({ upload, batches }, { dryRun: false });

    expect(InventoryItem.findOne).toHaveBeenCalledWith({
      where: {
        restaurantId: 5,
        sourcePosProvider: 'csv',
        sourcePosItemId: 'item-1'
      }
    });

    expect(SalesTransaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 5,
        inventoryItemId: 200,
        sourcePosProvider: 'csv',
        sourcePosOrderId: 'ORD-1',
        sourcePosLineItemId: 'csv-ITEM-1'
      }),
      expect.objectContaining({
        conflictFields: ['source_pos_provider', 'source_pos_line_item_id'],
        returning: true
      })
    );

    expect(result.summary).toEqual({
      processed: 1,
      created: 1,
      updated: 0,
      skipped: 0,
      errors: 0
    });
    expect(result.itemMatching).toEqual({ matched: 1, unmatched: 0 });
    expect(result.exceededThreshold).toBe(false);
  });

  it('flags unmatched items and records errors when persistence fails', async () => {
    const transformer = new CsvSalesTransformer({ errorThresholdPct: 10 });

    const batches = [
      {
        rows: [
          {
            row: 1,
            data: {
              transaction_date: '2025-10-15T12:00:00Z',
              item_name: 'Unknown Special',
              quantity: 1,
              unit_price: 12,
              total_amount: 12,
              order_id: 'ORD-2',
              line_item_id: 'ITEM-2'
            }
          },
          {
            row: 2,
            data: {
              transaction_date: '2025-10-16T12:00:00Z',
              item_name: 'Another Item',
              quantity: 2,
              unit_price: 10,
              total_amount: 20,
              order_id: 'ORD-3'
            }
          }
        ]
      }
    ];

    vi.spyOn(InventoryItem, 'findOne').mockResolvedValue(null);
    vi.spyOn(SalesTransaction, 'findOne').mockResolvedValue(null);

    const upsertSpy = vi.spyOn(SalesTransaction, 'upsert');
    upsertSpy
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce([{ id: 1000, sourcePosLineItemId: 'csv-77-2-another-item' }, true]);

    const result = await transformer.transform({ upload, batches }, { dryRun: false });

    expect(result.summary.errors).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.itemMatching.unmatched).toBe(1);
    expect(result.flaggedForReview).toHaveLength(1);
    expect(result.flaggedForReview[0]).toMatchObject({
      reason: 'inventory_match_not_found',
      lineItemId: 'csv-77-2-another-item'
    });
    expect(result.exceededThreshold).toBe(true);
  });
});
