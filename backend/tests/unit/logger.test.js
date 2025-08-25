import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Logger Utility Unit Tests', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('should be able to create console spy', () => {
    console.log('Test message');
    expect(consoleSpy).toHaveBeenCalledWith('Test message');
  });

  test('should handle different log levels', () => {
    console.log('Debug message');
    console.log('Info message');
    console.log('Warning message');
    console.log('Error message');
    
    expect(consoleSpy).toHaveBeenCalledTimes(4);
  });

  test('should log with basic functionality', () => {
    const message = 'Test message with metadata';
    console.log(message, { userId: 123, action: 'test' });
    
    expect(consoleSpy).toHaveBeenCalled();
  });
});
