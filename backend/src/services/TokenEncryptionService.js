/**
 * Token Encryption Service
 * 
 * Provides AES-256-GCM authenticated encryption for POS OAuth tokens.
 * This is a CRITICAL security component that ensures tokens are never
 * stored in plaintext in the database.
 * 
 * Security Design Decisions:
 * 1. AES-256-GCM chosen for authenticated encryption (prevents tampering)
 * 2. Unique IV (initialization vector) per encryption operation
 * 3. Authentication tag validates data integrity during decryption
 * 4. Encryption key stored separately from data (AWS Secrets Manager in prod)
 * 
 * Key Storage Strategy:
 * - Production: AWS Secrets Manager (secure, rotatable)
 * - Development: Environment variable (convenient for local dev)
 * - Never: Hardcoded in source code
 * 
 * Format: iv:authTag:ciphertext (all hex-encoded, colon-separated)
 * 
 * Progress Note: Implementing secure token storage per Square best practices
 * Created: 2025-10-04
 */

import crypto from 'crypto';
import settings from '../config/settings.js';
import logger from '../utils/logger.js';

class TokenEncryptionService {
  constructor() {
    // AES-256-GCM requires 256-bit (32-byte) key
    this.algorithm = 'aes-256-gcm';
    this.encryptionKey = this.getEncryptionKey();
    
    logger.info('[TokenEncryptionService] Initialized with AES-256-GCM encryption');
  }

  /**
   * Get encryption key from environment
   * 
   * Production: Requires TOKEN_ENCRYPTION_KEY environment variable
   * Development: Falls back to deterministic key (NOT FOR PRODUCTION)
   * 
   * Key format: Base64-encoded 32-byte key
   * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   */
  getEncryptionKey() {
    const key = process.env.TOKEN_ENCRYPTION_KEY;
    
    // Production MUST have encryption key set
    if (!key) {
      if (settings.nodeEnv === 'production') {
        throw new Error(
          'TOKEN_ENCRYPTION_KEY required in production. ' +
          'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
        );
      }
      
      // Development fallback - INSECURE but convenient for local testing
      // This key is intentionally weak for development only
      logger.warn(
        '[TokenEncryptionService] Using development encryption key. ' +
        'Set TOKEN_ENCRYPTION_KEY for production use.'
      );
      return crypto.scryptSync('dev-key-not-for-production', 'salt', 32);
    }
    
    // Decode base64 key to Buffer
    return Buffer.from(key, 'base64');
  }

  /**
   * Encrypt a token using AES-256-GCM
   * 
   * Process:
   * 1. Generate random 16-byte IV (initialization vector)
   * 2. Create cipher with algorithm, key, and IV
   * 3. Encrypt plaintext
   * 4. Extract authentication tag for integrity verification
   * 5. Return formatted string: iv:authTag:ciphertext
   * 
   * @param {string} plaintext - The token to encrypt
   * @returns {string|null} Encrypted token or null if input is empty
   * 
   * Progress Note: Each encryption gets unique IV for security
   */
  encrypt(plaintext) {
    if (!plaintext) {
      return null; // Handle null/undefined tokens gracefully
    }

    try {
      // Generate random IV for this encryption operation
      // IV can be public but must be unique per encryption
      const iv = crypto.randomBytes(16);
      
      // Create cipher instance
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      // Encrypt the plaintext
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag for GCM mode
      // This ensures data hasn't been tampered with
      const authTag = cipher.getAuthTag();
      
      // Return all components as colon-separated hex strings
      // Format: iv:authTag:ciphertext
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
    } catch (error) {
      logger.error('[TokenEncryptionService] Encryption failed', { error: error.message });
      throw new Error('Token encryption failed');
    }
  }

  /**
   * Decrypt a token using AES-256-GCM
   * 
   * Process:
   * 1. Parse iv:authTag:ciphertext format
   * 2. Create decipher with algorithm, key, and IV
   * 3. Set authentication tag for verification
   * 4. Decrypt and verify integrity
   * 5. Return plaintext
   * 
   * @param {string} ciphertext - The encrypted token (iv:authTag:ciphertext format)
   * @returns {string|null} Decrypted token or null if input is empty
   * @throws {Error} If format is invalid or authentication fails
   * 
   * Progress Note: Auth tag verification prevents tampered tokens from decrypting
   */
  decrypt(ciphertext) {
    if (!ciphertext) {
      return null; // Handle null/undefined tokens gracefully
    }

    try {
      // Parse the colon-separated format
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted token format. Expected iv:authTag:ciphertext');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      // Create decipher instance
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      
      // Set authentication tag - this will cause decryption to fail if tampered
      decipher.setAuthTag(authTag);
      
      // Decrypt the ciphertext
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      logger.error('[TokenEncryptionService] Decryption failed', { 
        error: error.message,
        // Never log the actual ciphertext - could be sensitive
      });
      throw new Error('Token decryption failed. Token may be corrupted or tampered with.');
    }
  }

  /**
   * Verify encryption key is properly configured
   * 
   * Used during application startup to catch configuration issues early
   * 
   * @returns {boolean} True if key is valid
   */
  verifyKeyConfiguration() {
    try {
      // Test encryption/decryption cycle
      const testData = 'test-token-verification';
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);
      
      if (decrypted !== testData) {
        throw new Error('Encryption verification failed - decrypted data does not match');
      }
      
      logger.info('[TokenEncryptionService] Encryption key verified successfully');
      return true;
      
    } catch (error) {
      logger.error('[TokenEncryptionService] Encryption key verification failed', {
        error: error.message
      });
      return false;
    }
  }
}

// Export singleton instance
// This ensures we only have one encryption key loaded in memory
export default new TokenEncryptionService();

/**
 * Progress Note: Token encryption complete
 * 
 * Security features implemented:
 * ✅ AES-256-GCM authenticated encryption
 * ✅ Unique IV per encryption
 * ✅ Authentication tag verification
 * ✅ Production key requirement
 * ✅ Development fallback
 * ✅ Comprehensive error handling
 * 
 * Next: OAuthStateService for CSRF protection
 */
