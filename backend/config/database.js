const dotenv = require('dotenv');
const path = require('path');

// Load .env file from the project root
const rootDir = path.join(__dirname, '../');
dotenv.config({ path: path.join(rootDir, '.env') });

const config = {
  development: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    migrationStorageTableName: 'sequelize_meta',
    seederStorageTableName: 'sequelize_data'
  },
  test: {
    url: process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/restaurant_ai_test',
    dialect: 'postgres',
    logging: false,
    migrationStorageTableName: 'sequelize_meta',
    seederStorageTableName: 'sequelize_data'
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    migrationStorageTableName: 'sequelize_meta',
    seederStorageTableName: 'sequelize_data',
    logging: false
  }
};

module.exports = config;
