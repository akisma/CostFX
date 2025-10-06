# Issue #19: Square API Client Implementation - Technical Design

**Status**: 🔍 **Research Complete - Awaiting Approval**  
**Date**: October 5, 2025  
**Branch**: feature/api-hookup  
**Dependencies**: Issue #16 (OAuth ✅), Issue #18 (Database Schema ✅)

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Square API Analysis](#square-api-analysis)
4. [Rate Limiting Strategy](#rate-limiting-strategy)
5. [Implementation Details](#implementation-details)
6. [Testing Strategy](#testing-strategy)
7. [Error Handling](#error-handling)
8. [Next Steps](#next-steps)

---

## Executive Summary

### Scope
Issue #19 implements the **data fetching layer** of the two-tier architecture approved in Issue #18:

```
Square API → SquareAPIClient → square_* tables (Tier 1) ✅ THIS ISSUE
                                    ↓
                        SquareDataTransformer (Issue #20) ❌ NOT THIS ISSUE
                                    ↓
                        inventory_items (Tier 2)
```

### Key Deliverables
1. **`syncInventory(connection, since)`** - Fetch Catalog + Inventory APIs → store in `square_*` tables
2. **Rate Limiter** (`squareRateLimiter.js`) - Comply with Square's 100 req/10s limit
3. **Retry Policy** (`squareRetryPolicy.js`) - Exponential backoff for transient failures
4. **`healthCheck(connection)`** - Basic API connectivity test

**Deferred to Issue #33:**
- Webhook signature verification and event processing
- Real-time updates (polling sync is primary method for now)

### What This Issue Does NOT Do
- ❌ Transform data to unified format (that's Issue #20's `POSDataTransformer`)
- ❌ Update `inventory_items` table (that's Issue #20)
- ❌ Build analytics/reporting (that's Issues #22-23)

---

## Architecture Overview

### Current State (Issue #16 Complete)
```javascript
// SquareAdapter.js - OAuth methods COMPLETE
✅ initiateOAuth(restaurantId, redirectUri)
✅ handleOAuthCallback(params)
✅ refreshAuth(connection)
✅ disconnect(connection)
✅ getLocations(connection)
```

### This Issue (Issue #19)
```javascript
// SquareAdapter.js - Data sync methods TO IMPLEMENT
🔴 async syncInventory(connection, since = null)
🔴 async healthCheck(connection)

// New utility files TO CREATE
🔴 backend/src/utils/squareRateLimiter.js
🔴 backend/src/utils/squareRetryPolicy.js

// New fixture files TO CREATE
🔴 backend/tests/fixtures/squareApiResponses.js
```

### Deferred to Issue #33 (Webhooks)
```javascript
// SquareAdapter.js - Webhook methods DEFERRED
⏸️ async verifyWebhookSignature(payload, signature, signatureKey)
⏸️ async processWebhook(payload, connection)

// Webhook infrastructure DEFERRED
⏸️ backend/src/routes/squareWebhook.js
⏸️ backend/src/controllers/SquareWebhookController.js
⏸️ backend/src/services/WebhookEventProcessor.js
```

---

## Square API Analysis

### API Endpoints We'll Call

#### 1. Catalog API (`client.catalogApi`)
**Purpose**: Get menu items with pricing, variations, categories

```typescript
// Square SDK Method
await client.catalog.list({
  types: ['ITEM', 'ITEM_VARIATION', 'CATEGORY']
});

// Returns: Paginated CatalogObject[]
// Storage: → square_menu_items table
// Storage: → square_categories table
```

**Response Structure** (from Square docs):
```json
{
  "objects": [{
    "type": "ITEM",
    "id": "ABC123XYZ",
    "updated_at": "2025-10-05T12:34:56.789Z",
    "version": 1696867890000,
    "is_deleted": false,
    "present_at_all_locations": true,
    "item_data": {
      "name": "Ribeye Steak",
      "description": "16oz USDA Prime",
      "category_id": "CAT_XYZ",
      "variations": [...]
    }
  }]
}
```

**Pagination**: Cursor-based (handle `cursor` in response)

---

#### 2. Inventory API (`client.inventoryApi`)
**Purpose**: Get stock counts at each location

```typescript
// Square SDK Method
await client.inventory.batchGetCounts({
  catalogObjectIds: ['ABC123', 'DEF456'],
  locationIds: ['LOC_123'],
  updatedAfter: '2025-10-05T00:00:00.000Z' // Incremental sync
});

// Returns: Paginated InventoryCount[]
// Storage: → square_inventory_counts table
```

**Response Structure**:
```json
{
  "counts": [{
    "catalog_object_id": "ABC123",
    "catalog_object_type": "ITEM_VARIATION",
    "state": "IN_STOCK",
    "location_id": "LOC_123",
    "quantity": "25.5",
    "calculated_at": "2025-10-05T12:34:56.789Z"
  }]
}
```

**States**: `IN_STOCK`, `SOLD`, `WASTE`, `RETURNED_BY_CUSTOMER`, etc.

---

### Rate Limiting (from Square docs)

**Official Limit**: **100 requests per 10 seconds per access token**

**Our Strategy**: **80 requests per 10 seconds** (20% buffer)

```javascript
// squareRateLimiter.js configuration
{
  maxRequests: 80,        // Conservative limit (buffer below 100)
  windowMs: 10000,        // 10 seconds
  
  // Optional overrides for testing/production
  sandbox: {
    maxRequests: 50       // More conservative in sandbox
  },
  production: {
    maxRequests: 80       // Default for production
  }
}
```

**Implementation Pattern**:
- Token bucket algorithm
- Per-connection rate limiting (multiple merchants don't interfere)
- Request queueing when limit approached
- Automatic 429 error handling with retry

---

### Error Handling (from Square SDK)

```typescript
import { SquareError } from 'square';

try {
  await client.catalog.list();
} catch (err) {
  if (err instanceof SquareError) {
    // err.statusCode: HTTP status code
    // err.message: Human-readable error
    // err.body: Full error response with details
  }
}
```

**Common Error Codes**:
- `401` - Token expired → trigger `refreshAuth()`
- `429` - Rate limit exceeded → retry with backoff
- `5xx` - Square server error → retry with backoff
- `4xx` (other) - Client error → log and skip

---

### Webhook Verification (from Square docs)

**Signature Header**: `X-Square-HmacSha256-Signature`

**Algorithm**: HMAC-SHA256 using:
- Signature key (from Square webhook subscription)
- Notification URL (our registered endpoint)
- Raw request body (NO whitespace modification)

```javascript
import { WebhooksHelper } from 'square';

const isValid = await WebhooksHelper.verifySignature({
  requestBody: rawBody,              // MUST be raw body
  signatureHeader: req.headers['x-square-hmacsha256-signature'],
  signatureKey: config.webhook.signatureKey,
  notificationUrl: `${settings.baseUrl}/api/pos/square/webhook`
});
```

**Security Note**: Use constant-time comparison to prevent timing attacks

---

## Rate Limiting Strategy

### Design Pattern: Token Bucket Algorithm

```javascript
// backend/src/utils/squareRateLimiter.js

class SquareRateLimiter {
  constructor(config) {
    // Square's official limit: 100 requests per 10 seconds
    // Our default: 80 requests per 10 seconds (20% safety buffer)
    // Configurable via environment variables
    
    this.maxRequests = config.maxRequests || 80;
    this.windowMs = config.windowMs || 10000;
    
    // Per-connection token buckets
    // Key: POSConnection ID
    // Value: { tokens: number, lastRefill: timestamp }
    this.buckets = new Map();
  }
  
  /**
   * Request permission to make an API call
   * Returns immediately if tokens available
   * Waits if bucket empty (implements queuing)
   */
  async acquireToken(connectionId) {
    const bucket = this._getBucket(connectionId);
    
    // Refill tokens based on elapsed time
    this._refillBucket(bucket);
    
    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true; // Proceed immediately
    }
    
    // Wait until token available
    await this._waitForToken(bucket);
    bucket.tokens--;
    return true;
  }
  
  /**
   * Handle 429 Rate Limit Error from Square
   * Pauses all requests for this connection
   */
  async handleRateLimitError(connectionId, retryAfterMs = null) {
    const bucket = this._getBucket(connectionId);
    bucket.tokens = 0; // Empty bucket
    bucket.pausedUntil = Date.now() + (retryAfterMs || this.windowMs);
  }
}

export default SquareRateLimiter;
```

**Configuration** (in `posProviders.js`):
```javascript
api: {
  rateLimit: {
    // Default: 80 requests per 10 seconds
    requests: parseInt(process.env.SQUARE_RATE_LIMIT_REQUESTS) || 80,
    windowMs: parseInt(process.env.SQUARE_RATE_LIMIT_WINDOW_MS) || 10000,
    
    // Square's documented limits (for reference):
    // Production: 100 requests per 10 seconds per access token
    // Sandbox: Same as production (100 req/10s)
    // 
    // We use 80 req/10s as a conservative default to avoid hitting the limit
    // This provides a 20% safety buffer for request timing variations
  }
}
```

---

## Retry Policy Strategy

### Design Pattern: Exponential Backoff with Jitter

```javascript
// backend/src/utils/squareRetryPolicy.js

class SquareRetryPolicy {
  constructor(config) {
    this.maxRetries = config.maxRetries || 3;
    this.baseDelayMs = config.baseDelayMs || 1000;   // 1 second
    this.maxDelayMs = config.maxDelayMs || 30000;    // 30 seconds
    this.retryableStatusCodes = [429, 500, 502, 503, 504];
  }
  
  /**
   * Execute function with automatic retry logic
   */
  async executeWithRetry(fn, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this._isRetryable(error)) {
          throw error; // Non-retryable error
        }
        
        // Last attempt failed
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Calculate backoff with jitter
        const delayMs = this._calculateBackoff(attempt);
        logger.warn(`Square API error (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${delayMs}ms`, {
          error: error.message,
          statusCode: error.statusCode,
          context
        });
        
        await this._delay(delayMs);
      }
    }
    
    throw lastError;
  }
  
  /**
   * Calculate exponential backoff with jitter
   * Formula: min(maxDelay, baseDelay * 2^attempt + randomJitter)
   */
  _calculateBackoff(attempt) {
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // 0-1000ms random jitter
    return Math.min(this.maxDelayMs, exponentialDelay + jitter);
  }
  
  /**
   * Check if error should trigger retry
   */
  _isRetryable(error) {
    if (error instanceof SquareError) {
      return this.retryableStatusCodes.includes(error.statusCode);
    }
    
    // Network errors are retryable
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    return false;
  }
}

export default SquareRetryPolicy;
```

---

## Implementation Details

### Phase 3: syncInventory() Implementation

```javascript
/**
 * Sync inventory items from Square to CostFX (READ ONLY)
 * Fetches Catalog + Inventory APIs, stores in square_* tables
 * 
 * Two-Tier Architecture:
 * - Tier 1 (this method): Fetch raw data → square_menu_items, square_inventory_counts
 * - Tier 2 (Issue #20): Transform → inventory_items table
 * 
 * @param {POSConnection} connection - Authenticated POS connection
 * @param {Date} [since] - Optional date to sync changes since (incremental sync)
 * @returns {Promise<{synced: number, errors: Array}>} Sync results
 * @throws {POSSyncError} If sync fails
 */
async syncInventory(connection, since = null) {
  this._ensureInitialized();
  await this._validateConnection(connection);
  this._logOperation('syncInventory', { connectionId: connection.id, since });
  
  const results = {
    synced: 0,
    errors: [],
    details: {
      menuItems: 0,
      categories: 0,
      inventoryCounts: 0
    }
  };
  
  try {
    // Create merchant-specific SDK client
    const merchantClient = this._createMerchantClient(connection);
    
    // Step 1: Fetch Catalog Objects (menu items + categories)
    const catalogResults = await this._syncCatalogObjects(
      merchantClient,
      connection,
      since
    );
    results.details.menuItems = catalogResults.menuItems;
    results.details.categories = catalogResults.categories;
    
    // Step 2: Fetch Inventory Counts
    const inventoryResults = await this._syncInventoryCounts(
      merchantClient,
      connection,
      catalogResults.catalogObjectIds,
      since
    );
    results.details.inventoryCounts = inventoryResults.counts;
    
    // Update sync metadata
    await this._updateSyncMetadata(connection, 'inventory');
    
    results.synced = results.details.menuItems + 
                     results.details.categories + 
                     results.details.inventoryCounts;
    
    this._logOperation('syncInventory', {
      connectionId: connection.id,
      status: 'success',
      ...results.details
    });
    
    return results;
    
  } catch (error) {
    this._logOperation('syncInventory', {
      connectionId: connection.id,
      status: 'failed',
      error: error.message
    }, 'error');
    
    throw new POSSyncError(
      `Square inventory sync failed: ${error.message}`,
      'INVENTORY_SYNC_FAILED',
      { connectionId: connection.id, originalError: error }
    );
  }
}

/**
 * Fetch catalog objects (menu items + categories)
 * Handles pagination and rate limiting
 */
async _syncCatalogObjects(client, connection, since) {
  const results = {
    menuItems: 0,
    categories: 0,
    catalogObjectIds: []
  };
  
  // Build query parameters
  const params = {
    types: ['ITEM', 'ITEM_VARIATION', 'CATEGORY']
  };
  
  // Pagination handling
  let cursor = null;
  do {
    // Rate limiting
    await this.rateLimiter.acquireToken(connection.id);
    
    // API call with retry logic
    const response = await this.retryPolicy.executeWithRetry(async () => {
      return await client.catalogApi.list({ ...params, cursor });
    }, { method: 'catalog.list', connectionId: connection.id });
    
    // Process each catalog object
    for (const obj of response.result.objects || []) {
      await this._storeCatalogObject(obj, connection);
      
      if (obj.type === 'ITEM' || obj.type === 'ITEM_VARIATION') {
        results.menuItems++;
        results.catalogObjectIds.push(obj.id);
      } else if (obj.type === 'CATEGORY') {
        results.categories++;
      }
    }
    
    cursor = response.result.cursor;
  } while (cursor);
  
  return results;
}

/**
 * Store catalog object in appropriate table
 * JSONB storage preserves exact Square API response
 */
async _storeCatalogObject(obj, connection) {
  if (obj.type === 'CATEGORY') {
    // Store in square_categories table
    await SquareCategory.upsert({
      posConnectionId: connection.id,
      restaurantId: connection.restaurantId,
      squareCategoryId: obj.id,
      squareData: obj, // Full JSONB storage
      name: obj.category_data?.name || 'Unknown',
      isDeleted: obj.is_deleted || false,
      squareVersion: obj.version,
      lastSyncedAt: new Date()
    });
  } else {
    // Store in square_menu_items table
    await SquareMenuItem.upsert({
      posConnectionId: connection.id,
      restaurantId: connection.restaurantId,
      squareCatalogObjectId: obj.id,
      squareData: obj, // Full JSONB storage
      name: obj.item_data?.name || obj.item_variation_data?.name || 'Unknown',
      // ... denormalized fields for query performance
      isDeleted: obj.is_deleted || false,
      squareVersion: obj.version,
      lastSyncedAt: new Date()
    });
  }
}
```

---

## Testing Strategy

### Test Structure (Using Fixtures - Option B)

```javascript
// backend/tests/fixtures/squareApiResponses.js

/**
 * Real Square API response fixtures
 * Copied directly from Square API documentation
 * Used for unit testing without hitting actual API
 */

export const squareCatalogItemResponse = {
  objects: [
    {
      type: "ITEM",
      id: "W62UWFY35CWMYGVWK6TWJDNI",
      updated_at: "2025-10-05T12:34:56.789Z",
      version: 1696867890000,
      is_deleted: false,
      present_at_all_locations: true,
      item_data: {
        name: "Ribeye Steak",
        description: "16oz USDA Prime Ribeye",
        category_id: "CAT_ABC123",
        tax_ids: ["TAX_XYZ789"],
        variations: [
          {
            type: "ITEM_VARIATION",
            id: "VARIATION_123",
            item_variation_data: {
              item_id: "W62UWFY35CWMYGVWK6TWJDNI",
              name: "Regular",
              sku: "RIBEYE-16OZ",
              pricing_type: "FIXED_PRICING",
              price_money: {
                amount: 4500, // $45.00 in cents
                currency: "USD"
              }
            }
          }
        ],
        product_type: "REGULAR"
      }
    }
  ],
  cursor: null
};

export const squareInventoryCountResponse = {
  counts: [
    {
      catalog_object_id: "W62UWFY35CWMYGVWK6TWJDNI",
      catalog_object_type: "ITEM_VARIATION",
      state: "IN_STOCK",
      location_id: "LOC_123ABC",
      quantity: "25.5",
      calculated_at: "2025-10-05T12:34:56.789Z"
    }
  ],
  cursor: null
};

export const squareRateLimitError = {
  statusCode: 429,
  message: "Rate limit exceeded",
  body: {
    errors: [{
      category: "RATE_LIMIT_ERROR",
      code: "RATE_LIMIT_EXCEEDED",
      detail: "You exceeded the rate limit for this API."
    }]
  }
};
```

### Unit Test Example

```javascript
// backend/tests/unit/squareAdapter.syncInventory.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import SquareAdapter from '../../src/adapters/SquareAdapter.js';
import { squareCatalogItemResponse } from '../fixtures/squareApiResponses.js';

describe('SquareAdapter - syncInventory()', () => {
  let adapter;
  let mockConnection;
  
  beforeEach(async () => {
    adapter = new SquareAdapter(mockSquareConfig);
    await adapter.initialize();
    
    mockConnection = {
      id: 1,
      restaurantId: 1,
      getAccessToken: vi.fn().mockReturnValue('test-token')
    };
  });
  
  it('should fetch catalog items and store in database', async () => {
    // Mock Square SDK catalog API
    vi.spyOn(adapter.client.catalogApi, 'list')
      .mockResolvedValue({ result: squareCatalogItemResponse });
    
    // Mock Square SDK inventory API
    vi.spyOn(adapter.client.inventoryApi, 'batchGetCounts')
      .mockResolvedValue({ result: squareInventoryCountResponse });
    
    // Execute sync
    const result = await adapter.syncInventory(mockConnection);
    
    // Assertions
    expect(result.synced).toBeGreaterThan(0);
    expect(result.details.menuItems).toBe(1);
    
    // Verify data stored in database
    const storedItems = await SquareMenuItem.findAll({
      where: { restaurantId: mockConnection.restaurantId }
    });
    expect(storedItems).toHaveLength(1);
    expect(storedItems[0].name).toBe('Ribeye Steak');
  });
  
  it('should handle rate limiting with retry', async () => {
    // First call: rate limit error
    // Second call: success
    vi.spyOn(adapter.client.catalogApi, 'list')
      .mockRejectedValueOnce(new SquareError(squareRateLimitError))
      .mockResolvedValueOnce({ result: squareCatalogItemResponse });
    
    const result = await adapter.syncInventory(mockConnection);
    
    expect(result.synced).toBeGreaterThan(0);
    expect(adapter.client.catalogApi.list).toHaveBeenCalledTimes(2);
  });
});
```

---

## Error Handling

### Error Categories

```javascript
// Retry with exponential backoff
const RETRYABLE_ERRORS = [
  429,  // Rate limit (wait and retry)
  500,  // Internal server error
  502,  // Bad gateway
  503,  // Service unavailable
  504   // Gateway timeout
];

// Trigger token refresh
const AUTH_ERRORS = [
  401   // Unauthorized (token expired)
];

// Log and skip (non-recoverable)
const FATAL_ERRORS = [
  400,  // Bad request (malformed data)
  403,  // Forbidden (insufficient permissions)
  404   // Not found (resource doesn't exist)
];
```

### Error Handling Flow

```javascript
async _makeSquareApiCall(fn, context) {
  try {
    return await this.retryPolicy.executeWithRetry(fn, context);
  } catch (error) {
    if (error instanceof SquareError) {
      // Handle Square-specific errors
      switch (error.statusCode) {
        case 401:
          // Token expired - trigger refresh
          logger.warn('Square token expired, refreshing...', context);
          await this.refreshAuth(context.connection);
          // Retry once after refresh
          return await fn();
          
        case 429:
          // Rate limit exceeded
          await this.rateLimiter.handleRateLimitError(
            context.connection.id,
            error.headers?.['retry-after']
          );
          throw error;
          
        default:
          // Log and throw
          logger.error('Square API error', {
            statusCode: error.statusCode,
            message: error.message,
            context
          });
          throw error;
      }
    }
    
    throw error;
  }
}
```

---

## Next Steps

### Phase 2: Implementation Order

1. **✅ Phase 1 Complete**: Research & Design (this document)

2. **🔵 Phase 2**: Rate Limiter & Retry Utilities (1-2 hours)
   - Create `squareRateLimiter.js`
   - Create `squareRetryPolicy.js`
   - Write comprehensive unit tests
   - Validate against Square's documented limits

3. **🔵 Phase 3**: syncInventory() Implementation (2-3 hours)
   - Implement `syncInventory()` method
   - Implement helper methods (`_syncCatalogObjects`, etc.)
   - Create Square API response fixtures
   - Write unit tests with fixtures

4. **🔵 Phase 4**: healthCheck() Implementation (30 minutes)
   - Simple API connectivity test
   - Error scenario tests

5. **🔵 Phase 5**: Integration Testing (1-2 hours)
   - End-to-end: OAuth → Sync → Database verification
   - Performance tests
   - All 399+ tests passing

6. **🔵 Phase 6**: Documentation (30-60 minutes)
   - Update `TECHNICAL_DOCUMENTATION.md`
   - Update `PROJECT_STATUS.md`
   - Add Swagger docs
   - GitHub issue comment

**Deferred to Issue #33:**
- Webhook signature verification (`verifyWebhookSignature`)
- Webhook event processing (`processWebhook`)
- Real-time update infrastructure

---

## Approval Status: ✅ APPROVED

**Principal Engineer Approval** (October 5, 2025):

- [x] **Two-Tier Architecture** - ✅ Confirmed: Tier 1 only (raw data storage)
- [x] **Scope** - ✅ syncInventory() implementation with rate limiting & retry
- [x] **Rate Limiting** - ✅ 80 req/10s with configurable limits
- [x] **Retry Strategy** - ✅ Exponential backoff with jitter
- [x] **Testing Approach** - ✅ Fixtures (Option B) with real Square API responses
- [x] **Webhook Implementation** - ✅ Deferred to Issue #33
- [x] **Error Handling** - ✅ Strategy approved
- [x] **Implementation Order** - ✅ Phase 2-6 sequence approved

**🚀 APPROVED TO PROCEED WITH PHASE 2**

---

**Document Version**: 1.0  
**Author**: GitHub Copilot (Lead Engineer)  
**Supervisor**: Principal Engineer (jessjacobs)
