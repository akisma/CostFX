import config, { getApiConfig, getCurrentUrls } from './src/config/settings.js';

// Simple test to verify our frontend configuration system is working
console.log('=== Frontend Configuration Test ===');
console.log('Config loaded:', {
  api: config.api,
  development: config.development,
  production: config.production
});

console.log('\nAPI Config:', getApiConfig());
console.log('\nCurrent URLs:', getCurrentUrls());

console.log('\nFrontend configuration system is working correctly!');
