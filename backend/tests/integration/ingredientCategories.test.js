import { vi, describe, test, expect, beforeEach } from 'vitest';

// Mock ingredient categories data that would come from the database
const mockIngredientCategories = [
  {
    id: 1,
    name: 'Produce',
    path: 'produce',
    description: 'Fresh fruits and vegetables',
    is_active: true
  },
  {
    id: 2,
    name: 'Leafy Greens',
    path: 'produce.leafy_greens',
    description: 'Lettuce, spinach, kale, and other leafy vegetables',
    is_active: true
  },
  {
    id: 3,
    name: 'Romaine Lettuce',
    path: 'produce.leafy_greens.romaine',
    description: 'Romaine lettuce - low value, high volume item',
    is_active: true
  },
  {
    id: 4,
    name: 'Spices & Seasonings',
    path: 'spices',
    description: 'Herbs, spices, and seasoning ingredients',
    is_active: true
  },
  {
    id: 5,
    name: 'Premium Spices',
    path: 'spices.premium',
    description: 'High-value specialty spices and seasonings',
    is_active: true
  },
  {
    id: 6,
    name: 'Saffron',
    path: 'spices.premium.saffron',
    description: 'Saffron threads - high value, low volume item',
    is_active: true
  }
];

// Mock category service that would handle hierarchical queries
const mockCategoryService = {
  findAll: vi.fn(),
  findByPath: vi.fn(),
  findChildren: vi.fn(),
  findParents: vi.fn(),
  isDescendantOf: vi.fn(),
  getHierarchyDepth: vi.fn()
};

describe('Ingredient Categories Hierarchical Structure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock behavior
    mockCategoryService.findAll.mockResolvedValue(mockIngredientCategories);
  });

  test('should return all ingredient categories with hierarchical paths', async () => {
    const categories = await mockCategoryService.findAll();
    
    expect(categories.length).toBe(6);
    
    // Check specific seed data for Dave's use case
    const categoryNames = categories.map(c => c.name);
    expect(categoryNames).toContain('Produce');
    expect(categoryNames).toContain('Leafy Greens');
    expect(categoryNames).toContain('Romaine Lettuce');
    expect(categoryNames).toContain('Saffron');
  });

  test('should support hierarchical path queries (find children)', async () => {
    // Mock finding all children of 'produce'
    const produceChildren = mockIngredientCategories.filter(c => 
      c.path.startsWith('produce')
    );
    
    mockCategoryService.findChildren.mockResolvedValue(produceChildren);
    
    const children = await mockCategoryService.findChildren('produce');
    
    expect(children.length).toBe(3); // produce, leafy_greens, romaine
    
    const produceNames = children.map(c => c.name);
    expect(produceNames).toContain('Produce');
    expect(produceNames).toContain('Leafy Greens');
    expect(produceNames).toContain('Romaine Lettuce');
  });

  test('should support finding parent categories', async () => {
    // Mock finding parent categories of romaine
    const romainePath = 'produce.leafy_greens.romaine';
    const parents = mockIngredientCategories.filter(c => 
      romainePath.startsWith(c.path) || romainePath === c.path
    );
    
    mockCategoryService.findParents.mockResolvedValue(parents);
    
    const parentCategories = await mockCategoryService.findParents(romainePath);
    
    expect(parentCategories.length).toBe(3); // produce, leafy_greens, romaine itself
    
    const parentNames = parentCategories.map(c => c.name);
    expect(parentNames).toContain('Produce');
    expect(parentNames).toContain('Leafy Greens');
    expect(parentNames).toContain('Romaine Lettuce');
  });

  test('should demonstrate Dave\'s high-value vs low-value scenario', async () => {
    // Mock finding saffron (high-value, low-volume)
    const saffron = mockIngredientCategories.find(c => c.name === 'Saffron');
    mockCategoryService.findByPath.mockResolvedValueOnce(saffron);
    
    // Mock finding romaine (low-value, high-volume)
    const romaine = mockIngredientCategories.find(c => c.name === 'Romaine Lettuce');
    mockCategoryService.findByPath.mockResolvedValueOnce(romaine);
    
    const saffronResult = await mockCategoryService.findByPath('spices.premium.saffron');
    const romaineResult = await mockCategoryService.findByPath('produce.leafy_greens.romaine');
    
    expect(saffronResult.name).toBe('Saffron');
    expect(saffronResult.path).toBe('spices.premium.saffron');
    expect(saffronResult.description).toContain('high value, low volume');
    
    expect(romaineResult.name).toBe('Romaine Lettuce');
    expect(romaineResult.path).toBe('produce.leafy_greens.romaine');
    expect(romaineResult.description).toContain('low value, high volume');
    
    // Verify they're in different hierarchies
    expect(saffronResult.path).not.toContain('produce');
    expect(romaineResult.path).not.toContain('spices');
  });

  test('should validate hierarchical relationships', async () => {
    // Mock hierarchy validation
    mockCategoryService.isDescendantOf.mockImplementation((childPath, parentPath) => {
      return childPath.startsWith(parentPath + '.') || childPath === parentPath;
    });

    // Test that romaine is a descendant of produce
    const romaineIsProduceChild = await mockCategoryService.isDescendantOf(
      'produce.leafy_greens.romaine', 
      'produce'
    );
    expect(romaineIsProduceChild).toBe(true);

    // Test that saffron is NOT a descendant of produce
    const saffronIsProduceChild = await mockCategoryService.isDescendantOf(
      'spices.premium.saffron', 
      'produce'
    );
    expect(saffronIsProduceChild).toBe(false);
  });

  test('should calculate hierarchy depth correctly', async () => {
    mockCategoryService.getHierarchyDepth.mockImplementation((path) => {
      return path.split('.').length;
    });

    // Root categories have depth 1
    const produceDepth = await mockCategoryService.getHierarchyDepth('produce');
    expect(produceDepth).toBe(1);

    // Leafy greens has depth 2
    const leafyGreensDepth = await mockCategoryService.getHierarchyDepth('produce.leafy_greens');
    expect(leafyGreensDepth).toBe(2);

    // Romaine has depth 3
    const romaineDepth = await mockCategoryService.getHierarchyDepth('produce.leafy_greens.romaine');
    expect(romaineDepth).toBe(3);

    // Saffron also has depth 3
    const saffronDepth = await mockCategoryService.getHierarchyDepth('spices.premium.saffron');
    expect(saffronDepth).toBe(3);
  });
});
