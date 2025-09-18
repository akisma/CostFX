import settings from './src/config/settings.js';
import logger from './src/utils/logger.js';

// Simple test to verify our configuration system is working
console.log('=== Configuration Test ===');
console.log('Settings loaded:', {
  port: settings.port,
  nodeEnv: settings.nodeEnv,
  baseUrl: settings.baseUrl,
  apiPath: settings.apiPath,
  corsOrigins: settings.corsOrigins,
  frontendUrl: settings.frontendUrl
});

logger.info('Configuration system is working correctly!');
logger.info(`Would start server on port ${settings.port}`);
logger.info(`API would be available at ${settings.baseUrl}${settings.apiPath}`);
logger.info(`CORS origins configured: ${settings.corsOrigins.join(', ')}`);
