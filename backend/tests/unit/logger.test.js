import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import logger from '../../src/utils/logger.js';

describe('Logger Utility Unit Tests', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('should have required logging methods', () => {
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.debug).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  test('should be able to call logging methods without errors', () => {
    expect(() => {
      logger.info('Test info message');
      logger.warn('Test warn message');
      logger.error('Test error message');
      logger.debug('Test debug message');
    }).not.toThrow();
  });

  test('should handle metadata in logging calls', () => {
    expect(() => {
      logger.info('Test message with metadata', { userId: 123, action: 'test' });
      logger.error('Error with context', { error: 'test-error', stack: 'test-stack' });
    }).not.toThrow();
  });
});
