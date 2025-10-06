/**
 * Square API Retry Policy
 * 
 * Implements exponential backoff with jitter for transient failures
 * 
 * Retryable Errors:
 * - 429: Rate limit exceeded (should be rare with our rate limiter)
 * - 500: Internal server error (Square issue)
 * - 502: Bad gateway (network issue)
 * - 503: Service unavailable (Square maintenance)
 * - 504: Gateway timeout (network issue)
 * - Network errors: ECONNRESET, ETIMEDOUT, ENOTFOUND
 * 
 * Non-Retryable Errors:
 * - 400: Bad request (our code issue)
 * - 401: Unauthorized (token expired - handled separately by refreshAuth)
 * - 403: Forbidden (permission issue)
 * - 404: Not found (resource doesn't exist)
 * - Other 4xx: Client errors
 * 
 * Retry Strategy:
 * - Exponential backoff: delay = baseDelay * 2^attempt
 * - Random jitter: adds 0-1000ms to prevent thundering herd
 * - Max delay cap: prevents excessive waiting
 * 
 * @see https://developer.squareup.com/docs/build-basics/handling-errors
 */

import { SquareError } from 'square';
import logger from './logger.js';

class SquareRetryPolicy {
  /**
   * Create a new retry policy
   * 
   * @param {Object} config - Retry policy configuration
   * @param {number} [config.maxRetries=3] - Maximum number of retry attempts
   * @param {number} [config.baseDelayMs=1000] - Base delay in milliseconds (1 second)
   * @param {number} [config.maxDelayMs=30000] - Maximum delay in milliseconds (30 seconds)
   * @param {number} [config.jitterMs=1000] - Maximum random jitter in milliseconds
   * @param {number[]} [config.retryableStatusCodes] - HTTP status codes that trigger retry
   * @param {string[]} [config.retryableErrorCodes] - Error codes that trigger retry
   */
  constructor(config = {}) {
    this.maxRetries = config.maxRetries ?? 3;
    this.baseDelayMs = config.baseDelayMs ?? 1000;
    this.maxDelayMs = config.maxDelayMs ?? 30000;
    this.jitterMs = config.jitterMs ?? 1000;
    
    // HTTP status codes that should trigger retry
    this.retryableStatusCodes = config.retryableStatusCodes ?? [
      429, // Rate limit exceeded
      500, // Internal server error
      502, // Bad gateway
      503, // Service unavailable
      504  // Gateway timeout
    ];
    
    // Network error codes that should trigger retry
    this.retryableErrorCodes = config.retryableErrorCodes ?? [
      'ECONNRESET',   // Connection reset by peer
      'ETIMEDOUT',    // Connection timed out
      'ENOTFOUND',    // DNS lookup failed
      'ECONNREFUSED', // Connection refused
      'EPIPE'         // Broken pipe
    ];
    
    // Statistics for monitoring
    this.stats = {
      totalAttempts: 0,
      totalRetries: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      retriesByStatusCode: {}
    };
    
    logger.info('SquareRetryPolicy initialized', {
      maxRetries: this.maxRetries,
      baseDelayMs: this.baseDelayMs,
      maxDelayMs: this.maxDelayMs,
      retryableStatusCodes: this.retryableStatusCodes
    });
  }
  
  /**
   * Execute function with automatic retry logic
   * 
   * @param {Function} fn - Async function to execute
   * @param {Object} [context={}] - Context for logging (e.g., { method: 'catalog.list', connectionId: 1 })
   * @returns {Promise<*>} Result of successful execution
   * @throws {Error} Last error if all retries exhausted
   */
  async executeWithRetry(fn, context = {}) {
    let lastError;
    const maxAttempts = this.maxRetries + 1; // Initial attempt + retries
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      this.stats.totalAttempts++;
      
      try {
        const result = await fn();
        this.stats.totalSuccesses++;
        
        if (attempt > 0) {
          logger.info('Square API call succeeded after retry', {
            ...context,
            attempt: attempt + 1,
            totalAttempts: maxAttempts
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = this._isRetryable(error);
        
        // Last attempt or non-retryable error
        if (attempt === this.maxRetries || !isRetryable) {
          this.stats.totalFailures++;
          
          logger.error('Square API call failed', {
            ...context,
            attempt: attempt + 1,
            totalAttempts: maxAttempts,
            isRetryable,
            error: this._serializeError(error)
          });
          
          throw error;
        }
        
        // Calculate backoff with jitter
        const delayMs = this._calculateBackoff(attempt);
        this.stats.totalRetries++;
        
        // Track retries by status code
        if (error.statusCode && (error.constructor.name === 'SquareError' || error instanceof SquareError)) {
          const code = error.statusCode.toString();
          this.stats.retriesByStatusCode[code] = (this.stats.retriesByStatusCode[code] || 0) + 1;
        }
        
        logger.warn('Square API error, retrying...', {
          ...context,
          attempt: attempt + 1,
          totalAttempts: maxAttempts,
          retryIn: delayMs,
          error: this._serializeError(error)
        });
        
        await this._delay(delayMs);
      }
    }
    
    throw lastError;
  }
  
  /**
   * Check if error should trigger retry
   * 
   * @private
   * @param {Error} error - Error to check
   * @returns {boolean} True if error is retryable
   */
  _isRetryable(error) {
    // Square API errors - check by statusCode property and constructor name
    if (error.statusCode && (error.constructor.name === 'SquareError' || error instanceof SquareError)) {
      return this.retryableStatusCodes.includes(error.statusCode);
    }
    
    // Network errors
    if (error.code && this.retryableErrorCodes.includes(error.code)) {
      return true;
    }
    
    // Default: non-retryable
    return false;
  }
  
  /**
   * Calculate exponential backoff with jitter
   * 
   * Formula: min(maxDelay, baseDelay * 2^attempt + randomJitter)
   * 
   * Example with baseDelay=1000ms, jitter=1000ms:
   * - Attempt 0: 1000ms + 0-1000ms = 1000-2000ms
   * - Attempt 1: 2000ms + 0-1000ms = 2000-3000ms
   * - Attempt 2: 4000ms + 0-1000ms = 4000-5000ms
   * 
   * @private
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  _calculateBackoff(attempt) {
    // Exponential component: baseDelay * 2^attempt
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attempt);
    
    // Random jitter component: 0 to jitterMs
    const jitter = Math.random() * this.jitterMs;
    
    // Cap at maxDelay
    return Math.min(this.maxDelayMs, exponentialDelay + jitter);
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
   * Serialize error for logging
   * 
   * @private
   * @param {Error} error - Error to serialize
   * @returns {Object} Serialized error
   */
  _serializeError(error) {
    // Check for SquareError by constructor name or instanceof (if available)
    if (error.statusCode && (error.constructor.name === 'SquareError' || error instanceof SquareError)) {
      return {
        type: 'SquareError',
        statusCode: error.statusCode,
        message: error.message,
        category: error.body?.errors?.[0]?.category,
        code: error.body?.errors?.[0]?.code,
        detail: error.body?.errors?.[0]?.detail
      };
    }
    
    return {
      type: error.constructor.name,
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines of stack
    };
  }
  
  /**
   * Get current statistics
   * 
   * @returns {Object} Retry policy statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalAttempts > 0
        ? (this.stats.totalSuccesses / this.stats.totalAttempts * 100).toFixed(2) + '%'
        : 'N/A',
      avgRetriesPerFailure: this.stats.totalFailures > 0
        ? (this.stats.totalRetries / this.stats.totalFailures).toFixed(2)
        : '0'
    };
  }
  
  /**
   * Reset statistics (useful for testing)
   */
  resetStats() {
    this.stats = {
      totalAttempts: 0,
      totalRetries: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      retriesByStatusCode: {}
    };
  }
}

export default SquareRetryPolicy;
