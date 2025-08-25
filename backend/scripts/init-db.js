import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Sequelize, DataTypes } from 'sequelize';
import winston from 'winston';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the root directory (two levels up from scripts/)
const rootDir = join(__dirname, '../../');
const envPath = join(rootDir, '.env');
config({ path: envPath });

// Setup logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Check if DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  logger.error('❌ DATABASE_URL environment variable is not set');
  logger.error(`   Looking for .env file in: ${envPath}`);
  logger.error('   Make sure you have a .env file with DATABASE_URL configured');
  process.exit(1);
}

logger.info(`📁 Loaded environment from: ${envPath}`);
logger.info(`🔗 Connecting to database...`);

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
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

// Define Restaurant model directly in this script
const Restaurant = sequelize.define('Restaurant', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  location: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  cuisineType: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'cuisine_type'
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      is: /^[\+]?[1-9][\d]{0,15}$/i
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  settings: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
    validate: {
      isValidSettings(value) {
        if (typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('Settings must be an object');
        }
      }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  sequelize,
  modelName: 'Restaurant',
  tableName: 'restaurants',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['name']
    },
    {
      fields: ['is_active']
    }
  ]
});

async function initializeDatabase() {
  try {
    logger.info('🔄 Initializing database...');
    
    // Test database connection
    await sequelize.authenticate();
    logger.info('✅ Database connection established successfully');

    // Create tables (force: false means don't drop existing tables)
    await sequelize.sync({ force: false });
    logger.info('📊 Database tables synchronized successfully');

    await sequelize.close();
    logger.info('✅ Database initialization complete');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Unable to initialize database:', error.message);
    if (error.code === 'ECONNREFUSED') {
      logger.error('   Make sure PostgreSQL is running (try: npm run docker:up)');
    }
    if (error.code === 'ENOTFOUND') {
      logger.error('   Check your DATABASE_URL in the .env file');
    }
    process.exit(1);
  }
}

initializeDatabase();