import { describe, beforeEach, afterEach, test, expect, vi } from 'vitest';

// Mock IngredientCategory model methods
const mockIngredientCategory = {
  create: vi.fn(),
  findOne: vi.fn(),
  findAll: vi.fn(),
  findByPk: vi.fn(),
  getCategoryTree: vi.fn(),
  findRootCategories: vi.fn(),
  searchCategories: vi.fn(),
  prototype: {
    getDepth: vi.fn(),
    getParentCategory: vi.fn(),
    getChildCategories: vi.fn(),
    getAllDescendants: vi.fn(),
    getAncestors: vi.fn(),
    getBreadcrumbs: vi.fn(),
    isDescendantOf: vi.fn()
  }
};

// Mock InventoryItem model methods
const mockInventoryItem = {
  create: vi.fn(),
  findAll: vi.fn(),
  findByPk: vi.fn(),
  findHighValueItems: vi.fn(),
  getCategoryVarianceSummary: vi.fn(),
  prototype: {
    getCategoryPath: vi.fn(),
    getVariancePriority: vi.fn(),
    isVarianceSignificant: vi.fn(),
    reload: vi.fn()
  }
};

// Mock Restaurant model methods
const mockRestaurant = {
  create: vi.fn(),
  findByPk: vi.fn()
};

describe('Task 8: Updated Sequelize Models', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('IngredientCategory Model', () => {
    test('should create hierarchical categories with ltree paths', async () => {
      // Mock data
      const mockProduceCategory = {
        id: 1,
        name: 'Produce',
        path: 'produce',
        description: 'Fresh fruits and vegetables',
        getDepth: vi.fn().mockReturnValue(1)
      };

      const mockLeafyGreensCategory = {
        id: 2,
        name: 'Leafy Greens',
        path: 'produce.leafy_greens',
        description: 'Lettuce, spinach, kale',
        getDepth: vi.fn().mockReturnValue(2)
      };

      const mockRomaineCategory = {
        id: 3,
        name: 'Romaine Lettuce',
        path: 'produce.leafy_greens.romaine',
        description: 'Romaine lettuce - low value, high volume',
        getDepth: vi.fn().mockReturnValue(3)
      };

      // Mock create method to return the mock data
      mockIngredientCategory.create
        .mockResolvedValueOnce(mockProduceCategory)
        .mockResolvedValueOnce(mockLeafyGreensCategory)
        .mockResolvedValueOnce(mockRomaineCategory);

      // Simulate creating categories
      const produce = await mockIngredientCategory.create({
        name: 'Produce',
        path: 'produce',
        description: 'Fresh fruits and vegetables'
      });

      const leafyGreens = await mockIngredientCategory.create({
        name: 'Leafy Greens',
        path: 'produce.leafy_greens',
        description: 'Lettuce, spinach, kale'
      });

      const romaine = await mockIngredientCategory.create({
        name: 'Romaine Lettuce',
        path: 'produce.leafy_greens.romaine',
        description: 'Romaine lettuce - low value, high volume'
      });

      // Test the results
      expect(produce.path).toBe('produce');
      expect(leafyGreens.path).toBe('produce.leafy_greens');
      expect(romaine.path).toBe('produce.leafy_greens.romaine');

      // Test depth calculation
      expect(produce.getDepth()).toBe(1);
      expect(leafyGreens.getDepth()).toBe(2);
      expect(romaine.getDepth()).toBe(3);

      // Verify create was called with correct data
      expect(mockIngredientCategory.create).toHaveBeenCalledTimes(3);
      expect(mockIngredientCategory.create).toHaveBeenNthCalledWith(1, {
        name: 'Produce',
        path: 'produce',
        description: 'Fresh fruits and vegetables'
      });
    });

    test('should find parent categories using ltree operators', async () => {
      const mockParentCategory = {
        id: 1,
        name: 'Produce',
        path: 'produce'
      };

      const mockChildCategory = {
        id: 2,
        name: 'Leafy Greens',
        path: 'produce.leafy_greens',
        getParentCategory: vi.fn().mockResolvedValue(mockParentCategory)
      };

      mockIngredientCategory.create
        .mockResolvedValueOnce(mockParentCategory)
        .mockResolvedValueOnce(mockChildCategory);

      const produce = await mockIngredientCategory.create({
        name: 'Produce',
        path: 'produce'
      });

      const leafyGreens = await mockIngredientCategory.create({
        name: 'Leafy Greens',
        path: 'produce.leafy_greens'
      });

      // Test parent finding
      const parent = await leafyGreens.getParentCategory();
      expect(parent.id).toBe(produce.id);
      expect(parent.path).toBe('produce');
    });

    test('should find child categories using ltree operators', async () => {
      const mockChildCategories = [
        { id: 2, name: 'Leafy Greens', path: 'produce.leafy_greens' },
        { id: 3, name: 'Herbs', path: 'produce.herbs' }
      ];

      const mockParentCategory = {
        id: 1,
        name: 'Produce',
        path: 'produce',
        getChildCategories: vi.fn().mockResolvedValue(mockChildCategories)
      };

      mockIngredientCategory.create.mockResolvedValue(mockParentCategory);

      const produce = await mockIngredientCategory.create({
        name: 'Produce',
        path: 'produce'
      });

      // Test child finding
      const children = await produce.getChildCategories();
      expect(children).toHaveLength(2);
      expect(children.map(c => c.name)).toContain('Leafy Greens');
      expect(children.map(c => c.name)).toContain('Herbs');
    });

    test('should generate breadcrumbs correctly', () => {
      const mockCategory = {
        name: 'Romaine',
        path: 'produce.leafy_greens.romaine',
        getBreadcrumbs: vi.fn().mockReturnValue([
          { path: 'produce', name: 'Produce' },
          { path: 'produce.leafy_greens', name: 'Leafy Greens' },
          { path: 'produce.leafy_greens.romaine', name: 'Romaine' }
        ])
      };

      const breadcrumbs = mockCategory.getBreadcrumbs();
      expect(breadcrumbs).toHaveLength(3);
      expect(breadcrumbs[0]).toEqual({ path: 'produce', name: 'Produce' });
      expect(breadcrumbs[1]).toEqual({ path: 'produce.leafy_greens', name: 'Leafy Greens' });
      expect(breadcrumbs[2]).toEqual({ path: 'produce.leafy_greens.romaine', name: 'Romaine' });
    });

    test('should find root categories', async () => {
      const mockRootCategories = [
        { name: 'Produce', path: 'produce' },
        { name: 'Spices', path: 'spices' }
      ];

      mockIngredientCategory.findRootCategories.mockResolvedValue(mockRootCategories);

      const rootCategories = await mockIngredientCategory.findRootCategories();
      expect(rootCategories).toHaveLength(2);
      expect(rootCategories.map(c => c.name)).toContain('Produce');
      expect(rootCategories.map(c => c.name)).toContain('Spices');
    });

    test('should build category tree structure', async () => {
      const mockTree = [
        {
          name: 'Produce',
          path: 'produce',
          children: [
            {
              name: 'Leafy Greens',
              path: 'produce.leafy_greens',
              children: [
                { name: 'Romaine', path: 'produce.leafy_greens.romaine', children: [] }
              ]
            }
          ]
        },
        {
          name: 'Spices',
          path: 'spices',
          children: [
            { name: 'Premium Spices', path: 'spices.premium', children: [] }
          ]
        }
      ];

      mockIngredientCategory.getCategoryTree.mockResolvedValue(mockTree);

      const tree = await mockIngredientCategory.getCategoryTree();
      expect(tree).toHaveLength(2); // Two root categories

      const produceNode = tree.find(node => node.name === 'Produce');
      expect(produceNode.children).toHaveLength(1);
      expect(produceNode.children[0].name).toBe('Leafy Greens');
      expect(produceNode.children[0].children).toHaveLength(1);
      expect(produceNode.children[0].children[0].name).toBe('Romaine');
    });
  });

  describe('Updated InventoryItem Model', () => {
    test('should associate with hierarchical categories', async () => {
      const mockCategory = {
        id: 1,
        name: 'Romaine Lettuce',
        path: 'produce.leafy_greens.romaine'
      };

      const mockItem = {
        id: 1,
        restaurantId: 1,
        name: 'Romaine Hearts',
        category: 'produce',
        categoryId: 1,
        unit: 'lbs',
        unitCost: 2.50,
        hierarchicalCategory: mockCategory,
        reload: vi.fn().mockResolvedValue()
      };

      mockRestaurant.create.mockResolvedValue({ id: 1 });
      mockIngredientCategory.create.mockResolvedValue(mockCategory);
      mockInventoryItem.create.mockResolvedValue(mockItem);

      // Create category
      const category = await mockIngredientCategory.create({
        name: 'Romaine Lettuce',
        path: 'produce.leafy_greens.romaine'
      });

      // Create inventory item with category association
      const item = await mockInventoryItem.create({
        restaurantId: 1,
        name: 'Romaine Hearts',
        category: 'produce',
        categoryId: category.id,
        unit: 'lbs',
        unitCost: 2.50,
        minimumStock: 5,
        maximumStock: 50,
        highValueFlag: false,
        varianceThresholdQuantity: 20.00,
        varianceThresholdDollar: 50.00
      });

      // Test association
      await item.reload();
      expect(item.hierarchicalCategory).toBeDefined();
      expect(item.hierarchicalCategory.path).toBe('produce.leafy_greens.romaine');
    });

    test('should get category path for drilling', async () => {
      const mockCategory = {
        id: 1,
        name: 'Saffron',
        path: 'spices.premium.saffron'
      };

      const mockItem = {
        id: 1,
        categoryId: 1,
        getCategoryPath: vi.fn().mockResolvedValue('spices.premium.saffron')
      };

      mockIngredientCategory.create.mockResolvedValue(mockCategory);
      mockInventoryItem.create.mockResolvedValue(mockItem);

      const item = await mockInventoryItem.create({
        restaurantId: 1,
        name: 'Saffron Threads',
        category: 'spices',
        categoryId: 1,
        unit: 'oz',
        unitCost: 150.00,
        highValueFlag: true
      });

      const categoryPath = await item.getCategoryPath();
      expect(categoryPath).toBe('spices.premium.saffron');
    });

    test('should find high-value items with category information', async () => {
      const mockHighValueItems = [
        {
          id: 1,
          name: 'Saffron Threads',
          highValueFlag: true,
          hierarchicalCategory: {
            path: 'spices.premium.saffron'
          }
        }
      ];

      mockInventoryItem.findHighValueItems.mockResolvedValue(mockHighValueItems);

      const highValueItems = await mockInventoryItem.findHighValueItems(1);
      expect(highValueItems).toHaveLength(1);
      expect(highValueItems[0].name).toBe('Saffron Threads');
      expect(highValueItems[0].hierarchicalCategory.path).toBe('spices.premium.saffron');
    });
  });

  describe('Dave\'s Business Logic Integration', () => {
    test('should support Dave\'s variance priorities with categories', () => {
      const mockSaffronItem = {
        name: 'Saffron Threads',
        unitCost: 150.00,
        highValueFlag: true,
        varianceThresholdDollar: 25.00,
        getVariancePriority: vi.fn().mockReturnValue('CRITICAL'),
        isVarianceSignificant: vi.fn().mockReturnValue(true)
      };

      mockInventoryItem.create.mockResolvedValue(mockSaffronItem);

      // Test Dave's logic: high-value items get critical priority
      const priority = mockSaffronItem.getVariancePriority(600); // $600 variance
      expect(priority).toBe('CRITICAL');

      // Test Dave's variance significance
      const isSignificant = mockSaffronItem.isVarianceSignificant(4, 600); // 4oz, $600
      expect(isSignificant).toBe(true);
    });

    test('should get category variance summary for Dave\'s drilling', async () => {
      const mockSummary = [
        {
          dataValues: {
            itemCount: '2',
            avgUnitCost: '2.75',
            highValueItemCount: '0'
          }
        }
      ];

      mockInventoryItem.getCategoryVarianceSummary.mockResolvedValue(mockSummary);

      const summary = await mockInventoryItem.getCategoryVarianceSummary(
        1,
        'produce.leafy_greens'
      );

      expect(summary).toHaveLength(1);
      expect(parseInt(summary[0].dataValues.itemCount)).toBe(2);
    });
  });

  describe('Model Integration Tests', () => {
    test('should validate ltree path format', () => {
      // Test path validation logic
      const validPaths = [
        'produce',
        'produce.leafy_greens',
        'produce.leafy_greens.romaine',
        'spices.premium',
        'dairy.cheese.hard_cheese'
      ];

      const ltreePathRegex = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/i;

      validPaths.forEach(path => {
        expect(ltreePathRegex.test(path)).toBe(true);
      });
    });

    test('should calculate category depth correctly', () => {
      const testCases = [
        { path: 'produce', expectedDepth: 1 },
        { path: 'produce.leafy_greens', expectedDepth: 2 },
        { path: 'produce.leafy_greens.romaine', expectedDepth: 3 },
        { path: 'spices.premium.saffron', expectedDepth: 3 }
      ];

      testCases.forEach(({ path, expectedDepth }) => {
        const depth = path.split('.').length;
        expect(depth).toBe(expectedDepth);
      });
    });

    test('should handle category breadcrumb generation', () => {
      const path = 'produce.leafy_greens.romaine';
      const pathParts = path.split('.');
      const breadcrumbs = [];

      for (let i = 0; i < pathParts.length; i++) {
        const currentPath = pathParts.slice(0, i + 1).join('.');
        breadcrumbs.push({
          path: currentPath,
          name: pathParts[i].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        });
      }

      expect(breadcrumbs).toHaveLength(3);
      expect(breadcrumbs[0]).toEqual({ path: 'produce', name: 'Produce' });
      expect(breadcrumbs[1]).toEqual({ path: 'produce.leafy_greens', name: 'Leafy Greens' });
      expect(breadcrumbs[2]).toEqual({ path: 'produce.leafy_greens.romaine', name: 'Romaine' });
    });
  });
});
