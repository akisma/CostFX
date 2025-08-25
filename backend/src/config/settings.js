const settings = {
  // Server
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Database
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Authentication
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
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