import { describe, beforeAll, beforeEach, afterEach, afterAll, test, expect, vi } from 'vitest';

// Skip mocking for this integration test by importing directly
vi.unmock('../../../src/config/database.js');
vi.unmock('../../../src/models/index.js');

import sequelize from '../../../src/config/database.js';
import models from '../../../src/models/index.js';

const { IngredientCategory, InventoryItem, Restaurant } = models;

describe('Task 8: Updated Sequelize Models', () => {
  let testRestaurant;

  beforeAll(async () => {
    // Ensure database connection and sync models
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Create test restaurant for foreign key relationships
    testRestaurant = await Restaurant.create({
      name: 'Test Restaurant',
      address: '123 Test St',
      phone: '555-0123',
      email: 'test@restaurant.com'
    });
  });

  afterEach(async () => {
    // Clean up test data
    await sequelize.truncate({ cascade: true, restartIdentity: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('IngredientCategory Model', () => {
    test('should create hierarchical categories with ltree paths', async () => {
      // Create parent category
      const produce = await IngredientCategory.create({
        name: 'Produce',
        path: 'produce',
        description: 'Fresh fruits and vegetables'
      });

      // Create child category
      const leafyGreens = await IngredientCategory.create({
        name: 'Leafy Greens',
        path: 'produce.leafy_greens',
        description: 'Lettuce, spinach, kale'
      });

      // Create grandchild category
      const romaine = await IngredientCategory.create({
        name: 'Romaine Lettuce',
        path: 'produce.leafy_greens.romaine',
        description: 'Romaine lettuce - low value, high volume'
      });

      expect(produce.path).toBe('produce');
      expect(leafyGreens.path).toBe('produce.leafy_greens');
      expect(romaine.path).toBe('produce.leafy_greens.romaine');

      // Test depth calculation
      expect(produce.getDepth()).toBe(1);
      expect(leafyGreens.getDepth()).toBe(2);
      expect(romaine.getDepth()).toBe(3);
    });

    test('should find parent categories using ltree operators', async () => {
      // Create hierarchy
      const produce = await IngredientCategory.create({
        name: 'Produce',
        path: 'produce'
      });

      const leafyGreens = await IngredientCategory.create({
        name: 'Leafy Greens',
        path: 'produce.leafy_greens'
      });

      // Test parent finding
      const parent = await leafyGreens.getParentCategory();
      expect(parent.id).toBe(produce.id);
      expect(parent.path).toBe('produce');
    });

    test('should find child categories using ltree operators', async () => {
      // Create hierarchy
      const produce = await IngredientCategory.create({
        name: 'Produce',
        path: 'produce'
      });

      const leafyGreens = await IngredientCategory.create({
        name: 'Leafy Greens',
        path: 'produce.leafy_greens'
      });

      const herbs = await IngredientCategory.create({
        name: 'Herbs',
        path: 'produce.herbs'
      });

      // Test child finding
      const children = await produce.getChildCategories();
      expect(children).toHaveLength(2);
      expect(children.map(c => c.name)).toContain('Leafy Greens');
      expect(children.map(c => c.name)).toContain('Herbs');
    });

    test('should generate breadcrumbs correctly', async () => {
      const category = await IngredientCategory.create({
        name: 'Romaine',
        path: 'produce.leafy_greens.romaine'
      });

      const breadcrumbs = category.getBreadcrumbs();
      expect(breadcrumbs).toHaveLength(3);
      expect(breadcrumbs[0]).toEqual({ path: 'produce', name: 'Produce' });
      expect(breadcrumbs[1]).toEqual({ path: 'produce.leafy_greens', name: 'Leafy Greens' });
      expect(breadcrumbs[2]).toEqual({ path: 'produce.leafy_greens.romaine', name: 'Romaine' });
    });

    test('should find root categories', async () => {
      // Create mix of root and nested categories
      await IngredientCategory.create({ name: 'Produce', path: 'produce' });
      await IngredientCategory.create({ name: 'Spices', path: 'spices' });
      await IngredientCategory.create({ name: 'Leafy Greens', path: 'produce.leafy_greens' });

      const rootCategories = await IngredientCategory.findRootCategories();
      expect(rootCategories).toHaveLength(2);
      expect(rootCategories.map(c => c.name)).toContain('Produce');
      expect(rootCategories.map(c => c.name)).toContain('Spices');
    });

    test('should build category tree structure', async () => {
      // Create test hierarchy
      await IngredientCategory.create({ name: 'Produce', path: 'produce' });
      await IngredientCategory.create({ name: 'Leafy Greens', path: 'produce.leafy_greens' });
      await IngredientCategory.create({ name: 'Romaine', path: 'produce.leafy_greens.romaine' });
      await IngredientCategory.create({ name: 'Spices', path: 'spices' });
      await IngredientCategory.create({ name: 'Premium Spices', path: 'spices.premium' });

      const tree = await IngredientCategory.getCategoryTree();
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
      // Create category
      const category = await IngredientCategory.create({
        name: 'Romaine Lettuce',
        path: 'produce.leafy_greens.romaine'
      });

      // Create inventory item with category association
      const item = await InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Romaine Hearts',
        category: 'produce', // Legacy field
        categoryId: category.id, // New hierarchical field
        unit: 'lbs',
        unitCost: 2.50,
        minimumStock: 5,
        maximumStock: 50,
        highValueFlag: false,
        varianceThresholdQuantity: 20.00,
        varianceThresholdDollar: 50.00
      });

      // Test association
      await item.reload({ include: [{ model: IngredientCategory, as: 'hierarchicalCategory' }] });
      expect(item.hierarchicalCategory).toBeDefined();
      expect(item.hierarchicalCategory.path).toBe('produce.leafy_greens.romaine');
    });

    test('should get category path for drilling', async () => {
      const category = await IngredientCategory.create({
        name: 'Saffron',
        path: 'spices.premium.saffron'
      });

      const item = await InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Saffron Threads',
        category: 'spices',
        categoryId: category.id,
        unit: 'oz',
        unitCost: 150.00,
        minimumStock: 1,
        maximumStock: 5,
        highValueFlag: true,
        varianceThresholdQuantity: 0.25,
        varianceThresholdDollar: 25.00
      });

      const categoryPath = await item.getCategoryPath();
      expect(categoryPath).toBe('spices.premium.saffron');
    });

    test('should find high-value items with category information', async () => {
      const saffronCategory = await IngredientCategory.create({
        name: 'Saffron',
        path: 'spices.premium.saffron'
      });

      const romaineCategory = await IngredientCategory.create({
        name: 'Romaine',
        path: 'produce.leafy_greens.romaine'
      });

      // Create high-value item
      await InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Saffron Threads',
        category: 'spices',
        categoryId: saffronCategory.id,
        unit: 'oz',
        unitCost: 150.00,
        highValueFlag: true
      });

      // Create low-value item
      await InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Romaine Hearts',
        category: 'produce',
        categoryId: romaineCategory.id,
        unit: 'lbs',
        unitCost: 2.50,
        highValueFlag: false
      });

      const highValueItems = await InventoryItem.findHighValueItems(testRestaurant.id);
      expect(highValueItems).toHaveLength(1);
      expect(highValueItems[0].name).toBe('Saffron Threads');
      expect(highValueItems[0].hierarchicalCategory.path).toBe('spices.premium.saffron');
    });
  });

  describe('Model Index Integration', () => {
    test('should load all models through index', async () => {
      expect(models.Restaurant).toBeDefined();
      expect(models.IngredientCategory).toBeDefined();
      expect(models.InventoryItem).toBeDefined();
      expect(models.InventoryPeriod).toBeDefined();
      expect(models.InventoryTransaction).toBeDefined();
      expect(models.PeriodInventorySnapshot).toBeDefined();
      expect(models.TheoreticalUsageAnalysis).toBeDefined();
    });

    test('should have proper associations loaded', async () => {
      // Create test data
      const category = await IngredientCategory.create({
        name: 'Test Category',
        path: 'test'
      });

      const item = await InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Test Item',
        category: 'test',
        categoryId: category.id,
        unit: 'pieces',
        unitCost: 1.00
      });

      // Test that associations work
      const foundItem = await InventoryItem.findByPk(item.id, {
        include: [
          { model: IngredientCategory, as: 'hierarchicalCategory' },
          { model: Restaurant, as: 'restaurant' }
        ]
      });

      expect(foundItem.hierarchicalCategory.name).toBe('Test Category');
      expect(foundItem.restaurant.name).toBe('Test Restaurant');
    });
  });

  describe('Dave\'s Business Logic Integration', () => {
    test('should support Dave\'s variance priorities with categories', async () => {
      const saffronCategory = await IngredientCategory.create({
        name: 'Saffron',
        path: 'spices.premium.saffron'
      });

      const saffron = await InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Saffron Threads',
        categoryId: saffronCategory.id,
        category: 'spices',
        unit: 'oz',
        unitCost: 150.00,
        highValueFlag: true,
        varianceThresholdDollar: 25.00
      });

      // Test Dave's logic: high-value items get critical priority
      const priority = saffron.getVariancePriority(600); // $600 variance
      expect(priority).toBe('CRITICAL');

      // Test Dave's variance significance
      const isSignificant = saffron.isVarianceSignificant(4, 600); // 4oz, $600
      expect(isSignificant).toBe(true);
    });

    test('should get category variance summary for Dave\'s drilling', async () => {
      // Create produce hierarchy  
      await IngredientCategory.create({ name: 'Produce', path: 'produce' });
      const leafyGreensCategory = await IngredientCategory.create({ 
        name: 'Leafy Greens', 
        path: 'produce.leafy_greens' 
      });

      // Create items in category
      await InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Romaine Hearts',
        categoryId: leafyGreensCategory.id,
        category: 'produce',
        unit: 'lbs',
        unitCost: 2.50,
        highValueFlag: false
      });

      await InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Spinach',
        categoryId: leafyGreensCategory.id,
        category: 'produce',
        unit: 'lbs',
        unitCost: 3.00,
        highValueFlag: false
      });

      // Test category drilling
      const summary = await InventoryItem.getCategoryVarianceSummary(
        testRestaurant.id,
        'produce.leafy_greens'
      );

      expect(summary).toHaveLength(1);
      expect(parseInt(summary[0].dataValues.itemCount)).toBe(2);
    });
  });
});
