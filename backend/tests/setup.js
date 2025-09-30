/**
 * Vitest Test Setup
 * Configures global mocks and test environment
 */
import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { testConfig } from '../../shared/src/config/testConfig.js';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = testConfig.backend.port.toString();
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = `redis://${testConfig.redis.host}:${testConfig.redis.port}`;

// Create shared in-memory data stores for all mocks
const sharedDataStores = {
  Restaurant: new Map(),
  InventoryItem: new Map(),
  InventoryPeriod: new Map(),
  PeriodInventorySnapshot: new Map(),
  InventoryTransaction: new Map(),
  Supplier: new Map(),
  IngredientCategory: new Map(),
  TheoreticalUsageAnalysis: new Map()
};

// Helper to generate unique IDs
const generateId = () => Math.floor(Math.random() * 1000) + 1;

// Helper to handle type coercion in where clauses
const matchesWhereClause = (item, whereClause) => {
  return Object.entries(whereClause).every(([key, value]) => {
    if (Array.isArray(value)) {
      // For arrays, check if item value matches any array value (with type coercion)
      return value.some(v => item[key] == v);
    }
    // Handle type coercion for IDs (string vs number)
    return item[key] == value; // Use == for type coercion
  });
};

// Helper to create instance methods for mock objects
const createInstanceMethods = (item, store, customMethods = {}) => ({
  update: vi.fn().mockImplementation(async function(data) {
    // Update this instance
    Object.assign(this, data, { updatedAt: new Date() });
    // Also update the stored version
    const storedItem = store.get(this.id);
    if (storedItem) {
      Object.assign(storedItem, data, { updatedAt: new Date() });
      store.set(this.id, storedItem);
    }
    return this;
  }),
  
  destroy: vi.fn().mockImplementation(async function() {
    store.delete(this.id);
    return this;
  }),
  
  ...customMethods
});

// Factory function to create consistent stateful mock models
const createStatefulMockModel = (modelName, customMethods = {}) => {
  const store = sharedDataStores[modelName];
  if (!store) {
    throw new Error(`No shared store defined for model: ${modelName}`);
  }

  const baseMockModel = {
    findAll: vi.fn().mockImplementation((options = {}) => {
      let items = Array.from(store.values());

      // Apply where clause filtering
      if (options.where) {
        items = items.filter(item => matchesWhereClause(item, options.where));
      }

      // Apply order by
      if (options.order) {
        // Simple ordering implementation
        const [field, direction = 'ASC'] = options.order[0] || [];
        if (field) {
          items.sort((a, b) => {
            const aVal = a[field];
            const bVal = b[field];
            const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return direction === 'DESC' ? -result : result;
          });
        }
      }

      // Apply limit and offset
      if (options.offset) {
        items = items.slice(options.offset);
      }
      if (options.limit) {
        items = items.slice(0, options.limit);
      }

      return Promise.resolve(items.map(item => ({
        ...item,
        ...createInstanceMethods(item, store, customMethods), // Include instance and custom methods
        toJSON: () => ({
          ...item,
          // Convert dates to proper JSON format
          createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
          updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
          // Remove any function properties
          ...Object.fromEntries(
            Object.entries(item).filter(([key, value]) => typeof value !== 'function')
          )
        })
      })));
    }),

    findAndCountAll: vi.fn().mockImplementation((options = {}) => {
      return baseMockModel.findAll(options).then(rows => ({
        count: rows.length,
        rows
      }));
    }),

    findOne: vi.fn().mockImplementation((options = {}) => {
      return baseMockModel.findAll({ ...options, limit: 1 }).then(results => 
        results.length > 0 ? results[0] : null
      );
    }),

    findByPk: vi.fn().mockImplementation((id) => {
      // Convert string IDs to numbers for matching
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
      const item = store.get(numericId) || store.get(id); // Try both numeric and original
      if (!item) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        ...item,
        ...createInstanceMethods(item, store, customMethods), // Include instance and custom methods
        toJSON: () => ({
          ...item,
          createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
          updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
          ...Object.fromEntries(
            Object.entries(item).filter(([key, value]) => typeof value !== 'function')
          )
        })
      });
    }),

    create: vi.fn().mockImplementation((data) => {
      const id = generateId();
      const now = new Date();
      // Ensure foreign key references are properly typed
      const processedData = { ...data };
      if (processedData.periodId && typeof processedData.periodId === 'string') {
        processedData.periodId = parseInt(processedData.periodId, 10);
      }
      if (processedData.inventoryItemId && typeof processedData.inventoryItemId === 'string') {
        processedData.inventoryItemId = parseInt(processedData.inventoryItemId, 10);
      }
      
      const item = {
        id,
        ...processedData,
        createdAt: now,
        updatedAt: now
      };
      store.set(id, item);
      return Promise.resolve({
        ...item,
        ...createInstanceMethods(item, store, customMethods), // Include instance and custom methods
        toJSON: () => ({
          ...item,
          createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
          updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
          ...Object.fromEntries(
            Object.entries(item).filter(([key, value]) => typeof value !== 'function')
          )
        })
      });
    }),

    update: vi.fn().mockImplementation((data, options = {}) => {
      if (options.where) {
        // Update multiple records
        const items = Array.from(store.values()).filter(item => 
          matchesWhereClause(item, options.where)
        );
        items.forEach(item => {
          Object.assign(item, data, { updatedAt: new Date() });
          store.set(item.id, item);
        });
        return Promise.resolve([items.length]);
      }
      return Promise.resolve([0]);
    }),

    destroy: vi.fn().mockImplementation((options = {}) => {
      if (options.where) {
        const items = Array.from(store.values()).filter(item => 
          matchesWhereClause(item, options.where)
        );
        items.forEach(item => store.delete(item.id));
        return Promise.resolve(items.length);
      }
      return Promise.resolve(0);
    }),
    
    // Add custom methods
    ...customMethods
  };

  return baseMockModel;
};

// Mock Sequelize itself
vi.mock('sequelize', () => {
  const mockSequelize = vi.fn().mockImplementation(() => ({
    define: vi.fn(),
    authenticate: vi.fn().mockResolvedValue(),
    sync: vi.fn().mockResolvedValue(),
    close: vi.fn().mockResolvedValue(),
    transaction: vi.fn().mockImplementation((callback) => 
      callback({
        commit: vi.fn().mockResolvedValue(),
        rollback: vi.fn().mockResolvedValue()
      })
    )
  }));
  
  return {
    default: mockSequelize,
    Sequelize: mockSequelize,
    DataTypes: {
      INTEGER: 'INTEGER',
      STRING: 'STRING',
      TEXT: 'TEXT',
      BOOLEAN: 'BOOLEAN',
      DATE: 'DATE',
      DECIMAL: 'DECIMAL',
      FLOAT: 'FLOAT',
      ENUM: 'ENUM'
    },
    Op: {
      between: 'between',
      in: 'in',
      gte: 'gte',
      lte: 'lte',
      like: 'like',
      iLike: 'iLike'
    }
  };
});

// Mock database connection
vi.mock('../src/config/database.js', () => {
  const mockSequelize = {
    define: vi.fn(),
    models: {},
    authenticate: vi.fn().mockResolvedValue(),
    sync: vi.fn().mockResolvedValue(),
    close: vi.fn().mockResolvedValue(),
    transaction: vi.fn().mockImplementation((callback) => 
      callback({
        commit: vi.fn().mockResolvedValue(),
        rollback: vi.fn().mockResolvedValue()
      })
    )
  };
  
  return {
    default: mockSequelize,
    sequelize: mockSequelize,
    connectDB: vi.fn().mockResolvedValue(),
    closeDB: vi.fn().mockResolvedValue()
  };
});

// Mock Redis
vi.mock('../src/config/redis.js', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue()
  },
  connectRedis: vi.fn().mockResolvedValue(),
  closeRedis: vi.fn().mockResolvedValue()
}));

// Mock all Sequelize models with elegant stateful system
vi.mock('../src/models/Restaurant.js', () => ({
  default: createStatefulMockModel('Restaurant')
}));

vi.mock('../src/models/InventoryItem.js', () => ({
  default: createStatefulMockModel('InventoryItem')
}));

vi.mock('../src/models/InventoryTransaction.js', () => ({
  default: createStatefulMockModel('InventoryTransaction')
}));

vi.mock('../src/models/Supplier.js', () => ({
  default: createStatefulMockModel('Supplier')
}));

vi.mock('../src/models/IngredientCategory.js', () => ({
  default: createStatefulMockModel('IngredientCategory')
}));

vi.mock('../src/models/InventoryPeriod.js', () => ({
  default: createStatefulMockModel('InventoryPeriod', {
    // Add InventoryPeriod-specific domain methods
    canTransitionTo: vi.fn().mockImplementation(function(newStatus) {
      const validTransitions = {
        'draft': ['active'],
        'active': ['closed'],
        'closed': []
      };
      return validTransitions[this.status]?.includes(newStatus) || false;
    }),

    getSnapshotCompleteness: vi.fn().mockImplementation(function() {
      const snapshotStore = sharedDataStores.PeriodInventorySnapshot;
      // Handle type coercion for periodId (string vs number)
      const snapshots = Array.from(snapshotStore.values()).filter(s => s.periodId == this.id);
      
      const beginningSnapshots = snapshots.filter(s => s.snapshotType === 'beginning').length;
      const endingSnapshots = snapshots.filter(s => s.snapshotType === 'ending').length;
      
      return {
        hasBeginningSnapshot: beginningSnapshots > 0,
        hasEndingSnapshot: endingSnapshots > 0,
        isComplete: beginningSnapshots > 0 && endingSnapshots > 0,
        snapshotSummary: {
          beginning: beginningSnapshots,
          ending: endingSnapshots,
          total: snapshots.length
        }
      };
    }),

    findOverlappingPeriods: vi.fn().mockImplementation(function(restaurantId, periodStart, periodEnd, excludeId = null) {
      const periodStore = sharedDataStores.InventoryPeriod;
      return Array.from(periodStore.values()).filter(period => {
        if (period.restaurantId !== restaurantId) return false;
        if (excludeId && period.id === excludeId) return false;
        
        const start1 = new Date(periodStart).getTime();
        const end1 = new Date(periodEnd).getTime();
        const start2 = new Date(period.periodStart).getTime();
        const end2 = new Date(period.periodEnd).getTime();
        
        return start1 < end2 && end1 > start2;
      });
    })
  })
}));

vi.mock('../src/models/PeriodInventorySnapshot.js', () => ({
  default: createStatefulMockModel('PeriodInventorySnapshot')
}));

vi.mock('../src/models/TheoreticalUsageAnalysis.js', () => ({
  default: createStatefulMockModel('TheoreticalUsageAnalysis')
}));

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({ analysis: 'test analysis', recommendations: [] })
            }
          }]
        })
      }
    }
  }))
}));

// Mock axios for external API calls
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    create: vi.fn().mockReturnThis()
  }
}));

// Console override for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console errors/warnings during tests unless explicitly testing them
  console.error = vi.fn();
  console.warn = vi.fn();
});

afterAll(() => {
  // Restore console
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});