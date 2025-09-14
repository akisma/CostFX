import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Sequelize } from 'sequelize';
import logger from '../utils/logger.js';

// Load .env from the root directory (parent of backend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');
dotenv.config({ path: join(rootDir, '.env') });

// Check if DATABASE_URL is available after loading dotenv
if (!process.env.DATABASE_URL) {
  logger.error('❌ DATABASE_URL environment variable is not set');
  logger.error('   Make sure you have a .env file with DATABASE_URL configured');
  process.exit(1);
}

// Determine if SSL is required (robust across envs)
function shouldUseSSL(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const host = url.hostname || '';
    const qs = url.searchParams;

    // Explicit flags take precedence
    if ((process.env.DB_SSL || '').toLowerCase() === 'true') return true;
    if ((process.env.PGSSLMODE || '').toLowerCase() === 'require') return true;
    if (qs.get('ssl') === 'true') return true;
    if ((qs.get('sslmode') || '').toLowerCase() === 'require') return true;

    // RDS commonly requires SSL; match common host patterns
    if (/rds\.amazonaws\.com$/.test(host)) return true;
  } catch (e) {
    // If URL parsing fails, fall back to NODE_ENV heuristic
    logger.warn('⚠️ Failed to parse DATABASE_URL for SSL detection, falling back to NODE_ENV check');
  }
  return process.env.NODE_ENV === 'production';
}

const useSSL = shouldUseSSL(process.env.DATABASE_URL);
logger.info(`📦 Database SSL ${useSSL ? 'enabled' : 'disabled'}`, {
  nodeEnv: process.env.NODE_ENV,
  host: (() => { try { return new URL(process.env.DATABASE_URL).hostname; } catch { return 'unknown'; } })()
});

// Build a safe connection URL; when SSL is used, prefer sslmode=no-verify to avoid CA issues in dev
let connectionUrl = process.env.DATABASE_URL;
try {
  const u = new URL(process.env.DATABASE_URL);
  if (useSSL) {
    // Remove any conflicting ssl params and enforce sslmode=no-verify
    u.searchParams.delete('ssl');
    u.searchParams.set('sslmode', 'no-verify');
    connectionUrl = u.toString();
    // Also hint pg via env (redundant, but harmless)
    process.env.PGSSLMODE = 'no-verify';
  }
} catch (e) {
  logger.warn('⚠️ Failed to normalize DATABASE_URL, using raw value');
}

const sequelize = new Sequelize(connectionUrl, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: useSSL ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {}
});

export async function connectDB() {
  try {
    await sequelize.authenticate();
    logger.info('✅ Database connection established successfully');
    
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('📊 Database synchronized');
    }
  } catch (error) {
    logger.error('❌ Unable to connect to database:', error);
    throw error;
  }
}

export { sequelize };
export default sequelize;