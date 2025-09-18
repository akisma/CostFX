import { beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { testConfig } from '../../shared/src/config/testConfig.js';

// Set global reference
globalThis.global = globalThis;
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_URL: testConfig.backend.apiUrl,
    NODE_ENV: 'test'
  }
});

// Mock fetch for API calls
globalThis.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
globalThis.localStorage = localStorageMock;

// Mock window.location
delete window.location;
window.location = { href: '', reload: vi.fn() };

// Setup and cleanup
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// Clean up after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks();
})