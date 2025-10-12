/**
 * POS Providers Configuration
 * 
 * Progress Note: Day 2 - Configuration Management
 * Centralizes all POS provider-specific configuration loaded from environment variables
 * 
 * Design Rationale:
 * - Single source of truth for all POS provider config
 * - Type safety with validation
 * - Environment-specific configurations (dev/staging/prod)
 * - Secrets managed through environment variables only
 * 
 * Security Considerations:
 * - All sensitive values (API keys, secrets) must come from environment variables
 * - Never commit actual credentials to version control
 * - Production requires all credentials; development can use partial config for testing
 * 
 * Configuration Sources:
 * - Environment variables (via process.env)
 * - Settings service for application-wide defaults
 * - Provider-specific defaults when appropriate
 */

import settings from '../config/settings.js';
import logger from '../utils/logger.js';

/**
 * Square POS Configuration
 * 
 * Progress Note: Square uses OAuth 2.0 with PKCE
 * Required environment variables:
 * - SQUARE_APPLICATION_ID: Your Square application ID
 * - SQUARE_ACCESS_TOKEN: For application-level operations (not per-merchant)
 * - SQUARE_ENVIRONMENT: 'sandbox' or 'production'
 * - SQUARE_OAUTH_CLIENT_ID: OAuth client ID (may be same as APPLICATION_ID)
 * - SQUARE_OAUTH_CLIENT_SECRET: OAuth client secret
 * - SQUARE_WEBHOOK_SIGNATURE_KEY: For verifying webhook signatures
 * 
 * Square API Documentation:
 * - OAuth: https://developer.squareup.com/docs/oauth-api/overview
 * - Webhooks: https://developer.squareup.com/docs/webhooks/overview
 * - Catalog API: https://developer.squareup.com/docs/catalog-api/what-it-does
 */
export const squareConfig = {
  // Application credentials
  applicationId: process.env.SQUARE_APPLICATION_ID || null,
  accessToken: process.env.SQUARE_ACCESS_TOKEN || null, // Application-level access token
  
  // Environment: 'sandbox' or 'production'
  // Progress Note: Sandbox allows testing without real merchant data
  environment: process.env.SQUARE_ENVIRONMENT || 'sandbox',
  
  // OAuth configuration
  oauth: {
    clientId: process.env.SQUARE_OAUTH_CLIENT_ID || process.env.SQUARE_APPLICATION_ID || null,
    clientSecret: process.env.SQUARE_OAUTH_CLIENT_SECRET || null,
    
    // OAuth authorization URLs (environment-specific)
    authorizationUrl: process.env.SQUARE_OAUTH_AUTHORIZATION_URL || null, // Override if needed
    
    // OAuth scopes requested from merchants
    // Progress Note: READ ONLY scopes - we never write data back to Square
    // Request minimal necessary scopes per security best practice
    scopes: [
      'ITEMS_READ',           // Read catalog items (inventory) - READ ONLY
      'INVENTORY_READ',       // Read inventory counts - READ ONLY
      'ORDERS_READ',          // Read sales/order data - READ ONLY
      'MERCHANT_PROFILE_READ' // Read merchant/location information - READ ONLY
    ],
    
    // Redirect URI must match exactly what's registered in Square dashboard
    redirectUri: process.env.SQUARE_OAUTH_REDIRECT_URI || `${settings.baseUrl}/api/pos/square/callback`
  },
  
  // Webhook configuration
  webhook: {
    signatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || null,
    
    // Events we want to receive from Square
    // Progress Note: Subscribe only to events we'll actually process
    events: [
      'catalog.version.updated',   // Item definitions changed
      'inventory.count.updated',   // Inventory quantities changed
      'order.created',             // New sale recorded
      'order.updated'              // Sale modified
    ]
  },
  
  // API configuration
  api: {
    // API version - Square uses dated versions
    version: '2024-01-18',
    
    // Rate limiting (Square: 100 requests per 10 seconds per access token)
    // Progress Note: We implement conservative limits to avoid hitting Square's limits
    rateLimit: {
      requests: 80,      // Max requests per window (buffer below Square's 100)
      windowMs: 10000    // Time window in milliseconds
    },
    
    // Retry configuration for transient failures
    retry: {
      maxAttempts: 3,
      backoffMs: 1000,  // Initial backoff, doubles each retry
      retryableStatusCodes: [429, 500, 502, 503, 504]
    }
  },
  
  // Sync configuration
  sync: {
    // How far back to sync on initial connection
    initialSyncDays: 30,
    
    // Batch size for paginated requests
    batchSize: 100,
    
    // Whether to enable real-time webhook sync
    enableWebhooks: process.env.SQUARE_WEBHOOKS_ENABLED !== 'false' // Default true
  }
};

/**
 * Toast POS Configuration
 * 
 * Progress Note: Toast adapter is stubbed for Issue #15
 * Configuration structure prepared for future implementation
 * 
 * Toast uses different OAuth flow and API structure than Square
 * When implementing: refer to Toast Partner API docs
 */
export const toastConfig = {
  // Application credentials (to be configured when Toast integration is implemented)
  clientId: process.env.TOAST_CLIENT_ID || null,
  clientSecret: process.env.TOAST_CLIENT_SECRET || null,
  
  // Environment
  environment: process.env.TOAST_ENVIRONMENT || 'sandbox',
  
  // OAuth configuration (placeholder)
  oauth: {
    clientId: process.env.TOAST_OAUTH_CLIENT_ID || process.env.TOAST_CLIENT_ID || null,
    clientSecret: process.env.TOAST_OAUTH_CLIENT_SECRET || process.env.TOAST_CLIENT_SECRET || null,
    // Progress Note: When implementing, request READ ONLY scopes
    // We never write data back to Toast POS - one-way sync only
    scopes: [], // To be determined based on Toast API docs (READ permissions only)
    redirectUri: process.env.TOAST_OAUTH_REDIRECT_URI || `${settings.baseUrl}/api/pos/toast/callback`
  },
  
  // Webhook configuration (placeholder)
  webhook: {
    signatureKey: process.env.TOAST_WEBHOOK_SIGNATURE_KEY || null,
    events: []
  },
  
  // API configuration (placeholder)
  api: {
    version: 'v1',
    rateLimit: {
      requests: 50,
      windowMs: 10000
    },
    retry: {
      maxAttempts: 3,
      backoffMs: 1000,
      retryableStatusCodes: [429, 500, 502, 503, 504]
    }
  },
  
  // Sync configuration (placeholder)
  sync: {
    initialSyncDays: 30,
    batchSize: 50,
    enableWebhooks: process.env.TOAST_WEBHOOKS_ENABLED !== 'false'
  }
};

/**
 * Validate provider configuration
 * 
 * Progress Note: Configuration validation prevents runtime errors
 * Should be called during adapter initialization
 * 
 * @param {string} provider - Provider name ('square' or 'toast')
 * @param {Object} config - Configuration to validate
 * @param {boolean} [strict=true] - Whether to require all fields (false for development)
 * @returns {{valid: boolean, errors: Array<string>}} Validation result
 */
export function validateProviderConfig(provider, config, strict = true) {
  const errors = [];
  
  // In development mode with strict=false, allow missing credentials
  // Progress Note: This lets developers run tests without full POS account setup
  if (!strict && settings.env !== 'production') {
    logger.warn(`Provider ${provider} config validation running in non-strict mode`);
    return { valid: true, errors: [] };
  }
  
  // Provider-specific validation
  if (provider === 'square') {
    if (!config.applicationId) {
      errors.push('SQUARE_APPLICATION_ID is required');
    }
    if (!config.oauth.clientId) {
      errors.push('SQUARE_OAUTH_CLIENT_ID is required');
    }
    if (!config.oauth.clientSecret) {
      errors.push('SQUARE_OAUTH_CLIENT_SECRET is required');
    }
    if (!config.oauth.redirectUri) {
      errors.push('SQUARE_OAUTH_REDIRECT_URI is required');
    }
    if (!['sandbox', 'production'].includes(config.environment)) {
      errors.push('SQUARE_ENVIRONMENT must be "sandbox" or "production"');
    }
    // Webhook signature key is optional - only needed if webhooks are enabled
    if (config.sync.enableWebhooks && !config.webhook.signatureKey) {
      logger.warn('Square webhooks enabled but SQUARE_WEBHOOK_SIGNATURE_KEY not set');
    }
  }
  
  if (provider === 'toast') {
    // Progress Note: Toast validation will be implemented when Toast adapter is built
    if (strict) {
      errors.push('Toast POS integration is not yet implemented');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get configuration for a specific provider
 * 
 * Progress Note: Factory method for retrieving validated config
 * 
 * @param {string} provider - Provider name ('square' or 'toast')
 * @returns {Object|null} Provider configuration or null if not found
 */
export function getProviderConfig(provider) {
  const configs = {
    square: squareConfig,
    toast: toastConfig
  };
  
  return configs[provider] || null;
}

/**
 * Get list of all configured providers
 * 
 * Progress Note: Returns only providers that have basic config present
 * Useful for POSAdapterFactory to know which adapters to initialize
 * 
 * @param {boolean} [requireValid=false] - Whether to only return fully validated providers
 * @returns {Array<string>} List of provider names
 */
export function getConfiguredProviders(requireValid = false) {
  const providers = [];
  
  // Check Square
  if (squareConfig.applicationId || !requireValid) {
    if (!requireValid || validateProviderConfig('square', squareConfig, false).valid) {
      providers.push('square');
    }
  }
  
  // Check Toast
  if (toastConfig.clientId || !requireValid) {
    if (!requireValid || validateProviderConfig('toast', toastConfig, false).valid) {
      providers.push('toast');
    }
  }
  
  return providers;
}

/**
 * Log configuration status (without exposing secrets)
 * 
 * Progress Note: Safe logging for debugging configuration issues
 * Never logs actual secrets - only their presence/absence
 */
export function logConfigStatus() {
  logger.info('POS Provider Configuration Status:', {
    square: {
      environment: squareConfig.environment,
      hasApplicationId: !!squareConfig.applicationId,
      hasOAuthClientId: !!squareConfig.oauth.clientId,
      hasOAuthClientSecret: !!squareConfig.oauth.clientSecret,
      hasWebhookKey: !!squareConfig.webhook.signatureKey,
      redirectUri: squareConfig.oauth.redirectUri,
      webhooksEnabled: squareConfig.sync.enableWebhooks
    },
    toast: {
      environment: toastConfig.environment,
      hasClientId: !!toastConfig.clientId,
      hasClientSecret: !!toastConfig.clientSecret,
      implementation: 'STUB - Not yet implemented'
    }
  });
}

// Export all config objects and utility functions
export default {
  square: squareConfig,
  toast: toastConfig,
  validate: validateProviderConfig,
  getConfig: getProviderConfig,
  getConfiguredProviders,
  logStatus: logConfigStatus
};
