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

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: process.env.NODE_ENV === 'production' ? {
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