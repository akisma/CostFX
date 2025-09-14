# Technical Solutions & Code Patterns
*Discovered during test coverage implementation*

## 🔧 ES Modules + Jest Configuration

### Problem
Jest doesn't natively support ES modules, causing failures with modern JavaScript imports.

### Solution
**File: `backend/jest.config.js`**
```javascript
export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
```

**File: `backend/.babelrc`**
```json
{
  "presets": [
    ["@babel/preset-env", {
      "targets": {
        "node": "current"
      }
    }]
  ]
}
```

**Package.json script:**
```json
{
  "test": "NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest --detectOpenHandles --forceExit --passWithNoTests"
}
```

## ⚛️ React Testing with Vitest

### Problem
Need fast, modern testing for React components with proper DOM simulation.

### Solution
**File: `frontend/vitest.config.js`**
```javascript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
    css: true
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
```

**Component Test Pattern:**
```javascript
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DollarSign } from 'lucide-react'
import MetricCard from '../../src/components/dashboard/MetricCard'

describe('MetricCard Component', () => {
  const basicProps = {
    title: 'Total Revenue',
    value: '$45,650',
    icon: DollarSign,
    color: 'blue'
  }

  it('renders the basic metric card correctly', () => {
    render(<MetricCard {...basicProps} />)
    
    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    expect(screen.getByText('$45,650')).toBeInTheDocument()
  })
})
```

## 🌐 Express API Testing Pattern

### Integration Test Setup
```javascript
import request from 'supertest';
import app from '../../src/app.js';

describe('Restaurant API Integration Tests', () => {
  it('should return list of restaurants', async () => {
    const response = await request(app)
      .get('/api/v1/restaurants')
      .expect(200);

    expect(response.body).toHaveProperty('restaurants');
    expect(response.body).toHaveProperty('total');
  });
});
```

### Unit Test Pattern (Controller)
```javascript
import { jest } from '@jest/globals';
import { findAll, findByPk } from '../../src/controllers/restaurantController.js';

// Mock the model
const mockRestaurant = {
  findAll: jest.fn(),
  findByPk: jest.fn(),
  count: jest.fn()
};

describe('Restaurant Controller Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return paginated restaurants', async () => {
    // Test implementation
  });
});
```

## 🔀 Router Testing Challenges

### Problem
React Router components cause nesting conflicts in tests:
```jsx
// App.jsx contains BrowserRouter
// Test adds MemoryRouter = Double router error
```

### Solution Strategy
Extract testable components:
```javascript
// Good: Testable wrapper
const TestWrapper = ({ children, initialEntries = ['/'] }) => (
  <Provider store={store}>
    <MemoryRouter initialEntries={initialEntries}>
      {children}
    </MemoryRouter>
  </Provider>
);

// Mock the components to avoid complexity
vi.mock('../src/components/dashboard/Dashboard', () => ({
  default: () => <div data-testid="dashboard">Dashboard Component</div>
}));
```

## 🗄️ Database Testing Patterns

### Test Environment Setup
```javascript
// tests/setup.js
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../');

// Load test environment variables
dotenv.config({ path: join(rootDir, '.env') });

// Override for test database
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'restaurant_ai_test';
```

### Model Association Pattern
```javascript
// models/Restaurant.js
class Restaurant extends Model {
  static associate(models) {
    Restaurant.hasMany(models.Recipe, {
      foreignKey: 'restaurantId',
      as: 'recipes'
    });
    // Critical: Must match controller includes
  }
}
```

## 📦 Mock Strategy Patterns

### Axios API Mocking
```javascript
// Complex but necessary for interceptor testing
const mockAxios = {
  create: vi.fn(),
  defaults: {},
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() }
  }
};

vi.mock('axios', () => ({
  default: mockAxios
}));
```

### Component Mocking
```javascript
// Simple and effective
vi.mock('../../src/components/dashboard/MetricCard', () => ({
  default: ({ title, value }) => (
    <div data-testid="metric-card">
      <span>{title}</span>
      <span>{value}</span>
    </div>
  )
}));
```

## 🎯 Error Testing Patterns

### Error Handler Testing
```javascript
describe('Error Handler Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  it('should handle errors with status codes', () => {
    const error = new Error('Validation error');
    error.statusCode = 400;
    
    errorHandler(error, mockReq, mockRes, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});
```

## 🚀 Performance Patterns

### Test Execution Optimization
```javascript
// Jest configuration for speed
export default {
  maxWorkers: '50%',           // Parallel execution
  testTimeout: 10000,          // Reasonable timeout
  detectOpenHandles: true,     // Memory leak detection
  forceExit: true             // Clean exit
};
```

### Async Testing Best Practices
```javascript
// Use waitFor for async operations
await waitFor(() => {
  expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
}, { timeout: 2000 });

// Proper cleanup
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});
```

## 🔍 Debugging Patterns

### Test Failure Diagnosis
```javascript
// Add detailed logging for debugging
console.log('Rendered HTML:', container.innerHTML);

// Use screen.debug() for React components
screen.debug();

// Check available queries
screen.logTestingPlaygroundURL();
```

### Environment Variable Debugging
```javascript
// Verify test environment
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('Test DB:', process.env.DB_NAME_TEST);
```

These patterns represent battle-tested solutions for common testing challenges in modern JavaScript applications.
