/**
 * Square API Rate Limiter
 * 
 * Implements token bucket algorithm to comply with Square's rate limits
 * 
 * Square's Official Limits (as of 2024-01-18 API version):
 * - Production: 100 requests per 10 seconds per access token
 * - Sandbox: 100 requests per 10 seconds per access token
 * 
 * Our Strategy: 80 requests per 10 seconds (20% safety buffer)
 * This buffer accounts for:
 * - Request timing variations
 * - Parallel operations
 * - External factors (other apps using same merchant token)
 * 
 * Design Pattern: Token Bucket Algorithm
 * - Each connection gets its own token bucket
 * - Tokens refill continuously over time
 * - Requests consume tokens
 * - Requests wait if bucket is empty
 * 
 * @see https://developer.squareup.com/docs/build-basics/using-rest-api
 */

import logger from './logger.js';

class SquareRateLimiter {
  /**
   * Create a new rate limiter
   * 
   * @param {Object} config - Rate limiter configuration
   * @param {number} [config.maxRequests=80] - Maximum requests per window (default: 80, Square limit: 100)
   * @param {number} [config.windowMs=10000] - Time window in milliseconds (default: 10 seconds)
   * @param {number} [config.refillIntervalMs=100] - Token refill check interval (default: 100ms)
   */
  constructor(config = {}) {
    // Square's documented limit: 100 requests per 10 seconds
    // Our default: 80 requests per 10 seconds (20% safety buffer)
    this.maxRequests = config.maxRequests || 80;
    this.windowMs = config.windowMs || 10000;
    this.refillIntervalMs = config.refillIntervalMs || 100;
    
    // Token refill rate (tokens per millisecond)
    this.refillRate = this.maxRequests / this.windowMs;
    
    // Per-connection token buckets
    // Map<connectionId, Bucket>
    // Bucket: { tokens: number, lastRefill: timestamp, pausedUntil: timestamp|null }
    this.buckets = new Map();
    
    // Statistics for monitoring
    this.stats = {
      totalRequests: 0,
      totalWaits: 0,
      totalRateLimitErrors: 0
    };
    
    logger.info('SquareRateLimiter initialized', {
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      refillRate: this.refillRate
    });
  }
  
  /**
   * Acquire permission to make an API request
   * Blocks until a token is available
   * 
   * @param {string|number} connectionId - Unique identifier for the connection
   * @returns {Promise<boolean>} Always resolves to true when token acquired
   */
  async acquireToken(connectionId) {
    const bucket = this._getBucket(connectionId);
    
    // Check if bucket is paused (due to rate limit error)
    if (bucket.pausedUntil && Date.now() < bucket.pausedUntil) {
      const waitMs = bucket.pausedUntil - Date.now();
      logger.warn('Rate limiter paused, waiting...', {
        connectionId,
        waitMs
      });
      await this._delay(waitMs);
      bucket.pausedUntil = null; // Clear pause
    }
    
    // Refill tokens based on elapsed time
    this._refillBucket(bucket);
    
    // If tokens available, consume one immediately
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.stats.totalRequests++;
      return true;
    }
    
    // No tokens available - wait for refill
    this.stats.totalWaits++;
    await this._waitForToken(bucket, connectionId);
    bucket.tokens -= 1;
    this.stats.totalRequests++;
    return true;
  }
  
  /**
   * Handle 429 Rate Limit Error from Square
   * Pauses all requests for this connection
   * 
   * @param {string|number} connectionId - Connection that hit rate limit
   * @param {number} [retryAfterMs] - Optional retry-after header value in milliseconds
   */
  async handleRateLimitError(connectionId, retryAfterMs = null) {
    const bucket = this._getBucket(connectionId);
    
    // Empty bucket and pause
    bucket.tokens = 0;
    const pauseDuration = retryAfterMs || this.windowMs;
    bucket.pausedUntil = Date.now() + pauseDuration;
    
    this.stats.totalRateLimitErrors++;
    
    logger.warn('Square rate limit exceeded, pausing requests', {
      connectionId,
      pauseDuration,
      retryAfterMs
    });
  }
  
  /**
   * Get or create token bucket for connection
   * 
   * @private
   * @param {string|number} connectionId - Connection identifier
   * @returns {Object} Token bucket
   */
  _getBucket(connectionId) {
    if (!this.buckets.has(connectionId)) {
      this.buckets.set(connectionId, {
        tokens: this.maxRequests, // Start with full bucket
        lastRefill: Date.now(),
        pausedUntil: null
      });
    }
    return this.buckets.get(connectionId);
  }
  
  /**
   * Refill tokens based on elapsed time
   * 
   * @private
   * @param {Object} bucket - Token bucket to refill
   */
  _refillBucket(bucket) {
    const now = Date.now();
    const elapsedMs = now - bucket.lastRefill;
    
    if (elapsedMs > 0) {
      // Calculate tokens to add based on elapsed time
      const tokensToAdd = elapsedMs * this.refillRate;
      bucket.tokens = Math.min(this.maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }
  
  /**
   * Wait until a token becomes available
   * 
   * @private
   * @param {Object} bucket - Token bucket to monitor
   * @param {string|number} connectionId - Connection identifier (for logging)
   * @returns {Promise<void>}
   */
  async _waitForToken(bucket, connectionId) {
    // Calculate how long until next token available
    const tokensNeeded = 1 - bucket.tokens;
    const waitMs = Math.ceil(tokensNeeded / this.refillRate);
    
    logger.debug('Rate limiter: waiting for token', {
      connectionId,
      waitMs,
      currentTokens: bucket.tokens
    });
    
    await this._delay(waitMs);
    
    // Refill after waiting
    this._refillBucket(bucket);
    
    // If still no tokens (shouldn't happen), wait again recursively
    if (bucket.tokens < 1) {
      return this._waitForToken(bucket, connectionId);
    }
  }
  
  /**
   * Delay helper
   * 
   * @private
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get current statistics
   * 
   * @returns {Object} Rate limiter statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeBuckets: this.buckets.size
    };
  }
  
  /**
   * Get bucket status for a specific connection
   * 
   * @param {string|number} connectionId - Connection identifier
   * @returns {Object|null} Bucket status or null if not found
   */
  getBucketStatus(connectionId) {
    const bucket = this.buckets.get(connectionId);
    if (!bucket) return null;
    
    // Refill to get current state
    this._refillBucket(bucket);
    
    return {
      tokens: bucket.tokens,
      maxTokens: this.maxRequests,
      percentFull: (bucket.tokens / this.maxRequests) * 100,
      isPaused: bucket.pausedUntil ? Date.now() < bucket.pausedUntil : false,
      pausedUntil: bucket.pausedUntil
    };
  }
  
  /**
   * Clear bucket for a connection (useful for testing or manual reset)
   * 
   * @param {string|number} connectionId - Connection identifier
   */
  clearBucket(connectionId) {
    this.buckets.delete(connectionId);
  }
  
  /**
   * Clear all buckets (useful for testing)
   */
  clearAllBuckets() {
    this.buckets.clear();
  }
}

export default SquareRateLimiter;
