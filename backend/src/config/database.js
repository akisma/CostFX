import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Sequelize } from 'sequelize';
import env from 'env-var';
import logger from '../utils/logger.js';

// Load .env from the root directory (parent of backend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');
dotenv.config({ path: join(rootDir, '.env') });

// Validate and get environment variables with proper types and defaults
const dbConfig = {
  url: env.get('DATABASE_URL').required().asUrlString(),
  host: env.get('DB_HOST').default('localhost').asString(),
  port: env.get('DB_PORT').default(5432).asPortNumber(),
  database: env.get('POSTGRES_DB').default('restaurant_ai').asString(),
  username: env.get('POSTGRES_USER').default('postgres').asString(),
  password: env.get('POSTGRES_PASSWORD').required().asString(),
  ssl: env.get('DB_SSL').default('false').asBool(),
  sslMode: env.get('PGSSLMODE').default('disable').asEnum(['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full']),
  pool: {
    min: env.get('DB_POOL_MIN').default(2).asIntPositive(),
    max: env.get('DB_POOL_MAX').default(10).asIntPositive(),
    acquire: env.get('DB_POOL_ACQUIRE_TIMEOUT').default(60000).asIntPositive(),
    idle: env.get('DB_POOL_IDLE_TIMEOUT').default(30000).asIntPositive()
  }
};

// Environment-specific settings
const nodeEnv = env.get('NODE_ENV').default('development').asEnum(['development', 'test', 'production']);
const isProduction = nodeEnv === 'production';
const isDevelopment = nodeEnv === 'development';

// Determine SSL configuration based on environment and explicit settings
function configureSSL() {
  // Explicit SSL configuration takes precedence
  if (dbConfig.ssl || dbConfig.sslMode === 'require') {
    logger.info('📦 Database SSL enabled', { 
      nodeEnv, 
      sslMode: dbConfig.sslMode,
      host: getHostFromUrl(dbConfig.url)
    });
    return true;
  }

  // Check if host requires SSL (AWS RDS, managed services)
  const host = getHostFromUrl(dbConfig.url);
  if (host && /rds\.amazonaws\.com$/.test(host)) {
    logger.info('📦 Database SSL enabled (AWS RDS detected)', { nodeEnv, host });
    return true;
  }

  // Production defaults to SSL unless explicitly disabled
  if (isProduction && dbConfig.sslMode !== 'disable') {
    logger.info('📦 Database SSL enabled (production environment)', { nodeEnv });
    return true;
  }

  logger.info('📦 Database SSL disabled', { nodeEnv, host });
  return false;
}

function getHostFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    logger.warn('⚠️ Failed to parse DATABASE_URL hostname');
    return 'unknown';
  }
}

const useSSL = configureSSL();

// Build connection URL with proper SSL configuration
let connectionUrl = dbConfig.url;
try {
  const u = new URL(dbConfig.url);
  if (useSSL) {
    // Remove any conflicting ssl params and set appropriate SSL mode
    u.searchParams.delete('ssl');
    u.searchParams.set('sslmode', isProduction ? 'require' : 'no-verify');
    connectionUrl = u.toString();
  } else {
    // Ensure SSL is disabled
    u.searchParams.set('sslmode', 'disable');
    connectionUrl = u.toString();
  }
} catch (e) {
  logger.warn('⚠️ Failed to normalize DATABASE_URL, using raw value');
}

// Create Sequelize instance with environment-appropriate configuration
const sequelize = new Sequelize(connectionUrl, {
  dialect: 'postgres',
  logging: isDevelopment ? (msg) => logger.debug(msg) : false,
  pool: {
    max: dbConfig.pool.max,
    min: dbConfig.pool.min,
    acquire: dbConfig.pool.acquire,
    idle: dbConfig.pool.idle
  },
  dialectOptions: useSSL ? {
    ssl: {
      require: true,
      rejectUnauthorized: !isProduction // Allow self-signed certs in non-prod
    }
  } : {},
  // Enhanced retry and connection options
  retry: {
    max: isProduction ? 5 : 3,
    backoffBase: 1000,
    backoffExponent: 2
  },
  define: {
    // Use camelCase for attributes but snake_case for database
    underscored: true,
    // Timestamp fields
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

export async function connectDB() {
  try {
    logger.info('🔌 Attempting database connection...', {
      host: getHostFromUrl(dbConfig.url),
      database: dbConfig.database,
      ssl: useSSL,
      environment: nodeEnv
    });

    await sequelize.authenticate();
    logger.info('✅ Database connection established successfully');
    
    // Only sync in development, use migrations in production
    if (isDevelopment) {
      await sequelize.sync({ alter: true });
      logger.info('📊 Database synchronized (development mode)');
    } else {
      logger.info('📊 Database ready (production mode - use migrations)');
    }

    return sequelize;
  } catch (error) {
    logger.error('❌ Unable to connect to database:', {
      error: error.message,
      code: error.original?.code,
      host: getHostFromUrl(dbConfig.url),
      ssl: useSSL
    });
    
    // Provide helpful error messages for common issues
    if (error.original?.code === 'ECONNREFUSED') {
      logger.error('💡 Database connection refused. Check:');
      logger.error('   1. PostgreSQL is running on the specified host/port');
      logger.error('   2. Database credentials are correct');
      logger.error('   3. Network connectivity to database host');
      logger.error('   4. For local development: run `docker-compose up db`');
    }
    
    throw error;
  }
}

// Export configuration for use in other modules
export { sequelize, dbConfig, nodeEnv, isDevelopment, isProduction };
export default sequelize;