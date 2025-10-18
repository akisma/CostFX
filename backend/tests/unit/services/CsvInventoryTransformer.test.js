import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CsvInventoryTransformer from '../../../src/services/csv/CsvInventoryTransformer.js';

const { mockInventoryItem } = vi.hoisted(() => ({
  mockInventoryItem: {
    findOne: vi.fn(),
    upsert: vi.fn()
  }
}));

vi.mock('../../../src/models/InventoryItem.js', () => ({
  default: mockInventoryItem
}));

const buildTransformer = () => {
  const categoryMapper = {
    mapSquareCategory: vi.fn(() => ({
      category: 'produce',
      confidence: 0.95,
      matchType: 'exact'
    }))
  };

  const varianceCalculator = {
    calculate: vi.fn(() => ({
      varianceThresholdQuantity: 3,
      varianceThresholdDollar: 9.75,
      highValueFlag: false
    }))
  };

  const posTransformer = {
    normalizeUnit: vi.fn(unit => (unit === 'lb' ? 'lbs' : unit))
  };

  return new CsvInventoryTransformer({ categoryMapper, varianceCalculator, posTransformer });
};

describe('CsvInventoryTransformer', () => {
  beforeEach(() => {
    mockInventoryItem.findOne.mockReset();
    mockInventoryItem.upsert.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('transforms validated rows and persists inventory items', async () => {
    const transformer = buildTransformer();

    const upload = {
      id: 42,
      restaurantId: 7,
      status: 'validated'
    };

    const batches = [
      {
        rows: [
          {
            row: 1,
            data: {
              name: 'Romaine Lettuce',
              category: 'Produce',
              unit: 'lb',
              unit_cost: 3.25,
              current_stock: 12,
              minimum_stock: 4,
              maximum_stock: 18,
              description: 'Crisp romaine',
              supplier_name: 'Farm Box',
              location: 'Walk-in Cooler',
              batch_number: 'A-100',
              sku: 'ROM-001',
              vendor_item_number: null,
              gl_account: 'INV-100',
              notes: null
            }
          }
        ]
      }
    ];

    mockInventoryItem.findOne.mockResolvedValue(null);
    mockInventoryItem.upsert.mockResolvedValue([{ id: 555 }, true]);

    const result = await transformer.transform({ upload, batches }, { dryRun: false });

    expect(mockInventoryItem.findOne).toHaveBeenCalledWith({
      where: {
        restaurantId: 7,
        sourcePosProvider: 'csv',
        sourcePosItemId: 'csv-rom-001'
      }
    });

    expect(mockInventoryItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 7,
        name: 'Romaine Lettuce',
        category: 'produce',
        unit: 'lbs',
        unitCost: 3.25,
        sourcePosProvider: 'csv',
        sourcePosItemId: 'csv-rom-001'
      }),
      expect.objectContaining({
        conflictFields: ['restaurant_id', 'source_pos_provider', 'source_pos_item_id'],
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
    expect(result.errorRate).toBe(0);
    expect(result.exceededThreshold).toBe(false);
  });

  it('records row errors and reports when error threshold exceeded', async () => {
    const transformer = buildTransformer();

    const upload = {
      id: 88,
      restaurantId: 3,
      status: 'validated'
    };

    const batches = [
      {
        rows: [
          { row: 1, data: { name: 'Item 1', category: 'Produce', unit: 'lb', unit_cost: 2.5, supplier_name: 'S1' } },
          { row: 2, data: { name: 'Item 2', category: 'Produce', unit: 'lb', unit_cost: 2.5, supplier_name: 'S1' } }
        ]
      }
    ];

    mockInventoryItem.findOne.mockResolvedValue(null);
    mockInventoryItem.upsert.mockImplementation(() => {
      throw new Error('DB exploded');
    });

    const result = await transformer.transform({ upload, batches }, { dryRun: false });

    expect(result.summary.errors).toBe(2);
    expect(result.errorRate).toBeGreaterThan(0);
    expect(result.exceededThreshold).toBe(true);
    expect(result.errors).toHaveLength(2);
  });
});
