/**
 * Unit Tests: Square Rate Limiter
 * 
 * Tests the token bucket algorithm implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import SquareRateLimiter from '../../src/utils/squareRateLimiter.js';

describe('SquareRateLimiter', () => {
  let rateLimiter;
  
  beforeEach(() => {
    // Use smaller limits for faster tests
    rateLimiter = new SquareRateLimiter({
      maxRequests: 10,
      windowMs: 1000,
      refillIntervalMs: 50
    });
  });
  
  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const limiter = new SquareRateLimiter();
      expect(limiter.maxRequests).toBe(80); // Square default with buffer
      expect(limiter.windowMs).toBe(10000);
    });
    
    it('should initialize with custom configuration', () => {
      const limiter = new SquareRateLimiter({
        maxRequests: 50,
        windowMs: 5000
      });
      expect(limiter.maxRequests).toBe(50);
      expect(limiter.windowMs).toBe(5000);
    });
    
    it('should calculate correct refill rate', () => {
      const limiter = new SquareRateLimiter({
        maxRequests: 100,
        windowMs: 10000
      });
      expect(limiter.refillRate).toBe(0.01); // 100 tokens / 10000ms = 0.01 tokens/ms
    });
  });
  
  describe('acquireToken()', () => {
    it('should immediately acquire token when bucket is full', async () => {
      const startTime = Date.now();
      await rateLimiter.acquireToken('conn1');
      const elapsed = Date.now() - startTime;
      
      expect(elapsed).toBeLessThan(50); // Should be near-instant
      expect(rateLimiter.stats.totalRequests).toBe(1);
      expect(rateLimiter.stats.totalWaits).toBe(0);
    });
    
    it('should acquire multiple tokens from same bucket', async () => {
      await rateLimiter.acquireToken('conn1');
      await rateLimiter.acquireToken('conn1');
      await rateLimiter.acquireToken('conn1');
      
      expect(rateLimiter.stats.totalRequests).toBe(3);
      
      const status = rateLimiter.getBucketStatus('conn1');
      expect(status.tokens).toBeLessThan(10); // Some tokens consumed
    });
    
    it('should manage separate buckets for different connections', async () => {
      await rateLimiter.acquireToken('conn1');
      await rateLimiter.acquireToken('conn2');
      
      const status1 = rateLimiter.getBucketStatus('conn1');
      const status2 = rateLimiter.getBucketStatus('conn2');
      
      expect(status1.tokens).toBeCloseTo(9, 0); // Lost 1 token
      expect(status2.tokens).toBeCloseTo(9, 0); // Lost 1 token
      expect(rateLimiter.getStats().activeBuckets).toBe(2);
    });
    
    it('should wait when bucket is exhausted', async () => {
      // Exhaust bucket (10 tokens)
      for (let i = 0; i < 10; i++) {
        await rateLimiter.acquireToken('conn1');
      }
      
      const status = rateLimiter.getBucketStatus('conn1');
      expect(status.tokens).toBeLessThan(1); // Bucket empty
      
      // Next request should wait
      const startTime = Date.now();
      await rateLimiter.acquireToken('conn1');
      const elapsed = Date.now() - startTime;
      
      expect(elapsed).toBeGreaterThan(50); // Had to wait for refill
      expect(rateLimiter.stats.totalWaits).toBe(1);
    });
    
    it('should refill tokens over time', async () => {
      // Consume 5 tokens
      for (let i = 0; i < 5; i++) {
        await rateLimiter.acquireToken('conn1');
      }
      
      const beforeStatus = rateLimiter.getBucketStatus('conn1');
      expect(beforeStatus.tokens).toBeLessThan(6);
      
      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
      
      const afterStatus = rateLimiter.getBucketStatus('conn1');
      expect(afterStatus.tokens).toBeGreaterThan(beforeStatus.tokens);
    });
  });
  
  describe('handleRateLimitError()', () => {
    it('should pause bucket when rate limit hit', async () => {
      await rateLimiter.handleRateLimitError('conn1', 500);
      
      const status = rateLimiter.getBucketStatus('conn1');
      expect(status.isPaused).toBe(true);
      expect(status.tokens).toBe(0);
      expect(rateLimiter.stats.totalRateLimitErrors).toBe(1);
    });
    
    it('should wait through pause period', async () => {
      await rateLimiter.handleRateLimitError('conn1', 300);
      
      const startTime = Date.now();
      await rateLimiter.acquireToken('conn1');
      const elapsed = Date.now() - startTime;
      
      expect(elapsed).toBeGreaterThanOrEqual(280); // Should wait ~300ms
    });
    
    it('should use default window if retry-after not provided', async () => {
      await rateLimiter.handleRateLimitError('conn1');
      
      const bucket = rateLimiter._getBucket('conn1');
      expect(bucket.pausedUntil).toBeGreaterThan(Date.now());
    });
  });
  
  describe('getBucketStatus()', () => {
    it('should return null for non-existent bucket', () => {
      const status = rateLimiter.getBucketStatus('nonexistent');
      expect(status).toBeNull();
    });
    
    it('should return current bucket status', async () => {
      await rateLimiter.acquireToken('conn1');
      
      const status = rateLimiter.getBucketStatus('conn1');
      expect(status).toMatchObject({
        tokens: expect.any(Number),
        maxTokens: 10,
        percentFull: expect.any(Number),
        isPaused: false,
        pausedUntil: null
      });
      expect(status.tokens).toBeLessThan(10);
      expect(status.percentFull).toBeLessThan(100);
    });
  });
  
  describe('getStats()', () => {
    it('should return accurate statistics', async () => {
      await rateLimiter.acquireToken('conn1');
      await rateLimiter.acquireToken('conn2');
      
      const stats = rateLimiter.getStats();
      expect(stats).toMatchObject({
        totalRequests: 2,
        totalWaits: 0,
        totalRateLimitErrors: 0,
        activeBuckets: 2
      });
    });
  });
  
  describe('clearBucket()', () => {
    it('should remove specific bucket', async () => {
      await rateLimiter.acquireToken('conn1');
      await rateLimiter.acquireToken('conn2');
      
      rateLimiter.clearBucket('conn1');
      
      expect(rateLimiter.getBucketStatus('conn1')).toBeNull();
      expect(rateLimiter.getBucketStatus('conn2')).not.toBeNull();
      expect(rateLimiter.getStats().activeBuckets).toBe(1);
    });
  });
  
  describe('clearAllBuckets()', () => {
    it('should remove all buckets', async () => {
      await rateLimiter.acquireToken('conn1');
      await rateLimiter.acquireToken('conn2');
      
      rateLimiter.clearAllBuckets();
      
      expect(rateLimiter.getStats().activeBuckets).toBe(0);
    });
  });
  
  describe('token bucket algorithm', () => {
    it('should maintain rate limit over time', async () => {
      const requestCount = 15;
      const startTime = Date.now();
      
      // Make 15 requests (bucket size is 10)
      for (let i = 0; i < requestCount; i++) {
        await rateLimiter.acquireToken('conn1');
      }
      
      const elapsed = Date.now() - startTime;
      
      // Should take at least (15-10) * (1000/10) = 500ms for the extra 5 tokens
      // (10 tokens available immediately, need to wait for 5 more)
      expect(elapsed).toBeGreaterThan(400);
      expect(rateLimiter.stats.totalRequests).toBe(requestCount);
    });
    
    it('should handle concurrent requests correctly', async () => {
      // Launch 20 concurrent requests
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(rateLimiter.acquireToken('conn1'));
      }
      
      await Promise.all(promises);
      
      expect(rateLimiter.stats.totalRequests).toBe(20);
      expect(rateLimiter.stats.totalWaits).toBeGreaterThan(0); // Some had to wait
    });
  });
  
  describe('Square production scenario', () => {
    it('should handle 80 requests per 10 seconds (default config)', async () => {
      const productionLimiter = new SquareRateLimiter({
        maxRequests: 80,
        windowMs: 10000
      });
      
      // Make 80 requests as fast as possible
      const startTime = Date.now();
      const promises = [];
      for (let i = 0; i < 80; i++) {
        promises.push(productionLimiter.acquireToken('conn1'));
      }
      
      await Promise.all(promises);
      const elapsed = Date.now() - startTime;
      
      // Should complete in under 1 second (all tokens available initially)
      expect(elapsed).toBeLessThan(1000);
      expect(productionLimiter.stats.totalRequests).toBe(80);
    }, 15000); // Allow 15s for this test
  });
});
