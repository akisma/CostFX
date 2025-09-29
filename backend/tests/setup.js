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

// Mock database connection
vi.mock('../src/config/database.js', () => {
  const mockSequelize = {
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

// Mock all Sequelize models
vi.mock('../src/models/Restaurant.js', () => ({
  default: {
    findAll: vi.fn(),
    findAndCountAll: vi.fn(),
    findByPk: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn()
  }
}));

vi.mock('../src/models/InventoryItem.js', () => ({
  default: {
    findAll: vi.fn(),
    findByPk: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn()
  }
}));

vi.mock('../src/models/InventoryTransaction.js', () => ({
  default: {
    findAll: vi.fn(),
    findByPk: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn()
  }
}));

vi.mock('../src/models/Supplier.js', () => ({
  default: {
    findAll: vi.fn(),
    findByPk: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn()
  }
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