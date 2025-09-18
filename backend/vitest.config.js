import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test files patterns
    include: [
      'tests/**/*.test.js'
    ],
    
    // Setup files
    setupFiles: ['tests/setup.js'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'src/**/*.js'
      ],
      exclude: [
        'src/index.js',
        'src/config/database.js',
        '**/node_modules/**'
      ]
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Global test configuration
    globals: false, // Use explicit imports instead of globals
    
    // Pool configuration for better ES modules support
    pool: 'forks',
    
    // Dependency handling
    deps: {
      // Inline dependencies for better ES modules support
      inline: [
        /^(?!.*node_modules)/
      ]
    }
  }
});
