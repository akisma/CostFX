const settings = {
  // Server
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`,
  apiPath: '/api/v1',
  
  // CORS allowed origins
  corsOrigins: [
    'http://localhost:3000',  // Frontend dev server
    'http://localhost:3001',  // Backend dev server 
    'http://localhost:3002',  // Docker dev server
    process.env.FRONTEND_URL
  ].filter(Boolean),

  // Database
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL, // No default - only use if explicitly set

  // Authentication
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // AI Services
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1
  },

  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
    indexName: process.env.PINECONE_INDEX_NAME || 'restaurant-ai'
  },

  // File Uploads
  uploads: {
    csv: {
      maxFileSizeBytes: parseInt(process.env.CSV_UPLOAD_MAX_BYTES, 10) || 10 * 1024 * 1024, // 10 MB default
      allowedMimeTypes: (process.env.CSV_UPLOAD_ALLOWED_MIME_TYPES || 'text/csv,application/vnd.ms-excel')
        .split(',')
        .map(type => type.trim())
        .filter(Boolean),
      allowedExtensions: (process.env.CSV_UPLOAD_ALLOWED_EXTENSIONS || '.csv')
        .split(',')
        .map(ext => ext.trim().toLowerCase())
        .filter(Boolean)
    }
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Cache TTL (seconds)
  cache: {
    defaultTtl: 3600, // 1 hour
    shortTtl: 300,    // 5 minutes
    longTtl: 86400    // 24 hours
  },

  // Business Logic Defaults
  business: {
    defaultWastePercentage: 0.05, // 5%
    defaultOverheadPercentage: 0.15, // 15%
    defaultFoodCostTarget: 0.30, // 30%
    inventoryReorderDays: 3, // Days ahead to suggest reordering
    wasteAlertThreshold: 0.10 // Alert if waste exceeds 10%
  }
};

// Validate required environment variables in production
if (settings.nodeEnv === 'production') {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'OPENAI_API_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

export default settings;