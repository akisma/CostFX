/**
 * Frontend Configuration Settings
 * Centralized configuration for all frontend URLs, ports, and environment settings
 */

const config = {
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
    timeout: 10000,
    retries: 3
  },

  // Development URLs
  development: {
    frontendPort: 3000,
    backendPort: 3001,
    frontendUrl: 'http://localhost:3000',
    backendUrl: 'http://localhost:3001',
    apiUrl: 'http://localhost:3001/api/v1'
  },

  // Production URLs (from environment variables)
  production: {
    frontendUrl: import.meta.env.VITE_FRONTEND_URL,
    backendUrl: import.meta.env.VITE_BACKEND_URL,
    apiUrl: import.meta.env.VITE_API_URL
  },

  // Feature flags
  features: {
    enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    enableDebugLogs: import.meta.env.VITE_DEBUG === 'true' || import.meta.env.NODE_ENV === 'development'
  },

  // UI Configuration
  ui: {
    defaultPageSize: 20,
    maxFileUploadSize: 10 * 1024 * 1024, // 10MB
    debounceDelay: 300, // ms
    toast: {
      duration: 5000,
      position: 'top-right'
    }
  },

  // Chart defaults
  charts: {
    colors: {
      primary: '#3B82F6',
      secondary: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#6366F1'
    },
    animation: {
      duration: 300
    }
  }
};

// Helper function to get current environment URLs
export function getCurrentUrls() {
  const isDevelopment = import.meta.env.NODE_ENV === 'development';
  return isDevelopment ? config.development : config.production;
}

// Helper function to get API configuration
export function getApiConfig() {
  return {
    baseURL: config.api.baseUrl,
    timeout: config.api.timeout,
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

export default config;
