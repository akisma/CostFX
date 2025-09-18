/**
 * Shared Test Configuration
 * Centralized configuration for test environments
 */

export const testConfig = {
  // Backend test configuration
  backend: {
    port: 3001,
    host: 'localhost',
    baseUrl: 'http://localhost:3001',
    apiPath: '/api/v1',
    apiUrl: 'http://localhost:3001/api/v1'
  },

  // Frontend test configuration  
  frontend: {
    port: 3000,
    host: 'localhost',
    baseUrl: 'http://localhost:3000'
  },

  // Database test configuration
  database: {
    host: 'localhost',
    port: 5432,
    name: 'restaurant_ai_test'
  },

  // Redis test configuration
  redis: {
    host: 'localhost', 
    port: 6379,
    db: 1 // Use different DB for tests
  },

  // Mock API responses
  mocks: {
    timeout: 100, // Fast timeout for tests
    retries: 1
  },

  // Test timeouts
  timeouts: {
    unit: 5000,      // 5 seconds
    integration: 10000, // 10 seconds
    e2e: 30000       // 30 seconds
  }
};

// Helper functions for test URLs
export function getTestApiUrl(endpoint = '') {
  return `${testConfig.backend.apiUrl}${endpoint}`;
}

export function getTestBackendUrl(path = '') {
  return `${testConfig.backend.baseUrl}${path}`;
}

export function getTestFrontendUrl(path = '') {
  return `${testConfig.frontend.baseUrl}${path}`;
}

export default testConfig;
