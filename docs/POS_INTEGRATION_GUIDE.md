# POS Integration Guide

**Complete guide to integrating CostFX with POS systems (Square, Toast, etc.)**

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Square Integration Setup](#square-integration-setup)
4. [Environment Configuration](#environment-configuration)
5. [OAuth Flow Implementation](#oauth-flow-implementation)
6. [Data Synchronization](#data-synchronization)
7. [Webhook Configuration](#webhook-configuration)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)
10. [Security Considerations](#security-considerations)

---

## Overview

### What is POS Integration?

The POS Integration system allows CostFX to import inventory and sales data from merchant POS systems for analysis and reporting. This is a **READ ONLY** integration - CostFX never writes data back to the merchant's POS system.

### Supported POS Systems

- ✅ **Square** - Complete OAuth 2.0 implementation with token encryption
- 📋 **Toast** - Planned (adapter stub created)
- 📋 **Clover** - Future consideration
- 📋 **Lightspeed** - Future consideration

### Architecture

**Two-Tier Data Architecture (Updated October 11, 2025):**

```
Merchant's POS System (Square/Toast)
           ↓ (READ ONLY via OAuth 2.0)
    POS Adapter (SquareAdapter.syncInventory)
           ↓
  TIER 1: Raw POS Data (square_categories, square_menu_items)
           ↓
  POSDataTransformer.transformBatch()
           ↓
  TIER 2: Normalized Inventory (inventory_items)
           ↓
   CostFX Analysis & Reports
```

**Tier 1 (Raw POS Data)**:
- Preserves original POS format for debugging
- Tables: `square_categories`, `square_menu_items`
- Updated via: `SquareAdapter.syncInventory()`

**Tier 2 (Normalized Inventory)**:
- Unified CostFX format for analysis
- Table: `inventory_items`
- Updated via: `POSDataTransformer.transformBatch()`
- Includes: Category mapping, unit normalization, variance thresholds

**Data Flow**: POS → Tier 1 (import) → Tier 2 (transform) → Analysis (one-way only)

---

## Prerequisites

### Required Knowledge

- Basic understanding of OAuth 2.0 flows
- Node.js/Express.js development
- PostgreSQL database administration
- Environment variable configuration
- HTTPS/SSL certificate setup (required for OAuth callbacks)

### Required Access

- Square Developer Account (https://developer.squareup.com/)
- Access to CostFX backend codebase
- Database admin access (PostgreSQL)
- AWS Secrets Manager access (production)

### System Requirements

- Node.js 18+ with ES modules support
- PostgreSQL 12+ database
- SSL/TLS certificate (production OAuth requires HTTPS)
- Secure secret storage (AWS Secrets Manager recommended)

---

## Square Integration Setup

### Step 1: Create Square Application

1. **Log in to Square Developer Dashboard**
   - Visit: https://developer.squareup.com/apps
   - Sign in with your Square account

2. **Create New Application**
   - Click "+" or "Create Application"
   - Enter application name: "CostFX Restaurant Management"
   - Select application type: "Custom Application"
   - Save application

3. **Configure OAuth Settings**
   - Navigate to "OAuth" tab
   - Add Redirect URL: `https://your-domain.com/api/pos/square/callback`
   - For development: `http://localhost:3001/api/pos/square/callback`
   - Save settings

4. **Note Your Credentials**
   - **Application ID**: Found on "Credentials" tab
   - **Application Secret**: Found on "Credentials" tab (keep secure!)
   - **Access Token**: For application-level operations (optional)

### Step 2: Configure OAuth Scopes

In Square Developer Dashboard → OAuth tab, ensure these scopes are selected:

**READ ONLY Scopes** (required):
- ✅ `ITEMS_READ` - Read catalog items and variations
- ✅ `INVENTORY_READ` - Read inventory counts
- ✅ `ORDERS_READ` - Read order and sales data
- ✅ `MERCHANT_PROFILE_READ` - Read merchant business info

**IMPORTANT**: Do NOT select any WRITE scopes:
- ❌ `ITEMS_WRITE` - NOT NEEDED (we never write to Square)
- ❌ `INVENTORY_WRITE` - NOT NEEDED
- ❌ `ORDERS_WRITE` - NOT NEEDED

### Step 3: Enable Webhooks (Optional)

For real-time inventory updates:

1. Navigate to "Webhooks" tab in Square Dashboard
2. Add webhook URL: `https://your-domain.com/api/pos/square/webhook`
3. Select events:
   - `inventory.count.updated`
   - `catalog.version.updated`
   - `order.created`
4. Note the **Webhook Signature Key** (for verification)
5. Test webhook delivery

---

## Environment Configuration

### Development Environment

Create or update `.env` file in backend directory:

```bash
# ==================== POS INTEGRATIONS ====================

# Token Encryption
# CRITICAL: Generate a secure 32-byte (256-bit) key
# Command: openssl rand -hex 32
TOKEN_ENCRYPTION_KEY=<your-generated-32-byte-hex-key>

# Square POS Configuration
SQUARE_APPLICATION_ID=<from Square Dashboard - Credentials tab>
SQUARE_ACCESS_TOKEN=<optional - application-level token>
SQUARE_ENVIRONMENT=sandbox  # Use 'sandbox' for development, 'production' for live
SQUARE_OAUTH_CLIENT_ID=<from Square Dashboard - Credentials tab>
SQUARE_OAUTH_CLIENT_SECRET=<from Square Dashboard - Credentials tab>
SQUARE_OAUTH_REDIRECT_URI=http://localhost:3001/api/pos/square/callback
SQUARE_WEBHOOK_SIGNATURE_KEY=<from Square Dashboard - Webhooks tab>
SQUARE_WEBHOOKS_ENABLED=true

# Database (ensure pos_connections table exists)
DATABASE_URL=postgresql://postgres:password@localhost:5432/restaurant_ai
```

### Production Environment (AWS)

**Use AWS Secrets Manager for sensitive values:**

```bash
# Store in AWS Secrets Manager
aws secretsmanager create-secret \
  --name costfx/pos/square \
  --secret-string '{
    "TOKEN_ENCRYPTION_KEY": "<secure-32-byte-hex>",
    "SQUARE_OAUTH_CLIENT_ID": "<client-id>",
    "SQUARE_OAUTH_CLIENT_SECRET": "<client-secret>",
    "SQUARE_WEBHOOK_SIGNATURE_KEY": "<webhook-key>"
  }'

# Reference in ECS task definition
"secrets": [
  {
    "name": "TOKEN_ENCRYPTION_KEY",
    "valueFrom": "arn:aws:secretsmanager:region:account:secret:costfx/pos/square:TOKEN_ENCRYPTION_KEY"
  },
  ...
]
```

### Generate Encryption Key

**CRITICAL**: Never use a weak or default encryption key!

```bash
# Generate secure 32-byte hex key (256 bits)
openssl rand -hex 32

# Example output (DO NOT USE THIS - generate your own!):
# a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Store securely:**
- Development: `.env` file (never commit to git!)
- Production: AWS Secrets Manager or similar
- Never hardcode in source code

---

## OAuth Flow Implementation

### Step 1: Initiate OAuth

When a restaurant wants to connect their Square account:

```javascript
// Example route: GET /api/pos/square/connect
const POSAdapterFactory = require('../adapters/POSAdapterFactory');

app.get('/api/pos/square/connect', async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId; // From authentication
    
    // Initialize factory
    await POSAdapterFactory.initialize();
    
    // Get Square adapter
    const adapter = await POSAdapterFactory.getAdapter('square');
    
    // Generate OAuth URL with state token (CSRF protection)
    const { authorizationUrl, state } = await adapter.initiateOAuth(restaurantId);
    
    // Store state in session for verification (handled automatically by OAuthStateService)
    
    // Redirect user to Square authorization page
    res.redirect(authorizationUrl);
    
  } catch (error) {
    console.error('OAuth initiation failed:', error);
    res.status(500).json({ error: 'Failed to initiate Square connection' });
  }
});
```

### Step 2: Handle OAuth Callback

Square redirects back to your callback URL with authorization code:

```javascript
// Example route: GET /api/pos/square/callback
app.get('/api/pos/square/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      throw new Error('Missing authorization code or state');
    }
    
    const restaurantId = req.user.restaurantId; // From authentication
    
    // Initialize factory
    await POSAdapterFactory.initialize();
    const adapter = await POSAdapterFactory.getAdapter('square');
    
    // Handle callback - exchanges code for tokens, encrypts and stores them
    const connection = await adapter.handleOAuthCallback({
      code,
      state,
      restaurantId
    });
    
    console.log(`Square connected for restaurant ${restaurantId}`);
    console.log(`Merchant ID: ${connection.merchantId}`);
    console.log(`Token expires: ${connection.tokenExpiresAt}`);
    
    // Redirect to success page
    res.redirect('/dashboard?pos_connected=success');
    
  } catch (error) {
    console.error('OAuth callback failed:', error);
    
    // Check for specific error types
    if (error.name === 'POSAuthError') {
      // Invalid state token - possible CSRF attack
      return res.status(403).json({ error: 'Invalid authorization state' });
    }
    
    res.status(500).json({ error: 'Failed to complete Square connection' });
  }
});
```

### Step 3: Check Connection Status

Verify that a restaurant has an active POS connection:

```javascript
const POSConnection = require('../models/POSConnection');

// Check if restaurant has Square connected
const connection = await POSConnection.findOne({
  where: {
    restaurantId: req.user.restaurantId,
    provider: 'square'
  }
});

if (connection && connection.isActive()) {
  console.log('Square is connected');
  console.log(`Token expires in ${connection.getHoursUntilExpiration()} hours`);
  
  // Perform health check
  const adapter = await POSAdapterFactory.getAdapter('square');
  const health = await adapter.healthCheck(connection);
  
  if (health.healthy) {
    console.log('Connection is healthy');
  } else {
    console.log('Connection has issues:', health.message);
  }
} else {
  console.log('Square not connected or connection inactive');
}
```

---

## Data Synchronization

### Manual Inventory Sync

Import inventory items from Square into CostFX:

```javascript
app.post('/api/pos/square/sync/inventory', async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    
    // Get connection
    const connection = await POSConnection.findOne({
      where: { restaurantId, provider: 'square' }
    });
    
    if (!connection || !connection.isActive()) {
      return res.status(400).json({ error: 'No active Square connection' });
    }
    
    // Get adapter
    const adapter = await POSAdapterFactory.getAdapter('square');
    
    // Sync inventory (READ ONLY from Square)
    const result = await adapter.syncInventory(connection);
    
    res.json({
      success: true,
      synced: result.synced,
      errors: result.errors.length,
      message: `Successfully synced ${result.synced} inventory items`
    });
    
  } catch (error) {
    console.error('Inventory sync failed:', error);
    res.status(500).json({ error: 'Failed to sync inventory' });
  }
});
```

### Manual Sales Sync

Import sales data from Square:

```javascript
app.post('/api/pos/square/sync/sales', async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { startDate, endDate } = req.body;
    
    // Get connection
    const connection = await POSConnection.findOne({
      where: { restaurantId, provider: 'square' }
    });
    
    if (!connection || !connection.isActive()) {
      return res.status(400).json({ error: 'No active Square connection' });
    }
    
    // Get adapter
    const adapter = await POSAdapterFactory.getAdapter('square');
    
    // Sync sales (READ ONLY from Square)
    const result = await adapter.syncSales(
      connection,
      new Date(startDate),
      new Date(endDate)
    );
    
    res.json({
      success: true,
      synced: result.synced,
      errors: result.errors.length,
      message: `Successfully synced ${result.synced} sales records`
    });
    
  } catch (error) {
    console.error('Sales sync failed:', error);
    res.status(500).json({ error: 'Failed to sync sales' });
  }
});
```

### Scheduled Sync (Recommended)

Use a job scheduler for automatic daily syncs:

```javascript
// Using node-cron or similar
const cron = require('node-cron');

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Starting scheduled POS sync');
  
  // Get all active Square connections
  const connections = await POSConnection.findAll({
    where: {
      provider: 'square',
      status: 'active'
    }
  });
  
  const adapter = await POSAdapterFactory.getAdapter('square');
  
  for (const connection of connections) {
    try {
      // Sync inventory
      const inventoryResult = await adapter.syncInventory(connection);
      console.log(`Restaurant ${connection.restaurantId}: Synced ${inventoryResult.synced} items`);
      
      // Sync yesterday's sales
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const salesResult = await adapter.syncSales(connection, yesterday, today);
      console.log(`Restaurant ${connection.restaurantId}: Synced ${salesResult.synced} sales`);
      
    } catch (error) {
      console.error(`Sync failed for restaurant ${connection.restaurantId}:`, error);
    }
  }
  
  console.log('Scheduled POS sync completed');
});
```

---

## Webhook Configuration

### Webhook Endpoint

Handle real-time updates from Square:

```javascript
app.post('/api/pos/square/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Get signature from header
    const signature = req.headers['x-square-hmacsha256-signature'];
    
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }
    
    const adapter = await POSAdapterFactory.getAdapter('square');
    
    // Verify webhook signature (CRITICAL for security)
    const isValid = await adapter.verifyWebhookSignature(
      req.body,
      signature
    );
    
    if (!isValid) {
      console.error('Invalid webhook signature - possible attack');
      return res.status(403).json({ error: 'Invalid signature' });
    }
    
    // Parse webhook payload
    const payload = JSON.parse(req.body);
    const { type, data } = payload;
    
    console.log(`Received webhook: ${type}`);
    
    // Find connection by merchant ID
    const connection = await POSConnection.findOne({
      where: {
        provider: 'square',
        merchantId: data.merchant_id
      }
    });
    
    if (!connection) {
      console.log('No connection found for webhook');
      return res.status(200).json({ received: true });
    }
    
    // Process webhook
    const result = await adapter.processWebhook(payload, connection);
    
    // Acknowledge receipt
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
```

### Webhook Event Types

Square sends these events (configure in Dashboard):

- `inventory.count.updated` - Inventory quantities changed
- `catalog.version.updated` - Items added/modified/deleted
- `order.created` - New order/sale recorded
- `order.updated` - Order modified

**Processing Strategy:**
- Acknowledge immediately (return 200)
- Queue webhook for background processing
- Trigger relevant sync operations
- Update connection metadata

---

## Testing

### Unit Testing

Test adapter methods with mocked Square SDK:

```javascript
// tests/unit/squareAdapter.test.js
import { describe, it, expect, vi } from 'vitest';
import SquareAdapter from '../../src/adapters/SquareAdapter.js';

describe('SquareAdapter', () => {
  it('should generate OAuth URL', async () => {
    const adapter = new SquareAdapter(testConfig);
    await adapter.initialize();
    
    const result = await adapter.initiateOAuth(123);
    
    expect(result.authorizationUrl).toContain('https://connect.squareup.com');
    expect(result.state).toBeDefined();
  });
  
  it('should verify webhook signatures', async () => {
    const adapter = new SquareAdapter(testConfig);
    await adapter.initialize();
    
    const payload = { type: 'test', data: {} };
    const key = 'test-key';
    
    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', key)
      .update(JSON.stringify(payload))
      .digest('base64');
    
    const isValid = await adapter.verifyWebhookSignature(payload, signature, key);
    expect(isValid).toBe(true);
  });
});
```

### Integration Testing

Test with Square Sandbox environment:

1. Create test merchant account in Square Sandbox
2. Generate sandbox OAuth credentials
3. Set `SQUARE_ENVIRONMENT=sandbox` in `.env`
4. Test complete OAuth flow
5. Verify token encryption/decryption
6. Test sync operations with sandbox data

### Manual Testing Checklist

- [ ] OAuth initiation generates valid authorization URL
- [ ] State token includes restaurant ID and provider
- [ ] OAuth callback successfully exchanges code for tokens
- [ ] Tokens are encrypted in database
- [ ] Token decryption works correctly
- [ ] Connection status is "active" after OAuth
- [ ] Health check returns healthy status
- [ ] Token refresh updates expiration date
- [ ] Disconnect revokes tokens properly
- [ ] Webhook signature verification works
- [ ] Invalid signatures are rejected

---

## Troubleshooting

### OAuth Issues

**Problem**: "Invalid state token" error during callback

**Solutions**:
- Check that state tokens expire after 10 minutes
- Verify restaurant ID matches between initiate and callback
- Ensure state service is not using in-memory store in production (use Redis)
- Check for clock skew between servers

**Problem**: "Redirect URI mismatch" error from Square

**Solutions**:
- Verify redirect URI in Square Dashboard exactly matches your callback URL
- Include http:// or https:// prefix
- Check for trailing slashes
- Development: Use http://localhost:3001/api/pos/square/callback
- Production: Use https://your-domain.com/api/pos/square/callback

### Token Issues

**Problem**: "Failed to decrypt token" error

**Solutions**:
- Verify TOKEN_ENCRYPTION_KEY is 64 characters (32 bytes hex)
- Ensure same encryption key is used across deployments
- Check that IV (initialization vector) is stored correctly
- Verify database stores encrypted tokens as TEXT type

**Problem**: "Token expired" errors

**Solutions**:
- Implement automatic token refresh (check every hour)
- Square tokens expire after 30 days
- Call `adapter.refreshAuth(connection)` before sync operations
- Monitor `connection.getHoursUntilExpiration()` for warnings

### Sync Issues

**Problem**: Inventory sync returns 0 items

**Solutions**:
- Verify connection is active: `connection.isActive()`
- Check OAuth scopes include `ITEMS_READ` and `INVENTORY_READ`
- Verify merchant has items in Square catalog
- Check Square API error logs
- Test with Square Sandbox first

**Problem**: "Rate limit exceeded" errors

**Solutions**:
- Square has rate limits (varies by endpoint)
- Implement exponential backoff
- Batch requests when possible
- Use webhooks instead of polling
- Cache frequently accessed data

### Webhook Issues

**Problem**: Webhooks not being received

**Solutions**:
- Verify webhook URL is publicly accessible (use ngrok for development)
- Check firewall rules allow Square IPs
- Ensure endpoint returns 200 status quickly (<5 seconds)
- Test webhook delivery in Square Dashboard
- Check webhook logs in Square Dashboard

**Problem**: "Invalid webhook signature" errors

**Solutions**:
- Verify SQUARE_WEBHOOK_SIGNATURE_KEY matches Dashboard
- Use raw body for signature verification (not parsed JSON)
- Check for newlines or spaces in signature key
- Test with Square's webhook testing tool

---

## Security Considerations

### Token Security

✅ **DO**:
- Use AES-256-GCM for token encryption
- Generate unique IV for each encryption
- Store encryption key in AWS Secrets Manager (production)
- Rotate encryption keys periodically
- Use HTTPS for all OAuth callbacks
- Validate token expiration before use

❌ **DON'T**:
- Store tokens in plaintext
- Log tokens to files or console
- Expose tokens in error messages
- Use weak or default encryption keys
- Commit encryption keys to git
- Share tokens across environments

### OAuth Security

✅ **DO**:
- Verify state tokens on callback (CSRF protection)
- Use cryptographically secure random for state generation
- Implement state token expiration (10 minutes)
- Validate redirect URIs match configuration
- Use one-time state tokens (prevent replay)

❌ **DON'T**:
- Skip state token verification
- Use predictable state values
- Allow open redirect vulnerabilities
- Accept expired state tokens
- Reuse state tokens

### Webhook Security

✅ **DO**:
- Verify HMAC-SHA256 signatures
- Use timing-safe comparison for signatures
- Validate webhook payload structure
- Rate limit webhook endpoint
- Log suspicious webhook attempts

❌ **DON'T**:
- Process webhooks without signature verification
- Use weak signature verification
- Expose webhook endpoint details
- Trust webhook data without validation

### Data Access

✅ **DO**:
- Request only READ scopes needed
- Verify user authorization before operations
- Log all POS data access
- Implement role-based access control
- Encrypt sensitive data at rest

❌ **DON'T**:
- Request WRITE scopes unnecessarily
- Allow unauthenticated POS access
- Share POS data between restaurants
- Store more data than needed
- Expose POS credentials in APIs

---

## Support

### Resources

- **Square Developer Docs**: https://developer.squareup.com/docs
- **Square OAuth Guide**: https://developer.squareup.com/docs/oauth-api/overview
- **CostFX Technical Docs**: See TECHNICAL_DOCUMENTATION.md
- **GitHub Issues**: Report bugs and feature requests

### Getting Help

1. Check this guide first
2. Review TECHNICAL_DOCUMENTATION.md
3. Search Square Developer forums
4. Check CloudWatch logs (production)
5. Contact CostFX development team

---

**Last Updated**: October 4, 2025  
**Version**: 1.0.0  
**Status**: Foundation Complete - OAuth and Token Encryption Operational
