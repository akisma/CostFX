/**
 * POS Integration Error Classes
 * 
 * Custom error hierarchy for POS system integrations extending AppError.
 * These errors provide structured error handling for OAuth, synchronization,
 * configuration, and rate limiting scenarios across different POS providers.
 * 
 * Design Decision: Extend AppError (existing in errorHandler.js) to maintain
 * consistency with the application's error handling middleware.
 * 
 * Progress Note: Starting Day 1 implementation with error foundation
 * Created: 2025-10-04
 */

import { AppError } from '../middleware/errorHandler.js';

/**
 * Base class for all POS-related errors
 * 
 * Provides common structure for POS provider errors including:
 * - HTTP status codes appropriate for the error type
 * - Provider identification for multi-POS debugging
 * - Structured error responses that middleware can handle uniformly
 */
export class POSError extends AppError {
  constructor(message, statusCode = 500, provider = null) {
    super(message, statusCode);
    this.name = 'POSError';
    this.provider = provider; // 'square', 'toast', etc.
  }
}

/**
 * Authentication/Authorization errors
 * 
 * Used when:
 * - OAuth authorization fails
 * - Invalid credentials provided
 * - Missing required OAuth scopes
 * - Merchant permissions insufficient
 * 
 * HTTP Status: 401 Unauthorized
 */
export class POSAuthError extends POSError {
  constructor(message, provider = null) {
    super(message, 401, provider);
    this.name = 'POSAuthError';
  }
}

/**
 * Token expired or invalid errors
 * 
 * Used when:
 * - Access token has expired
 * - Refresh token is invalid
 * - Token format is malformed
 * 
 * Special property: retryable = true
 * The system can automatically attempt token refresh before failing
 * 
 * HTTP Status: 401 Unauthorized
 */
export class POSTokenError extends POSError {
  constructor(message, provider = null) {
    super(message, 401, provider);
    this.name = 'POSTokenError';
    this.retryable = true; // Can retry after token refresh
  }
}

/**
 * Synchronization failures
 * 
 * Used when:
 * - Inventory sync fails
 * - Sales data sync encounters errors
 * - Network issues during data transfer
 * - POS API temporary unavailability
 * 
 * The retryable flag indicates whether the operation should be retried:
 * - true: Network issues, temporary API failures (default)
 * - false: Data validation errors, permanent failures
 * 
 * HTTP Status: 503 Service Unavailable
 */
export class POSSyncError extends POSError {
  constructor(message, provider = null, retryable = true) {
    super(message, 503, provider);
    this.name = 'POSSyncError';
    this.retryable = retryable;
  }
}

/**
 * Configuration errors
 * 
 * Used when:
 * - Missing required environment variables
 * - Invalid POS provider configuration
 * - Client ID/Secret not set
 * - Malformed configuration values
 * 
 * These are NOT retryable as they require manual intervention
 * 
 * HTTP Status: 500 Internal Server Error
 */
export class POSConfigError extends POSError {
  constructor(message, provider = null) {
    super(message, 500, provider);
    this.name = 'POSConfigError';
    this.retryable = false; // Requires manual configuration fix
  }
}

/**
 * Rate limiting errors
 * 
 * Used when:
 * - POS API rate limits exceeded
 * - Too many requests in time window
 * - Need to back off and retry later
 * 
 * Special property: retryAfter (seconds to wait before retry)
 * This allows intelligent retry scheduling based on provider's guidance
 * 
 * HTTP Status: 429 Too Many Requests
 */
export class POSRateLimitError extends POSError {
  constructor(message, provider = null, retryAfter = null) {
    super(message, 429, provider);
    this.name = 'POSRateLimitError';
    this.retryable = true;
    this.retryAfter = retryAfter; // Seconds to wait (from Retry-After header)
  }
}

/**
 * Progress Note: Error classes complete
 * 
 * Next steps:
 * 1. Create TokenEncryptionService for secure token storage
 * 2. Create OAuthStateService for CSRF protection
 * 3. Create database migration for pos_connections table
 * 4. Create POSConnection model with encryption integration
 */
