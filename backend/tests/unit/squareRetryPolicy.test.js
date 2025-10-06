/**
 * Unit Tests: Square Retry Policy
 * 
 * Tests exponential backoff with jitter implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import SquareRetryPolicy from '../../src/utils/squareRetryPolicy.js';

// Mock SquareError class (from square SDK)
class SquareError extends Error {
  constructor({ statusCode, body }) {
    super('Square API Error');
    this.statusCode = statusCode;
    this.body = body;
    this.errors = body?.errors || [];
  }
}

describe('SquareRetryPolicy', () => {
  let retryPolicy;
  
  beforeEach(() => {
    // Use faster config for testing
    retryPolicy = new SquareRetryPolicy({
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      jitterMs: 50
    });
  });
  
  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const policy = new SquareRetryPolicy();
      expect(policy.maxRetries).toBe(3);
      expect(policy.baseDelayMs).toBe(1000);
      expect(policy.maxDelayMs).toBe(30000);
    });
    
    it('should initialize with custom configuration', () => {
      const policy = new SquareRetryPolicy({
        maxRetries: 5,
        baseDelayMs: 500,
        maxDelayMs: 10000
      });
      expect(policy.maxRetries).toBe(5);
      expect(policy.baseDelayMs).toBe(500);
      expect(policy.maxDelayMs).toBe(10000);
    });
    
    it('should have correct default retryable status codes', () => {
      const policy = new SquareRetryPolicy();
      expect(policy.retryableStatusCodes).toEqual([429, 500, 502, 503, 504]);
    });
  });
  
  describe('executeWithRetry()', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await retryPolicy.executeWithRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(retryPolicy.stats.totalAttempts).toBe(1);
      expect(retryPolicy.stats.totalSuccesses).toBe(1);
      expect(retryPolicy.stats.totalRetries).toBe(0);
    });
    
    it('should retry on retryable error', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new SquareError({ statusCode: 500, body: { errors: [] } }))
        .mockResolvedValue('success');
      
      const result = await retryPolicy.executeWithRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(retryPolicy.stats.totalRetries).toBe(1);
      expect(retryPolicy.stats.totalSuccesses).toBe(1);
    });
    
    it('should not retry on non-retryable error', async () => {
      const fn = vi.fn()
        .mockRejectedValue(new SquareError({ statusCode: 400, body: { errors: [] } }));
      
      await expect(retryPolicy.executeWithRetry(fn)).rejects.toThrow();
      
      expect(fn).toHaveBeenCalledTimes(1);
      expect(retryPolicy.stats.totalRetries).toBe(0);
      expect(retryPolicy.stats.totalFailures).toBe(1);
    });
    
    it('should exhaust retries and throw last error', async () => {
      const error = new SquareError({ statusCode: 500, body: { errors: [] } });
      const fn = vi.fn().mockRejectedValue(error);
      
      await expect(retryPolicy.executeWithRetry(fn)).rejects.toThrow();
      
      expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      expect(retryPolicy.stats.totalRetries).toBe(3);
      expect(retryPolicy.stats.totalFailures).toBe(1);
    });
    
    it('should pass context to logging', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new SquareError({ statusCode: 503, body: { errors: [] } }))
        .mockResolvedValue('success');
      
      const context = { method: 'catalog.list', connectionId: 1 };
      await retryPolicy.executeWithRetry(fn, context);
      
      expect(retryPolicy.stats.totalSuccesses).toBe(1);
    });
  });
  
  describe('_isRetryable()', () => {
    it('should identify retryable Square errors', () => {
      const retryableErrors = [
        new SquareError({ statusCode: 429, body: { errors: [] } }),
        new SquareError({ statusCode: 500, body: { errors: [] } }),
        new SquareError({ statusCode: 502, body: { errors: [] } }),
        new SquareError({ statusCode: 503, body: { errors: [] } }),
        new SquareError({ statusCode: 504, body: { errors: [] } })
      ];
      
      retryableErrors.forEach(error => {
        expect(retryPolicy._isRetryable(error)).toBe(true);
      });
    });
    
    it('should identify non-retryable Square errors', () => {
      const nonRetryableErrors = [
        new SquareError({ statusCode: 400, body: { errors: [] } }),
        new SquareError({ statusCode: 401, body: { errors: [] } }),
        new SquareError({ statusCode: 403, body: { errors: [] } }),
        new SquareError({ statusCode: 404, body: { errors: [] } })
      ];
      
      nonRetryableErrors.forEach(error => {
        expect(retryPolicy._isRetryable(error)).toBe(false);
      });
    });
    
    it('should identify retryable network errors', () => {
      const networkErrors = [
        { code: 'ECONNRESET' },
        { code: 'ETIMEDOUT' },
        { code: 'ENOTFOUND' },
        { code: 'ECONNREFUSED' }
      ];
      
      networkErrors.forEach(error => {
        expect(retryPolicy._isRetryable(error)).toBe(true);
      });
    });
    
    it('should identify non-retryable generic errors', () => {
      const error = new Error('Generic error');
      expect(retryPolicy._isRetryable(error)).toBe(false);
    });
  });
  
  describe('_calculateBackoff()', () => {
    it('should calculate exponential backoff', () => {
      const policy = new SquareRetryPolicy({
        baseDelayMs: 1000,
        jitterMs: 0 // No jitter for predictable testing
      });
      
      // Attempt 0: 1000 * 2^0 = 1000ms
      expect(policy._calculateBackoff(0)).toBe(1000);
      
      // Attempt 1: 1000 * 2^1 = 2000ms
      expect(policy._calculateBackoff(1)).toBe(2000);
      
      // Attempt 2: 1000 * 2^2 = 4000ms
      expect(policy._calculateBackoff(2)).toBe(4000);
    });
    
    it('should add random jitter', () => {
      const policy = new SquareRetryPolicy({
        baseDelayMs: 1000,
        jitterMs: 1000
      });
      
      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(policy._calculateBackoff(0));
      }
      
      // All delays should be between 1000ms and 2000ms
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(1000);
        expect(delay).toBeLessThanOrEqual(2000);
      });
      
      // Delays should not all be identical (jitter working)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
    
    it('should cap at maxDelayMs', () => {
      const policy = new SquareRetryPolicy({
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        jitterMs: 0
      });
      
      // Attempt 10: 1000 * 2^10 = 1024000ms, but capped at 5000ms
      expect(policy._calculateBackoff(10)).toBe(5000);
    });
  });
  
  describe('getStats()', () => {
    it('should return statistics with success rate', async () => {
      const fn1 = vi.fn().mockResolvedValue('success');
      const fn2 = vi.fn()
        .mockRejectedValueOnce(new SquareError({ statusCode: 500, body: { errors: [] } }))
        .mockResolvedValue('success');
      
      await retryPolicy.executeWithRetry(fn1);
      await retryPolicy.executeWithRetry(fn2);
      
      const stats = retryPolicy.getStats();
      expect(stats.totalAttempts).toBe(3); // 1 + 2
      expect(stats.totalSuccesses).toBe(2);
      expect(stats.totalRetries).toBe(1);
      expect(stats.successRate).toContain('66.67%'); // 2/3 attempts succeeded
    });
    
    it('should track retries by status code', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new SquareError({ statusCode: 429, body: { errors: [] } }))
        .mockRejectedValueOnce(new SquareError({ statusCode: 500, body: { errors: [] } }))
        .mockResolvedValue('success');
      
      await retryPolicy.executeWithRetry(fn);
      
      const stats = retryPolicy.getStats();
      expect(stats.retriesByStatusCode['429']).toBe(1);
      expect(stats.retriesByStatusCode['500']).toBe(1);
    });
  });
  
  describe('resetStats()', () => {
    it('should reset all statistics', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      await retryPolicy.executeWithRetry(fn);
      
      retryPolicy.resetStats();
      
      const stats = retryPolicy.getStats();
      expect(stats.totalAttempts).toBe(0);
      expect(stats.totalSuccesses).toBe(0);
      expect(stats.totalRetries).toBe(0);
    });
  });
  
  describe('_serializeError()', () => {
    it('should serialize Square errors', () => {
      const error = new SquareError({
        statusCode: 400,
        body: {
          errors: [{
            category: 'INVALID_REQUEST_ERROR',
            code: 'MISSING_REQUIRED_PARAMETER',
            detail: 'Missing idempotency_key'
          }]
        }
      });
      
      const serialized = retryPolicy._serializeError(error);
      expect(serialized).toMatchObject({
        type: 'SquareError',
        statusCode: 400,
        category: 'INVALID_REQUEST_ERROR',
        code: 'MISSING_REQUIRED_PARAMETER',
        detail: 'Missing idempotency_key'
      });
    });
    
    it('should serialize generic errors', () => {
      const error = new Error('Something went wrong');
      error.code = 'CUSTOM_CODE';
      
      const serialized = retryPolicy._serializeError(error);
      expect(serialized).toMatchObject({
        type: 'Error',
        message: 'Something went wrong',
        code: 'CUSTOM_CODE'
      });
    });
  });
  
  describe('retry timing', () => {
    it('should wait before retrying', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new SquareError({ statusCode: 503, body: { errors: [] } }))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await retryPolicy.executeWithRetry(fn);
      const elapsed = Date.now() - startTime;
      
      // Should have waited baseDelayMs + jitter (100-150ms)
      expect(elapsed).toBeGreaterThanOrEqual(80); // Allow some timing variance
    });
  });
  
  describe('Square production scenarios', () => {
    it('should handle rate limit error (429)', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new SquareError({ statusCode: 429, body: { errors: [] } }))
        .mockResolvedValue('success');
      
      await retryPolicy.executeWithRetry(fn);
      
      expect(fn).toHaveBeenCalledTimes(2);
      expect(retryPolicy.stats.retriesByStatusCode['429']).toBe(1);
    });
    
    it('should handle server error (500)', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new SquareError({ statusCode: 500, body: { errors: [] } }))
        .mockResolvedValue('success');
      
      await retryPolicy.executeWithRetry(fn);
      
      expect(fn).toHaveBeenCalledTimes(2);
      expect(retryPolicy.stats.retriesByStatusCode['500']).toBe(1);
    });
    
    it('should not retry on auth error (401)', async () => {
      const fn = vi.fn()
        .mockRejectedValue(new SquareError({ statusCode: 401, body: { errors: [] } }));
      
      await expect(retryPolicy.executeWithRetry(fn)).rejects.toThrow();
      
      expect(fn).toHaveBeenCalledTimes(1); // No retry
    });
  });
});
