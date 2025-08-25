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

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false, // Disable SQL logging for seed script
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
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
      // More flexible phone validation that accepts common formats
      isValidPhone(value) {
        if (value && !/^[\+]?[\d\-\(\)\s\.]{7,20}$/.test(value)) {
          throw new Error('Phone number must be a valid format');
        }
      }
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

async function seedDatabase() {
  try {
    logger.info('🌱 Starting database seed...');
    
    // Test database connection
    await sequelize.authenticate();
    logger.info('✅ Database connection established');

    // Check if data already exists
    const existingRestaurants = await Restaurant.count();
    
    if (existingRestaurants > 0) {
      logger.info('🌱 Database already has data, skipping seed');
      await sequelize.close();
      process.exit(0);
    }

    // Create sample restaurant with a valid phone number
    const sampleRestaurant = await Restaurant.create({
      name: 'Demo Restaurant',
      location: '123 Main St, Anytown, USA',
      cuisineType: 'American',
      phone: '15550123456', // Simple format that matches validation
      email: 'demo@restaurant.com',
      settings: {
        currency: 'USD',
        timezone: 'America/New_York',
        defaultWastePercentage: 5.0,
        targetFoodCostPercentage: 30.0
      }
    });

    logger.info('🌱 Sample data created successfully');
    logger.info(`   Restaurant: ${sampleRestaurant.name} (ID: ${sampleRestaurant.id})`);

    await sequelize.close();
    logger.info('✅ Database seed complete');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Unable to seed database:', error.message);
    if (error.code === 'ECONNREFUSED') {
      logger.error('   Make sure PostgreSQL is running (try: npm run docker:up)');
    }
    if (error.code === 'ENOTFOUND') {
      logger.error('   Check your DATABASE_URL in the .env file');
    }
    
    // Show validation errors more clearly
    if (error.name === 'SequelizeValidationError') {
      logger.error('   Validation errors:');
      error.errors.forEach(err => {
        logger.error(`   - ${err.path}: ${err.message} (value: "${err.value}")`);
      });
    }
    
    await sequelize.close();
    process.exit(1);
  }
}

seedDatabase();